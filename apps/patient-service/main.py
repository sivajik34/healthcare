import asyncio
import json
import os
import uuid
from typing import List
import contextlib

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from event_store import init_event_store, append_event
from read_model import init_read_model, upsert_patient, list_patients


KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:29092")
PATIENT_TOPIC = "patient.events"

producer: AIOKafkaProducer | None = None
consumer_task: asyncio.Task | None = None

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


class PatientCreate(BaseModel):
    name: str
    dob: str  # ISO date


class PatientView(BaseModel):
    id: str
    name: str
    dob: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_event_store()
    init_read_model()
    global producer, consumer_task
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP)
    await producer.start()
    consumer_task = asyncio.create_task(consume_events())
    try:
        yield
    finally:
        if consumer_task:
            consumer_task.cancel()
            with contextlib.suppress(Exception):
                await consumer_task
        if producer:
            await producer.stop()


app = FastAPI(title="Patient Service", openapi_url="/patients/openapi.json", docs_url="/patients/docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def require_user(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        return str(sub)
    except JWTError:
        raise credentials_exception


@app.post("/patients/patients", response_model=PatientView)
async def create_patient(payload: PatientCreate, user: str = Depends(require_user)):
    patient_id = str(uuid.uuid4())
    event = {
        "type": "PatientCreated",
        "aggregate_id": patient_id,
        "data": {"id": patient_id, "name": payload.name, "dob": payload.dob},
    }
    append_event(patient_id, event["type"], event["data"], version=1)
    await producer.send_and_wait(PATIENT_TOPIC, json.dumps(event).encode("utf-8"))
    # Optimistic immediate projection for better UX (eventual consistency remains)
    upsert_patient(patient_id, payload.name, payload.dob)
    return PatientView(id=patient_id, name=payload.name, dob=payload.dob)


@app.get("/patients/patients", response_model=List[PatientView])
async def get_patients(user: str = Depends(require_user)):
    return [PatientView(**p) for p in list_patients()]

async def consume_events():
    consumer = AIOKafkaConsumer(
        PATIENT_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id="patient-read-model",
        enable_auto_commit=True,
    )
    await consumer.start()
    try:
        async for msg in consumer:
            event = json.loads(msg.value.decode("utf-8"))
            if event.get("type") == "PatientCreated":
                data = event["data"]
                upsert_patient(data["id"], data["name"], data["dob"])
    finally:
        await consumer.stop()



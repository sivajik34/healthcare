import json
import os
import uuid
from typing import List

from aiokafka import AIOKafkaProducer
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:29092")
APPT_TOPIC = "appointment.events"

producer: AIOKafkaProducer | None = None


class AppointmentCreate(BaseModel):
    patient_id: str
    datetime: str
    reason: str


class AppointmentView(BaseModel):
    id: str
    patient_id: str
    datetime: str
    reason: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP)
    await producer.start()
    try:
        yield
    finally:
        if producer:
            await producer.stop()


app = FastAPI(title="Appointment Service", openapi_url="/appointments/openapi.json", docs_url="/appointments/docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/appointments", response_model=AppointmentView)
async def create_appointment(payload: AppointmentCreate):
    appt_id = str(uuid.uuid4())
    view = AppointmentView(id=appt_id, patient_id=payload.patient_id, datetime=payload.datetime, reason=payload.reason)
    event = {"type": "AppointmentCreated", "data": view.model_dump()}
    await producer.send_and_wait(APPT_TOPIC, json.dumps(event).encode("utf-8"))
    return view


@app.get("/appointments", response_model=List[AppointmentView])
async def list_appointments():
    # In a real system this would query a read model. Kept in-memory for scaffold simplicity.
    return []



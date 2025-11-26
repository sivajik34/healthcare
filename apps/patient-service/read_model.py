from sqlalchemy import Column, Integer, String, DateTime, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import List, Dict, Any
import os

DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "appdb")
DB_USER = os.getenv("POSTGRES_USER", "app")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "app")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class PatientRead(Base):
    __tablename__ = "patients_read"
    id = Column(String(64), primary_key=True)
    name = Column(String(200), nullable=False)
    dob = Column(String(20), nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))


def init_read_model():
    Base.metadata.create_all(bind=engine)


def upsert_patient(patient_id: str, name: str, dob: str):
    session = SessionLocal()
    try:
        obj = session.get(PatientRead, patient_id)
        if not obj:
            obj = PatientRead(id=patient_id, name=name, dob=dob)
            session.add(obj)
        else:
            obj.name = name
            obj.dob = dob
        session.commit()
    finally:
        session.close()


def list_patients() -> List[Dict[str, Any]]:
    session = SessionLocal()
    try:
        rows = session.query(PatientRead).all()
        return [{"id": r.id, "name": r.name, "dob": r.dob} for r in rows]
    finally:
        session.close()



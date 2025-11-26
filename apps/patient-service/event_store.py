from datetime import datetime
from typing import Any, Dict
from sqlalchemy import Column, Integer, String, DateTime, JSON, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
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


class Event(Base):
    __tablename__ = "patient_events"
    id = Column(Integer, primary_key=True)
    aggregate_id = Column(String(64), index=True, nullable=False)  # patient_id
    type = Column(String(100), nullable=False)
    data = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))


def init_event_store():
    Base.metadata.create_all(bind=engine)


def append_event(aggregate_id: str, event_type: str, data: Dict[str, Any], version: int = 1) -> Event:
    session = SessionLocal()
    try:
        event = Event(aggregate_id=aggregate_id, type=event_type, data=data, version=version)
        session.add(event)
        session.commit()
        session.refresh(event)
        return event
    finally:
        session.close()



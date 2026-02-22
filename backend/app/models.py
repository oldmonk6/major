import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, String, Integer, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .database import Base


def uuid4_str() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plans: Mapped[List["Plan"]] = relationship(back_populates="user")
    coach_sessions: Mapped[List["CoachSession"]] = relationship(back_populates="user")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    plan_json: Mapped[Dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="plans")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    plan_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("plans.id"), nullable=True)
    day_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String)
    details_json: Mapped[Dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="pending")
    xp: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Checkin(Base):
    __tablename__ = "checkins"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    craving: Mapped[int] = mapped_column(Integer)
    mood: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    triggers: Mapped[List[str]] = mapped_column(JSON)
    urge: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Journal(Base):
    __tablename__ = "journals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    encrypted_url: Mapped[str] = mapped_column(Text)
    emotion_tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(384), nullable=True)


class VoiceEntry(Base):
    __tablename__ = "voice_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    journal_id: Mapped[str] = mapped_column(String, ForeignKey("journals.id"))
    blob_url: Mapped[str] = mapped_column(Text)
    transcript_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    score: Mapped[float] = mapped_column(Float)
    bucket: Mapped[str] = mapped_column(String)
    rationale: Mapped[str] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BanditEvent(Base):
    __tablename__ = "bandit_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    context_json: Mapped[Dict[str, Any]] = mapped_column(JSON)
    action_id: Mapped[str] = mapped_column(String)
    reward: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BanditActionStat(Base):
    __tablename__ = "bandit_action_stats"

    action_id: Mapped[str] = mapped_column(String, primary_key=True)
    pulls: Mapped[int] = mapped_column(Integer, default=0)
    reward_sum: Mapped[float] = mapped_column(Float, default=0.0)
    reward_avg: Mapped[float] = mapped_column(Float, default=0.0)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String)
    payload_json: Mapped[Dict[str, Any]] = mapped_column(JSON)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CoachSession(Base):
    __tablename__ = "coach_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String, default="New chat")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="coach_sessions")
    messages: Mapped[List["CoachMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("coach_sessions.id"))
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["CoachSession"] = relationship(back_populates="messages")

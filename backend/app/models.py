import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, String, Integer, DateTime, ForeignKey, Text, Float, UniqueConstraint
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
    emergency_plans: Mapped[List["EmergencyPlan"]] = relationship(back_populates="user")
    support_circle_members: Mapped[List["SupportCircleMember"]] = relationship(back_populates="user")
    slip_events: Mapped[List["SlipEvent"]] = relationship(back_populates="user")
    craving_logs: Mapped[List["CravingLog"]] = relationship(back_populates="user")
    community_groups_created: Mapped[List["CommunityGroup"]] = relationship(back_populates="creator")
    community_messages_sent: Mapped[List["CommunityMessage"]] = relationship(
        back_populates="sender",
        foreign_keys="CommunityMessage.sender_id",
    )
    community_messages_received: Mapped[List["CommunityMessage"]] = relationship(
        back_populates="recipient",
        foreign_keys="CommunityMessage.recipient_id",
    )


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


class CravingLog(Base):
    __tablename__ = "craving_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    intensity: Mapped[int] = mapped_column(Integer)
    mood: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    trigger: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    action_taken: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="craving_logs")


class SlipEvent(Base):
    __tablename__ = "slip_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    trigger: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    happened_before: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    safe_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_hour_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_day_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="slip_events")


class EmergencyPlan(Base):
    __tablename__ = "emergency_plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    triggers: Mapped[List[str]] = mapped_column(JSON, default=list)
    danger_hours: Mapped[List[str]] = mapped_column(JSON, default=list)
    contacts: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    safe_places: Mapped[List[str]] = mapped_column(JSON, default=list)
    replacement_actions: Mapped[List[str]] = mapped_column(JSON, default=list)
    reasons_to_quit: Mapped[List[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="emergency_plans")


class SupportCircleMember(Base):
    __tablename__ = "support_circle_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    relationship_label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="support_circle_members")


class UserFollow(Base):
    __tablename__ = "user_follows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    follower_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    following_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True)
    display_name: Mapped[str] = mapped_column(String)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialCommunity(Base):
    __tablename__ = "social_communities"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialCommunityMember(Base):
    __tablename__ = "social_community_members"
    __table_args__ = (
        UniqueConstraint("community_id", "user_id", name="uq_social_community_member"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    community_id: Mapped[str] = mapped_column(String, ForeignKey("social_communities.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String, default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialConversation(Base):
    __tablename__ = "social_conversations"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_social_conversation_pair"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_a_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    user_b_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialConversationMessage(Base):
    __tablename__ = "social_conversation_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("social_conversations.id"))
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialConversationReadState(Base):
    __tablename__ = "social_conversation_read_states"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_social_conversation_read_state"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("social_conversations.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    last_read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialCommunityMessage(Base):
    __tablename__ = "social_community_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    community_id: Mapped[str] = mapped_column(String, ForeignKey("social_communities.id"))
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CommunityGroup(Base):
    __tablename__ = "community_groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    creator: Mapped["User"] = relationship(back_populates="community_groups_created")
    members: Mapped[List["CommunityGroupMember"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )
    messages: Mapped[List["CommunityMessage"]] = relationship(back_populates="group")


class CommunityGroupMember(Base):
    __tablename__ = "community_group_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("community_groups.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    group: Mapped["CommunityGroup"] = relationship(back_populates="members")


class CommunityMessage(Base):
    __tablename__ = "community_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    recipient_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    group_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("community_groups.id"), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sender: Mapped["User"] = relationship(
        back_populates="community_messages_sent",
        foreign_keys=[sender_id],
    )
    recipient: Mapped[Optional["User"]] = relationship(
        back_populates="community_messages_received",
        foreign_keys=[recipient_id],
    )
    group: Mapped[Optional["CommunityGroup"]] = relationship(back_populates="messages")


class SocialFriendRequest(Base):
    __tablename__ = "social_friend_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    requester_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    addressee_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | accepted | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class SocialFriendship(Base):
    __tablename__ = "social_friendships"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    user_a_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    user_b_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialChat(Base):
    __tablename__ = "social_chats"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    kind: Mapped[str] = mapped_column(String, default="direct")  # direct | group
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialChatMember(Base):
    __tablename__ = "social_chat_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("social_chats.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String, default="member")  # owner | member
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SocialChatMessage(Base):
    __tablename__ = "social_chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid4_str)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("social_chats.id"))
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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

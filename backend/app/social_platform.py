from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import socketio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import SessionLocal, get_session
from .dependencies import get_current_user
from .models import (
    Checkin,
    CoachMessage,
    CoachSession,
    CravingLog,
    Journal,
    SlipEvent,
    SocialCommunity,
    SocialCommunityMember,
    SocialCommunityMessage,
    SocialConversation,
    SocialConversationMessage,
    SocialConversationReadState,
    User,
    UserFollow,
    UserProfile,
)
from .security import decode_token

router = APIRouter(prefix="/social", tags=["social"])
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)
_sid_user: Dict[str, str] = {}


def _display_name(user: Optional[User]) -> str:
    if not user:
        return "Member"
    email = (user.email or "").strip()
    if not email:
        return "Member"
    handle = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
    return handle.title() or "Member"


def _conversation_pair(user_id_1: str, user_id_2: str) -> Tuple[str, str]:
    return (user_id_1, user_id_2) if user_id_1 < user_id_2 else (user_id_2, user_id_1)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "community"


async def _ensure_profile(session: AsyncSession, user: User) -> UserProfile:
    profile = (await session.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalar_one_or_none()
    if profile:
        return profile
    base = re.sub(r"[^a-z0-9_]", "", (user.email or "member").split("@", 1)[0].lower()) or "member"
    candidate = base
    suffix = 1
    while (await session.execute(select(UserProfile).where(UserProfile.username == candidate))).scalar_one_or_none():
        suffix += 1
        candidate = f"{base}{suffix}"
    profile = UserProfile(user_id=user.id, username=candidate, display_name=_display_name(user))
    session.add(profile)
    await session.flush()
    return profile


def _compute_streak_days(active_dates: Set[date]) -> int:
    if not active_dates:
        return 0
    today = datetime.utcnow().date()
    cursor = today if today in active_dates else today - timedelta(days=1)
    if cursor not in active_dates:
        return 0
    streak = 0
    while cursor in active_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


async def _activity_stats_for_users(session: AsyncSession, user_ids: List[str]) -> Dict[str, Dict[str, int]]:
    unique_user_ids = list({user_id for user_id in user_ids if user_id})
    if not unique_user_ids:
        return {}
    dates_by_user: Dict[str, Set[date]] = {user_id: set() for user_id in unique_user_ids}
    queries = [
        select(Checkin.user_id, Checkin.ts).where(Checkin.user_id.in_(unique_user_ids)),
        select(CravingLog.user_id, CravingLog.ts).where(CravingLog.user_id.in_(unique_user_ids)),
        select(SlipEvent.user_id, SlipEvent.ts).where(SlipEvent.user_id.in_(unique_user_ids)),
        select(Journal.user_id, Journal.ts).where(Journal.user_id.in_(unique_user_ids)),
        select(CoachSession.user_id, CoachMessage.ts)
        .join(CoachMessage, CoachMessage.session_id == CoachSession.id)
        .where(CoachSession.user_id.in_(unique_user_ids)),
    ]
    for query in queries:
        for user_id, ts in (await session.execute(query)).all():
            if ts:
                dates_by_user.setdefault(user_id, set()).add(ts.date())
    return {
        user_id: {
            "active_days": len(active_dates),
            "current_streak_days": _compute_streak_days(active_dates),
        }
        for user_id, active_dates in dates_by_user.items()
    }


async def _follow_counts(session: AsyncSession, user_id: str) -> Tuple[int, int]:
    followers = (await session.execute(select(func.count()).select_from(UserFollow).where(UserFollow.following_id == user_id))).scalar_one()
    following = (await session.execute(select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user_id))).scalar_one()
    return int(followers or 0), int(following or 0)


async def _serialize_user_summary(session: AsyncSession, user: User, viewer_id: str, stats_map: Optional[Dict[str, Dict[str, int]]] = None) -> Dict[str, Any]:
    profile = await _ensure_profile(session, user)
    followers_count, following_count = await _follow_counts(session, user.id)
    is_following = (
        await session.execute(
            select(UserFollow).where(UserFollow.follower_id == viewer_id, UserFollow.following_id == user.id)
        )
    ).scalar_one_or_none() is not None
    stats = (stats_map or {}).get(user.id, {"active_days": 0, "current_streak_days": 0})
    return {
        "id": user.id,
        "username": profile.username,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "avatar_url": profile.avatar_url,
        "banner_url": profile.banner_url,
        "followers_count": followers_count,
        "following_count": following_count,
        "active_days": int(stats.get("active_days", 0)),
        "current_streak_days": int(stats.get("current_streak_days", 0)),
        "is_following": is_following,
        "is_self": viewer_id == user.id,
    }


async def _serialize_user_list(session: AsyncSession, users: List[User], viewer_id: str) -> List[Dict[str, Any]]:
    stats = await _activity_stats_for_users(session, [user.id for user in users])
    return [await _serialize_user_summary(session, user, viewer_id, stats) for user in users]


async def _serialize_community(session: AsyncSession, community: SocialCommunity, current_user_id: str) -> Dict[str, Any]:
    members = (
        await session.execute(select(SocialCommunityMember).where(SocialCommunityMember.community_id == community.id))
    ).scalars().all()
    owner = (await session.execute(select(User).where(User.id == community.owner_id))).scalar_one_or_none()
    owner_profile = await _ensure_profile(session, owner) if owner else None
    return {
        "id": community.id,
        "slug": community.slug,
        "name": community.name,
        "description": community.description,
        "avatar_url": community.avatar_url,
        "banner_url": community.banner_url,
        "owner": {
            "id": owner.id if owner else None,
            "username": owner_profile.username if owner_profile else None,
            "display_name": owner_profile.display_name if owner_profile else _display_name(owner),
            "avatar_url": owner_profile.avatar_url if owner_profile else None,
        },
        "member_count": len(members),
        "is_member": any(member.user_id == current_user_id for member in members),
    }


async def _community_member_users(session: AsyncSession, community_id: str) -> List[User]:
    members = (
        await session.execute(
            select(SocialCommunityMember).where(SocialCommunityMember.community_id == community_id).order_by(desc(SocialCommunityMember.joined_at))
        )
    ).scalars().all()
    ids = [member.user_id for member in members]
    if not ids:
        return []
    users = (await session.execute(select(User).where(User.id.in_(ids)))).scalars().all()
    user_map = {user.id: user for user in users}
    return [user_map[user_id] for user_id in ids if user_id in user_map]


async def _partner_last_read_at(session: AsyncSession, conversation: SocialConversation, viewer_id: str) -> Optional[datetime]:
    partner_id = conversation.user_b_id if conversation.user_a_id == viewer_id else conversation.user_a_id
    state = (
        await session.execute(
            select(SocialConversationReadState).where(
                SocialConversationReadState.conversation_id == conversation.id,
                SocialConversationReadState.user_id == partner_id,
            )
        )
    ).scalar_one_or_none()
    return state.last_read_at if state else None


async def _serialize_dm_message(session: AsyncSession, message: SocialConversationMessage, viewer_id: Optional[str] = None, partner_last_read_at: Optional[datetime] = None) -> Dict[str, Any]:
    sender = (await session.execute(select(User).where(User.id == message.sender_id))).scalar_one_or_none()
    sender_profile = await _ensure_profile(session, sender) if sender else None
    seen = bool(viewer_id and partner_last_read_at and message.sender_id == viewer_id and message.created_at and message.created_at <= partner_last_read_at)
    return {
        "id": message.id,
        "conversationId": message.conversation_id,
        "senderId": message.sender_id,
        "senderUsername": sender_profile.username if sender_profile else "member",
        "senderDisplayName": sender_profile.display_name if sender_profile else _display_name(sender),
        "senderAvatarUrl": sender_profile.avatar_url if sender_profile else None,
        "content": message.content,
        "imageUrl": message.image_url,
        "createdAt": message.created_at.isoformat() if message.created_at else None,
        "seen": seen,
        "seenAt": partner_last_read_at.isoformat() if seen and partner_last_read_at else None,
    }


async def _serialize_community_message(session: AsyncSession, message: SocialCommunityMessage) -> Dict[str, Any]:
    sender = (await session.execute(select(User).where(User.id == message.sender_id))).scalar_one_or_none()
    sender_profile = await _ensure_profile(session, sender) if sender else None
    return {
        "id": message.id,
        "communityId": message.community_id,
        "senderId": message.sender_id,
        "senderUsername": sender_profile.username if sender_profile else "member",
        "senderDisplayName": sender_profile.display_name if sender_profile else _display_name(sender),
        "senderAvatarUrl": sender_profile.avatar_url if sender_profile else None,
        "content": message.content,
        "imageUrl": message.image_url,
        "createdAt": message.created_at.isoformat() if message.created_at else None,
    }


async def _resolve_socket_user(auth: Optional[Dict[str, Any]]) -> Optional[User]:
    token = (auth or {}).get("token")
    if not token:
        return None
    user_id = decode_token(str(token))
    if not user_id:
        return None
    async with SessionLocal() as session:
        return (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()


async def _require_conversation_member(session: AsyncSession, conversation_id: str, user_id: str) -> SocialConversation:
    conversation = (await session.execute(select(SocialConversation).where(SocialConversation.id == conversation_id))).scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user_id not in {conversation.user_a_id, conversation.user_b_id}:
        raise HTTPException(status_code=403, detail="Access denied")
    return conversation


async def _require_community_by_slug(session: AsyncSession, slug: str) -> SocialCommunity:
    community = (await session.execute(select(SocialCommunity).where(SocialCommunity.slug == slug))).scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


async def _require_community_membership(session: AsyncSession, community_id: str, user_id: str) -> SocialCommunityMember:
    membership = (
        await session.execute(
            select(SocialCommunityMember).where(
                SocialCommunityMember.community_id == community_id,
                SocialCommunityMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Join community to view chat")
    return membership


@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]]) -> bool:
    user = await _resolve_socket_user(auth)
    if not user:
        return False
    _sid_user[sid] = user.id
    await sio.enter_room(sid, f"user:{user.id}")
    return True


@sio.event
async def disconnect(sid: str) -> None:
    _sid_user.pop(sid, None)


@sio.on("join_conversation")
async def join_conversation(sid: str, conversation_id: str) -> None:
    user_id = _sid_user.get(sid)
    if not user_id:
        return
    async with SessionLocal() as session:
        try:
            await _require_conversation_member(session, str(conversation_id), user_id)
        except HTTPException:
            return
    await sio.enter_room(sid, f"conversation:{conversation_id}")


@sio.on("join_community_chat")
async def join_community_chat(sid: str, community_id: str) -> None:
    user_id = _sid_user.get(sid)
    if not user_id:
        return
    async with SessionLocal() as session:
        membership = (
            await session.execute(
                select(SocialCommunityMember).where(
                    SocialCommunityMember.community_id == str(community_id),
                    SocialCommunityMember.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if not membership:
            return
    await sio.enter_room(sid, f"community:{community_id}")


@sio.on("typing_start")
async def typing_start(sid: str, payload: Dict[str, Any]) -> None:
    user_id = _sid_user.get(sid)
    conversation_id = str((payload or {}).get("conversationId") or "").strip()
    if not user_id or not conversation_id:
        return
    await sio.emit("typing", {"conversationId": conversation_id, "userId": user_id, "isTyping": True}, room=f"conversation:{conversation_id}", skip_sid=sid)


@sio.on("typing_stop")
async def typing_stop(sid: str, payload: Dict[str, Any]) -> None:
    user_id = _sid_user.get(sid)
    conversation_id = str((payload or {}).get("conversationId") or "").strip()
    if not user_id or not conversation_id:
        return
    await sio.emit("typing", {"conversationId": conversation_id, "userId": user_id, "isTyping": False}, room=f"conversation:{conversation_id}", skip_sid=sid)


@sio.on("send_dm")
async def send_dm(sid: str, payload: Dict[str, Any]) -> None:
    user_id = _sid_user.get(sid)
    if not user_id:
        return
    conversation_id = str((payload or {}).get("conversationId") or "").strip()
    content = str((payload or {}).get("content") or "").strip()
    image_url = str((payload or {}).get("imageUrl") or "").strip() or None
    if not conversation_id or (not content and not image_url):
        return
    async with SessionLocal() as session:
        try:
            conversation = await _require_conversation_member(session, conversation_id, user_id)
        except HTTPException:
            return
        message = SocialConversationMessage(conversation_id=conversation_id, sender_id=user_id, content=content[:4000], image_url=image_url)
        session.add(message)
        conversation.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(message)
        message_payload = await _serialize_dm_message(session, message)
        await sio.emit("new_dm", message_payload, room=f"conversation:{conversation_id}")
        await sio.emit("new_dm", message_payload, room=f"user:{conversation.user_a_id}")
        await sio.emit("new_dm", message_payload, room=f"user:{conversation.user_b_id}")


@sio.on("mark_read")
async def mark_read(sid: str, payload: Dict[str, Any]) -> None:
    user_id = _sid_user.get(sid)
    conversation_id = str((payload or {}).get("conversationId") or "").strip()
    if not user_id or not conversation_id:
        return
    async with SessionLocal() as session:
        try:
            await _require_conversation_member(session, conversation_id, user_id)
        except HTTPException:
            return
        read_state = (
            await session.execute(
                select(SocialConversationReadState).where(
                    SocialConversationReadState.conversation_id == conversation_id,
                    SocialConversationReadState.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if not read_state:
            read_state = SocialConversationReadState(conversation_id=conversation_id, user_id=user_id, last_read_at=datetime.utcnow())
        else:
            read_state.last_read_at = datetime.utcnow()
        session.add(read_state)
        await session.commit()
    await sio.emit("message_read", {"conversationId": conversation_id, "userId": user_id}, room=f"conversation:{conversation_id}")


@sio.on("send_community_message")
async def send_community_message(sid: str, payload: Dict[str, Any]) -> None:
    user_id = _sid_user.get(sid)
    if not user_id:
        return
    community_id = str((payload or {}).get("communityId") or "").strip()
    content = str((payload or {}).get("content") or "").strip()
    image_url = str((payload or {}).get("imageUrl") or "").strip() or None
    if not community_id or (not content and not image_url):
        return
    async with SessionLocal() as session:
        membership = (
            await session.execute(
                select(SocialCommunityMember).where(
                    SocialCommunityMember.community_id == community_id,
                    SocialCommunityMember.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if not membership:
            return
        message = SocialCommunityMessage(community_id=community_id, sender_id=user_id, content=content[:4000], image_url=image_url)
        session.add(message)
        await session.commit()
        await session.refresh(message)
        message_payload = await _serialize_community_message(session, message)
        await sio.emit("new_community_message", message_payload, room=f"community:{community_id}")


@router.get("/profile/me")
async def profile_me(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    await _ensure_profile(session, current_user)
    await session.commit()
    stats = await _activity_stats_for_users(session, [current_user.id])
    return await _serialize_user_summary(session, current_user, current_user.id, stats)


@router.put("/profile/me")
async def update_profile_me(payload: Dict[str, Any], session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    profile = await _ensure_profile(session, current_user)
    username = str(payload.get("username") or profile.username).strip().lower()
    display_name = str(payload.get("display_name") or profile.display_name).strip()
    bio = str(payload.get("bio") or "").strip() or None
    avatar_url = str(payload.get("avatar_url") or "").strip() or None
    banner_url = str(payload.get("banner_url") or "").strip() or None
    if not re.match(r"^[a-z0-9_]{3,30}$", username):
        raise HTTPException(status_code=400, detail="username must be 3-30 chars with lowercase letters, numbers, or underscores")
    existing = (
        await session.execute(
            select(UserProfile).where(UserProfile.username == username, UserProfile.user_id != current_user.id)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="username already taken")
    profile.username = username
    profile.display_name = display_name[:80] or _display_name(current_user)
    profile.bio = bio[:220] if bio else None
    profile.avatar_url = avatar_url
    profile.banner_url = banner_url
    session.add(profile)
    await session.commit()
    stats = await _activity_stats_for_users(session, [current_user.id])
    return await _serialize_user_summary(session, current_user, current_user.id, stats)


@router.get("/users/{user_id}")
async def user_profile(user_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    stats = await _activity_stats_for_users(session, [user.id])
    return await _serialize_user_summary(session, user, current_user.id, stats)


@router.get("/users/{user_id}/followers")
async def user_followers(user_id: str, page: int = 1, page_size: int = 20, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    size = max(1, min(page_size, 50))
    offset = max(page - 1, 0) * size
    rows = (
        await session.execute(
            select(UserFollow).where(UserFollow.following_id == user_id).order_by(desc(UserFollow.created_at)).offset(offset).limit(size + 1)
        )
    ).scalars().all()
    ids = [row.follower_id for row in rows[:size]]
    users = (await session.execute(select(User).where(User.id.in_(ids)))).scalars().all() if ids else []
    user_map = {user.id: user for user in users}
    ordered_users = [user_map[user_id] for user_id in ids if user_id in user_map]
    return {"page": page, "page_size": size, "has_more": len(rows) > size, "items": await _serialize_user_list(session, ordered_users, current_user.id)}


@router.get("/users/{user_id}/following")
async def user_following(user_id: str, page: int = 1, page_size: int = 20, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    size = max(1, min(page_size, 50))
    offset = max(page - 1, 0) * size
    rows = (
        await session.execute(
            select(UserFollow).where(UserFollow.follower_id == user_id).order_by(desc(UserFollow.created_at)).offset(offset).limit(size + 1)
        )
    ).scalars().all()
    ids = [row.following_id for row in rows[:size]]
    users = (await session.execute(select(User).where(User.id.in_(ids)))).scalars().all() if ids else []
    user_map = {user.id: user for user in users}
    ordered_users = [user_map[user_id] for user_id in ids if user_id in user_map]
    return {"page": page, "page_size": size, "has_more": len(rows) > size, "items": await _serialize_user_list(session, ordered_users, current_user.id)}


@router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        await session.execute(
            select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id)
        )
    ).scalar_one_or_none()
    if not existing:
        session.add(UserFollow(follower_id=current_user.id, following_id=user_id))
        await session.commit()
    return {"status": "ok", "following": True}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    row = (
        await session.execute(
            select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id)
        )
    ).scalar_one_or_none()
    if row:
        await session.delete(row)
        await session.commit()
    return {"status": "ok", "following": False}


@router.get("/suggestions")
async def suggestions(limit: int = 8, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    size = max(1, min(limit, 24))
    follows = (await session.execute(select(UserFollow).where(UserFollow.follower_id == current_user.id))).scalars().all()
    followed_ids = {row.following_id for row in follows}
    users = (
        await session.execute(select(User).where(User.id != current_user.id).order_by(desc(User.created_at)).limit(size * 4))
    ).scalars().all()
    filtered = [user for user in users if user.id not in followed_ids][:size]
    return {"users": await _serialize_user_list(session, filtered, current_user.id)}


@router.post("/communities")
async def create_community(payload: Dict[str, Any], session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    slug = _slugify(str(payload.get("slug") or name))
    if len(slug) < 3:
        raise HTTPException(status_code=400, detail="community slug must be at least 3 characters")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    existing = (await session.execute(select(SocialCommunity).where(SocialCommunity.slug == slug))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="community slug already exists")
    community = SocialCommunity(
        slug=slug,
        name=name[:80],
        description=str(payload.get("description") or "").strip()[:400] or None,
        avatar_url=str(payload.get("avatar_url") or "").strip() or None,
        banner_url=str(payload.get("banner_url") or "").strip() or None,
        owner_id=current_user.id,
    )
    session.add(community)
    await session.flush()
    session.add(SocialCommunityMember(community_id=community.id, user_id=current_user.id, role="owner"))
    await session.commit()
    return await _serialize_community(session, community, current_user.id)


@router.get("/communities")
async def list_communities(search: str = "", page: int = 1, page_size: int = 18, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    size = max(1, min(page_size, 50))
    offset = max(page - 1, 0) * size
    query = select(SocialCommunity)
    term = search.strip().lower()
    if term:
        query = query.where(
            or_(
                SocialCommunity.name.ilike(f"%{term}%"),
                SocialCommunity.slug.ilike(f"%{term}%"),
                SocialCommunity.description.ilike(f"%{term}%"),
            )
        )
    rows = (await session.execute(query.order_by(desc(SocialCommunity.created_at)).offset(offset).limit(size + 1))).scalars().all()
    items = [await _serialize_community(session, community, current_user.id) for community in rows[:size]]
    return {"page": page, "page_size": size, "has_more": len(rows) > size, "items": items}


@router.get("/communities/{slug}")
async def community_detail(slug: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    payload = await _serialize_community(session, community, current_user.id)
    members = await _community_member_users(session, community.id)
    payload["members_preview"] = await _serialize_user_list(session, members[:8], current_user.id)
    return payload


@router.get("/communities/{slug}/members")
async def community_members(slug: str, page: int = 1, page_size: int = 20, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    users = await _community_member_users(session, community.id)
    size = max(1, min(page_size, 50))
    start = max(page - 1, 0) * size
    items = users[start : start + size]
    return {"page": page, "page_size": size, "has_more": start + size < len(users), "items": await _serialize_user_list(session, items, current_user.id)}


@router.post("/communities/{slug}/join")
async def join_community(slug: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    existing = (
        await session.execute(
            select(SocialCommunityMember).where(
                SocialCommunityMember.community_id == community.id,
                SocialCommunityMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        session.add(SocialCommunityMember(community_id=community.id, user_id=current_user.id, role="member"))
        await session.commit()
    return {"status": "ok", "is_member": True, "community_id": community.id}


@router.post("/communities/{slug}/leave")
async def leave_community(slug: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    membership = (
        await session.execute(
            select(SocialCommunityMember).where(
                SocialCommunityMember.community_id == community.id,
                SocialCommunityMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if membership:
        await session.delete(membership)
        await session.commit()
    return {"status": "ok", "is_member": False, "community_id": community.id}


@router.get("/communities/{slug}/messages")
async def community_messages(slug: str, before_id: Optional[str] = None, limit: int = 50, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    await _require_community_membership(session, community.id, current_user.id)
    size = max(1, min(limit, 100))
    query = select(SocialCommunityMessage).where(SocialCommunityMessage.community_id == community.id)
    if before_id:
        before_message = (await session.execute(select(SocialCommunityMessage).where(SocialCommunityMessage.id == before_id))).scalar_one_or_none()
        if before_message:
            query = query.where(SocialCommunityMessage.created_at < before_message.created_at)
    rows = (await session.execute(query.order_by(desc(SocialCommunityMessage.created_at)).limit(size))).scalars().all()
    return {"items": [await _serialize_community_message(session, row) for row in reversed(rows)]}


@router.post("/communities/{slug}/messages")
async def community_messages_rest(slug: str, payload: Dict[str, Any], session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    community = await _require_community_by_slug(session, slug)
    await _require_community_membership(session, community.id, current_user.id)
    content = str(payload.get("content") or "").strip()
    image_url = str(payload.get("imageUrl") or "").strip() or None
    if not content and not image_url:
        raise HTTPException(status_code=400, detail="content or imageUrl is required")
    message = SocialCommunityMessage(community_id=community.id, sender_id=current_user.id, content=content[:4000], image_url=image_url)
    session.add(message)
    await session.commit()
    await session.refresh(message)
    serialized = await _serialize_community_message(session, message)
    await sio.emit("new_community_message", serialized, room=f"community:{community.id}")
    return {"message": serialized}


@router.post("/conversations/with/{target_user_id}")
async def create_or_get_conversation(target_user_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot open conversation with yourself")
    target = (await session.execute(select(User).where(User.id == target_user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    user_a_id, user_b_id = _conversation_pair(current_user.id, target_user_id)
    conversation = (
        await session.execute(
            select(SocialConversation).where(
                SocialConversation.user_a_id == user_a_id,
                SocialConversation.user_b_id == user_b_id,
            )
        )
    ).scalar_one_or_none()
    if not conversation:
        conversation = SocialConversation(user_a_id=user_a_id, user_b_id=user_b_id)
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
    return {"conversation_id": conversation.id}


@router.get("/conversations")
async def list_conversations(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    conversations = (
        await session.execute(
            select(SocialConversation)
            .where(or_(SocialConversation.user_a_id == current_user.id, SocialConversation.user_b_id == current_user.id))
            .order_by(desc(SocialConversation.updated_at))
        )
    ).scalars().all()
    items: List[Dict[str, Any]] = []
    for conversation in conversations:
        partner_id = conversation.user_b_id if conversation.user_a_id == current_user.id else conversation.user_a_id
        partner = (await session.execute(select(User).where(User.id == partner_id))).scalar_one_or_none()
        partner_profile = await _ensure_profile(session, partner) if partner else None
        last_message = (
            await session.execute(
                select(SocialConversationMessage).where(SocialConversationMessage.conversation_id == conversation.id).order_by(desc(SocialConversationMessage.created_at)).limit(1)
            )
        ).scalar_one_or_none()
        read_state = (
            await session.execute(
                select(SocialConversationReadState).where(
                    SocialConversationReadState.conversation_id == conversation.id,
                    SocialConversationReadState.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        unread_query = select(func.count()).select_from(SocialConversationMessage).where(
            SocialConversationMessage.conversation_id == conversation.id,
            SocialConversationMessage.sender_id != current_user.id,
        )
        if read_state and read_state.last_read_at:
            unread_query = unread_query.where(SocialConversationMessage.created_at > read_state.last_read_at)
        unread_count = (await session.execute(unread_query)).scalar_one()
        items.append(
            {
                "id": conversation.id,
                "partner": {
                    "id": partner_id,
                    "username": partner_profile.username if partner_profile else "member",
                    "display_name": partner_profile.display_name if partner_profile else _display_name(partner),
                    "avatar_url": partner_profile.avatar_url if partner_profile else None,
                },
                "last_message": last_message.content if last_message else None,
                "last_message_at": last_message.created_at.isoformat() if last_message and last_message.created_at else None,
                "last_message_sender_id": last_message.sender_id if last_message else None,
                "unread_count": int(unread_count or 0),
            }
        )
    return {"items": items}


@router.get("/conversations/{conversation_id}/messages")
async def conversation_messages(conversation_id: str, before_id: Optional[str] = None, limit: int = 50, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    conversation = await _require_conversation_member(session, conversation_id, current_user.id)
    partner_read_at = await _partner_last_read_at(session, conversation, current_user.id)
    size = max(1, min(limit, 100))
    query = select(SocialConversationMessage).where(SocialConversationMessage.conversation_id == conversation_id)
    if before_id:
        before_message = (await session.execute(select(SocialConversationMessage).where(SocialConversationMessage.id == before_id))).scalar_one_or_none()
        if before_message:
            query = query.where(SocialConversationMessage.created_at < before_message.created_at)
    rows = (await session.execute(query.order_by(desc(SocialConversationMessage.created_at)).limit(size))).scalars().all()
    return {
        "items": [await _serialize_dm_message(session, row, current_user.id, partner_read_at) for row in reversed(rows)],
        "partnerReadAt": partner_read_at.isoformat() if partner_read_at else None,
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_dm_rest(conversation_id: str, payload: Dict[str, Any], session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    conversation = await _require_conversation_member(session, conversation_id, current_user.id)
    content = str(payload.get("content") or "").strip()
    image_url = str(payload.get("imageUrl") or "").strip() or None
    if not content and not image_url:
        raise HTTPException(status_code=400, detail="content or imageUrl is required")
    message = SocialConversationMessage(conversation_id=conversation_id, sender_id=current_user.id, content=content[:4000], image_url=image_url)
    session.add(message)
    conversation.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(message)
    serialized = await _serialize_dm_message(session, message)
    await sio.emit("new_dm", serialized, room=f"conversation:{conversation_id}")
    await sio.emit("new_dm", serialized, room=f"user:{conversation.user_a_id}")
    await sio.emit("new_dm", serialized, room=f"user:{conversation.user_b_id}")
    return {"message": serialized}


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(conversation_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    await _require_conversation_member(session, conversation_id, current_user.id)
    read_state = (
        await session.execute(
            select(SocialConversationReadState).where(
                SocialConversationReadState.conversation_id == conversation_id,
                SocialConversationReadState.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not read_state:
        read_state = SocialConversationReadState(conversation_id=conversation_id, user_id=current_user.id, last_read_at=datetime.utcnow())
    else:
        read_state.last_read_at = datetime.utcnow()
    session.add(read_state)
    await session.commit()
    await sio.emit("message_read", {"conversationId": conversation_id, "userId": current_user.id}, room=f"conversation:{conversation_id}")
    return {"status": "ok", "conversationId": conversation_id}


@router.get("/messages/unread-count")
async def unread_count(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    conversations = (
        await session.execute(
            select(SocialConversation).where(or_(SocialConversation.user_a_id == current_user.id, SocialConversation.user_b_id == current_user.id))
        )
    ).scalars().all()
    total = 0
    for conversation in conversations:
        read_state = (
            await session.execute(
                select(SocialConversationReadState).where(
                    SocialConversationReadState.conversation_id == conversation.id,
                    SocialConversationReadState.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        query = select(func.count()).select_from(SocialConversationMessage).where(
            SocialConversationMessage.conversation_id == conversation.id,
            SocialConversationMessage.sender_id != current_user.id,
        )
        if read_state and read_state.last_read_at:
            query = query.where(SocialConversationMessage.created_at > read_state.last_read_at)
        total += int((await session.execute(query)).scalar_one() or 0)
    return {"count": total}

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings, get_settings
from .database import get_session
from .models import User
from .security import create_access_token, hash_password, verify_password, pwd_context

router = APIRouter(prefix="/auth")

@router.post("/register")
async def register(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")
    exists = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="User already exists")
    user = User(email=email, password_hash=hash_password(password))
    session.add(user)
    await session.commit()
    token = create_access_token(user.id, settings.access_token_expire_minutes)
    return {"token": token, "user_id": user.id}


@router.post("/login")
async def login(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Optionally upgrade legacy hashes
    if pwd_context.needs_update(user.password_hash):
        user.password_hash = hash_password(password)
        await session.commit()
    token = create_access_token(user.id, settings.access_token_expire_minutes)
    return {"token": token, "user_id": user.id}

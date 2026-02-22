import io
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import random
import math
from datetime import timezone as dt_timezone, timedelta

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .dependencies import get_current_user, get_llm
from .llm import LLMClient
from .models import (
    Alert,
    BanditActionStat,
    BanditEvent,
    Checkin,
    CoachMessage,
    CoachSession,
    Journal,
    Plan,
    RiskScore,
    Task,
    User,
    VoiceEntry,
)
from .storage import put_object_from_fileobj

router = APIRouter()


def _serialize_coach_message(message: CoachMessage) -> Dict[str, Any]:
    return {
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "ts": message.ts.isoformat() if message.ts else None,
    }


def extract_first_day_tasks(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    phases = plan.get("phases") or []
    if not phases:
        return []
    weeks = phases[0].get("weeks") or []
    if not weeks:
        return []
    days = weeks[0].get("days") or []
    if not days:
        return []
    tasks = days[0].get("tasks") or []
    return tasks if isinstance(tasks, list) else []


def compute_streak(completed_dates: List[datetime]) -> int:
    if not completed_dates:
        return 0
    days = sorted({d.date() for d in completed_dates}, reverse=True)
    streak = 1
    today = datetime.now(dt_timezone.utc).date()
    if days[0] != today:
        return 0
    for i in range(1, len(days)):
        if (today - days[i]) == timedelta(days=streak):
            streak += 1
        else:
            break
    return streak


def deterministic_risk(checkins: List[Checkin], tasks: List[Task]) -> Dict[str, Any]:
    if not checkins:
        return {"score": 0.3, "bucket": "Low", "rationale": "No recent signals; default low risk."}
    # recency-weighted craving and urge
    now = datetime.now(dt_timezone.utc)
    scores = []
    for c in checkins:
        age_hours = max((now - c.ts.replace(tzinfo=dt_timezone.utc)).total_seconds() / 3600, 0.1)
        weight = math.exp(-age_hours / 24)
        craving_component = (c.craving / 10) * weight
        urge_component = ((c.urge or 0) / 10) * 0.5 * weight
        scores.append(craving_component + urge_component)
    avg = float(np.clip(np.sum(scores), 0, 1))
    # task adherence penalty
    completed = [t for t in tasks if t.status == "completed"]
    adherence = len(completed) / max(len(tasks), 1)
    penalty = 0.15 * (1 - adherence)
    score = float(np.clip(avg + penalty, 0, 1))
    if score < 0.33:
        bucket = "Low"
    elif score < 0.66:
        bucket = "Medium"
    else:
        bucket = "High"
    rationale = f"Recent craving/urge averaged to {avg:.2f}, adherence {adherence:.2f}, adjusted score {score:.2f}."
    return {"score": score, "bucket": bucket, "rationale": rationale}


async def epsilon_greedy_choose(session: AsyncSession, actions: List[str], epsilon: float = 0.2) -> str:
    stats = (
        await session.execute(select(BanditActionStat).where(BanditActionStat.action_id.in_(actions)))
    ).scalars().all()
    stat_map = {s.action_id: s for s in stats}
    if random.random() < epsilon:
        return random.choice(actions)
    best_action = actions[0]
    best_avg = -1
    for a in actions:
        s = stat_map.get(a)
        avg = s.reward_avg if s else 0.5
        if avg > best_avg:
            best_avg = avg
            best_action = a
    return best_action


@router.get("/progress/summary")
async def progress_summary(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    tasks = (
        await session.execute(select(Task).where(Task.user_id == current_user.id))
    ).scalars().all()
    completed = [t for t in tasks if t.status == "completed"]
    total_xp = sum(t.xp for t in completed)
    completed_dates = [t.updated_at.replace(tzinfo=dt_timezone.utc) if t.updated_at.tzinfo is None else t.updated_at for t in completed]
    streak = compute_streak(completed_dates)
    return {
        "completed_tasks": len(completed),
        "total_tasks": len(tasks),
        "total_xp": total_xp,
        "streak_days": streak,
    }


@router.post("/sos/alert")
async def sos_alert(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    crisis_keywords = {"suicide", "self-harm", "overdose", "kill myself", "end it", "cant go on"}
    message = (payload.get("message") or "").lower()
    crisis_detected = any(k in message for k in crisis_keywords)
    alert = Alert(
        user_id=current_user.id,
        type=payload.get("type", "sos"),
        payload_json=payload,
    )
    session.add(alert)
    await session.commit()
    response = {"status": "ok", "alert_id": alert.id, "crisis_detected": crisis_detected}
    if crisis_detected:
        response["helpline"] = "Crisis detected. Please contact your local crisis line or call 988 (US)."
    return response


@router.post("/onboard")
async def onboard(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    llm: LLMClient = Depends(get_llm),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user = current_user

    plan_payload = {
        "addiction": payload.get("addiction"),
        "triggers": payload.get("triggers"),
        "goals": payload.get("goals"),
        "constraints": payload.get("constraints"),
        "preferences": payload.get("preferences"),
    }
    try:
        plan = await llm.generate_plan(plan_payload)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Failed to generate plan", exc_info=exc, extra={"payload": plan_payload})
        raise HTTPException(status_code=502, detail="Plan generation failed")
    if not plan:
        raise HTTPException(status_code=502, detail="Plan generation failed")

    plan_row = Plan(user_id=user.id, plan_json=plan, version=1)
    session.add(plan_row)

    # seed tasks from day 1 of plan
    for t in extract_first_day_tasks(plan):
        session.add(
            Task(
                user_id=user.id,
                plan_id=plan_row.id,
                day_index=1,
                title=t.get("title") or t.get("name") or "Task",
                details_json=t,
                xp=t.get("xp", 10),
            )
        )

    await session.commit()
    return {"user_id": user.id, "plan": plan, "plan_id": plan_row.id}


@router.post("/coach/session")
async def coach_session(
    payload: Dict[str, Any],
    llm: LLMClient = Depends(get_llm),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    flow = await llm.coach_flow(payload)
    if not flow:
        raise HTTPException(status_code=502, detail="Coach flow failed")
    return flow


@router.get("/coach/sessions")
async def list_coach_sessions(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    rows = (
        await session.execute(
            select(CoachSession)
            .where(CoachSession.user_id == current_user.id)
            .order_by(desc(CoachSession.updated_at))
        )
    ).scalars().all()
    return {
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in rows
        ]
    }


@router.post("/coach/sessions")
async def create_coach_session(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    title = (payload.get("title") or "").strip() or "New chat"
    row = CoachSession(user_id=current_user.id, title=title)
    session.add(row)
    await session.commit()
    return {
        "id": row.id,
        "title": row.title,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/coach/sessions/{session_id}")
async def get_coach_session(
    session_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    coach_session_row = (
        await session.execute(
            select(CoachSession).where(
                CoachSession.id == session_id,
                CoachSession.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not coach_session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = (
        await session.execute(
            select(CoachMessage)
            .where(CoachMessage.session_id == coach_session_row.id)
            .order_by(CoachMessage.ts.asc())
        )
    ).scalars().all()
    return {
        "session": {
            "id": coach_session_row.id,
            "title": coach_session_row.title,
            "created_at": coach_session_row.created_at.isoformat() if coach_session_row.created_at else None,
            "updated_at": coach_session_row.updated_at.isoformat() if coach_session_row.updated_at else None,
        },
        "messages": [_serialize_coach_message(m) for m in messages],
    }


@router.post("/coach/sessions/{session_id}/messages")
async def create_coach_message(
    session_id: str,
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    llm: LLMClient = Depends(get_llm),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    coach_session_row = (
        await session.execute(
            select(CoachSession).where(
                CoachSession.id == session_id,
                CoachSession.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not coach_session_row:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = (payload.get("message") or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="message is required")

    user_row = CoachMessage(session_id=coach_session_row.id, role="user", content=user_message)
    session.add(user_row)
    await session.flush()

    recent_messages = (
        await session.execute(
            select(CoachMessage)
            .where(CoachMessage.session_id == coach_session_row.id)
            .order_by(CoachMessage.ts.desc())
            .limit(30)
        )
    ).scalars().all()
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(recent_messages)
    ]
    reply = await llm.coach_chat_reply(history)
    if not reply:
        reply = "I hear you. Let's take this one step at a time. Tell me what feels hardest right now."

    assistant_row = CoachMessage(session_id=coach_session_row.id, role="assistant", content=reply)
    session.add(assistant_row)

    if coach_session_row.title == "New chat":
        coach_session_row.title = user_message[:60]
    coach_session_row.updated_at = datetime.utcnow()

    await session.commit()
    return {
        "session": {
            "id": coach_session_row.id,
            "title": coach_session_row.title,
            "created_at": coach_session_row.created_at.isoformat() if coach_session_row.created_at else None,
            "updated_at": coach_session_row.updated_at.isoformat() if coach_session_row.updated_at else None,
        },
        "user_message": _serialize_coach_message(user_row),
        "assistant_message": _serialize_coach_message(assistant_row),
    }


@router.get("/tasks/today")
async def tasks_today(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    result = await session.execute(
        select(Task).where(Task.user_id == current_user.id).order_by(Task.created_at.desc())
    )
    tasks = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "xp": t.xp,
            "details": t.details_json,
            "day_index": t.day_index,
        }
        for t in result.scalars().all()
    ]
    return {"tasks": tasks}


@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, session: AsyncSession = Depends(get_session)) -> Dict[str, Any]:
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await session.execute(
        update(Task).where(Task.id == task_id).values(status="completed", updated_at=datetime.utcnow())
    )
    await session.commit()
    return {"status": "ok", "task_id": task_id}


@router.post("/checkins")
async def create_checkin(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if "craving" not in payload:
        raise HTTPException(status_code=400, detail="Missing craving")
    checkin = Checkin(
        user_id=current_user.id,
        craving=int(payload["craving"]),
        mood=payload.get("mood"),
        triggers=payload.get("triggers") or [],
        urge=payload.get("urge"),
    )
    session.add(checkin)
    await session.commit()
    return {"status": "ok", "id": checkin.id}


@router.post("/journal/upload")
async def upload_journal(
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    emotion_tags: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    # Note: assume client-side encryption before upload; we store as-is.
    content = await file.read()
    object_name = f"journals/{current_user.id}/{uuid.uuid4()}-{file.filename}"
    url = put_object_from_fileobj(io.BytesIO(content), object_name, file.content_type or "application/octet-stream")

    tags = []
    if emotion_tags:
        try:
            tags = [t.strip() for t in emotion_tags.split(",") if t.strip()]
        except Exception:
            tags = []

    journal = Journal(user_id=current_user.id, encrypted_url=url, emotion_tags=tags)
    session.add(journal)
    await session.commit()
    return {"status": "ok", "url": url, "journal_id": journal.id}


@router.get("/risk")
async def risk(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    checkins = (
        await session.execute(
            select(Checkin)
            .where(Checkin.user_id == current_user.id)
            .order_by(Checkin.ts.desc())
            .limit(10)
        )
    ).scalars().all()
    tasks = (
        await session.execute(
            select(Task)
            .where(Task.user_id == current_user.id)
            .order_by(Task.updated_at.desc())
            .limit(20)
        )
    ).scalars().all()
    assessment = deterministic_risk(checkins, tasks)
    risk_row = RiskScore(
        user_id=current_user.id,
        score=float(assessment.get("score", 0.3)),
        bucket=assessment.get("bucket", "Low"),
        rationale=assessment.get("rationale", "No rationale"),
    )
    session.add(risk_row)
    await session.commit()
    return {
        "score": risk_row.score,
        "bucket": risk_row.bucket,
        "rationale": risk_row.rationale,
        "risk_id": risk_row.id,
    }


@router.post("/jitai/choose")
async def jitai_choose(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    llm: LLMClient = Depends(get_llm),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    context = {
        "risk_score": payload.get("risk_score"),
        "risk_bucket": payload.get("risk_bucket"),
        "recent_events": payload.get("recent_events"),
        "time_of_day": payload.get("time_of_day"),
    }
    actions = [
        "urge-surfing (3 min)",
        "box breathing (2 min)",
        "grounding (5-4-3-2-1)",
        "distraction task (5 min)",
    ]
    best_action = await epsilon_greedy_choose(session, actions)
    choice = await llm.jit_intervention(context, actions)
    if not choice:
        choice = {"chosen_action": best_action, "why": "Bandit selection", "instructions": "Follow the chosen action."}

    event = BanditEvent(
        user_id=current_user.id,
        context_json=context,
        action_id=choice.get("chosen_action", best_action),
        reward=None,
    )
    session.add(event)
    # optimistic pull update
    stat = (
        await session.execute(select(BanditActionStat).where(BanditActionStat.action_id == event.action_id))
    ).scalar_one_or_none()
    if not stat:
        stat = BanditActionStat(action_id=event.action_id, pulls=0, reward_sum=0.0, reward_avg=0.0)
        session.add(stat)
    stat.pulls += 1
    await session.commit()
    return {
        "chosen_action": event.action_id,
        "why": choice.get("why", "Best fit for context"),
        "instructions": choice.get("instructions", ""),
        "event_id": event.id,
    }


@router.post("/jitai/feedback")
async def jitai_feedback(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    event_id = payload.get("event_id")
    reward = payload.get("reward")
    if event_id is None or reward is None:
        raise HTTPException(status_code=400, detail="event_id and reward are required")
    reward = float(reward)
    event = (
        await session.execute(select(BanditEvent).where(BanditEvent.id == event_id, BanditEvent.user_id == current_user.id))
    ).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.reward = reward
    stat = (
        await session.execute(select(BanditActionStat).where(BanditActionStat.action_id == event.action_id))
    ).scalar_one_or_none()
    if not stat:
        stat = BanditActionStat(action_id=event.action_id, pulls=0, reward_sum=0.0, reward_avg=0.0)
        session.add(stat)
    stat.reward_sum += reward
    stat.reward_avg = stat.reward_sum / max(stat.pulls, 1)
    await session.commit()
    return {"status": "ok", "event_id": event_id, "reward": reward, "action_id": event.action_id}

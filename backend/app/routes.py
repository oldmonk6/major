import io
import json
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Set, Tuple

import random
import asyncio
from datetime import timezone as dt_timezone, timedelta

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, desc, or_, select, update
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
    CommunityGroup,
    CommunityGroupMember,
    CommunityMessage,
    CravingLog,
    EmergencyPlan,
    Journal,
    Plan,
    RiskScore,
    SocialChat,
    SocialChatMember,
    SocialChatMessage,
    SocialFriendRequest,
    SocialFriendship,
    SlipEvent,
    SupportCircleMember,
    Task,
    UserFollow,
    User,
    VoiceEntry,
)
from .storage import put_object_from_fileobj

router = APIRouter()


def _display_name(user: Optional[User]) -> str:
    if not user:
        return "Unknown"
    email = (user.email or "").strip()
    if not email:
        return "Member"
    handle = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
    return handle.title() or email


def _serialize_user_card(
    user: User,
    stats: Optional[Dict[str, int]] = None,
    is_following: Optional[bool] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": user.id,
        "email": user.email,
        "display_name": _display_name(user),
        "handle": f"@{(user.email or 'member').split('@', 1)[0]}",
    }
    if stats is not None:
        payload["current_streak_days"] = int(stats.get("current_streak_days", 0))
        payload["active_days"] = int(stats.get("active_days", 0))
    if is_following is not None:
        payload["is_following"] = is_following
    return payload


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


async def _activity_stats_for_users(
    session: AsyncSession,
    user_ids: List[str],
) -> Dict[str, Dict[str, int]]:
    unique_user_ids = list({user_id for user_id in user_ids if user_id})
    if not unique_user_ids:
        return {}

    dates_by_user: Dict[str, Set[date]] = {user_id: set() for user_id in unique_user_ids}

    checkin_rows = (
        await session.execute(
            select(Checkin.user_id, Checkin.ts).where(Checkin.user_id.in_(unique_user_ids))
        )
    ).all()
    for user_id, ts in checkin_rows:
        if ts:
            dates_by_user.setdefault(user_id, set()).add(ts.date())

    craving_rows = (
        await session.execute(
            select(CravingLog.user_id, CravingLog.ts).where(CravingLog.user_id.in_(unique_user_ids))
        )
    ).all()
    for user_id, ts in craving_rows:
        if ts:
            dates_by_user.setdefault(user_id, set()).add(ts.date())

    slip_rows = (
        await session.execute(
            select(SlipEvent.user_id, SlipEvent.ts).where(SlipEvent.user_id.in_(unique_user_ids))
        )
    ).all()
    for user_id, ts in slip_rows:
        if ts:
            dates_by_user.setdefault(user_id, set()).add(ts.date())

    journal_rows = (
        await session.execute(
            select(Journal.user_id, Journal.ts).where(Journal.user_id.in_(unique_user_ids))
        )
    ).all()
    for user_id, ts in journal_rows:
        if ts:
            dates_by_user.setdefault(user_id, set()).add(ts.date())

    coach_rows = (
        await session.execute(
            select(CoachSession.user_id, CoachMessage.ts)
            .join(CoachMessage, CoachMessage.session_id == CoachSession.id)
            .where(CoachSession.user_id.in_(unique_user_ids))
        )
    ).all()
    for user_id, ts in coach_rows:
        if ts:
            dates_by_user.setdefault(user_id, set()).add(ts.date())

    out: Dict[str, Dict[str, int]] = {}
    for user_id in unique_user_ids:
        active_dates = dates_by_user.get(user_id, set())
        out[user_id] = {
            "active_days": len(active_dates),
            "current_streak_days": _compute_streak_days(active_dates),
        }
    return out


def _serialize_community_message(message: CommunityMessage, viewer_id: str, sender: Optional[User]) -> Dict[str, Any]:
    return {
        "id": message.id,
        "body": message.body,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "sender_id": message.sender_id,
        "sender_name": _display_name(sender),
        "is_mine": message.sender_id == viewer_id,
        "group_id": message.group_id,
        "recipient_id": message.recipient_id,
    }


def _friend_pair(user_id_1: str, user_id_2: str) -> Tuple[str, str]:
    return (user_id_1, user_id_2) if user_id_1 < user_id_2 else (user_id_2, user_id_1)


def _serialize_social_message(message: SocialChatMessage, viewer_id: str, sender: Optional[User]) -> Dict[str, Any]:
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "body": message.body,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "sender_id": message.sender_id,
        "sender_name": _display_name(sender),
        "is_mine": message.sender_id == viewer_id,
    }


def _chunk_text(text: str, chunk_size: int = 10) -> List[str]:
    if not text:
        return []
    chunks: List[str] = []
    buf = ""
    for ch in text:
        buf += ch
        if len(buf) >= chunk_size and ch in {" ", "\n", ".", ",", "!", "?"}:
            chunks.append(buf)
            buf = ""
    if buf:
        chunks.append(buf)
    return chunks


def _serialize_coach_message(message: CoachMessage) -> Dict[str, Any]:
    return {
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "ts": message.ts.isoformat() if message.ts else None,
    }


TASKS_PER_DAY = 1
PLAN_DAYS_PER_WEEK = 7


def _build_local_onboarding_plan(user_profile: Dict[str, Any]) -> Dict[str, Any]:
    addiction = str(user_profile.get("addiction") or "recovery")
    triggers = str(user_profile.get("triggers") or "stress, isolation, or unplanned downtime")
    goals = str(user_profile.get("goals") or "build consistency and stability")
    constraints = str(user_profile.get("constraints") or "limited time and energy")
    preferences = str(user_profile.get("preferences") or "small practical steps")

    task_templates = [
        (
            "Morning reset",
            f"Start the day with structure so {addiction} recovery begins intentionally.",
            "10-15 min",
            "grounding",
            "Easy",
        ),
        (
            "Trigger scan",
            f"Notice whether {triggers} may show up today and choose one response in advance.",
            "10-15 min",
            "trigger-awareness",
            "Easy",
        ),
        (
            "Support action",
            "Reduce isolation with one small act of connection, accountability, or outreach.",
            "10-15 min",
            "connection",
            "Medium",
        ),
        (
            "Body regulation",
            "Use movement, hydration, or breathing to lower stress before cravings build.",
            "10-15 min",
            "regulation",
            "Medium",
        ),
        (
            "Evening reflection",
            f"Review what helped and align tomorrow with the goal of {goals}.",
            "10-15 min",
            "reflection",
            "Easy",
        ),
        (
            "Craving plan",
            "Choose one response for the first craving or difficult moment of the day.",
            "10-15 min",
            "planning",
            "Medium",
        ),
        (
            "Recovery anchor",
            "Protect the day with one repeatable anchor such as a walk, meeting, or quiet reset.",
            "10-15 min",
            "consistency",
            "Easy",
        ),
    ]

    weeks: List[Dict[str, Any]] = []
    week_themes = [
        "Stabilize the day",
        "Strengthen routines",
        "Handle triggers earlier",
        "Consolidate wins",
    ]

    for week_index, theme in enumerate(week_themes, start=1):
        days: List[Dict[str, Any]] = []
        for day_in_week in range(1, PLAN_DAYS_PER_WEEK + 1):
            template_index = (week_index + day_in_week - 2) % len(task_templates)
            title, rationale, est_time, micro_skill, difficulty = task_templates[template_index]
            tasks = [
                {
                    "title": f"{title} W{week_index}D{day_in_week}",
                    "rationale": rationale,
                    "est_time": est_time,
                    "xp": 12,
                    "micro_skill": micro_skill,
                    "difficulty": difficulty,
                }
            ]
            days.append(
                {
                    "title": f"Week {week_index} Day {day_in_week}",
                    "focus": theme,
                    "tasks": tasks,
                }
            )

        weeks.append(
            {
                "title": f"Week {week_index}",
                "theme": theme,
                "milestone": f"Finish week {week_index} with a routine that fits {constraints}.",
                "days": days,
            }
        )

    return {
        "title": "Recovery Foundations Plan",
        "summary": f"A four-week plan for {addiction} recovery built around {preferences}.",
        "phases": [
            {
                "title": "Foundation",
                "objective": f"Build stable routines, respond to triggers earlier, and move toward {goals}.",
                "weeks": weeks,
            }
        ],
        "weekly_milestones": [week["milestone"] for week in weeks],
        "relapse_fallback_steps": [
            "Pause and do one grounding exercise for 2 minutes.",
            "Move away from the trigger or high-risk environment.",
            "Contact one trusted person or use the SOS flow.",
            "Write down what happened without self-judgment.",
            "Restart with the smallest next task instead of abandoning the day.",
        ],
        "daily_checkin_prompts": [
            "What feels most likely to derail me today?",
            "What is one action that would make today safer?",
            "What helped me stay steady since the last check-in?",
        ],
        "source": "local_fallback",
    }


def _fallback_day_task(global_day_index: int, week_index: int, day_in_week: int, slot: int) -> Dict[str, Any]:
    focus = [
        "Mindful breathing and reset",
        "Trigger mapping and distancing",
        "Short movement and hydration",
        "Supportive outreach",
        "Evening reflection and plan",
    ]
    idx = (slot - 1) % len(focus)
    return {
        "title": focus[idx],
        "rationale": f"Daily recovery task for week {week_index}, day {day_in_week}.",
        "est_time": "10-15 min",
        "difficulty": "Easy",
        "xp": 12,
        "micro_skill": "consistency",
        "plan_day_index": global_day_index,
    }


def _normalize_day_tasks(raw_tasks: Any, global_day_index: int, week_index: int, day_in_week: int) -> List[Dict[str, Any]]:
    tasks = raw_tasks if isinstance(raw_tasks, list) else []
    normalized: List[Dict[str, Any]] = []
    for item in tasks[:TASKS_PER_DAY]:
        payload = item if isinstance(item, dict) else {"title": str(item)}
        title = str(payload.get("title") or payload.get("name") or "Recovery task").strip()
        normalized.append(
            {
                "title": title or "Recovery task",
                "rationale": str(payload.get("rationale") or "Small consistent steps build long-term stability."),
                "est_time": str(payload.get("est_time") or "5-15 min"),
                "difficulty": str(payload.get("difficulty") or "Medium"),
                "xp": int(payload.get("xp") or 10),
                "micro_skill": str(payload.get("micro_skill") or "habit"),
            }
        )
    while len(normalized) < TASKS_PER_DAY:
        normalized.append(_fallback_day_task(global_day_index, week_index, day_in_week, len(normalized) + 1))
    return normalized


def _extract_plan_days(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    phases = plan.get("phases") or []
    days_out: List[Dict[str, Any]] = []
    global_day_index = 1

    for phase in phases:
        weeks = (phase or {}).get("weeks") or []
        for week_idx, week in enumerate(weeks, start=1):
            raw_days = (week or {}).get("days") or []
            for day_in_week in range(1, PLAN_DAYS_PER_WEEK + 1):
                day_payload = raw_days[day_in_week - 1] if day_in_week - 1 < len(raw_days) else {}
                day_tasks = _normalize_day_tasks(
                    (day_payload or {}).get("tasks"),
                    global_day_index=global_day_index,
                    week_index=week_idx,
                    day_in_week=day_in_week,
                )
                days_out.append(
                    {
                        "global_day_index": global_day_index,
                        "week_index": week_idx,
                        "day_in_week": day_in_week,
                        "tasks": day_tasks,
                    }
                )
                global_day_index += 1
    return days_out


def _week_days(plan_days: List[Dict[str, Any]], week_index: int) -> List[Dict[str, Any]]:
    return [day for day in plan_days if int(day.get("week_index") or 0) == week_index]


async def _seed_plan_day_tasks(
    session: AsyncSession,
    user_id: str,
    plan_row: Plan,
    plan_day: Dict[str, Any],
) -> int:
    day_idx = int(plan_day["global_day_index"])
    exists = (
        await session.execute(
            select(Task.id)
            .where(
                Task.user_id == user_id,
                Task.plan_id == plan_row.id,
                Task.day_index == day_idx,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if exists:
        return 0

    week_idx = int(plan_day["week_index"])
    day_in_week = int(plan_day["day_in_week"])
    created = 0
    for slot, t in enumerate(plan_day["tasks"], start=1):
        details = dict(t)
        details["plan_week_index"] = week_idx
        details["plan_day_in_week"] = day_in_week
        details["plan_day_index"] = day_idx
        details["task_slot"] = slot
        session.add(
            Task(
                user_id=user_id,
                plan_id=plan_row.id,
                day_index=day_idx,
                title=t.get("title") or f"Task {slot}",
                details_json=details,
                xp=int(t.get("xp") or 10),
            )
        )
        created += 1
    return created


async def _seed_plan_week_tasks(
    session: AsyncSession,
    user_id: str,
    plan_row: Plan,
    plan_days: List[Dict[str, Any]],
    week_index: int,
) -> int:
    created = 0
    for plan_day in _week_days(plan_days, week_index):
        created += await _seed_plan_day_tasks(session, user_id, plan_row, plan_day)
    return created


async def _ensure_task_progression(session: AsyncSession, current_user: User) -> None:
    plan_row = (
        await session.execute(
            select(Plan)
            .where(Plan.user_id == current_user.id)
            .order_by(desc(Plan.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not plan_row:
        return

    plan_days = _extract_plan_days(plan_row.plan_json or {})
    if not plan_days:
        return

    tasks = (
        await session.execute(
            select(Task)
            .where(Task.user_id == current_user.id, Task.plan_id == plan_row.id)
            .order_by(Task.day_index.asc(), Task.created_at.asc())
        )
    ).scalars().all()

    if not tasks:
        await _seed_plan_week_tasks(session, current_user.id, plan_row, plan_days, week_index=1)
        return

    tasks_by_day: Dict[int, List[Task]] = {}
    for task in tasks:
        key = int(task.day_index or 0)
        tasks_by_day.setdefault(key, []).append(task)

    pending_days = sorted({int(t.day_index or 0) for t in tasks if (t.status or "").lower() != "completed"})
    total_weeks = max((int(day.get("week_index") or 0) for day in plan_days), default=0)
    if pending_days:
        active_day = pending_days[0]
        active_week = ((active_day - 1) // PLAN_DAYS_PER_WEEK) + 1
        if 1 <= active_week <= total_weeks:
            await _seed_plan_week_tasks(session, current_user.id, plan_row, plan_days, week_index=active_week)
        return

    max_seeded_day = max(int(t.day_index or 0) for t in tasks)
    max_seeded_week = ((max_seeded_day - 1) // PLAN_DAYS_PER_WEEK) + 1 if max_seeded_day > 0 else 0
    next_week = max_seeded_week + 1
    if 1 <= next_week <= total_weeks:
        await _seed_plan_week_tasks(session, current_user.id, plan_row, plan_days, week_index=next_week)


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


RISK_FEATURE_ORDER = [
    "weighted_signal",
    "trend_delta",
    "signal_volatility",
    "hours_since_last_checkin",
    "adherence",
    "stale_pending_ratio",
    "streak_norm",
    "late_night_ratio",
    "high_intensity_recent",
    "checkin_count_norm",
]


def _as_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=dt_timezone.utc)
    return ts.astimezone(dt_timezone.utc)


def _clip_0_10(value: Any, default: float = 0.0) -> float:
    try:
        return float(np.clip(float(value), 0.0, 10.0))
    except Exception:
        return default


def _risk_signal(checkin: Checkin) -> float:
    craving = _clip_0_10(checkin.craving)
    urge = _clip_0_10(checkin.urge, default=craving)
    return 0.65 * craving + 0.35 * urge


def _build_risk_features(checkins: List[Checkin], tasks: List[Task], now: datetime) -> Dict[str, float]:
    if not checkins:
        return {
            "weighted_signal": 0.25,
            "trend_delta": 0.0,
            "signal_volatility": 0.0,
            "hours_since_last_checkin": 1.0,
            "adherence": 0.5,
            "stale_pending_ratio": 0.0,
            "streak_norm": 0.0,
            "late_night_ratio": 0.0,
            "high_intensity_recent": 0.0,
            "checkin_count_norm": 0.0,
        }

    checkins_sorted = sorted(checkins, key=lambda c: _as_utc(c.ts), reverse=True)
    times = np.array([_as_utc(c.ts) for c in checkins_sorted])
    signals = np.array([_risk_signal(c) for c in checkins_sorted], dtype=float)
    age_hours = np.array([max((now - ts).total_seconds() / 3600.0, 0.1) for ts in times], dtype=float)
    weights = np.exp(-age_hours / 24.0)

    weighted_signal = float(np.clip(np.average(signals, weights=weights) / 10.0, 0.0, 1.0))

    last_24h_mask = age_hours <= 24.0
    last_7d_mask = age_hours <= 24.0 * 7.0
    avg_24h = float(np.mean(signals[last_24h_mask])) if np.any(last_24h_mask) else float(np.mean(signals))
    avg_7d = float(np.mean(signals[last_7d_mask])) if np.any(last_7d_mask) else float(np.mean(signals))
    trend_delta = float(np.clip((avg_24h - avg_7d) / 10.0, -1.0, 1.0))

    signal_volatility = float(np.clip(np.std(signals) / 10.0, 0.0, 1.0))
    hours_since_last_checkin = float(np.clip(age_hours.min() / 48.0, 0.0, 1.0))

    completed = [t for t in tasks if (t.status or "").lower() == "completed"]
    adherence = float(len(completed) / max(len(tasks), 1))

    stale_pending = [
        t for t in tasks
        if (t.status or "").lower() != "completed"
        and (now - _as_utc(t.updated_at)).total_seconds() > 48 * 3600
    ]
    stale_pending_ratio = float(len(stale_pending) / max(len(tasks), 1))

    completed_dates = [_as_utc(t.updated_at) for t in completed]
    streak_norm = float(np.clip(compute_streak(completed_dates) / 14.0, 0.0, 1.0))

    late_night = sum(1 for ts in times if ts.hour in {0, 1, 2, 3, 4, 5})
    late_night_ratio = float(late_night / max(len(times), 1))

    high_intensity_recent = 0.0
    for c in checkins_sorted:
        ts = _as_utc(c.ts)
        if (now - ts).total_seconds() <= 72 * 3600 and (_clip_0_10(c.craving) >= 8.0 or _clip_0_10(c.urge) >= 8.0):
            high_intensity_recent = 1.0
            break

    checkin_count_norm = float(np.clip(len(checkins_sorted) / 10.0, 0.0, 1.0))

    return {
        "weighted_signal": weighted_signal,
        "trend_delta": trend_delta,
        "signal_volatility": signal_volatility,
        "hours_since_last_checkin": hours_since_last_checkin,
        "adherence": adherence,
        "stale_pending_ratio": stale_pending_ratio,
        "streak_norm": streak_norm,
        "late_night_ratio": late_night_ratio,
        "high_intensity_recent": high_intensity_recent,
        "checkin_count_norm": checkin_count_norm,
    }


def _rule_based_score(features: Dict[str, float]) -> float:
    score = (
        0.40 * features["weighted_signal"]
        + 0.12 * max(features["trend_delta"], 0.0)
        + 0.08 * features["signal_volatility"]
        + 0.10 * features["hours_since_last_checkin"]
        + 0.08 * (1.0 - features["adherence"])
        + 0.07 * features["stale_pending_ratio"]
        + 0.05 * (1.0 - features["streak_norm"])
        + 0.05 * features["late_night_ratio"]
        + 0.10 * features["high_intensity_recent"]
        + 0.03 * (1.0 - features["checkin_count_norm"])
    )
    return float(np.clip(score, 0.0, 1.0))


def _vectorize_features(features: Dict[str, float]) -> np.ndarray:
    return np.array([float(features[k]) for k in RISK_FEATURE_ORDER], dtype=float)


def _sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -35.0, 35.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def _fit_logistic_regression(
    x: np.ndarray,
    y: np.ndarray,
    epochs: int = 350,
    lr: float = 0.15,
    l2: float = 0.01,
) -> Optional[Tuple[np.ndarray, float]]:
    if len(x) < 20:
        return None
    if np.sum(y == 1) < 5 or np.sum(y == 0) < 5:
        return None

    w = np.zeros(x.shape[1], dtype=float)
    b = 0.0
    n = float(len(x))

    for _ in range(epochs):
        logits = x @ w + b
        preds = _sigmoid(logits)
        err = preds - y
        grad_w = (x.T @ err) / n + l2 * w
        grad_b = float(np.sum(err) / n)
        w -= lr * grad_w
        b -= lr * grad_b

    return w, b


def _label_from_future_events(anchor: datetime, checkins: List[Checkin], alerts: List[Alert]) -> int:
    horizon = anchor + timedelta(hours=24)
    for c in checkins:
        ts = _as_utc(c.ts)
        if anchor < ts <= horizon and (_clip_0_10(c.craving) >= 8.0 or _clip_0_10(c.urge) >= 8.0):
            return 1
    for a in alerts:
        ts = _as_utc(a.ts)
        if anchor < ts <= horizon:
            return 1
    return 0


def _build_training_data(
    checkins: List[Checkin], tasks: List[Task], alerts: List[Alert]
) -> Tuple[np.ndarray, np.ndarray]:
    if len(checkins) < 8:
        return np.array([]), np.array([])

    checkins_sorted = sorted(checkins, key=lambda c: _as_utc(c.ts))
    rows: List[np.ndarray] = []
    labels: List[int] = []

    for idx in range(3, len(checkins_sorted) - 1):
        anchor = _as_utc(checkins_sorted[idx].ts)
        past_checkins = [c for c in checkins_sorted if anchor - timedelta(days=7) <= _as_utc(c.ts) <= anchor]
        past_tasks = [t for t in tasks if anchor - timedelta(days=30) <= _as_utc(t.updated_at) <= anchor]
        if len(past_checkins) < 3:
            continue
        feat = _build_risk_features(past_checkins, past_tasks, now=anchor)
        rows.append(_vectorize_features(feat))
        labels.append(_label_from_future_events(anchor, checkins_sorted, alerts))

    if not rows:
        return np.array([]), np.array([])
    return np.vstack(rows), np.array(labels, dtype=float)


def _calibrate_thresholds(scores: np.ndarray, labels: np.ndarray) -> Tuple[float, float]:
    if len(scores) < 20 or np.sum(labels == 1) < 5 or np.sum(labels == 0) < 5:
        return 0.33, 0.66

    high_candidates = np.linspace(0.45, 0.9, 30)
    best_high = 0.66
    best_f1 = -1.0
    for t in high_candidates:
        pred = scores >= t
        tp = float(np.sum((pred == 1) & (labels == 1)))
        fp = float(np.sum((pred == 1) & (labels == 0)))
        fn = float(np.sum((pred == 0) & (labels == 1)))
        precision = tp / max(tp + fp, 1.0)
        recall = tp / max(tp + fn, 1.0)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)
        if f1 > best_f1:
            best_f1 = f1
            best_high = float(t)

    low_candidates = np.linspace(0.1, min(best_high - 0.05, 0.45), 25)
    best_low = 0.33
    best_score = -1.0
    for t in low_candidates:
        pred_low = scores < t
        tn = float(np.sum((pred_low == 1) & (labels == 0)))
        fn = float(np.sum((pred_low == 1) & (labels == 1)))
        npv = tn / max(tn + fn, 1.0)
        coverage = float(np.mean(pred_low))
        metric = 0.8 * npv + 0.2 * coverage
        if metric > best_score:
            best_score = metric
            best_low = float(t)

    if best_low >= best_high:
        return 0.33, 0.66
    return best_low, best_high


def hybrid_risk_assessment(checkins: List[Checkin], tasks: List[Task], alerts: List[Alert]) -> Dict[str, Any]:
    now = datetime.now(dt_timezone.utc)
    checkins_sorted = sorted(checkins, key=lambda c: _as_utc(c.ts), reverse=True)
    tasks_sorted = sorted(tasks, key=lambda t: _as_utc(t.updated_at), reverse=True)
    alerts_sorted = sorted(alerts, key=lambda a: _as_utc(a.ts), reverse=True)

    features = _build_risk_features(checkins_sorted[:30], tasks_sorted[:80], now=now)
    rule_score = _rule_based_score(features)
    score = rule_score
    model_type = "rule"
    thresholds = (0.33, 0.66)

    train_x, train_y = _build_training_data(checkins_sorted[:160], tasks_sorted[:220], alerts_sorted[:120])
    trained = _fit_logistic_regression(train_x, train_y) if len(train_x) else None
    if trained is not None:
        w, b = trained
        train_scores = _sigmoid(train_x @ w + b)
        low_t, high_t = _calibrate_thresholds(train_scores, train_y)
        ml_score = float(_sigmoid(np.array([_vectorize_features(features) @ w + b]))[0])
        score = float(np.clip(0.65 * ml_score + 0.35 * rule_score, 0.0, 1.0))
        thresholds = (low_t, high_t)
        model_type = "hybrid_logistic_plus_rules"

    severe_recent_checkin = any(
        (now - _as_utc(c.ts)).total_seconds() <= 24 * 3600
        and (_clip_0_10(c.craving) >= 9.0 or _clip_0_10(c.urge) >= 9.0)
        for c in checkins_sorted
    )
    severe_recent_alert = any((now - _as_utc(a.ts)).total_seconds() <= 24 * 3600 for a in alerts_sorted)

    override = None
    if severe_recent_checkin or severe_recent_alert:
        score = max(score, 0.82)
        override = "safety_override_recent_critical_signal"

    low_t, high_t = thresholds
    if score < low_t:
        bucket = "Low"
    elif score < high_t:
        bucket = "Medium"
    else:
        bucket = "High"

    if override:
        bucket = "High"

    rationale = (
        f"Model={model_type}, weighted_signal={features['weighted_signal']:.2f}, trend={features['trend_delta']:.2f}, "
        f"adherence={features['adherence']:.2f}, stale_pending={features['stale_pending_ratio']:.2f}, "
        f"score={score:.2f}, thresholds=({low_t:.2f},{high_t:.2f})"
    )

    return {
        "score": float(score),
        "bucket": bucket,
        "rationale": rationale,
        "model_type": model_type,
        "thresholds": {"low": float(low_t), "high": float(high_t)},
        "features": features,
        "override": override,
    }


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


def _split_lines_or_csv(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value)
    text = text.replace("\r", "\n")
    parts: List[str] = []
    for chunk in text.split("\n"):
        for item in chunk.split(","):
            normalized = item.strip()
            if normalized:
                parts.append(normalized)
    return parts


def _normalize_contacts(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        contact = str(item.get("contact") or "").strip()
        relationship_label = str(item.get("relationship") or item.get("relationship_label") or "").strip()
        if not name:
            continue
        normalized.append(
            {
                "name": name,
                "contact": contact,
                "relationship": relationship_label,
            }
        )
    return normalized


def _hour_bucket(ts: datetime) -> str:
    hour = _as_utc(ts).hour
    if 5 <= hour < 12:
        return "Morning"
    if 12 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 22:
        return "Evening"
    return "Late night"


def _build_recovery_insights(
    craving_logs: List[CravingLog],
    tasks: List[Task],
    slips: List[SlipEvent],
) -> Dict[str, Any]:
    completed_tasks = [t for t in tasks if (t.status or "").lower() == "completed"]
    cravings_resisted = sum(1 for c in craving_logs if (c.action_taken or "").strip())
    avg_intensity = round(sum(c.intensity for c in craving_logs) / max(len(craving_logs), 1), 1) if craving_logs else 0.0

    trigger_counts: Dict[str, int] = {}
    hour_counts: Dict[str, int] = {}
    location_counts: Dict[str, int] = {}

    for log in craving_logs:
        if log.trigger:
            trigger_counts[log.trigger] = trigger_counts.get(log.trigger, 0) + 1
        if log.location:
            location_counts[log.location] = location_counts.get(log.location, 0) + 1
        bucket = _hour_bucket(log.ts)
        hour_counts[bucket] = hour_counts.get(bucket, 0) + 1

    top_trigger = max(trigger_counts.items(), key=lambda item: item[1])[0] if trigger_counts else "No clear trigger yet"
    top_hour = max(hour_counts.items(), key=lambda item: item[1])[0] if hour_counts else "Not enough data"
    top_location = max(location_counts.items(), key=lambda item: item[1])[0] if location_counts else "No clear location yet"

    insight_lines = [
        f"Most cravings are appearing in the {top_hour.lower()}." if top_hour != "Not enough data" else "Log a few cravings to surface time patterns.",
        f"Your strongest repeated trigger is {top_trigger.lower()}." if trigger_counts else "Triggers will appear here once you log a few difficult moments.",
        f"The most repeated location is {top_location.lower()}." if location_counts else "Location patterns will appear once you add them to craving logs.",
    ]

    return {
        "metrics": {
            "cravings_logged": len(craving_logs),
            "cravings_resisted": cravings_resisted,
            "slips_logged": len(slips),
            "avg_craving_intensity": avg_intensity,
            "completed_tasks": len(completed_tasks),
        },
        "patterns": {
            "top_trigger": top_trigger,
            "top_time_window": top_hour,
            "top_location": top_location,
        },
        "insight_lines": insight_lines,
    }


async def _build_coach_context_snapshot(session: AsyncSession, user_id: str) -> Dict[str, Any]:
    tasks = (
        await session.execute(select(Task).where(Task.user_id == user_id))
    ).scalars().all()
    craving_logs = (
        await session.execute(
            select(CravingLog)
            .where(CravingLog.user_id == user_id)
            .order_by(desc(CravingLog.ts))
            .limit(20)
        )
    ).scalars().all()
    slips = (
        await session.execute(
            select(SlipEvent)
            .where(SlipEvent.user_id == user_id)
            .order_by(desc(SlipEvent.ts))
            .limit(10)
        )
    ).scalars().all()
    plan = (
        await session.execute(
            select(EmergencyPlan)
            .where(EmergencyPlan.user_id == user_id)
            .order_by(desc(EmergencyPlan.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    support_members = (
        await session.execute(
            select(SupportCircleMember)
            .where(SupportCircleMember.user_id == user_id, SupportCircleMember.status == "active")
        )
    ).scalars().all()

    insights = _build_recovery_insights(craving_logs, tasks, slips)
    return {
        "completed_tasks": insights["metrics"]["completed_tasks"],
        "cravings_logged": insights["metrics"]["cravings_logged"],
        "cravings_resisted": insights["metrics"]["cravings_resisted"],
        "slips_logged": insights["metrics"]["slips_logged"],
        "avg_craving_intensity": insights["metrics"]["avg_craving_intensity"],
        "top_trigger": insights["patterns"]["top_trigger"],
        "top_time_window": insights["patterns"]["top_time_window"],
        "replacement_actions": (plan.replacement_actions[:3] if plan else []),
        "reasons_to_quit": (plan.reasons_to_quit[:3] if plan else []),
        "support_circle_count": len(support_members),
    }


@router.get("/progress/summary")
async def progress_summary(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    tasks = (
        await session.execute(select(Task).where(Task.user_id == current_user.id))
    ).scalars().all()
    craving_logs = (
        await session.execute(
            select(CravingLog)
            .where(CravingLog.user_id == current_user.id)
            .order_by(desc(CravingLog.ts))
            .limit(90)
        )
    ).scalars().all()
    slips = (
        await session.execute(
            select(SlipEvent)
            .where(SlipEvent.user_id == current_user.id)
            .order_by(desc(SlipEvent.ts))
            .limit(30)
        )
    ).scalars().all()
    completed = [t for t in tasks if t.status == "completed"]
    total_xp = sum(t.xp for t in completed)
    completed_dates = [t.updated_at.replace(tzinfo=dt_timezone.utc) if t.updated_at.tzinfo is None else t.updated_at for t in completed]
    streak = compute_streak(completed_dates)
    insights = _build_recovery_insights(craving_logs, tasks, slips)
    return {
        "completed_tasks": len(completed),
        "total_tasks": len(tasks),
        "total_xp": total_xp,
        "streak_days": streak,
        "cravings_logged": insights["metrics"]["cravings_logged"],
        "cravings_resisted": insights["metrics"]["cravings_resisted"],
        "slips_logged": insights["metrics"]["slips_logged"],
        "avg_craving_intensity": insights["metrics"]["avg_craving_intensity"],
        "patterns": insights["patterns"],
        "insight_lines": insights["insight_lines"],
    }


@router.post("/cravings/log")
async def create_craving_log(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        intensity = int(payload.get("intensity"))
    except Exception:
        raise HTTPException(status_code=400, detail="intensity must be an integer from 0 to 10")
    if intensity < 0 or intensity > 10:
        raise HTTPException(status_code=400, detail="intensity must be between 0 and 10")

    log = CravingLog(
        user_id=current_user.id,
        intensity=intensity,
        mood=(payload.get("mood") or None),
        trigger=(payload.get("trigger") or None),
        location=(payload.get("location") or None),
        action_taken=(payload.get("action_taken") or None),
        notes=(payload.get("notes") or None),
    )
    session.add(log)
    await session.commit()
    return {"status": "ok", "id": log.id, "ts": log.ts.isoformat() if log.ts else None}


@router.get("/cravings/history")
async def craving_history(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    logs = (
        await session.execute(
            select(CravingLog)
            .where(CravingLog.user_id == current_user.id)
            .order_by(desc(CravingLog.ts))
            .limit(40)
        )
    ).scalars().all()
    tasks = (
        await session.execute(select(Task).where(Task.user_id == current_user.id))
    ).scalars().all()
    slips = (
        await session.execute(
            select(SlipEvent)
            .where(SlipEvent.user_id == current_user.id)
            .order_by(desc(SlipEvent.ts))
            .limit(20)
        )
    ).scalars().all()
    insights = _build_recovery_insights(logs, tasks, slips)
    return {
        "logs": [
            {
                "id": log.id,
                "intensity": log.intensity,
                "mood": log.mood,
                "trigger": log.trigger,
                "location": log.location,
                "action_taken": log.action_taken,
                "notes": log.notes,
                "ts": log.ts.isoformat() if log.ts else None,
            }
            for log in logs
        ],
        "patterns": insights["patterns"],
        "insight_lines": insights["insight_lines"],
    }


@router.post("/slip/log")
async def create_slip_log(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    slip = SlipEvent(
        user_id=current_user.id,
        trigger=(payload.get("trigger") or None),
        happened_before=(payload.get("happened_before") or None),
        safe_action=(payload.get("safe_action") or None),
        next_hour_plan=(payload.get("next_hour_plan") or None),
        next_day_plan=(payload.get("next_day_plan") or None),
        notes=(payload.get("notes") or None),
    )
    session.add(slip)
    await session.commit()
    return {"status": "ok", "id": slip.id, "ts": slip.ts.isoformat() if slip.ts else None}


@router.get("/slips/recent")
async def recent_slips(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    slips = (
        await session.execute(
            select(SlipEvent)
            .where(SlipEvent.user_id == current_user.id)
            .order_by(desc(SlipEvent.ts))
            .limit(12)
        )
    ).scalars().all()
    return {
        "slips": [
            {
                "id": slip.id,
                "trigger": slip.trigger,
                "happened_before": slip.happened_before,
                "safe_action": slip.safe_action,
                "next_hour_plan": slip.next_hour_plan,
                "next_day_plan": slip.next_day_plan,
                "notes": slip.notes,
                "ts": slip.ts.isoformat() if slip.ts else None,
            }
            for slip in slips
        ]
    }


@router.get("/emergency-plan")
async def get_emergency_plan(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    plan = (
        await session.execute(
            select(EmergencyPlan)
            .where(EmergencyPlan.user_id == current_user.id)
            .order_by(desc(EmergencyPlan.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not plan:
        return {
            "plan": {
                "triggers": [],
                "danger_hours": [],
                "contacts": [],
                "safe_places": [],
                "replacement_actions": [],
                "reasons_to_quit": [],
            }
        }
    return {
        "plan": {
            "id": plan.id,
            "triggers": plan.triggers,
            "danger_hours": plan.danger_hours,
            "contacts": plan.contacts,
            "safe_places": plan.safe_places,
            "replacement_actions": plan.replacement_actions,
            "reasons_to_quit": plan.reasons_to_quit,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        }
    }


@router.post("/emergency-plan")
async def save_emergency_plan(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    plan = (
        await session.execute(
            select(EmergencyPlan)
            .where(EmergencyPlan.user_id == current_user.id)
            .order_by(desc(EmergencyPlan.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    normalized_contacts = _normalize_contacts(payload.get("contacts"))
    if not plan:
        plan = EmergencyPlan(
            user_id=current_user.id,
            triggers=_split_lines_or_csv(payload.get("triggers")),
            danger_hours=_split_lines_or_csv(payload.get("danger_hours")),
            contacts=normalized_contacts,
            safe_places=_split_lines_or_csv(payload.get("safe_places")),
            replacement_actions=_split_lines_or_csv(payload.get("replacement_actions")),
            reasons_to_quit=_split_lines_or_csv(payload.get("reasons_to_quit")),
        )
        session.add(plan)
    else:
        plan.triggers = _split_lines_or_csv(payload.get("triggers"))
        plan.danger_hours = _split_lines_or_csv(payload.get("danger_hours"))
        plan.contacts = normalized_contacts
        plan.safe_places = _split_lines_or_csv(payload.get("safe_places"))
        plan.replacement_actions = _split_lines_or_csv(payload.get("replacement_actions"))
        plan.reasons_to_quit = _split_lines_or_csv(payload.get("reasons_to_quit"))
        plan.updated_at = datetime.utcnow()

    await session.commit()
    return {"status": "ok", "id": plan.id, "updated_at": plan.updated_at.isoformat() if plan.updated_at else None}


@router.get("/support-circle")
async def get_support_circle(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    members = (
        await session.execute(
            select(SupportCircleMember)
            .where(SupportCircleMember.user_id == current_user.id)
            .order_by(desc(SupportCircleMember.created_at))
        )
    ).scalars().all()
    return {
        "members": [
            {
                "id": member.id,
                "name": member.name,
                "relationship_label": member.relationship_label,
                "contact": member.contact,
                "status": member.status,
                "created_at": member.created_at.isoformat() if member.created_at else None,
            }
            for member in members
        ]
    }


@router.post("/support-circle/invite")
async def add_support_member(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    member = SupportCircleMember(
        user_id=current_user.id,
        name=name,
        relationship_label=(payload.get("relationship_label") or None),
        contact=(payload.get("contact") or None),
        status="active",
    )
    session.add(member)
    await session.commit()
    return {"status": "ok", "member_id": member.id}


@router.post("/support-circle/alert")
async def alert_support_circle(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    members = (
        await session.execute(
            select(SupportCircleMember)
            .where(SupportCircleMember.user_id == current_user.id, SupportCircleMember.status == "active")
        )
    ).scalars().all()
    alert = Alert(
        user_id=current_user.id,
        type="support-circle-alert",
        payload_json={
            "message": payload.get("message") or "I need support right now.",
            "member_count": len(members),
            "members": [
                {
                    "name": member.name,
                    "contact": member.contact,
                    "relationship_label": member.relationship_label,
                }
                for member in members
            ],
        },
    )
    session.add(alert)
    await session.commit()
    return {"status": "ok", "alert_id": alert.id, "member_count": len(members)}


@router.get("/community/overview")
async def community_overview(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    following_rows = (
        await session.execute(
            select(UserFollow).where(UserFollow.follower_id == current_user.id).order_by(desc(UserFollow.created_at))
        )
    ).scalars().all()
    following_ids = [row.following_id for row in following_rows]

    followed_users: List[User] = []
    if following_ids:
        followed_users = (
            await session.execute(select(User).where(User.id.in_(following_ids)))
        ).scalars().all()
    followed_map = {user.id: user for user in followed_users}

    following_id_set = set(following_ids)
    discover_rows = (
        await session.execute(
            select(User)
            .where(User.id != current_user.id)
            .order_by(desc(User.created_at))
            .limit(16)
        )
    ).scalars().all()
    discover = [user for user in discover_rows if user.id not in following_id_set][:6]

    member_rows = (
        await session.execute(
            select(CommunityGroupMember).where(CommunityGroupMember.user_id == current_user.id)
        )
    ).scalars().all()
    group_ids = [row.group_id for row in member_rows]

    groups: List[CommunityGroup] = []
    if group_ids:
        groups = (
            await session.execute(
                select(CommunityGroup).where(CommunityGroup.id.in_(group_ids)).order_by(desc(CommunityGroup.created_at))
            )
        ).scalars().all()

    group_member_rows = (
        await session.execute(
            select(CommunityGroupMember).where(CommunityGroupMember.group_id.in_(group_ids))
        )
    ).scalars().all() if group_ids else []
    group_counts: Dict[str, int] = {}
    for row in group_member_rows:
        group_counts[row.group_id] = group_counts.get(row.group_id, 0) + 1

    direct_messages = (
        await session.execute(
            select(CommunityMessage)
            .where(
                CommunityMessage.group_id.is_(None),
                or_(
                    CommunityMessage.sender_id == current_user.id,
                    CommunityMessage.recipient_id == current_user.id,
                ),
            )
            .order_by(desc(CommunityMessage.created_at))
        )
    ).scalars().all()

    partner_ids: List[str] = []
    latest_by_partner: Dict[str, CommunityMessage] = {}
    seen_partner_ids: set[str] = set()
    for msg in direct_messages:
        partner_id = msg.recipient_id if msg.sender_id == current_user.id else msg.sender_id
        if not partner_id or partner_id in seen_partner_ids:
            continue
        seen_partner_ids.add(partner_id)
        partner_ids.append(partner_id)
        latest_by_partner[partner_id] = msg

    partner_users: Dict[str, User] = {}
    if partner_ids:
        partner_users = {
            user.id: user
            for user in (
                await session.execute(select(User).where(User.id.in_(partner_ids)))
            ).scalars().all()
        }

    direct_threads: List[Dict[str, Any]] = []
    for partner_id in partner_ids:
        partner = partner_users.get(partner_id)
        latest = latest_by_partner[partner_id]
        direct_threads.append(
            {
                "kind": "direct",
                "partner": _serialize_user_card(partner) if partner else {"id": partner_id, "display_name": "Member", "handle": "@member"},
                "last_message": latest.body,
                "last_message_at": latest.created_at.isoformat() if latest.created_at else None,
                "last_sender_id": latest.sender_id,
            }
        )

    return {
        "profile": _serialize_user_card(current_user),
        "following": [_serialize_user_card(followed_map[user_id]) for user_id in following_ids if user_id in followed_map],
        "discover": [_serialize_user_card(user) for user in discover],
        "groups": [
            {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "member_count": group_counts.get(group.id, 1),
                "created_at": group.created_at.isoformat() if group.created_at else None,
            }
            for group in groups
        ],
        "direct_threads": direct_threads,
    }


@router.post("/community/follow")
async def follow_user(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    target_user = (
        await session.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == target_user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"status": "ok", "followed_user": _serialize_user_card(target_user), "already_following": True}

    session.add(UserFollow(follower_id=current_user.id, following_id=target_user_id))
    await session.commit()
    return {"status": "ok", "followed_user": _serialize_user_card(target_user)}


@router.post("/community/unfollow")
async def unfollow_user(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    existing = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == target_user_id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        return {"status": "ok", "already_unfollowed": True}

    await session.delete(existing)
    await session.commit()
    return {"status": "ok"}


@router.get("/community/profile/me")
async def my_community_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    following_count = len(
        (
            await session.execute(
                select(UserFollow).where(UserFollow.follower_id == current_user.id)
            )
        ).scalars().all()
    )
    follower_count = len(
        (
            await session.execute(
                select(UserFollow).where(UserFollow.following_id == current_user.id)
            )
        ).scalars().all()
    )
    groups_joined = len(
        (
            await session.execute(
                select(CommunityGroupMember).where(CommunityGroupMember.user_id == current_user.id)
            )
        ).scalars().all()
    )
    chats_opened = len(
        (
            await session.execute(
                select(CommunityMessage).where(
                    or_(
                        CommunityMessage.sender_id == current_user.id,
                        CommunityMessage.recipient_id == current_user.id,
                    )
                )
            )
        ).scalars().all()
    )

    return {
        "user": _serialize_user_card(current_user),
        "metrics": {
            "followers": follower_count,
            "following": following_count,
            "groups_joined": groups_joined,
            "chats_opened": chats_opened,
        },
        "is_self": True,
        "is_following": False,
    }


@router.get("/community/profile/{user_id}")
async def community_profile(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    following_count = len(
        (
            await session.execute(
                select(UserFollow).where(UserFollow.follower_id == user_id)
            )
        ).scalars().all()
    )
    follower_count = len(
        (
            await session.execute(
                select(UserFollow).where(UserFollow.following_id == user_id)
            )
        ).scalars().all()
    )
    groups_joined = len(
        (
            await session.execute(
                select(CommunityGroupMember).where(CommunityGroupMember.user_id == user_id)
            )
        ).scalars().all()
    )
    chats_opened = len(
        (
            await session.execute(
                select(CommunityMessage).where(
                    or_(
                        CommunityMessage.sender_id == user_id,
                        CommunityMessage.recipient_id == user_id,
                    )
                )
            )
        ).scalars().all()
    )

    is_following = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == user_id,
            )
        )
    ).scalar_one_or_none() is not None

    return {
        "user": _serialize_user_card(user),
        "metrics": {
            "followers": follower_count,
            "following": following_count,
            "groups_joined": groups_joined,
            "chats_opened": chats_opened,
        },
        "is_self": user_id == current_user.id,
        "is_following": is_following,
    }


@router.post("/community/groups")
async def create_community_group(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    group = CommunityGroup(name=name[:80], description=description[:240] or None, created_by=current_user.id)
    session.add(group)
    await session.flush()
    session.add(CommunityGroupMember(group_id=group.id, user_id=current_user.id, role="owner"))
    await session.commit()
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "member_count": 1,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


@router.post("/community/groups/{group_id}/join")
async def join_community_group(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    group = (
        await session.execute(select(CommunityGroup).where(CommunityGroup.id == group_id))
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = (
        await session.execute(
            select(CommunityGroupMember).where(
                CommunityGroupMember.group_id == group_id,
                CommunityGroupMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        session.add(CommunityGroupMember(group_id=group_id, user_id=current_user.id))
        await session.commit()

    member_count = (
        await session.execute(select(CommunityGroupMember).where(CommunityGroupMember.group_id == group_id))
    ).scalars().all()
    return {"status": "ok", "group_id": group_id, "member_count": len(member_count)}


@router.get("/community/groups/discover")
async def discover_community_groups(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    member_rows = (
        await session.execute(
            select(CommunityGroupMember).where(CommunityGroupMember.user_id == current_user.id)
        )
    ).scalars().all()
    joined_ids = {row.group_id for row in member_rows}
    groups = (
        await session.execute(
            select(CommunityGroup).order_by(desc(CommunityGroup.created_at)).limit(12)
        )
    ).scalars().all()
    member_counts = (
        await session.execute(select(CommunityGroupMember))
    ).scalars().all()
    counts: Dict[str, int] = {}
    for row in member_counts:
        counts[row.group_id] = counts.get(row.group_id, 0) + 1

    return {
        "groups": [
            {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "member_count": counts.get(group.id, 1),
                "joined": group.id in joined_ids,
            }
            for group in groups
            if group.id not in joined_ids
        ]
    }


@router.get("/community/direct/{partner_id}")
async def get_direct_thread(
    partner_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    partner = (
        await session.execute(select(User).where(User.id == partner_id))
    ).scalar_one_or_none()
    if not partner or partner.id == current_user.id:
        raise HTTPException(status_code=404, detail="Conversation partner not found")

    messages = (
        await session.execute(
            select(CommunityMessage)
            .where(
                CommunityMessage.group_id.is_(None),
                or_(
                    (
                        (CommunityMessage.sender_id == current_user.id)
                        & (CommunityMessage.recipient_id == partner_id)
                    ),
                    (
                        (CommunityMessage.sender_id == partner_id)
                        & (CommunityMessage.recipient_id == current_user.id)
                    ),
                ),
            )
            .order_by(CommunityMessage.created_at.asc())
        )
    ).scalars().all()

    return {
        "kind": "direct",
        "partner": _serialize_user_card(partner),
        "messages": [
            _serialize_community_message(
                message,
                current_user.id,
                current_user if message.sender_id == current_user.id else partner,
            )
            for message in messages
        ],
    }


@router.get("/community/groups/{group_id}/messages")
async def get_group_thread(
    group_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    membership = (
        await session.execute(
            select(CommunityGroupMember).where(
                CommunityGroupMember.group_id == group_id,
                CommunityGroupMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Join the group first")

    group = (
        await session.execute(select(CommunityGroup).where(CommunityGroup.id == group_id))
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    messages = (
        await session.execute(
            select(CommunityMessage)
            .where(CommunityMessage.group_id == group_id)
            .order_by(CommunityMessage.created_at.asc())
        )
    ).scalars().all()
    sender_ids = list({message.sender_id for message in messages})
    senders = {
        user.id: user
        for user in (
            await session.execute(select(User).where(User.id.in_(sender_ids)))
        ).scalars().all()
    } if sender_ids else {}

    return {
        "kind": "group",
        "group": {
            "id": group.id,
            "name": group.name,
            "description": group.description,
        },
        "messages": [
            _serialize_community_message(message, current_user.id, senders.get(message.sender_id))
            for message in messages
        ],
    }


@router.post("/community/messages")
async def create_community_message(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    body = str(payload.get("body") or "").strip()
    kind = str(payload.get("kind") or "direct").strip().lower()
    if not body:
        raise HTTPException(status_code=400, detail="body is required")

    if kind == "group":
        group_id = str(payload.get("group_id") or "").strip()
        if not group_id:
            raise HTTPException(status_code=400, detail="group_id is required")
        membership = (
            await session.execute(
                select(CommunityGroupMember).where(
                    CommunityGroupMember.group_id == group_id,
                    CommunityGroupMember.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=403, detail="Join the group first")
        message = CommunityMessage(sender_id=current_user.id, group_id=group_id, body=body[:4000])
        session.add(message)
        await session.commit()
        return {"status": "ok", "message": _serialize_community_message(message, current_user.id, current_user)}

    recipient_id = str(payload.get("recipient_id") or "").strip()
    if not recipient_id or recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="recipient_id is required")
    recipient = (
        await session.execute(select(User).where(User.id == recipient_id))
    ).scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    message = CommunityMessage(sender_id=current_user.id, recipient_id=recipient_id, body=body[:4000])
    session.add(message)
    await session.commit()
    return {"status": "ok", "message": _serialize_community_message(message, current_user.id, current_user)}


@router.get("/social/overview")
async def social_overview(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    my_following_rows = (
        await session.execute(select(UserFollow).where(UserFollow.follower_id == current_user.id))
    ).scalars().all()
    following_ids = [row.following_id for row in my_following_rows]
    following_set = set(following_ids)

    my_follower_rows = (
        await session.execute(select(UserFollow).where(UserFollow.following_id == current_user.id))
    ).scalars().all()

    friendships = (
        await session.execute(
            select(SocialFriendship).where(
                or_(
                    SocialFriendship.user_a_id == current_user.id,
                    SocialFriendship.user_b_id == current_user.id,
                )
            )
        )
    ).scalars().all()

    friend_ids: List[str] = []
    for friendship in friendships:
        friend_ids.append(
            friendship.user_b_id if friendship.user_a_id == current_user.id else friendship.user_a_id
        )

    friend_users = (
        await session.execute(select(User).where(User.id.in_(friend_ids)))
    ).scalars().all() if friend_ids else []
    friend_map = {user.id: user for user in friend_users}

    pending_received = (
        await session.execute(
            select(SocialFriendRequest)
            .where(
                SocialFriendRequest.addressee_id == current_user.id,
                SocialFriendRequest.status == "pending",
            )
            .order_by(desc(SocialFriendRequest.created_at))
        )
    ).scalars().all()
    requester_ids = [request.requester_id for request in pending_received]
    requesters = (
        await session.execute(select(User).where(User.id.in_(requester_ids)))
    ).scalars().all() if requester_ids else []
    requester_map = {user.id: user for user in requesters}

    pending_sent = (
        await session.execute(
            select(SocialFriendRequest)
            .where(
                SocialFriendRequest.requester_id == current_user.id,
                SocialFriendRequest.status == "pending",
            )
            .order_by(desc(SocialFriendRequest.created_at))
        )
    ).scalars().all()

    member_rows = (
        await session.execute(select(SocialChatMember).where(SocialChatMember.user_id == current_user.id))
    ).scalars().all()
    chat_ids = [row.chat_id for row in member_rows]

    chats = (
        await session.execute(select(SocialChat).where(SocialChat.id.in_(chat_ids)))
    ).scalars().all() if chat_ids else []
    chats_map = {chat.id: chat for chat in chats}

    chat_members = (
        await session.execute(select(SocialChatMember).where(SocialChatMember.chat_id.in_(chat_ids)))
    ).scalars().all() if chat_ids else []
    members_by_chat: Dict[str, List[SocialChatMember]] = {}
    for member in chat_members:
        members_by_chat.setdefault(member.chat_id, []).append(member)

    latest_messages = (
        await session.execute(
            select(SocialChatMessage)
            .where(SocialChatMessage.chat_id.in_(chat_ids))
            .order_by(desc(SocialChatMessage.created_at))
        )
    ).scalars().all() if chat_ids else []
    latest_by_chat: Dict[str, SocialChatMessage] = {}
    for message in latest_messages:
        if message.chat_id not in latest_by_chat:
            latest_by_chat[message.chat_id] = message

    all_member_user_ids = list({row.user_id for row in chat_members})
    all_member_users = (
        await session.execute(select(User).where(User.id.in_(all_member_user_ids)))
    ).scalars().all() if all_member_user_ids else []
    member_user_map = {user.id: user for user in all_member_users}

    direct_chats: List[Dict[str, Any]] = []
    group_chats: List[Dict[str, Any]] = []
    for chat_id in chat_ids:
        chat = chats_map.get(chat_id)
        if not chat:
            continue
        latest = latest_by_chat.get(chat_id)
        participants = members_by_chat.get(chat_id, [])
        if chat.kind == "direct":
            partner_member = next((m for m in participants if m.user_id != current_user.id), None)
            if not partner_member:
                continue
            partner_user = member_user_map.get(partner_member.user_id)
            direct_chats.append(
                {
                    "chat_id": chat.id,
                    "kind": "direct",
                    "partner": _serialize_user_card(partner_user) if partner_user else {
                        "id": partner_member.user_id,
                        "display_name": "Member",
                        "handle": "@member",
                    },
                    "last_message": latest.body if latest else None,
                    "last_message_at": latest.created_at.isoformat() if latest and latest.created_at else None,
                }
            )
        elif chat.kind == "group":
            group_chats.append(
                {
                    "chat_id": chat.id,
                    "kind": "group",
                    "name": chat.title or "Community",
                    "member_count": len(participants),
                    "last_message": latest.body if latest else None,
                    "last_message_at": latest.created_at.isoformat() if latest and latest.created_at else None,
                }
            )

    discover_candidates = (
        await session.execute(
            select(User).where(User.id != current_user.id).order_by(desc(User.created_at)).limit(24)
        )
    ).scalars().all()
    friend_set = set(friend_ids)
    pending_user_set = {request.requester_id for request in pending_received} | {
        request.addressee_id for request in pending_sent
    }
    discover_users = [
        user
        for user in discover_candidates
        if user.id not in friend_set and user.id not in pending_user_set
    ][:10]

    stats_user_ids = [current_user.id, *friend_ids, *requester_ids, *all_member_user_ids, *[u.id for u in discover_users]]
    activity_stats = await _activity_stats_for_users(session, stats_user_ids)

    return {
        "profile": {
            **_serialize_user_card(
                current_user,
                stats=activity_stats.get(current_user.id),
                is_following=False,
            ),
            "followers_count": len(my_follower_rows),
            "following_count": len(my_following_rows),
        },
        "friends": [
            _serialize_user_card(
                friend_map[user_id],
                stats=activity_stats.get(user_id),
                is_following=user_id in following_set,
            )
            for user_id in friend_ids
            if user_id in friend_map
        ],
        "pending_received": [
            {
                "request_id": request.id,
                "requester": (
                    _serialize_user_card(
                        requester_map[request.requester_id],
                        stats=activity_stats.get(request.requester_id),
                        is_following=request.requester_id in following_set,
                    )
                    if request.requester_id in requester_map
                    else {
                        "id": request.requester_id,
                        "display_name": "Member",
                        "handle": "@member",
                        "current_streak_days": 0,
                        "active_days": 0,
                        "is_following": request.requester_id in following_set,
                    }
                ),
                "created_at": request.created_at.isoformat() if request.created_at else None,
            }
            for request in pending_received
        ],
        "pending_sent": [
            {
                "request_id": request.id,
                "target_user_id": request.addressee_id,
                "created_at": request.created_at.isoformat() if request.created_at else None,
            }
            for request in pending_sent
        ],
        "direct_chats": direct_chats,
        "groups": group_chats,
        "discover": [
            _serialize_user_card(
                user,
                stats=activity_stats.get(user.id),
                is_following=user.id in following_set,
            )
            for user in discover_users
        ],
    }


@router.get("/social/search")
async def social_search_profiles(
    q: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    query = (q or "").strip().lower()
    if len(query) < 2:
        return {"results": []}

    users = (
        await session.execute(
            select(User)
            .where(
                User.id != current_user.id,
                User.email.is_not(None),
                User.email.ilike(f"%{query}%"),
            )
            .order_by(desc(User.created_at))
            .limit(24)
        )
    ).scalars().all()
    target_ids = [user.id for user in users]

    friendships = (
        await session.execute(
            select(SocialFriendship).where(
                or_(
                    and_(
                        SocialFriendship.user_a_id == current_user.id,
                        SocialFriendship.user_b_id.in_(target_ids),
                    ),
                    and_(
                        SocialFriendship.user_b_id == current_user.id,
                        SocialFriendship.user_a_id.in_(target_ids),
                    ),
                )
            )
        )
    ).scalars().all() if target_ids else []

    friend_ids = {
        friendship.user_b_id if friendship.user_a_id == current_user.id else friendship.user_a_id
        for friendship in friendships
    }

    pending_requests = (
        await session.execute(
            select(SocialFriendRequest).where(
                SocialFriendRequest.status == "pending",
                or_(
                    and_(
                        SocialFriendRequest.requester_id == current_user.id,
                        SocialFriendRequest.addressee_id.in_(target_ids),
                    ),
                    and_(
                        SocialFriendRequest.addressee_id == current_user.id,
                        SocialFriendRequest.requester_id.in_(target_ids),
                    ),
                ),
            )
        )
    ).scalars().all() if target_ids else []

    request_state: Dict[str, str] = {}
    for request in pending_requests:
        if request.requester_id == current_user.id:
            request_state[request.addressee_id] = "outgoing"
        else:
            request_state[request.requester_id] = "incoming"

    following_rows = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id.in_(target_ids),
            )
        )
    ).scalars().all() if target_ids else []
    following_set = {row.following_id for row in following_rows}
    activity_stats = await _activity_stats_for_users(session, target_ids)

    return {
        "results": [
            {
                **_serialize_user_card(
                    user,
                    stats=activity_stats.get(user.id),
                    is_following=user.id in following_set,
                ),
                "is_friend": user.id in friend_ids,
                "request_state": request_state.get(user.id, "none"),
            }
            for user in users
        ]
    }


@router.post("/social/friends/request")
async def social_send_friend_request(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    target_user = (
        await session.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    a_id, b_id = _friend_pair(current_user.id, target_user_id)
    friendship = (
        await session.execute(
            select(SocialFriendship).where(
                SocialFriendship.user_a_id == a_id,
                SocialFriendship.user_b_id == b_id,
            )
        )
    ).scalar_one_or_none()
    if friendship:
        return {"status": "ok", "already_friends": True}

    reverse_request = (
        await session.execute(
            select(SocialFriendRequest).where(
                SocialFriendRequest.requester_id == target_user_id,
                SocialFriendRequest.addressee_id == current_user.id,
                SocialFriendRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if reverse_request:
        reverse_request.status = "accepted"
        reverse_request.responded_at = datetime.utcnow()
        session.add(SocialFriendship(user_a_id=a_id, user_b_id=b_id))
        await session.commit()
        return {"status": "ok", "auto_accepted": True}

    existing_request = (
        await session.execute(
            select(SocialFriendRequest).where(
                SocialFriendRequest.requester_id == current_user.id,
                SocialFriendRequest.addressee_id == target_user_id,
                SocialFriendRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if existing_request:
        return {"status": "ok", "already_sent": True}

    request = SocialFriendRequest(requester_id=current_user.id, addressee_id=target_user_id)
    session.add(request)
    await session.commit()
    return {"status": "ok", "request_id": request.id}


@router.post("/social/friends/respond")
async def social_respond_friend_request(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    request_id = str(payload.get("request_id") or "").strip()
    action = str(payload.get("action") or "reject").strip().lower()
    if action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="action must be accept or reject")

    request = (
        await session.execute(
            select(SocialFriendRequest).where(
                SocialFriendRequest.id == request_id,
                SocialFriendRequest.addressee_id == current_user.id,
                SocialFriendRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")

    request.status = "accepted" if action == "accept" else "rejected"
    request.responded_at = datetime.utcnow()

    if action == "accept":
        a_id, b_id = _friend_pair(request.requester_id, request.addressee_id)
        existing_friendship = (
            await session.execute(
                select(SocialFriendship).where(
                    SocialFriendship.user_a_id == a_id,
                    SocialFriendship.user_b_id == b_id,
                )
            )
        ).scalar_one_or_none()
        if not existing_friendship:
            session.add(SocialFriendship(user_a_id=a_id, user_b_id=b_id))

    await session.commit()
    return {"status": "ok", "action": action}


@router.post("/social/friends/remove")
async def social_remove_friend(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    friend_user_id = str(payload.get("friend_user_id") or "").strip()
    if not friend_user_id or friend_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid friend_user_id is required")

    a_id, b_id = _friend_pair(current_user.id, friend_user_id)
    friendship = (
        await session.execute(
            select(SocialFriendship).where(
                SocialFriendship.user_a_id == a_id,
                SocialFriendship.user_b_id == b_id,
            )
        )
    ).scalar_one_or_none()
    if not friendship:
        return {"status": "ok", "already_removed": True}

    await session.delete(friendship)
    await session.commit()
    return {"status": "ok"}


@router.post("/social/chats/direct")
async def social_open_direct_chat(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    a_id, b_id = _friend_pair(current_user.id, target_user_id)
    friendship = (
        await session.execute(
            select(SocialFriendship).where(
                SocialFriendship.user_a_id == a_id,
                SocialFriendship.user_b_id == b_id,
            )
        )
    ).scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=403, detail="You can only message friends")

    my_chat_ids = {
        row.chat_id
        for row in (
            await session.execute(select(SocialChatMember).where(SocialChatMember.user_id == current_user.id))
        ).scalars().all()
    }
    their_chat_ids = {
        row.chat_id
        for row in (
            await session.execute(select(SocialChatMember).where(SocialChatMember.user_id == target_user_id))
        ).scalars().all()
    }

    common_chat_ids = list(my_chat_ids & their_chat_ids)
    if common_chat_ids:
        existing_direct = (
            await session.execute(
                select(SocialChat).where(
                    SocialChat.id.in_(common_chat_ids),
                    SocialChat.kind == "direct",
                )
            )
        ).scalars().first()
        if existing_direct:
            return {"status": "ok", "chat_id": existing_direct.id}

    chat = SocialChat(kind="direct", created_by=current_user.id)
    session.add(chat)
    await session.flush()
    session.add(SocialChatMember(chat_id=chat.id, user_id=current_user.id, role="owner"))
    session.add(SocialChatMember(chat_id=chat.id, user_id=target_user_id, role="member"))
    await session.commit()
    return {"status": "ok", "chat_id": chat.id}


@router.post("/social/chats/group")
async def social_create_group_chat(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    member_ids_payload = payload.get("member_ids") or []
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    member_ids = [str(item).strip() for item in member_ids_payload if str(item).strip()]
    unique_member_ids = list({member_id for member_id in member_ids if member_id != current_user.id})

    # Only allow adding friends to keep the social graph safe.
    valid_friend_ids: List[str] = []
    for friend_id in unique_member_ids:
        a_id, b_id = _friend_pair(current_user.id, friend_id)
        friendship = (
            await session.execute(
                select(SocialFriendship).where(
                    SocialFriendship.user_a_id == a_id,
                    SocialFriendship.user_b_id == b_id,
                )
            )
        ).scalar_one_or_none()
        if friendship:
            valid_friend_ids.append(friend_id)

    chat = SocialChat(kind="group", title=name[:80], created_by=current_user.id)
    session.add(chat)
    await session.flush()
    session.add(SocialChatMember(chat_id=chat.id, user_id=current_user.id, role="owner"))
    for friend_id in valid_friend_ids:
        session.add(SocialChatMember(chat_id=chat.id, user_id=friend_id, role="member"))

    await session.commit()
    return {
        "status": "ok",
        "chat_id": chat.id,
        "name": chat.title,
        "member_count": 1 + len(valid_friend_ids),
    }


@router.get("/social/groups/discover")
async def social_discover_groups(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    my_memberships = (
        await session.execute(select(SocialChatMember).where(SocialChatMember.user_id == current_user.id))
    ).scalars().all()
    joined_chat_ids = {membership.chat_id for membership in my_memberships}

    chats = (
        await session.execute(select(SocialChat).where(SocialChat.kind == "group").order_by(desc(SocialChat.created_at)).limit(20))
    ).scalars().all()
    chat_ids = [chat.id for chat in chats]

    members = (
        await session.execute(select(SocialChatMember).where(SocialChatMember.chat_id.in_(chat_ids)))
    ).scalars().all() if chat_ids else []
    counts: Dict[str, int] = {}
    for member in members:
        counts[member.chat_id] = counts.get(member.chat_id, 0) + 1

    return {
        "groups": [
            {
                "chat_id": chat.id,
                "name": chat.title or "Community",
                "member_count": counts.get(chat.id, 1),
                "joined": chat.id in joined_chat_ids,
            }
            for chat in chats
            if chat.id not in joined_chat_ids
        ]
    }


@router.post("/social/chats/{chat_id}/join")
async def social_join_group_chat(
    chat_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    chat = (
        await session.execute(select(SocialChat).where(SocialChat.id == chat_id, SocialChat.kind == "group"))
    ).scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found")

    membership = (
        await session.execute(
            select(SocialChatMember).where(
                SocialChatMember.chat_id == chat_id,
                SocialChatMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        session.add(SocialChatMember(chat_id=chat_id, user_id=current_user.id, role="member"))
        await session.commit()

    member_count = len(
        (
            await session.execute(select(SocialChatMember).where(SocialChatMember.chat_id == chat_id))
        ).scalars().all()
    )
    return {"status": "ok", "chat_id": chat_id, "member_count": member_count}


@router.get("/social/chats/{chat_id}/messages")
async def social_get_chat_messages(
    chat_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    membership = (
        await session.execute(
            select(SocialChatMember).where(
                SocialChatMember.chat_id == chat_id,
                SocialChatMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")

    chat = (
        await session.execute(select(SocialChat).where(SocialChat.id == chat_id))
    ).scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    members = (
        await session.execute(select(SocialChatMember).where(SocialChatMember.chat_id == chat_id))
    ).scalars().all()
    member_ids = [member.user_id for member in members]
    member_users = (
        await session.execute(select(User).where(User.id.in_(member_ids)))
    ).scalars().all() if member_ids else []
    member_map = {user.id: user for user in member_users}

    messages = (
        await session.execute(
            select(SocialChatMessage).where(SocialChatMessage.chat_id == chat_id).order_by(SocialChatMessage.created_at.asc())
        )
    ).scalars().all()

    payload: Dict[str, Any] = {
        "chat": {
            "chat_id": chat.id,
            "kind": chat.kind,
            "name": chat.title,
            "member_count": len(members),
        },
        "messages": [
            _serialize_social_message(message, current_user.id, member_map.get(message.sender_id))
            for message in messages
        ],
    }

    if chat.kind == "direct":
        partner_member = next((member for member in members if member.user_id != current_user.id), None)
        if partner_member:
            partner_user = member_map.get(partner_member.user_id)
            payload["chat"]["partner"] = _serialize_user_card(partner_user) if partner_user else {
                "id": partner_member.user_id,
                "display_name": "Member",
                "handle": "@member",
            }

    return payload


@router.post("/social/chats/{chat_id}/messages")
async def social_send_chat_message(
    chat_id: str,
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    membership = (
        await session.execute(
            select(SocialChatMember).where(
                SocialChatMember.chat_id == chat_id,
                SocialChatMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")

    body = str(payload.get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="body is required")

    message = SocialChatMessage(chat_id=chat_id, sender_id=current_user.id, body=body[:4000])
    session.add(message)
    await session.commit()
    return {"status": "ok", "message": _serialize_social_message(message, current_user.id, current_user)}


@router.post("/social/follow")
async def social_follow_user(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    target_user = (
        await session.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == target_user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"status": "ok", "already_following": True}

    session.add(UserFollow(follower_id=current_user.id, following_id=target_user_id))
    await session.commit()
    return {"status": "ok"}


@router.post("/social/unfollow")
async def social_unfollow_user(
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    target_user_id = str(payload.get("target_user_id") or "").strip()
    if not target_user_id or target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="valid target_user_id is required")

    existing = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == target_user_id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        return {"status": "ok", "already_unfollowed": True}

    await session.delete(existing)
    await session.commit()
    return {"status": "ok"}


@router.get("/social/profiles/{user_id}")
async def social_profile(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    following_rows = (
        await session.execute(select(UserFollow).where(UserFollow.follower_id == user_id))
    ).scalars().all()
    follower_rows = (
        await session.execute(select(UserFollow).where(UserFollow.following_id == user_id))
    ).scalars().all()

    is_following = (
        await session.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == user_id,
            )
        )
    ).scalar_one_or_none() is not None

    stats = (await _activity_stats_for_users(session, [user_id])).get(
        user_id,
        {"active_days": 0, "current_streak_days": 0},
    )

    return {
        "user": _serialize_user_card(user, stats=stats, is_following=is_following),
        "metrics": {
            "followers": len(follower_rows),
            "following": len(following_rows),
            "active_days": int(stats.get("active_days", 0)),
            "current_streak_days": int(stats.get("current_streak_days", 0)),
        },
        "is_self": user_id == current_user.id,
        "is_following": is_following,
    }


@router.get("/insights/patterns")
async def insights_patterns(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    craving_logs = (
        await session.execute(
            select(CravingLog)
            .where(CravingLog.user_id == current_user.id)
            .order_by(desc(CravingLog.ts))
            .limit(90)
        )
    ).scalars().all()
    tasks = (
        await session.execute(select(Task).where(Task.user_id == current_user.id))
    ).scalars().all()
    slips = (
        await session.execute(
            select(SlipEvent)
            .where(SlipEvent.user_id == current_user.id)
            .order_by(desc(SlipEvent.ts))
            .limit(30)
        )
    ).scalars().all()
    return _build_recovery_insights(craving_logs, tasks, slips)


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
    members = (
        await session.execute(
            select(SupportCircleMember)
            .where(SupportCircleMember.user_id == current_user.id, SupportCircleMember.status == "active")
        )
    ).scalars().all()
    plan = (
        await session.execute(
            select(EmergencyPlan)
            .where(EmergencyPlan.user_id == current_user.id)
            .order_by(desc(EmergencyPlan.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    await session.commit()
    response = {
        "status": "ok",
        "alert_id": alert.id,
        "crisis_detected": crisis_detected,
        "support_circle_count": len(members),
        "replacement_actions": (plan.replacement_actions[:3] if plan else []),
    }
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
    plan = _build_local_onboarding_plan(plan_payload)
    try:
        llm_plan = await llm.generate_plan(plan_payload)
        if isinstance(llm_plan, dict) and llm_plan.get("phases"):
            plan = llm_plan
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to generate plan from LLM; using local fallback", exc_info=exc)

    plan_row = Plan(user_id=user.id, plan_json=plan, version=1)
    session.add(plan_row)
    await session.flush()
    plan_days = _extract_plan_days(plan)
    if plan_days:
        await _seed_plan_day_tasks(session, user.id, plan_row, plan_days[0])

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


@router.delete("/coach/sessions/{session_id}")
async def delete_coach_session(
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

    await session.delete(coach_session_row)
    await session.commit()
    return {"status": "ok", "deleted_session_id": session_id}


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
    coach_context = await _build_coach_context_snapshot(session, current_user.id)
    history.insert(
        0,
        {
            "role": "system",
            "content": (
                "Current recovery context: "
                f"{json.dumps(coach_context, ensure_ascii=True)}. "
                "Use it quietly to personalize the reply. Do not dump raw JSON unless the user asks."
            ),
        },
    )
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


@router.post("/coach/sessions/{session_id}/messages/stream")
async def create_coach_message_stream(
    session_id: str,
    payload: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    llm: LLMClient = Depends(get_llm),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
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
    coach_context = await _build_coach_context_snapshot(session, current_user.id)
    history.insert(
        0,
        {
            "role": "system",
            "content": (
                "Current recovery context: "
                f"{json.dumps(coach_context, ensure_ascii=True)}. "
                "Use it quietly to personalize the reply. Do not dump raw JSON unless the user asks."
            ),
        },
    )
    reply = await llm.coach_chat_reply(history)
    if not reply:
        reply = "I hear you. Let's take this one step at a time. Tell me what feels hardest right now."

    assistant_row = CoachMessage(session_id=coach_session_row.id, role="assistant", content=reply)
    session.add(assistant_row)

    if coach_session_row.title == "New chat":
        coach_session_row.title = user_message[:60]
    coach_session_row.updated_at = datetime.utcnow()
    await session.commit()

    user_payload = _serialize_coach_message(user_row)
    assistant_payload = _serialize_coach_message(assistant_row)
    session_payload = {
        "id": coach_session_row.id,
        "title": coach_session_row.title,
        "created_at": coach_session_row.created_at.isoformat() if coach_session_row.created_at else None,
        "updated_at": coach_session_row.updated_at.isoformat() if coach_session_row.updated_at else None,
    }

    async def event_generator():
        yield f"event: user\ndata: {json.dumps(user_payload)}\n\n"
        for chunk in _chunk_text(reply, chunk_size=10):
            yield f"event: delta\ndata: {json.dumps({'content': chunk})}\n\n"
            await asyncio.sleep(0.02)
        done_payload = {
            "session": session_payload,
            "assistant_message": assistant_payload,
        }
        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/tasks/today")
async def tasks_today(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    await _ensure_task_progression(session, current_user)
    await session.commit()

    plan_row = (
        await session.execute(
            select(Plan)
            .where(Plan.user_id == current_user.id)
            .order_by(desc(Plan.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    plan_days = _extract_plan_days(plan_row.plan_json or {}) if plan_row else []
    total_weeks = max((int(day.get("week_index") or 0) for day in plan_days), default=0)

    all_tasks = (
        await session.execute(
            select(Task)
            .where(Task.user_id == current_user.id)
            .order_by(Task.day_index.asc(), Task.created_at.asc())
        )
    ).scalars().all()

    if not all_tasks:
        return {"tasks": [], "week_index": 1, "total_weeks": total_weeks, "week_complete": False}

    pending_tasks = [task for task in all_tasks if (task.status or "").lower() != "completed"]
    if pending_tasks:
        active_week = ((int(pending_tasks[0].day_index or 1) - 1) // PLAN_DAYS_PER_WEEK) + 1
    else:
        active_week = ((int(all_tasks[-1].day_index or 1) - 1) // PLAN_DAYS_PER_WEEK) + 1

    week_start_day = ((active_week - 1) * PLAN_DAYS_PER_WEEK) + 1
    week_end_day = week_start_day + PLAN_DAYS_PER_WEEK - 1
    week_tasks = [
        task for task in all_tasks
        if week_start_day <= int(task.day_index or 0) <= week_end_day
    ]
    week_complete = bool(week_tasks) and all((task.status or "").lower() == "completed" for task in week_tasks)
    tasks = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "xp": t.xp,
            "details": t.details_json,
            "day_index": t.day_index,
            "week_index": ((int(t.day_index or 1) - 1) // PLAN_DAYS_PER_WEEK) + 1,
            "day_in_week": (((int(t.day_index or 1) - 1) % PLAN_DAYS_PER_WEEK) + 1),
        }
        for t in week_tasks
    ]
    return {
        "tasks": tasks,
        "week_index": active_week,
        "total_weeks": total_weeks,
        "week_complete": week_complete,
    }


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    result = await session.execute(select(Task).where(Task.id == task_id, Task.user_id == current_user.id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await session.execute(
        update(Task).where(Task.id == task_id).values(status="completed", updated_at=datetime.utcnow())
    )
    await _ensure_task_progression(session, current_user)
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
    try:
        craving = int(payload["craving"])
    except Exception:
        raise HTTPException(status_code=400, detail="craving must be an integer from 0 to 10")
    if craving < 0 or craving > 10:
        raise HTTPException(status_code=400, detail="craving must be between 0 and 10")

    urge_value = payload.get("urge")
    urge: Optional[int] = None
    if urge_value is not None:
        try:
            urge = int(urge_value)
        except Exception:
            raise HTTPException(status_code=400, detail="urge must be an integer from 0 to 10")
        if urge < 0 or urge > 10:
            raise HTTPException(status_code=400, detail="urge must be between 0 and 10")

    triggers_payload = payload.get("triggers") or []
    if not isinstance(triggers_payload, list):
        raise HTTPException(status_code=400, detail="triggers must be a list of strings")
    triggers = [str(t).strip() for t in triggers_payload if str(t).strip()]

    checkin = Checkin(
        user_id=current_user.id,
        craving=craving,
        mood=payload.get("mood"),
        triggers=triggers,
        urge=urge,
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
    llm: LLMClient = Depends(get_llm),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    checkins = (
        await session.execute(
            select(Checkin)
            .where(Checkin.user_id == current_user.id)
            .order_by(Checkin.ts.desc())
            .limit(160)
        )
    ).scalars().all()
    tasks = (
        await session.execute(
            select(Task)
            .where(Task.user_id == current_user.id)
            .order_by(Task.updated_at.desc())
            .limit(220)
        )
    ).scalars().all()

    alerts = (
        await session.execute(
            select(Alert)
            .where(Alert.user_id == current_user.id)
            .order_by(Alert.ts.desc())
            .limit(120)
        )
    ).scalars().all()

    assessment = hybrid_risk_assessment(checkins, tasks, alerts)
    rationale = assessment.get("rationale", "No rationale")
    llm_context = {
        "score": float(assessment.get("score", 0.3)),
        "bucket": assessment.get("bucket", "Low"),
        "model_type": assessment.get("model_type", "rule"),
        "thresholds": assessment.get("thresholds", {}),
        "signals": assessment.get("features", {}),
        "safety_override": assessment.get("override"),
    }
    llm_explanation = await llm.explain_risk(llm_context)
    if llm_explanation:
        rationale = llm_explanation

    risk_row = RiskScore(
        user_id=current_user.id,
        score=float(assessment.get("score", 0.3)),
        bucket=assessment.get("bucket", "Low"),
        rationale=rationale,
    )
    session.add(risk_row)
    await session.commit()
    return {
        "score": risk_row.score,
        "bucket": risk_row.bucket,
        "rationale": risk_row.rationale,
        "risk_id": risk_row.id,
        "model_type": assessment.get("model_type", "rule"),
        "thresholds": assessment.get("thresholds", {"low": 0.33, "high": 0.66}),
        "safety_override": assessment.get("override"),
        "signals": assessment.get("features", {}),
    }


@router.post("/risk/evaluate")
async def risk_evaluate(
    llm: LLMClient = Depends(get_llm),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await risk(llm=llm, session=session, current_user=current_user)


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

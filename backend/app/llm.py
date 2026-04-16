import asyncio
import json
import logging
import re
from typing import Dict, List, Any, Optional

try:
    from google import genai
except ImportError:
    genai = None  # type: ignore

try:
    from google.genai import types as genai_types
except ImportError:
    genai_types = None  # type: ignore

logger = logging.getLogger(__name__)

TASKS_PER_DAY = 1
PLAN_WEEKS = 4
PLAN_DAYS_PER_WEEK = 7
PLAN_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "phases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "objective": {"type": "string"},
                    "weeks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "theme": {"type": "string"},
                                "milestone": {"type": "string"},
                                "days": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "title": {"type": "string"},
                                            "focus": {"type": "string"},
                                            "tasks": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "title": {"type": "string"},
                                                        "rationale": {"type": "string"},
                                                        "est_time": {"type": "string"},
                                                        "xp": {"type": "integer"},
                                                        "micro_skill": {"type": "string"},
                                                        "difficulty": {"type": "string"},
                                                    },
                                                    "required": [
                                                        "title",
                                                        "rationale",
                                                        "est_time",
                                                        "xp",
                                                        "micro_skill",
                                                        "difficulty",
                                                    ],
                                                },
                                            },
                                        },
                                        "required": ["title", "focus", "tasks"],
                                    },
                                },
                            },
                            "required": ["title", "theme", "milestone", "days"],
                        },
                    },
                },
                "required": ["title", "objective", "weeks"],
            },
        },
        "weekly_milestones": {
            "type": "array",
            "items": {"type": "string"},
        },
        "relapse_fallback_steps": {
            "type": "array",
            "items": {"type": "string"},
        },
        "daily_checkin_prompts": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": [
        "title",
        "summary",
        "phases",
        "weekly_milestones",
        "relapse_fallback_steps",
        "daily_checkin_prompts",
    ],
}


class LLMClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: int = 25,
        disable_thinking: bool = True,
    ) -> None:
        self.api_key = api_key
        self.model_name = model
        self.timeout_seconds = timeout_seconds
        self.disable_thinking = disable_thinking
        self.client = genai.Client(api_key=api_key) if genai else None

    def _strip_json_fences(self, text: str) -> str:
        cleaned = text.strip()
        if not cleaned.startswith("```"):
            return cleaned
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    def _extract_json_fragment(self, text: str) -> str:
        cleaned = self._strip_json_fences(text)
        if not cleaned:
            return ""
        if cleaned[0] in {"{", "["}:
            return cleaned

        object_start = cleaned.find("{")
        array_start = cleaned.find("[")
        starts = [idx for idx in [object_start, array_start] if idx != -1]
        if not starts:
            return cleaned

        start = min(starts)
        end_object = cleaned.rfind("}")
        end_array = cleaned.rfind("]")
        end = max(end_object, end_array)
        if end > start:
            return cleaned[start : end + 1].strip()
        return cleaned[start:].strip()

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        candidate = self._extract_json_fragment(text)
        if not candidate:
            raise ValueError("Empty response text from LLM")

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            compact = re.sub(r"\s+", " ", candidate[:240])
            raise ValueError(f"Invalid JSON from LLM: {compact}") from exc

        if not isinstance(parsed, dict):
            raise ValueError("Expected JSON object from LLM")
        return parsed

    def _build_fallback_task(
        self,
        week_index: int,
        day_in_week: int,
        slot: int,
        addiction: str,
        triggers: str,
        goals: str,
    ) -> Dict[str, Any]:
        trigger_hint = triggers or "stress, isolation, or unplanned downtime"
        templates = [
            {
                "title": "Morning reset",
                "rationale": f"Create structure early so {addiction} recovery starts with intention instead of drift.",
                "micro_skill": "grounding",
            },
            {
                "title": "Trigger scan",
                "rationale": f"Notice whether {trigger_hint} is likely to show up today and choose one response ahead of time.",
                "micro_skill": "trigger-awareness",
            },
            {
                "title": "Supportive action",
                "rationale": "Reduce isolation with one small act of connection, accountability, or outreach.",
                "micro_skill": "connection",
            },
            {
                "title": "Body regulation",
                "rationale": "Use movement, hydration, or breathing to lower baseline stress before cravings build.",
                "micro_skill": "regulation",
            },
            {
                "title": "Evening reflection",
                "rationale": f"Capture what helped and align the next day with the goal of {goals or 'steady recovery progress'}.",
                "micro_skill": "reflection",
            },
        ]
        template = templates[(slot - 1) % len(templates)]
        difficulty = "Easy"
        return {
            "title": f"{template['title']} W{week_index}D{day_in_week}",
            "rationale": template["rationale"],
            "est_time": "10-15 min",
            "xp": 10 + (slot * 2),
            "micro_skill": template["micro_skill"],
            "difficulty": difficulty,
        }

    def _fallback_plan(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        addiction = str(user_profile.get("addiction") or "recovery")
        triggers = str(user_profile.get("triggers") or "")
        goals = str(user_profile.get("goals") or "build consistency")
        constraints = str(user_profile.get("constraints") or "limited time and energy")
        preferences = str(user_profile.get("preferences") or "small actionable steps")

        weeks: List[Dict[str, Any]] = []
        for week_index in range(1, PLAN_WEEKS + 1):
            days: List[Dict[str, Any]] = []
            for day_in_week in range(1, PLAN_DAYS_PER_WEEK + 1):
                tasks = [
                    self._build_fallback_task(
                        week_index=week_index,
                        day_in_week=day_in_week,
                        slot=slot,
                        addiction=addiction,
                        triggers=triggers,
                        goals=goals,
                    )
                    for slot in range(1, TASKS_PER_DAY + 1)
                ]
                days.append(
                    {
                        "title": f"Week {week_index} Day {day_in_week}",
                        "focus": "Reduce friction and keep the next step clear.",
                        "tasks": tasks,
                    }
                )

            weeks.append(
                {
                    "title": f"Week {week_index}",
                    "theme": [
                        "Stabilize the day",
                        "Strengthen routines",
                        "Practice handling triggers",
                        "Consolidate wins",
                    ][week_index - 1],
                    "milestone": f"End week {week_index} with a visible routine that fits {constraints}.",
                    "days": days,
                }
            )

        return {
            "title": "Recovery Foundations Plan",
            "summary": f"A four-week structure for {addiction} recovery built around {preferences}.",
            "phases": [
                {
                    "title": "Foundation",
                    "objective": f"Build stable routines, respond to triggers earlier, and move toward {goals}.",
                    "weeks": weeks,
                }
            ],
            "weekly_milestones": [week["milestone"] for week in weeks],
            "relapse_fallback_steps": [
                "Pause the spiral and do one grounding action for 2 minutes.",
                "Move to a safer environment and reduce access to the trigger.",
                "Contact one trusted person or use the SOS support flow.",
                "Write down what happened without self-judgment.",
                "Restart with the next smallest task instead of abandoning the day.",
            ],
            "daily_checkin_prompts": [
                "What feels most likely to derail me today?",
                "What is one action that would make today safer?",
                "What helped me stay steady since the last check-in?",
            ],
            "source": "fallback",
        }

    def _build_generation_config(
        self,
        max_tokens: int,
        temperature: float,
        response_json: bool = False,
        response_json_schema: Optional[Dict[str, Any]] = None,
    ) -> Optional[Any]:
        config_payload: Dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if self.disable_thinking:
            config_payload["thinking_config"] = {"thinking_budget": 0}
        if response_json:
            config_payload["response_mime_type"] = "application/json"
        if response_json_schema:
            config_payload["response_json_schema"] = response_json_schema

        if genai_types:
            try:
                thinking_config = None
                if self.disable_thinking and hasattr(genai_types, "ThinkingConfig"):
                    thinking_config = genai_types.ThinkingConfig(thinking_budget=0)

                kwargs: Dict[str, Any] = {
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                }
                if response_json:
                    kwargs["response_mime_type"] = "application/json"
                if response_json_schema:
                    kwargs["response_json_schema"] = response_json_schema
                if thinking_config is not None:
                    kwargs["thinking_config"] = thinking_config
                return genai_types.GenerateContentConfig(**kwargs)
            except Exception:
                return config_payload

        return config_payload

    async def _generate_content(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        response_json: bool = False,
        response_json_schema: Optional[Dict[str, Any]] = None,
    ) -> Any:
        if not self.client or not genai:
            return None

        config = self._build_generation_config(
            max_tokens=max_tokens,
            temperature=temperature,
            response_json=response_json,
            response_json_schema=response_json_schema,
        )

        def _run() -> Any:
            kwargs: Dict[str, Any] = {
                "model": self.model_name,
                "contents": prompt,
            }
            if config is not None:
                kwargs["config"] = config
            return self.client.models.generate_content(**kwargs)

        return await asyncio.wait_for(
            asyncio.to_thread(_run),
            timeout=self.timeout_seconds,
        )

    async def _chat_json(
        self,
        system: str,
        user: str,
        max_tokens: int = 800,
        response_json_schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        prompt = system + "\n\n" + user + "\n\nReturn ONLY JSON."
        if not self.client or not genai:
            return {}
        try:
            resp = await self._generate_content(
                prompt,
                max_tokens=max_tokens,
                temperature=0.2,
                response_json=True,
                response_json_schema=response_json_schema,
            )
            text = (resp.text or "") if resp else ""
            return self._parse_json_response(text)
        except asyncio.TimeoutError:
            logger.error("LLM JSON call timed out after %ss", self.timeout_seconds)
            return {}
        except Exception as exc:
            logger.warning("LLM JSON parse failed; using fallback path: %s", exc)
            return {}

    async def _chat_text(self, system: str, user: str, max_tokens: int = 800) -> str:
        prompt = system + "\n\n" + user
        if not self.client or not genai:
            return ""
        try:
            resp = await self._generate_content(
                prompt,
                max_tokens=max_tokens,
                temperature=0.35,
            )
            return ((resp.text or "") if resp else "").strip()
        except asyncio.TimeoutError:
            logger.error("LLM text call timed out after %ss", self.timeout_seconds)
            return ""
        except Exception as exc:
            logger.error("LLM text call failed", exc_info=exc)
            return ""

    async def generate_plan(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a recovery coach. Create a structured four-week plan for addiction recovery. "
            "Return only valid JSON that matches the provided schema exactly. "
            "Keep titles concise, tasks practical, and rationales short."
        )
        user = (
            f"User profile:\n"
            f"- Addiction: {user_profile.get('addiction')}\n"
            f"- Triggers: {user_profile.get('triggers')}\n"
            f"- Goals: {user_profile.get('goals')}\n"
            f"- Constraints: {user_profile.get('constraints')}\n"
            f"- Preferences: {user_profile.get('preferences')}\n"
        )
        plan = await self._chat_json(
            system,
            user,
            max_tokens=1500,
            response_json_schema=PLAN_SCHEMA,
        )
        if plan:
            return plan
        logger.warning("Falling back to deterministic onboarding plan")
        return self._fallback_plan(user_profile)

    async def coach_flow(self, context: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a compassionate, concise recovery coach. Provide a 3-5 minute guided flow "
            "with steps: intro (30s), main practice (2-3min), reinforcement (30s), and a closing action. "
            "Return JSON with steps (title, instructions, suggested_duration_seconds)."
        )
        user = f"Context: {context}"
        return await self._chat_json(system, user, max_tokens=500)

    async def coach_chat_reply(self, history: List[Dict[str, str]]) -> str:
        system = (
            "You are a compassionate addiction-recovery coach. "
            "Respond in a warm, practical, non-judgmental tone. "
            "Keep replies clear and concise. "
            "When the user seems high-risk or asks for self-harm guidance, refuse harmful content and suggest immediate help "
            "including 988 in the US. "
            "Do not claim to be a therapist. "
            "Use short paragraphs or bullet points when useful."
        )
        transcript_lines: List[str] = []
        for m in history:
            role = (m.get("role") or "").strip().lower()
            content = (m.get("content") or "").strip()
            if role not in {"system", "user", "assistant"} or not content:
                continue
            transcript_lines.append(f"{role.upper()}: {content[:600]}")
        user = "Conversation so far:\n" + "\n".join(transcript_lines) + "\n\nASSISTANT:"
        return await self._chat_text(system, user, max_tokens=320)

    async def jit_intervention(self, context: Dict[str, Any], actions: List[str]) -> Dict[str, Any]:
        system = (
            "You choose the best micro-intervention for this user. "
            "Return JSON with chosen_action, why, and instructions."
        )
        user = f"Context: {context}\nActions: {actions}"
        return await self._chat_json(system, user, max_tokens=260)

    async def assess_risk(self, context: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a safety-focused recovery assistant. Given recent check-ins and tasks, "
            "estimate a 24h risk score between 0 and 1, assign bucket (Low/Medium/High), "
            "and provide a concise rationale referencing the inputs. Return JSON with score, bucket, rationale."
        )
        user = f"Context: {context}"
        return await self._chat_json(system, user, max_tokens=220)

    async def explain_risk(self, context: Dict[str, Any]) -> str:
        system = (
            "You are a safety-focused recovery assistant. "
            "A risk score and bucket have already been computed by a deterministic/ML pipeline. "
            "Do not recalculate or change them. Explain the result in plain language for the user, "
            "with 2-4 short sentences that reference the strongest input signals."
        )
        user = (
            f"Context: {context}\n"
            "Return only the explanation text."
        )
        return await self._chat_text(system, user, max_tokens=160)

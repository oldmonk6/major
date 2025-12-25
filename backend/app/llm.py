import json
import logging
from typing import Dict, List, Any

try:
    from google import genai
except ImportError:
    genai = None  # type: ignore

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model_name = model
        self.client = genai.Client(api_key=api_key) if genai else None

    def _chat_json(self, system: str, user: str, max_tokens: int = 800) -> Dict[str, Any]:
        prompt = system + "\n\n" + user + "\n\nReturn ONLY JSON."
        if not self.client or not genai:
            return {}
        try:
            resp = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            text = resp.text or ""
            text = text.strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:].lstrip()
            if not text:
                raise ValueError("Empty response text from LLM")
            if not (text.startswith("{") or text.startswith("[")):
                raise ValueError(f"Non-JSON response prefix: {text[:80]}")
            return json.loads(text)
        except Exception as exc:  # log and bubble empty
            logger.error("LLM call failed", exc_info=exc)
            return {}

    async def generate_plan(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a recovery coach. Create a structured, staged plan for addiction recovery. "
            "Return JSON with phases -> weeks -> days -> tasks (title, rationale, est_time, xp, micro_skill, difficulty), "
            "weekly milestones, relapse fallback steps, and daily check-ins prompts."
        )
        user = (
            f"User profile:\n"
            f"- Addiction: {user_profile.get('addiction')}\n"
            f"- Triggers: {user_profile.get('triggers')}\n"
            f"- Goals: {user_profile.get('goals')}\n"
            f"- Constraints: {user_profile.get('constraints')}\n"
            f"- Preferences: {user_profile.get('preferences')}\n"
        )
        return self._chat_json(system, user, max_tokens=800)

    async def coach_flow(self, context: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a compassionate, concise recovery coach. Provide a 3-5 minute guided flow "
            "with steps: intro (30s), main practice (2-3min), reinforcement (30s), and a closing action. "
            "Return JSON with steps (title, instructions, suggested_duration_seconds)."
        )
        user = f"Context: {context}"
        return self._chat_json(system, user, max_tokens=600)

    async def jit_intervention(self, context: Dict[str, Any], actions: List[str]) -> Dict[str, Any]:
        system = (
            "You choose the best micro-intervention for this user. "
            "Return JSON with chosen_action, why, and instructions."
        )
        user = f"Context: {context}\nActions: {actions}"
        return self._chat_json(system, user, max_tokens=400)

    async def assess_risk(self, context: Dict[str, Any]) -> Dict[str, Any]:
        system = (
            "You are a safety-focused recovery assistant. Given recent check-ins and tasks, "
            "estimate a 24h risk score between 0 and 1, assign bucket (Low/Medium/High), "
            "and provide a concise rationale referencing the inputs. Return JSON with score, bucket, rationale."
        )
        user = f"Context: {context}"
        return self._chat_json(system, user, max_tokens=300)

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.config import Settings


@dataclass(frozen=True, slots=True)
class ChatMsg:
    role: str
    content: str


class LlmClientPort(Protocol):
    async def generate_json(
        self,
        *,
        system_prompt: str,
        messages: list[ChatMsg],
        schema: dict[str, Any],
    ) -> dict[str, Any]: ...

    async def ping(self) -> bool: ...


class MockLlmClient:
    """Deterministic safe guidance client used when LLM_PROVIDER=mock (offline/CI)."""

    def __init__(self, scripted_outputs: list[dict[str, Any]] | None = None) -> None:
        self._scripted = list(scripted_outputs) if scripted_outputs else []

    async def generate_json(
        self,
        *,
        system_prompt: str,
        messages: list[ChatMsg],
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        if self._scripted:
            return self._scripted.pop(0)

        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        is_ar = "Locale: ar" in system_prompt or any("\u0600" <= ch <= "\u06ff" for ch in last_user)

        if is_ar:
            return {
                "triage_level": "soon",
                "reply_text": (
                    "الأعراض دي ممكن تكون مرتبطة بأكتر من سبب بسيط أو محتاج فحص طبي لتحديد "
                    "السبب بدقة. لو الأعراض مستمرة أو بتزيد يفضل تزور طبيب في أقرب وقت مناسب."
                ),
                "self_care": [
                    "اشرب سوائل دافية وارتاح كويس",
                    "تجنب المجهود البدني الشديد النهاردة",
                ],
                "warning_signs": [
                    "صعوبة في التنفس أو ألم شديد في الصدر",
                    "ارتفاع مستمر في الحرارة",
                ],
                "recommended_specialty_code": "general_practice",
                "specialty_reason": "تقييم مبدئي للأعراض وتوجيهك للفحوصات المناسبة",
                "follow_up_questions": [
                    "الأعراض بدأت من امتى بالظبط؟",
                    "هل في حرارة أو أعراض مصاحبة؟",
                ],
            }
        return {
            "triage_level": "soon",
            "reply_text": (
                "These symptoms can be related to several possible causes and warrant evaluation "
                "by a clinician if they persist or worsen."
            ),
            "self_care": [
                "Rest and stay well hydrated",
                "Monitor symptom intensity over the next 24 hours",
            ],
            "warning_signs": ["Difficulty breathing or chest pain", "Persistent high fever"],
            "recommended_specialty_code": "general_practice",
            "specialty_reason": "Initial clinical evaluation and targeted examination",
            "follow_up_questions": [
                "When did these symptoms start?",
                "Are they worsening over time?",
            ],
        }

    async def ping(self) -> bool:
        return True


class OpenAiCompatibleLlmClient:
    """Adapter for structured JSON responses (temperature=0.2, max_tokens=600, timeout=6s)."""

    def __init__(self, settings: Settings) -> None:
        self._base_url = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")
        self._api_key = settings.llm_api_key
        self._model = settings.llm_model

    async def generate_json(
        self,
        *,
        system_prompt: str,
        messages: list[ChatMsg],
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {
            "model": self._model,
            "temperature": 0.2,
            "max_tokens": 600,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                *[{"role": m.role, "content": m.content} for m in messages],
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)  # type: ignore[no-any-return]

    async def ping(self) -> bool:
        return bool(self._api_key)


def build_llm_client(settings: Settings) -> LlmClientPort:
    if settings.llm_provider.lower() == "mock" or not settings.llm_api_key:
        return MockLlmClient()
    return OpenAiCompatibleLlmClient(settings)

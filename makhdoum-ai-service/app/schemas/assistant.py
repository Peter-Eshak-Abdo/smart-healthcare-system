from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import StrictBaseModel


class ChatTurn(StrictBaseModel):
    role: Literal["user", "assistant"]
    text: str


class PatientTriageContext(StrictBaseModel):
    age_band: str
    sex: Literal["male", "female"]
    pregnant: bool | None = None


class TriageRequest(StrictBaseModel):
    session_ref: str
    locale: Literal["ar", "en"] = "ar"
    history: list[ChatTurn] = []
    message: str = Field(min_length=1, max_length=2000)
    patient_context: PatientTriageContext


class TriageLLMOutput(StrictBaseModel):
    triage_level: Literal["emergency", "urgent", "soon", "routine", "self_care"]
    reply_text: str = Field(max_length=1200)
    self_care: list[str] = Field(default_factory=list, max_length=4)
    warning_signs: list[str] = Field(default_factory=list, max_length=4)
    recommended_specialty_code: str
    specialty_reason: str = Field(max_length=200)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=3)


class TriageBlock(StrictBaseModel):
    level: Literal["emergency", "urgent", "soon", "routine", "self_care"]
    red_flag: bool
    rule_ids: list[str]
    emergency_action: str | None = None


class ReplyBlock(StrictBaseModel):
    text: str
    self_care: list[str]
    warning_signs: list[str]


class ValidatorMeta(StrictBaseModel):
    violations: list[str]
    regenerated: bool
    fallback_used: bool


class TriageResponse(StrictBaseModel):
    triage: TriageBlock
    reply: ReplyBlock
    recommended_specialty_code: str
    specialty_reason: str
    follow_up_questions: list[str]
    llm_used: bool
    validator: ValidatorMeta

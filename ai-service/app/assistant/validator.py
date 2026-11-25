from __future__ import annotations

import re
from dataclasses import dataclass

from pydantic import ValidationError

from app.schemas.assistant import TriageLLMOutput

TRIAGE_RANK: dict[str, int] = {
    "self_care": 0,
    "routine": 1,
    "soon": 2,
    "urgent": 3,
    "emergency": 4,
}

_DIAGNOSIS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\byou (?:definitely |clearly )?(?:have|are suffering from)\b", re.IGNORECASE),
    re.compile(r"\bthis is (?:definitely|clearly)\b", re.IGNORECASE),
    re.compile(r"\bdiagnos(?:is|ed)\s+(?:is|with)\b", re.IGNORECASE),
    re.compile(r"انت عندك|أنت مصاب|ده أكيد|تشخيصك هو"),
)

_DOSE_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|mcg|ml|g|iu|مجم|مل|ملي|جم)\b", re.IGNORECASE)

_LEAKAGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"smarthealth's symptom guidance assistant", re.IGNORECASE),
    re.compile(r"hard rules:", re.IGNORECASE),
    re.compile(r"never state or imply a diagnosis", re.IGNORECASE),
)


@dataclass(frozen=True, slots=True)
class ValidationOutcome:
    ok: bool
    output: TriageLLMOutput | None
    violations: list[str]


def truncate_reply(text: str, max_len: int = 900) -> str:
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    for sep in (". ", "، ", "؟ ", "! "):
        idx = cut.rfind(sep)
        if idx >= max_len // 2:
            return cut[: idx + 1].strip()
    return cut.strip()


def validate_llm_output(
    raw: dict[str, object],
    *,
    medication_terms: frozenset[str],
    rule_level: str | None = None,
) -> ValidationOutcome:
    violations: list[str] = []
    try:
        parsed = TriageLLMOutput.model_validate(raw)
    except ValidationError:
        return ValidationOutcome(ok=False, output=None, violations=["json_schema_invalid"])

    combined_text = " ".join(
        [
            parsed.reply_text,
            parsed.specialty_reason,
            *parsed.self_care,
            *parsed.warning_signs,
            *parsed.follow_up_questions,
        ]
    )

    for pat in _DIAGNOSIS_PATTERNS:
        if pat.search(combined_text):
            violations.append("diagnosis_assertion")
            break

    if _DOSE_PATTERN.search(combined_text):
        violations.append("dose_mention")

    lowered = combined_text.lower()
    for med in medication_terms:
        if re.search(rf"(?<!\w){re.escape(med)}(?!\w)", lowered):
            violations.append("prescription_drug_mention")
            break

    for leak in _LEAKAGE_PATTERNS:
        if leak.search(combined_text):
            violations.append("prompt_leakage")
            break

    if violations:
        return ValidationOutcome(ok=False, output=None, violations=violations)

    enforced_level = parsed.triage_level
    if rule_level and TRIAGE_RANK.get(rule_level, 0) > TRIAGE_RANK.get(enforced_level, 0):
        enforced_level = rule_level  # type: ignore[assignment]

    clean_output = parsed.model_copy(
        update={
            "triage_level": enforced_level,
            "reply_text": truncate_reply(parsed.reply_text, 900),
            "specialty_reason": truncate_reply(parsed.specialty_reason, 160),
        }
    )
    return ValidationOutcome(ok=True, output=clean_output, violations=[])

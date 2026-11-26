from __future__ import annotations

from typing import Literal

from app.schemas.common import LocalizedText, StrictBaseModel


class ProposedDrugInput(StrictBaseModel):
    key: str
    drug_id: str


class CurrentMedInput(StrictBaseModel):
    key: str
    drug_id: str
    from_restricted_record: bool = False


class AllergyInput(StrictBaseModel):
    allergen_type: Literal["ingredient", "drug_class", "food", "environmental", "other"]
    allergen_code: str | None = None
    free_text_present: bool = False
    severity: Literal["mild", "moderate", "severe", "anaphylaxis"]


class ConditionInput(StrictBaseModel):
    icd10_code: str


class ClinicalCheckRequest(StrictBaseModel):
    proposed: list[ProposedDrugInput]
    current: list[CurrentMedInput] = []
    allergies: list[AllergyInput] = []
    conditions: list[ConditionInput] = []
    locale: Literal["ar", "en"] = "en"


class ClinicalAlert(StrictBaseModel):
    alert_key: str
    type: Literal["drug_drug", "drug_allergy", "duplicate_therapy", "drug_condition"]
    severity: Literal["minor", "moderate", "major", "contraindicated"]
    item_keys: list[str]
    related_keys: list[str] = []
    rule_id: str
    title: LocalizedText
    message: LocalizedText
    management: LocalizedText
    source: str
    from_restricted_record: bool = False


class ClinicalCheckResponse(StrictBaseModel):
    checks_status: Literal["complete", "partial"]
    engine_version: str
    dataset_version: str
    unmapped_drug_ids: list[str]
    alerts: list[ClinicalAlert]

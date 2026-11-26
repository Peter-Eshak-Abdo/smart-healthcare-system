from __future__ import annotations

from app.clinical.engine import check_interactions
from app.clinical.refdata import build_seed_refdata
from app.schemas.clinical import (
    AllergyInput,
    ClinicalCheckRequest,
    ConditionInput,
    CurrentMedInput,
    ProposedDrugInput,
)


def test_golden_ddi_and_restricted_propagation() -> None:
    ref = build_seed_refdata()
    req = ClinicalCheckRequest(
        proposed=[ProposedDrugInput(key="i1", drug_id="DRG-KETOLAC-10")],
        current=[CurrentMedInput(key="m1", drug_id="DRG-MAREVAN-5", from_restricted_record=True)],
        allergies=[],
        conditions=[],
        locale="en",
    )
    res = check_interactions(req, ref)
    assert res.checks_status == "complete"
    dd = next(a for a in res.alerts if a.alert_key == "DD:ING-KETOROLAC:ING-WARFARIN")
    assert dd.severity == "contraindicated"
    assert dd.from_restricted_record is True


def test_allergy_class_cross_reactivity_levels() -> None:
    ref = build_seed_refdata()

    # Penicillin anaphylaxis + Augmentin -> contraindicated
    res1 = check_interactions(
        ClinicalCheckRequest(
            proposed=[ProposedDrugInput(key="i1", drug_id="DRG-AUGMENTIN-1G")],
            allergies=[
                AllergyInput(
                    allergen_type="drug_class",
                    allergen_code="CLS-PENICILLINS",
                    severity="anaphylaxis",
                )
            ],
        ),
        ref,
    )
    assert any(
        a.alert_key == "DAC:CLS-PENICILLINS:CLS-PENICILLINS" and a.severity == "contraindicated"
        for a in res1.alerts
    )

    # Penicillin anaphylaxis + Ceporex -> major
    res2 = check_interactions(
        ClinicalCheckRequest(
            proposed=[ProposedDrugInput(key="i1", drug_id="DRG-CEPOREX-500")],
            allergies=[
                AllergyInput(
                    allergen_type="drug_class",
                    allergen_code="CLS-PENICILLINS",
                    severity="anaphylaxis",
                )
            ],
        ),
        ref,
    )
    assert any(
        a.alert_key == "DAC:CLS-CEPHALOSPORINS:CLS-PENICILLINS" and a.severity == "major"
        for a in res2.alerts
    )

    # Penicillin mild + Ceporex -> moderate
    res3 = check_interactions(
        ClinicalCheckRequest(
            proposed=[ProposedDrugInput(key="i1", drug_id="DRG-CEPOREX-500")],
            allergies=[
                AllergyInput(
                    allergen_type="drug_class",
                    allergen_code="CLS-PENICILLINS",
                    severity="mild",
                )
            ],
        ),
        ref,
    )
    assert any(
        a.alert_key == "DAC:CLS-CEPHALOSPORINS:CLS-PENICILLINS" and a.severity == "moderate"
        for a in res3.alerts
    )


def test_duplicate_therapy_and_drug_condition() -> None:
    ref = build_seed_refdata()
    res = check_interactions(
        ClinicalCheckRequest(
            proposed=[
                ProposedDrugInput(key="i1", drug_id="DRG-BRUFEN-400"),
                ProposedDrugInput(key="i2", drug_id="DRG-CATAFLAM-50"),
                ProposedDrugInput(key="i3", drug_id="DRG-GLUCOPHAGE-500"),
            ],
            conditions=[ConditionInput(icd10_code="N18.4")],
            allergies=[
                AllergyInput(allergen_type="other", free_text_present=True, severity="mild")
            ],
        ),
        ref,
    )
    keys = {a.alert_key: a for a in res.alerts}
    assert keys["DUP:CLS-NSAIDS"].severity == "moderate"
    assert keys["DC:ING-METFORMIN:N18.4"].severity == "contraindicated"
    assert keys["UA:uncoded"].severity == "moderate"

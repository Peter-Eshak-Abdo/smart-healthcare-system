from __future__ import annotations

from itertools import product
from typing import Literal

from app.clinical.refdata import RefDataSnapshot
from app.schemas.clinical import (
    ClinicalAlert,
    ClinicalCheckRequest,
    ClinicalCheckResponse,
)
from app.schemas.common import LocalizedText

AlertSeverity = Literal["minor", "moderate", "major", "contraindicated"]

SEVERITY_RANK: dict[str, int] = {
    "contraindicated": 4,
    "major": 3,
    "moderate": 2,
    "minor": 1,
}


def _as_severity(val: str) -> AlertSeverity:
    if val in ("minor", "moderate", "major", "contraindicated"):
        return val  # type: ignore[return-value]
    return "moderate"


def _merge_alert(bucket: dict[str, ClinicalAlert], candidate: ClinicalAlert) -> None:
    existing = bucket.get(candidate.alert_key)
    if existing is None:
        bucket[candidate.alert_key] = candidate
        return

    item_keys = list(dict.fromkeys([*existing.item_keys, *candidate.item_keys]))
    related_keys = list(dict.fromkeys([*existing.related_keys, *candidate.related_keys]))
    restricted = existing.from_restricted_record or candidate.from_restricted_record

    chosen = (
        candidate
        if SEVERITY_RANK.get(candidate.severity, 0) > SEVERITY_RANK.get(existing.severity, 0)
        else existing
    )
    bucket[candidate.alert_key] = chosen.model_copy(
        update={
            "item_keys": item_keys,
            "related_keys": related_keys,
            "from_restricted_record": restricted,
        }
    )


def check_interactions(
    req: ClinicalCheckRequest,
    ref: RefDataSnapshot,
    *,
    engine_version: str = "rules-2026.11.1",
) -> ClinicalCheckResponse:
    proposed = [(it.key, it.drug_id, ref.ingredients_of(it.drug_id)) for it in req.proposed]
    current = [
        (m.key, m.drug_id, ref.ingredients_of(m.drug_id), m.from_restricted_record)
        for m in req.current
    ]
    unmapped = [it.drug_id for it in req.proposed if not ref.has_drug(it.drug_id)]
    alerts: dict[str, ClinicalAlert] = {}

    # 1) Drug-drug: proposed x proposed (distinct items) and proposed x current
    for idx_a, (k1, _, ings1) in enumerate(proposed):
        for idx_b in range(idx_a + 1, len(proposed)):
            k2, _, ings2 = proposed[idx_b]
            for a, b in product(ings1, ings2):
                if a == b:
                    continue
                pair = (min(a, b), max(a, b))
                for rule in ref.ddi.get(pair, []):
                    sev = rule.severity
                    _merge_alert(
                        alerts,
                        ClinicalAlert(
                            alert_key=f"DD:{pair[0]}:{pair[1]}",
                            type="drug_drug",
                            severity=sev,  # type: ignore[arg-type]
                            item_keys=[k1, k2],
                            related_keys=[],
                            rule_id=rule.rule_id,
                            title=LocalizedText(
                                en=f"Drug Interaction ({pair[0]} + {pair[1]})",
                                ar=f"تداخل دوائي ({pair[0]} + {pair[1]})",
                            ),
                            message=LocalizedText(
                                en=rule.mechanism_en,
                                ar=rule.mechanism_ar or rule.mechanism_en,
                            ),
                            management=LocalizedText(
                                en=rule.management_en,
                                ar=rule.management_ar or rule.management_en,
                            ),
                            source=f"{rule.source}:ddi-rules",
                        ),
                    )

        for k2, _, ings2, restricted in current:
            for a, b in product(ings1, ings2):
                if a == b:
                    continue
                pair = (min(a, b), max(a, b))
                for rule in ref.ddi.get(pair, []):
                    _merge_alert(
                        alerts,
                        ClinicalAlert(
                            alert_key=f"DD:{pair[0]}:{pair[1]}",
                            type="drug_drug",
                            severity=rule.severity,  # type: ignore[arg-type]
                            item_keys=[k1],
                            related_keys=[k2],
                            rule_id=rule.rule_id,
                            title=LocalizedText(
                                en=f"Interaction with active medication ({pair[0]} + {pair[1]})",
                                ar=f"تداخل مع دواء حالي ({pair[0]} + {pair[1]})",
                            ),
                            message=LocalizedText(
                                en=rule.mechanism_en,
                                ar=rule.mechanism_ar or rule.mechanism_en,
                            ),
                            management=LocalizedText(
                                en=rule.management_en,
                                ar=rule.management_ar or rule.management_en,
                            ),
                            source=f"{rule.source}:ddi-rules",
                            from_restricted_record=restricted,
                        ),
                    )

    # 2) Drug-allergy (direct ingredient & class cross-reactivity & uncoded)
    for k, _, ings in proposed:
        classes = set().union(*(ref.ingredient_classes.get(i, frozenset()) for i in ings))
        for al in req.allergies:
            if al.allergen_type == "ingredient" and al.allergen_code and al.allergen_code in ings:
                direct_sev: AlertSeverity = (
                    "contraindicated" if al.severity in ("severe", "anaphylaxis") else "major"
                )
                _merge_alert(
                    alerts,
                    ClinicalAlert(
                        alert_key=f"DA:{al.allergen_code}:{al.allergen_code}",
                        type="drug_allergy",
                        severity=direct_sev,
                        item_keys=[k],
                        related_keys=[],
                        rule_id="ALG-DIRECT-001",
                        title=LocalizedText(
                            en=f"Direct allergy to {al.allergen_code}",
                            ar=f"حساسية مباشرة تجاه المادة الفعالة {al.allergen_code}",
                        ),
                        message=LocalizedText(
                            en=(
                                f"Patient has a recorded {al.severity} allergy "
                                f"to {al.allergen_code}."
                            ),
                            ar=f"المريض لديه حساسية مسجلة ({al.severity}) تجاه {al.allergen_code}.",
                        ),
                        management=LocalizedText(
                            en=(
                                "Do not prescribe; choose an alternative from a "
                                "non-cross-reactive class."
                            ),
                            ar="ممنوع الصرف؛ اختر بديلاً من مجموعة دوائية أخرى.",
                        ),
                        source="seed:allergy-direct-rules",
                    ),
                )
            elif al.allergen_type == "drug_class" and al.allergen_code:
                for target_cls in sorted(classes):
                    cross_rule = ref.cross.get((al.allergen_code, target_cls))
                    if cross_rule:
                        cross_sev = _as_severity(
                            cross_rule.severity_if_severe
                            if al.severity in ("severe", "anaphylaxis")
                            else cross_rule.severity_if_mild
                        )
                        _merge_alert(
                            alerts,
                            ClinicalAlert(
                                alert_key=f"DAC:{target_cls}:{al.allergen_code}",
                                type="drug_allergy",
                                severity=cross_sev,
                                item_keys=[k],
                                related_keys=[],
                                rule_id=cross_rule.rule_id,
                                title=LocalizedText(
                                    en=(
                                        f"Class allergy warning "
                                        f"({al.allergen_code} -> {target_cls})"
                                    ),
                                    ar=(
                                        f"تحذير حساسية فئة دوائية "
                                        f"({al.allergen_code} -> {target_cls})"
                                    ),
                                ),
                                message=LocalizedText(
                                    en=cross_rule.note_en,
                                    ar=cross_rule.note_ar or cross_rule.note_en,
                                ),
                                management=LocalizedText(
                                    en=(
                                        "Avoid or document explicit clinical justification "
                                        "and monitoring."
                                    ),
                                    ar="تجنب الدواء أو وثق مبرراً طبياً واضحاً مع المتابعة.",
                                ),
                                source="seed:allergy-class-rules",
                            ),
                        )
            elif al.allergen_type == "other" and al.free_text_present:
                _merge_alert(
                    alerts,
                    ClinicalAlert(
                        alert_key="UA:uncoded",
                        type="drug_allergy",
                        severity="moderate",
                        item_keys=[k],
                        related_keys=[],
                        rule_id="ALG-UNCODED-001",
                        title=LocalizedText(
                            en="Uncoded free-text allergy on file",
                            ar="توجد حساسية مسجلة غير مكودة في ملف المريض",
                        ),
                        message=LocalizedText(
                            en=(
                                "Patient has an uncoded allergy entry. "
                                "Review allergy chart before prescribing."
                            ),
                            ar="المريض لديه حساسية مكتوبة كنص حر. راجع سجل الحساسية قبل الإصدار.",
                        ),
                        management=LocalizedText(
                            en=(
                                "Verify patient allergy history and code the allergen "
                                "if clinically applicable."
                            ),
                            ar="تحقق من تاريخ الحساسية وقم بتكويد المادة المسببة إن أمكن.",
                        ),
                        source="seed:allergy-uncoded",
                    ),
                )

    # 3) Duplicate therapy: same ingredient or duplicate_check class
    ing_occurrences: dict[str, list[tuple[str, bool, bool]]] = {}
    cls_occurrences: dict[str, list[tuple[str, bool, bool]]] = {}

    for k, _, ings in proposed:
        for ing in ings:
            ing_occurrences.setdefault(ing, []).append((k, False, True))
        for cls_code in set().union(*(ref.ingredient_classes.get(i, frozenset()) for i in ings)):
            if cls_code in ref.dup_classes:
                cls_occurrences.setdefault(cls_code, []).append((k, False, True))

    for k, _, ings, restricted in current:
        for ing in ings:
            ing_occurrences.setdefault(ing, []).append((k, restricted, False))
        for cls_code in set().union(*(ref.ingredient_classes.get(i, frozenset()) for i in ings)):
            if cls_code in ref.dup_classes:
                cls_occurrences.setdefault(cls_code, []).append((k, restricted, False))

    for ing, hits in ing_occurrences.items():
        if len(hits) >= 2 and any(is_prop for _, _, is_prop in hits):
            prop_keys = [k for k, _, is_prop in hits if is_prop]
            cur_keys = [k for k, _, is_prop in hits if not is_prop]
            restricted = any(r for _, r, _ in hits)
            _merge_alert(
                alerts,
                ClinicalAlert(
                    alert_key=f"DUP:{ing}",
                    type="duplicate_therapy",
                    severity="moderate",
                    item_keys=prop_keys,
                    related_keys=cur_keys,
                    rule_id="DUP-ING-001",
                    title=LocalizedText(
                        en=f"Duplicate ingredient: {ing}",
                        ar=f"تكرار مادة فعالة: {ing}",
                    ),
                    message=LocalizedText(
                        en=f"Multiple drugs contain {ing}.",
                        ar=f"أكثر من دواء يحتوي على نفس المادة الفعالة {ing}.",
                    ),
                    management=LocalizedText(
                        en="Verify intended cumulative dose or discontinue duplicate agent.",
                        ar="راجع الجرعة التراكمية المقصودة أو أوقف الدواء المكرر.",
                    ),
                    source="seed:duplicate-rules",
                    from_restricted_record=restricted,
                ),
            )

    for cls_code, hits in cls_occurrences.items():
        if len(hits) >= 2 and any(is_prop for _, _, is_prop in hits):
            prop_keys = [k for k, _, is_prop in hits if is_prop]
            cur_keys = [k for k, _, is_prop in hits if not is_prop]
            restricted = any(r for _, r, _ in hits)
            _merge_alert(
                alerts,
                ClinicalAlert(
                    alert_key=f"DUP:{cls_code}",
                    type="duplicate_therapy",
                    severity="moderate",
                    item_keys=prop_keys,
                    related_keys=cur_keys,
                    rule_id="DUP-CLS-001",
                    title=LocalizedText(
                        en=f"Duplicate therapeutic class: {cls_code}",
                        ar=f"تكرار فئة علاجية: {cls_code}",
                    ),
                    message=LocalizedText(
                        en=(
                            f"Concomitant drugs in class {cls_code} "
                            "increase additive adverse effects."
                        ),
                        ar=f"الجمع بين أدوية من نفس الفئة ({cls_code}) يرفع خطر الأعراض الجانبية.",
                    ),
                    management=LocalizedText(
                        en=(
                            "Use a single agent from this therapeutic class "
                            "unless clinically indicated."
                        ),
                        ar="اكتفِ بدواء واحد من هذه الفئة إلا لضرورة طبية واضحة.",
                    ),
                    source="seed:duplicate-rules",
                    from_restricted_record=restricted,
                ),
            )

    # 4) Drug-condition rules
    for k, _, ings in proposed:
        classes = set().union(*(ref.ingredient_classes.get(i, frozenset()) for i in ings))
        for cond in req.conditions:
            code_upper = cond.icd10_code.upper()
            for cond_rule in ref.drug_condition_rules:
                if not code_upper.startswith(cond_rule.icd10_prefix.upper()):
                    continue
                matched_subject: str | None = None
                if cond_rule.ingredient_code and cond_rule.ingredient_code in ings:
                    matched_subject = cond_rule.ingredient_code
                elif cond_rule.class_code and cond_rule.class_code in classes:
                    matched_subject = cond_rule.class_code
                if matched_subject:
                    _merge_alert(
                        alerts,
                        ClinicalAlert(
                            alert_key=f"DC:{matched_subject}:{cond_rule.icd10_prefix}",
                            type="drug_condition",
                            severity=_as_severity(cond_rule.severity),
                            item_keys=[k],
                            related_keys=[],
                            rule_id=cond_rule.rule_id,
                            title=LocalizedText(
                                en=f"Drug-condition precaution ({cond_rule.icd10_prefix})",
                                ar=f"تحذير دواء مع حالة مرضية ({cond_rule.icd10_prefix})",
                            ),
                            message=LocalizedText(
                                en=cond_rule.message_en,
                                ar=cond_rule.message_ar or cond_rule.message_en,
                            ),
                            management=LocalizedText(
                                en=(
                                    "Assess dose adjustment or safer alternative "
                                    "for patient condition."
                                ),
                                ar="قيّم تعديل الجرعة أو استخدام بديل أكثر أماناً لحالة المريض.",
                            ),
                            source="seed:drug-condition-rules",
                        ),
                    )

    sorted_alerts = sorted(
        alerts.values(),
        key=lambda a: (-SEVERITY_RANK.get(a.severity, 0), a.alert_key),
    )

    return ClinicalCheckResponse(
        checks_status="partial" if unmapped else "complete",
        engine_version=engine_version,
        dataset_version=ref.dataset_version,
        unmapped_drug_ids=unmapped,
        alerts=sorted_alerts,
    )

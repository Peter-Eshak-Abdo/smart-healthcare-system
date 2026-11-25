from __future__ import annotations

import asyncio
import importlib
import uuid
from dataclasses import dataclass

_SEED_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def seed_drug_uuid(drug_code: str) -> str:
    return str(uuid.uuid5(_SEED_NAMESPACE, drug_code))


@dataclass(frozen=True, slots=True)
class DdiRule:
    rule_id: str
    ingredient_a: str
    ingredient_b: str
    severity: str
    mechanism_en: str
    management_en: str
    mechanism_ar: str | None = None
    management_ar: str | None = None
    source: str = "seed"


@dataclass(frozen=True, slots=True)
class CrossReactivityRule:
    rule_id: str
    allergen_class: str
    target_class: str
    severity_if_severe: str
    severity_if_mild: str
    note_en: str
    note_ar: str | None = None


@dataclass(frozen=True, slots=True)
class DrugConditionRule:
    rule_id: str
    class_code: str | None
    ingredient_code: str | None
    icd10_prefix: str
    severity: str
    message_en: str
    message_ar: str | None = None


@dataclass(frozen=True, slots=True)
class DrugSummary:
    id: str
    code: str
    brand_name: str
    generic_name: str


@dataclass(frozen=True, slots=True)
class RefDataSnapshot:
    dataset_version: str
    drugs_by_id: dict[str, DrugSummary]
    drug_ingredients: dict[str, frozenset[str]]
    ingredient_classes: dict[str, frozenset[str]]
    ddi: dict[tuple[str, str], list[DdiRule]]
    cross: dict[tuple[str, str], CrossReactivityRule]
    dup_classes: frozenset[str]
    drug_condition_rules: tuple[DrugConditionRule, ...]
    specialty_codes: frozenset[str]
    medication_terms: frozenset[str]

    def has_drug(self, drug_id: str) -> bool:
        return drug_id in self.drug_ingredients

    def ingredients_of(self, drug_id: str) -> frozenset[str]:
        return self.drug_ingredients.get(drug_id, frozenset())


def build_seed_refdata(dataset_version: str = "seed-2026-11") -> RefDataSnapshot:
    specialty_codes = frozenset(
        {
            "general_practice",
            "internal_medicine",
            "emergency_medicine",
            "cardiology",
            "pulmonology",
            "gastroenterology",
            "neurology",
            "dermatology",
            "ent",
            "ophthalmology",
            "orthopedics",
            "pediatrics",
            "obstetrics_gynecology",
            "urology",
            "nephrology",
            "endocrinology",
            "psychiatry",
            "dentistry",
            "rheumatology",
            "oncology",
            "pharmacy",
            "paramedicine",
        }
    )

    dup_classes = frozenset(
        {
            "CLS-PENICILLINS",
            "CLS-CEPHALOSPORINS",
            "CLS-MACROLIDES",
            "CLS-FLUOROQUINOLONES",
            "CLS-SULFONAMIDE-ANTIBIOTICS",
            "CLS-NSAIDS",
            "CLS-ANTICOAGULANTS",
            "CLS-STATINS",
            "CLS-PPIS",
            "CLS-SSRIS",
            "CLS-OPIOIDS",
            "CLS-BENZODIAZEPINES",
            "CLS-ACE-INHIBITORS",
            "CLS-BETA-BLOCKERS",
            "CLS-PDE5-INHIBITORS",
            "CLS-SULFONYLUREAS",
            "CLS-ANALGESICS-SIMPLE",
        }
    )

    ing_classes_raw: dict[str, set[str]] = {
        "ING-AMOXICILLIN": {"CLS-PENICILLINS"},
        "ING-CEPHALEXIN": {"CLS-CEPHALOSPORINS"},
        "ING-CEFTRIAXONE": {"CLS-CEPHALOSPORINS"},
        "ING-AZITHROMYCIN": {"CLS-MACROLIDES"},
        "ING-CLARITHROMYCIN": {"CLS-MACROLIDES"},
        "ING-CIPROFLOXACIN": {"CLS-FLUOROQUINOLONES"},
        "ING-SULFAMETHOXAZOLE": {"CLS-SULFONAMIDE-ANTIBIOTICS"},
        "ING-IBUPROFEN": {"CLS-NSAIDS"},
        "ING-DICLOFENAC": {"CLS-NSAIDS"},
        "ING-KETOROLAC": {"CLS-NSAIDS"},
        "ING-ASPIRIN": {"CLS-ANTIPLATELETS"},
        "ING-CLOPIDOGREL": {"CLS-ANTIPLATELETS"},
        "ING-WARFARIN": {"CLS-ANTICOAGULANTS"},
        "ING-ATORVASTATIN": {"CLS-STATINS"},
        "ING-SIMVASTATIN": {"CLS-STATINS"},
        "ING-OMEPRAZOLE": {"CLS-PPIS"},
        "ING-ESOMEPRAZOLE": {"CLS-PPIS"},
        "ING-SERTRALINE": {"CLS-SSRIS"},
        "ING-FLUOXETINE": {"CLS-SSRIS"},
        "ING-TRAMADOL": {"CLS-OPIOIDS"},
        "ING-ALPRAZOLAM": {"CLS-BENZODIAZEPINES"},
        "ING-RAMIPRIL": {"CLS-ACE-INHIBITORS"},
        "ING-CAPTOPRIL": {"CLS-ACE-INHIBITORS"},
        "ING-SPIRONOLACTONE": {"CLS-K-SPARING-DIURETICS"},
        "ING-BISOPROLOL": {"CLS-BETA-BLOCKERS"},
        "ING-ISOSORBIDE-DINITRATE": {"CLS-NITRATES"},
        "ING-SILDENAFIL": {"CLS-PDE5-INHIBITORS"},
        "ING-FLUCONAZOLE": {"CLS-AZOLE-ANTIFUNGALS"},
        "ING-GLIMEPIRIDE": {"CLS-SULFONYLUREAS"},
        "ING-METFORMIN": {"CLS-BIGUANIDES"},
        "ING-CARBAMAZEPINE": {"CLS-ANTIEPILEPTICS"},
        "ING-PHENYTOIN": {"CLS-ANTIEPILEPTICS"},
        "ING-SALBUTAMOL": {"CLS-BETA2-AGONISTS"},
        "ING-PARACETAMOL": {"CLS-ANALGESICS-SIMPLE"},
    }
    ingredient_classes = {k: frozenset(v) for k, v in ing_classes_raw.items()}

    seed_drugs: list[tuple[str, str, str, list[str]]] = [
        (
            "DRG-AUGMENTIN-1G",
            "Augmentin",
            "Amoxicillin/Clavulanate",
            ["ING-AMOXICILLIN", "ING-CLAVULANATE"],
        ),
        ("DRG-AMOXIL-500", "Amoxil", "Amoxicillin", ["ING-AMOXICILLIN"]),
        ("DRG-CEPOREX-500", "Ceporex", "Cephalexin", ["ING-CEPHALEXIN"]),
        ("DRG-ROCEPHIN-1G", "Rocephin", "Ceftriaxone", ["ING-CEFTRIAXONE"]),
        ("DRG-ZITHROMAX-500", "Zithromax", "Azithromycin", ["ING-AZITHROMYCIN"]),
        ("DRG-KLACID-500", "Klacid", "Clarithromycin", ["ING-CLARITHROMYCIN"]),
        ("DRG-CIPROBAY-500", "Ciprobay", "Ciprofloxacin", ["ING-CIPROFLOXACIN"]),
        (
            "DRG-SEPTRIN-DS",
            "Septrin DS",
            "Sulfamethoxazole/Trimethoprim",
            ["ING-SULFAMETHOXAZOLE", "ING-TRIMETHOPRIM"],
        ),
        ("DRG-FLAGYL-500", "Flagyl", "Metronidazole", ["ING-METRONIDAZOLE"]),
        ("DRG-PANADOL-500", "Panadol", "Paracetamol", ["ING-PARACETAMOL"]),
        ("DRG-BRUFEN-400", "Brufen", "Ibuprofen", ["ING-IBUPROFEN"]),
        ("DRG-CATAFLAM-50", "Cataflam", "Diclofenac", ["ING-DICLOFENAC"]),
        ("DRG-KETOLAC-10", "Ketolac", "Ketorolac", ["ING-KETOROLAC"]),
        ("DRG-ASPOCID-75", "Aspocid", "Aspirin", ["ING-ASPIRIN"]),
        ("DRG-PLAVIX-75", "Plavix", "Clopidogrel", ["ING-CLOPIDOGREL"]),
        ("DRG-MAREVAN-5", "Marevan", "Warfarin", ["ING-WARFARIN"]),
        ("DRG-LIPITOR-20", "Lipitor", "Atorvastatin", ["ING-ATORVASTATIN"]),
        ("DRG-ZOCOR-20", "Zocor", "Simvastatin", ["ING-SIMVASTATIN"]),
        ("DRG-GASEC-20", "Gasec", "Omeprazole", ["ING-OMEPRAZOLE"]),
        ("DRG-NEXIUM-40", "Nexium", "Esomeprazole", ["ING-ESOMEPRAZOLE"]),
        ("DRG-LUSTRAL-50", "Lustral", "Sertraline", ["ING-SERTRALINE"]),
        ("DRG-PROZAC-20", "Prozac", "Fluoxetine", ["ING-FLUOXETINE"]),
        ("DRG-TRAMAL-50", "Tramal", "Tramadol", ["ING-TRAMADOL"]),
        ("DRG-XANAX-05", "Xanax", "Alprazolam", ["ING-ALPRAZOLAM"]),
        ("DRG-TRITACE-5", "Tritace", "Ramipril", ["ING-RAMIPRIL"]),
        ("DRG-CAPOTEN-25", "Capoten", "Captopril", ["ING-CAPTOPRIL"]),
        ("DRG-ALDACTONE-25", "Aldactone", "Spironolactone", ["ING-SPIRONOLACTONE"]),
        ("DRG-CONCOR-5", "Concor", "Bisoprolol", ["ING-BISOPROLOL"]),
        ("DRG-ISORDIL-10", "Isordil", "Isosorbide dinitrate", ["ING-ISOSORBIDE-DINITRATE"]),
        ("DRG-VIAGRA-50", "Viagra", "Sildenafil", ["ING-SILDENAFIL"]),
        ("DRG-DIFLUCAN-150", "Diflucan", "Fluconazole", ["ING-FLUCONAZOLE"]),
        ("DRG-AMARYL-2", "Amaryl", "Glimepiride", ["ING-GLIMEPIRIDE"]),
        ("DRG-GLUCOPHAGE-500", "Glucophage", "Metformin", ["ING-METFORMIN"]),
        ("DRG-TEGRETOL-200", "Tegretol", "Carbamazepine", ["ING-CARBAMAZEPINE"]),
        ("DRG-EPANUTIN-100", "Epanutin", "Phenytoin", ["ING-PHENYTOIN"]),
        ("DRG-LANOXIN-025", "Lanoxin", "Digoxin", ["ING-DIGOXIN"]),
        ("DRG-CORDARONE-200", "Cordarone", "Amiodarone", ["ING-AMIODARONE"]),
        ("DRG-VENTOLIN-100", "Ventolin", "Salbutamol", ["ING-SALBUTAMOL"]),
        ("DRG-LASIX-40", "Lasix", "Furosemide", ["ING-FUROSEMIDE"]),
    ]

    drugs_by_id: dict[str, DrugSummary] = {}
    drug_ingredients: dict[str, frozenset[str]] = {}
    med_terms: set[str] = set()
    for code, brand, generic, ings in seed_drugs:
        uid = seed_drug_uuid(code)
        summary = DrugSummary(id=uid, code=code, brand_name=brand, generic_name=generic)
        drugs_by_id[uid] = summary
        drugs_by_id[code] = summary
        drug_ingredients[uid] = frozenset(ings)
        drug_ingredients[code] = frozenset(ings)
        for token in (brand.lower(), *(p.strip().lower() for p in generic.split("/"))):
            if token and token != "paracetamol":
                med_terms.add(token)

    ddi_raw: list[tuple[str, str, str, str, str, str]] = [
        (
            "ING-WARFARIN",
            "ING-ASPIRIN",
            "major",
            "Additive anticoagulant/antiplatelet effect; increased bleeding risk.",
            "Avoid unless clearly indicated; monitor INR and signs of bleeding.",
            "SEED-001",
        ),
        (
            "ING-WARFARIN",
            "ING-IBUPROFEN",
            "major",
            "NSAID antiplatelet effect and GI mucosal injury increase bleeding risk.",
            "Prefer paracetamol; monitor INR.",
            "SEED-002",
        ),
        (
            "ING-WARFARIN",
            "ING-DICLOFENAC",
            "major",
            "NSAID antiplatelet effect and GI injury increase bleeding risk.",
            "Prefer paracetamol; monitor INR.",
            "SEED-003",
        ),
        (
            "ING-WARFARIN",
            "ING-KETOROLAC",
            "contraindicated",
            "High bleeding risk with ketorolac in anticoagulated patients.",
            "Do not combine.",
            "SEED-004",
        ),
        (
            "ING-WARFARIN",
            "ING-METRONIDAZOLE",
            "major",
            "Inhibition of warfarin metabolism (CYP2C9) raises INR.",
            "Consider warfarin dose reduction; check INR within 3-5 days.",
            "SEED-005",
        ),
        (
            "ING-WARFARIN",
            "ING-FLUCONAZOLE",
            "major",
            "CYP2C9 inhibition increases warfarin effect.",
            "Monitor INR closely; consider dose reduction.",
            "SEED-006",
        ),
        (
            "ING-WARFARIN",
            "ING-AMIODARONE",
            "major",
            "CYP2C9/3A4 inhibition increases INR for weeks.",
            "Reduce warfarin dose; monitor INR.",
            "SEED-007",
        ),
        (
            "ING-WARFARIN",
            "ING-CIPROFLOXACIN",
            "moderate",
            "May increase anticoagulant effect.",
            "Monitor INR during and after the course.",
            "SEED-008",
        ),
        (
            "ING-WARFARIN",
            "ING-CLARITHROMYCIN",
            "major",
            "CYP3A4 inhibition increases warfarin effect.",
            "Prefer azithromycin; monitor INR.",
            "SEED-009",
        ),
        (
            "ING-WARFARIN",
            "ING-SULFAMETHOXAZOLE",
            "major",
            "CYP2C9 inhibition markedly increases INR.",
            "Avoid or reduce warfarin dose with close INR monitoring.",
            "SEED-010",
        ),
        (
            "ING-SIMVASTATIN",
            "ING-CLARITHROMYCIN",
            "contraindicated",
            "Strong CYP3A4 inhibition increases statin levels; rhabdomyolysis risk.",
            "Do not combine.",
            "SEED-011",
        ),
        (
            "ING-SIMVASTATIN",
            "ING-AMIODARONE",
            "major",
            "Increased simvastatin exposure; myopathy risk.",
            "Do not exceed simvastatin 20 mg/day.",
            "SEED-012",
        ),
        (
            "ING-ATORVASTATIN",
            "ING-CLARITHROMYCIN",
            "major",
            "CYP3A4 inhibition increases atorvastatin exposure.",
            "Limit atorvastatin dose or pause during course.",
            "SEED-013",
        ),
        (
            "ING-SILDENAFIL",
            "ING-ISOSORBIDE-DINITRATE",
            "contraindicated",
            "Synergistic vasodilation causes profound hypotension.",
            "Do not combine.",
            "SEED-014",
        ),
        (
            "ING-SPIRONOLACTONE",
            "ING-RAMIPRIL",
            "major",
            "Additive potassium retention raises hyperkalaemia risk.",
            "Monitor potassium and renal function.",
            "SEED-015",
        ),
        (
            "ING-SPIRONOLACTONE",
            "ING-CAPTOPRIL",
            "major",
            "Additive potassium retention raises hyperkalaemia risk.",
            "Monitor potassium and renal function.",
            "SEED-016",
        ),
        (
            "ING-DIGOXIN",
            "ING-AMIODARONE",
            "major",
            "Amiodarone raises digoxin levels (P-gp inhibition).",
            "Reduce digoxin dose by ~50% and monitor levels.",
            "SEED-017",
        ),
        (
            "ING-DIGOXIN",
            "ING-CLARITHROMYCIN",
            "major",
            "P-gp inhibition increases digoxin toxicity risk.",
            "Prefer azithromycin; monitor digoxin level.",
            "SEED-018",
        ),
        (
            "ING-CLOPIDOGREL",
            "ING-OMEPRAZOLE",
            "moderate",
            "CYP2C19 inhibition reduces clopidogrel activation.",
            "Prefer pantoprazole if a PPI is required.",
            "SEED-019",
        ),
        (
            "ING-CLOPIDOGREL",
            "ING-ESOMEPRAZOLE",
            "moderate",
            "CYP2C19 inhibition reduces clopidogrel activation.",
            "Prefer pantoprazole if a PPI is required.",
            "SEED-020",
        ),
        (
            "ING-TRAMADOL",
            "ING-SERTRALINE",
            "major",
            "Serotonin syndrome and seizure-threshold lowering.",
            "Avoid or use lowest doses with monitoring.",
            "SEED-021",
        ),
        (
            "ING-TRAMADOL",
            "ING-FLUOXETINE",
            "major",
            "Serotonin syndrome; CYP2D6 inhibition alters tramadol effect.",
            "Avoid combination.",
            "SEED-022",
        ),
        (
            "ING-CARBAMAZEPINE",
            "ING-CLARITHROMYCIN",
            "major",
            "CYP3A4 inhibition causes carbamazepine toxicity.",
            "Use azithromycin; monitor levels.",
            "SEED-023",
        ),
        (
            "ING-PHENYTOIN",
            "ING-FLUCONAZOLE",
            "major",
            "CYP2C9 inhibition raises phenytoin levels.",
            "Monitor phenytoin levels and toxicity.",
            "SEED-024",
        ),
        (
            "ING-ALPRAZOLAM",
            "ING-CLARITHROMYCIN",
            "major",
            "CYP3A4 inhibition increases sedation.",
            "Reduce alprazolam dose or avoid.",
            "SEED-025",
        ),
        (
            "ING-IBUPROFEN",
            "ING-ASPIRIN",
            "moderate",
            "Ibuprofen may blunt aspirin antiplatelet effect; additive GI risk.",
            "Give aspirin >= 30 min before ibuprofen.",
            "SEED-026",
        ),
        (
            "ING-KETOROLAC",
            "ING-IBUPROFEN",
            "contraindicated",
            "Ketorolac with another NSAID greatly increases GI bleeding and renal risk.",
            "Do not combine.",
            "SEED-027",
        ),
        (
            "ING-KETOROLAC",
            "ING-DICLOFENAC",
            "contraindicated",
            "Ketorolac with another NSAID greatly increases GI bleeding and renal risk.",
            "Do not combine.",
            "SEED-028",
        ),
        (
            "ING-GLIMEPIRIDE",
            "ING-CLARITHROMYCIN",
            "moderate",
            "Increased risk of hypoglycaemia.",
            "Monitor blood glucose.",
            "SEED-029",
        ),
        (
            "ING-ASPIRIN",
            "ING-CLOPIDOGREL",
            "moderate",
            "Additive bleeding risk (confirm intended dual antiplatelet therapy).",
            "Confirm indication; consider gastroprotection.",
            "SEED-030",
        ),
    ]

    ddi: dict[tuple[str, str], list[DdiRule]] = {}
    for a, b, sev, mech, mgmt, ref in ddi_raw:
        pair = (min(a, b), max(a, b))
        ddi.setdefault(pair, []).append(
            DdiRule(
                rule_id=ref,
                ingredient_a=pair[0],
                ingredient_b=pair[1],
                severity=sev,
                mechanism_en=mech,
                management_en=mgmt,
            )
        )

    cross_raw = [
        (
            "ALG-CLASS-001",
            "CLS-PENICILLINS",
            "CLS-PENICILLINS",
            "contraindicated",
            "major",
            "Same class as recorded penicillin allergy.",
        ),
        (
            "ALG-CLASS-002",
            "CLS-PENICILLINS",
            "CLS-CEPHALOSPORINS",
            "major",
            "moderate",
            "Cross-reactivity risk between penicillins and cephalosporins.",
        ),
        (
            "ALG-CLASS-003",
            "CLS-CEPHALOSPORINS",
            "CLS-CEPHALOSPORINS",
            "contraindicated",
            "major",
            "Same class as recorded cephalosporin allergy.",
        ),
        (
            "ALG-CLASS-004",
            "CLS-SULFONAMIDE-ANTIBIOTICS",
            "CLS-SULFONAMIDE-ANTIBIOTICS",
            "contraindicated",
            "major",
            "Same class as recorded sulfonamide allergy.",
        ),
        (
            "ALG-CLASS-005",
            "CLS-NSAIDS",
            "CLS-NSAIDS",
            "contraindicated",
            "major",
            "NSAID hypersensitivity commonly cross-reacts across NSAIDs.",
        ),
        (
            "ALG-CLASS-006",
            "CLS-NSAIDS",
            "CLS-ANTIPLATELETS",
            "major",
            "moderate",
            "Aspirin-exacerbated reactions may occur in NSAID-hypersensitive patients.",
        ),
        (
            "ALG-CLASS-007",
            "CLS-MACROLIDES",
            "CLS-MACROLIDES",
            "contraindicated",
            "major",
            "Same class as recorded macrolide allergy.",
        ),
        (
            "ALG-CLASS-008",
            "CLS-FLUOROQUINOLONES",
            "CLS-FLUOROQUINOLONES",
            "contraindicated",
            "major",
            "Same class as recorded fluoroquinolone allergy.",
        ),
        (
            "ALG-CLASS-009",
            "CLS-OPIOIDS",
            "CLS-OPIOIDS",
            "major",
            "moderate",
            "Possible cross-sensitivity among opioids.",
        ),
    ]
    cross = {
        (ac, tc): CrossReactivityRule(
            rule_id=rid,
            allergen_class=ac,
            target_class=tc,
            severity_if_severe=s_sev,
            severity_if_mild=s_mild,
            note_en=note,
        )
        for rid, ac, tc, s_sev, s_mild, note in cross_raw
    }

    cond_rules = (
        DrugConditionRule(
            "DC-NSAID-N184",
            "CLS-NSAIDS",
            None,
            "N18.4",
            "major",
            "NSAIDs can worsen renal function in advanced CKD.",
        ),
        DrugConditionRule(
            "DC-NSAID-N185",
            "CLS-NSAIDS",
            None,
            "N18.5",
            "contraindicated",
            "Avoid NSAIDs in CKD stage 5.",
        ),
        DrugConditionRule(
            "DC-NSAID-K27",
            "CLS-NSAIDS",
            None,
            "K27",
            "major",
            "NSAIDs increase risk of peptic ulcer bleeding.",
        ),
        DrugConditionRule(
            "DC-NSAID-I50",
            "CLS-NSAIDS",
            None,
            "I50",
            "major",
            "NSAIDs cause fluid retention and may worsen heart failure.",
        ),
        DrugConditionRule(
            "DC-MET-N184",
            None,
            "ING-METFORMIN",
            "N18.4",
            "contraindicated",
            "Metformin is contraindicated when eGFR < 30 (CKD stage 4-5).",
        ),
        DrugConditionRule(
            "DC-MET-N185",
            None,
            "ING-METFORMIN",
            "N18.5",
            "contraindicated",
            "Metformin is contraindicated when eGFR < 30 (CKD stage 4-5).",
        ),
        DrugConditionRule(
            "DC-BB-J45",
            "CLS-BETA-BLOCKERS",
            None,
            "J45",
            "major",
            "Beta blockers may provoke bronchospasm in asthma.",
        ),
        DrugConditionRule(
            "DC-CBZ-O09",
            None,
            "ING-CARBAMAZEPINE",
            "O09",
            "major",
            "Teratogenic risk; specialist review required in pregnancy.",
        ),
        DrugConditionRule(
            "DC-PHT-O09",
            None,
            "ING-PHENYTOIN",
            "O09",
            "major",
            "Teratogenic risk; specialist review required in pregnancy.",
        ),
    )

    return RefDataSnapshot(
        dataset_version=dataset_version,
        drugs_by_id=drugs_by_id,
        drug_ingredients=drug_ingredients,
        ingredient_classes=ingredient_classes,
        ddi=ddi,
        cross=cross,
        dup_classes=dup_classes,
        drug_condition_rules=cond_rules,
        specialty_codes=specialty_codes,
        medication_terms=frozenset(med_terms),
    )


class RefDataStore:
    def __init__(self, initial: RefDataSnapshot) -> None:
        self._snapshot = initial

    @property
    def snapshot(self) -> RefDataSnapshot:
        return self._snapshot

    @classmethod
    async def load(cls, database_url: str, dataset_version: str) -> RefDataStore:
        snap = build_seed_refdata(dataset_version=dataset_version)
        store = cls(snap)
        if database_url:
            await store.refresh(database_url)
        return store

    async def refresh(self, database_url: str) -> None:
        if not database_url:
            return
        try:
            psycopg = importlib.import_module("psycopg")
        except ImportError:
            return

        def _fetch() -> RefDataSnapshot:
            with psycopg.connect(database_url) as conn, conn.cursor() as cur:
                cur.execute(
                    "select d.id::text, d.code, d.brand_name, d.generic_name "
                    "from ref.drugs d where d.is_active"
                )
                drugs_rows = cur.fetchall()
                drugs_by_id: dict[str, DrugSummary] = {}
                med_terms: set[str] = set()
                for did, code, brand, generic in drugs_rows:
                    ds = DrugSummary(id=did, code=code, brand_name=brand, generic_name=generic)
                    drugs_by_id[did] = ds
                    drugs_by_id[code] = ds
                    if brand.lower() != "paracetamol":
                        med_terms.add(brand.lower())
                    if generic.lower() != "paracetamol":
                        med_terms.add(generic.lower())

                cur.execute("select drug_id::text, ingredient_code from ref.drug_ingredients")
                di_map: dict[str, set[str]] = {}
                code_to_id = {d.code: d.id for d in drugs_by_id.values()}
                for did, ing in cur.fetchall():
                    di_map.setdefault(did, set()).add(ing)
                drug_ingredients: dict[str, frozenset[str]] = {
                    k: frozenset(v) for k, v in di_map.items()
                }
                for code, did in code_to_id.items():
                    if did in drug_ingredients:
                        drug_ingredients[code] = drug_ingredients[did]

                cur.execute("select ingredient_code, class_code from ref.ingredient_classes")
                ic_map: dict[str, set[str]] = {}
                for ing, cls_code in cur.fetchall():
                    ic_map.setdefault(ing, set()).add(cls_code)

                cur.execute("select code from ref.drug_classes where duplicate_check")
                dup_classes = frozenset(r[0] for r in cur.fetchall())

                cur.execute(
                    "select source_ref, ingredient_a, ingredient_b, severity, mechanism_en, "
                    "mechanism_ar, management_en, management_ar, source from ref.ddi_rules"
                )
                ddi: dict[tuple[str, str], list[DdiRule]] = {}
                for ref_id, a, b, sev, m_en, m_ar, mg_en, mg_ar, src in cur.fetchall():
                    pair = (min(a, b), max(a, b))
                    ddi.setdefault(pair, []).append(
                        DdiRule(
                            rule_id=str(ref_id or f"{pair[0]}:{pair[1]}"),
                            ingredient_a=pair[0],
                            ingredient_b=pair[1],
                            severity=sev,
                            mechanism_en=m_en,
                            mechanism_ar=m_ar,
                            management_en=mg_en,
                            management_ar=mg_ar,
                            source=src,
                        )
                    )

                cur.execute(
                    "select allergen_class, target_class, severity_if_severe, severity_if_mild, "
                    "note_en, note_ar from ref.allergy_cross_reactivity"
                )
                cross: dict[tuple[str, str], CrossReactivityRule] = {}
                for idx, (ac, tc, s_sev, s_mild, n_en, n_ar) in enumerate(cur.fetchall(), start=1):
                    cross[(ac, tc)] = CrossReactivityRule(
                        rule_id=f"ALG-CLASS-{idx:03d}",
                        allergen_class=ac,
                        target_class=tc,
                        severity_if_severe=s_sev,
                        severity_if_mild=s_mild,
                        note_en=n_en,
                        note_ar=n_ar,
                    )

                cur.execute(
                    "select class_code, ingredient_code, icd10_prefix, "
                    "severity, message_en, message_ar from ref.drug_condition_rules"
                )
                cond_rules = tuple(
                    DrugConditionRule(
                        rule_id=f"DC-{idx:03d}",
                        class_code=cc,
                        ingredient_code=ic,
                        icd10_prefix=pref,
                        severity=sev,
                        message_en=m_en,
                        message_ar=m_ar,
                    )
                    for idx, (cc, ic, pref, sev, m_en, m_ar) in enumerate(cur.fetchall(), start=1)
                )

                cur.execute("select code from ref.specialties")
                specialties = frozenset(r[0] for r in cur.fetchall())

                return RefDataSnapshot(
                    dataset_version=self._snapshot.dataset_version,
                    drugs_by_id=drugs_by_id,
                    drug_ingredients=drug_ingredients,
                    ingredient_classes={k: frozenset(v) for k, v in ic_map.items()},
                    ddi=ddi,
                    cross=cross,
                    dup_classes=dup_classes,
                    drug_condition_rules=cond_rules,
                    specialty_codes=specialties,
                    medication_terms=frozenset(med_terms),
                )

        self._snapshot = await asyncio.to_thread(_fetch)

    async def refresh_every(self, database_url: str, interval_sec: int = 600) -> None:
        while True:
            await asyncio.sleep(interval_sec)
            try:
                await self.refresh(database_url)
            except Exception:
                continue

from __future__ import annotations

from app.assistant.normalize import normalize_text

_SPECIALTY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "cardiology",
        ("chest", "palpitation", "blood pressure", "heart", "صدر", "خفقان", "ضغط", "قلب"),
    ),
    (
        "pulmonology",
        ("cough", "wheez", "asthma", "shortness of breath", "كحه", "ربو", "نهجان", "صدر"),
    ),
    (
        "neurology",
        ("headache", "migraine", "dizzy", "dizziness", "numb", "seizure", "صداع", "دوخه", "تنميل"),
    ),
    (
        "gastroenterology",
        (
            "stomach",
            "nausea",
            "vomit",
            "diarrhea",
            "acid",
            "constipat",
            "معده",
            "بطن",
            "ترجيع",
            "اسهال",
            "حموضه",
        ),
    ),
    ("dermatology", ("rash", "itch", "skin", "acne", "eczema", "طفح", "حكه", "جلد", "هرش")),
    ("ent", ("ear", "throat", "sore throat", "sinus", "nose", "اذن", "حلق", "زور", "جيوب انفيه")),
    ("ophthalmology", ("eye", "vision", "blurry", "عين", "رؤيه", "زغلله")),
    (
        "orthopedics",
        ("joint", "knee", "back pain", "bone", "sprain", "مفاصل", "ركبه", "ظهر", "عظام"),
    ),
    ("endocrinology", ("diabetes", "thyroid", "sugar", "سكر", "غده")),
    ("urology", ("urine", "urination", "burning urine", "kidney stone", "بول", "حرقان", "كلي")),
    ("obstetrics_gynecology", ("pregnant", "period", "menstrual", "pelvic", "حمل", "دوره")),
    ("psychiatry", ("anxiety", "depress", "panic", "insomnia", "قلق", "اكتئاب", "ارق", "توتر")),
    ("dentistry", ("tooth", "gum", "dental", "اسنان", "ضرس", "لثه")),
)


def map_specialty(text: str, valid_codes: frozenset[str] | None = None) -> str:
    norm = normalize_text(text)
    for code, keywords in _SPECIALTY_KEYWORDS:
        if valid_codes is not None and code not in valid_codes:
            continue
        if any(normalize_text(kw) in norm for kw in keywords):
            return code
    return "general_practice"

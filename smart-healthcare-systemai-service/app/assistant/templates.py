from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ResponseTemplate:
    text: str
    self_care: list[str]
    warning_signs: list[str]
    specialty_code: str
    specialty_reason: str
    emergency_action: str | None = None


_TEMPLATES: dict[tuple[str, str], ResponseTemplate] = {
    ("ar", "emergency_cardiac"): ResponseTemplate(
        text=(
            "ألم الصدر المصحوب بالأعراض دي بيحتاج تقييم إسعافي فوري فوراً. "
            "اطلب الإسعاف 123 دلوقتي وما تسوقش نفسك للمستشفى."
        ),
        self_care=[
            "اقعد وارتاح تماماً لحين وصول المساعدة",
            "ما تاخدش أي أدوية بدون توجيه طاقم الطوارئ",
        ],
        warning_signs=["زيادة ألم الصدر", "ضيق شديد في التنفس أو إغماء"],
        specialty_code="emergency_medicine",
        specialty_reason="تقييم طارئ لأعراض الصدر الحادة",
        emergency_action="call_123",
    ),
    ("en", "emergency_cardiac"): ResponseTemplate(
        text=(
            "Chest discomfort with these symptoms requires immediate emergency evaluation. "
            "Call 123 right now and do not drive yourself to the hospital."
        ),
        self_care=["Sit upright and rest calmly while waiting for paramedics"],
        warning_signs=["Worsening chest pain", "Shortness of breath or fainting"],
        specialty_code="emergency_medicine",
        specialty_reason="Immediate emergency assessment for acute chest symptoms",
        emergency_action="call_123",
    ),
    ("ar", "crisis_support"): ResponseTemplate(
        text=(
            "إحنا هنا عشان نساعدك ومش لوحدك. لو في خطر فوري على حياتك، "
            "اتصل بالإسعاف 123 أو روح أقرب قسم طوارئ فوراً وكلم حد قريب منك يبقى معاك."
        ),
        self_care=[
            "تواصل فوراً مع شخص بتثق فيه أو قريب منك",
            "توجه لأقرب مستشفى طوارئ أو اتصل بـ 123",
        ],
        warning_signs=["أي نية أو خطة لأذى النفس"],
        specialty_code="psychiatry",
        specialty_reason="دعم نفسي وتدخل طارئ فوري",
        emergency_action="crisis_helpline",
    ),
    ("en", "crisis_support"): ResponseTemplate(
        text=(
            "You are not alone and immediate help is available. If you are in danger of hurting "
            "yourself, please call 123 or go to the nearest emergency department immediately."
        ),
        self_care=["Reach out right now to someone you trust to stay with you"],
        warning_signs=["Any immediate risk of self-harm"],
        specialty_code="psychiatry",
        specialty_reason="Immediate crisis support and safety assessment",
        emergency_action="crisis_helpline",
    ),
    ("ar", "emergency_default"): ResponseTemplate(
        text=(
            "الأعراض اللي ذكرتها فيها علامات خطر بتتطلب تدخل طبي عاجل. "
            "اتصل بالإسعاف 123 فوراً أو توجه لأقرب طوارئ."
        ),
        self_care=["حافظ على هدوئك وما تبذلش أي مجهود لحد وصول الطوارئ"],
        warning_signs=["تدهور سريع في الوعي أو التنفس"],
        specialty_code="emergency_medicine",
        specialty_reason="تقييم طوارئ فوري لعلامات الخطر",
        emergency_action="call_123",
    ),
    ("en", "emergency_default"): ResponseTemplate(
        text=(
            "The symptoms you described include warning signs requiring urgent emergency care. "
            "Call 123 immediately or go to the nearest emergency room."
        ),
        self_care=["Remain calm and avoid exertion until emergency care arrives"],
        warning_signs=["Worsening breathing, bleeding, or consciousness"],
        specialty_code="emergency_medicine",
        specialty_reason="Immediate emergency care for critical red-flag symptoms",
        emergency_action="call_123",
    ),
    ("ar", "urgent_generic"): ResponseTemplate(
        text=(
            "الصداع المفاجئ الشديد ده بيحتاج فحص طبي عاجل اليوم في أقرب قسم طوارئ "
            "أو عيادة مختصة عشان نطمن."
        ),
        self_care=["ارتاح في مكان هادي وبعيد عن الإضاءة القوية"],
        warning_signs=["تغير في الرؤية أو الكلام أو قيء مستمر"],
        specialty_code="neurology",
        specialty_reason="تقييم عاجل لأعراض الصداع المفاجئ الحاد",
        emergency_action=None,
    ),
    ("en", "urgent_generic"): ResponseTemplate(
        text=(
            "A sudden severe headache requires urgent medical evaluation today at an urgent care "
            "clinic or emergency department."
        ),
        self_care=["Rest in a quiet, dimly lit room while arranging urgent evaluation"],
        warning_signs=["Vision changes, weakness, or persistent vomiting"],
        specialty_code="neurology",
        specialty_reason="Urgent evaluation for sudden severe neurological symptoms",
        emergency_action=None,
    ),
    ("ar", "safe_fallback"): ResponseTemplate(
        text=(
            "شكراً على مشاركتك الأعراض. علشان أمانك، يفضل تراجع طبيب مختص يقيم حالتك بشكل مباشر، "
            "ولو ظهرت أي علامات خطر اتصل بـ 123 فوراً."
        ),
        self_care=["ارتاح واشرب سوائل كفاية لحد ميعاد الكشف"],
        warning_signs=["صعوبة في التنفس", "ألم شديد بالصدر", "دوخة أو إغماء"],
        specialty_code="general_practice",
        specialty_reason="فحص إكلينيكي مباشر لتقييم الأعراض",
        emergency_action=None,
    ),
    ("en", "safe_fallback"): ResponseTemplate(
        text=(
            "Thank you for sharing your symptoms. To ensure an accurate clinical evaluation, "
            "please consult a physician promptly, and call 123 immediately if severe symptoms "
            "develop."
        ),
        self_care=["Rest and stay hydrated until your clinical appointment"],
        warning_signs=["Trouble breathing", "Chest pain", "Fainting or severe weakness"],
        specialty_code="general_practice",
        specialty_reason="Direct clinical examination for symptom evaluation",
        emergency_action=None,
    ),
}


def get_response_template(locale: str, key: str) -> ResponseTemplate:
    loc = "ar" if locale == "ar" else "en"
    if (loc, key) in _TEMPLATES:
        return _TEMPLATES[(loc, key)]
    if key.startswith("emergency_"):
        return _TEMPLATES[(loc, "emergency_default")]
    return _TEMPLATES[(loc, "safe_fallback")]

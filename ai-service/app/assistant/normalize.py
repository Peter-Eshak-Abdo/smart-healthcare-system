from __future__ import annotations

import re

_TASHKEEL_RE = re.compile(r"[\u064B-\u065F\u0670\u0640]")
_WHITESPACE_RE = re.compile(r"\s+")
_REPEAT_CHAR_RE = re.compile(r"(.)\1{2,}")

_EASTERN_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

_FRANCO_PHRASES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\balam\s+f[ei]\s+sadry\b"), "الم في الصدر"),
    (re.compile(r"\bwag[a3]\s+f[ei]\s+sadry\b"), "وجع في الصدر"),
    (re.compile(r"\bmesh\s+ader\s+atnafes\b"), "مش قادر اتنفس"),
    (re.compile(r"\bmsh\s+2ader\s+atnfes\b"), "مش قادر اتنفس"),
    (re.compile(r"\b3andy\b|\b3ndy\b"), "عندي"),
    (re.compile(r"\balam\b"), "الم"),
    (re.compile(r"\bsadry\b"), "صدري"),
    (re.compile(r"\b3ara2\b|\b3araq\b"), "عرق"),
)


def normalize_text(text: str) -> str:
    s = text.translate(_EASTERN_DIGITS)
    s = _TASHKEEL_RE.sub("", s)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي").replace("ة", "ه")
    s = _REPEAT_CHAR_RE.sub(r"\1", s)
    s = s.lower()
    for pat, repl in _FRANCO_PHRASES:
        s = pat.sub(repl, s)
    s = _WHITESPACE_RE.sub(" ", s).strip()
    return s

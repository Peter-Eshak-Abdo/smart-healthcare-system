from __future__ import annotations

import re

_NID_RE = re.compile(r"\b[23]\d{13}\b")
_PHONE_RE = re.compile(r"(?:\+?20[\s-]?|0)?1[0125]\d{8}\b")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_MRN_RE = re.compile(r"\bSH-[0-9A-Za-z]{8}\b", re.IGNORECASE)


def scrub_pii(text: str) -> str:
    out = _NID_RE.sub("[ID]", text)
    out = _PHONE_RE.sub("[PHONE]", out)
    out = _EMAIL_RE.sub("[EMAIL]", out)
    out = _MRN_RE.sub("[MRN]", out)
    return out

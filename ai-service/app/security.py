from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Literal

import jwt
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from app.config import Settings, get_settings


class InternalClaims(BaseModel):
    model_config = ConfigDict(extra="ignore")

    iss: Literal["backend-api"]
    aud: Literal["ai-service"]
    iat: int
    exp: int
    jti: str
    scope: Literal["face", "clinical", "assistant"]
    rid: str | None = None


class JtiReplayCache:
    """Thread-safe time-bounded LRU replay detector (120 s TTL)."""

    def __init__(self, ttl_seconds: float = 120.0, max_size: int = 10_000) -> None:
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._seen: OrderedDict[str, float] = OrderedDict()
        self._lock = threading.Lock()

    def seen_or_record(self, jti: str, now: float | None = None) -> bool:
        ts = now if now is not None else time.monotonic()
        with self._lock:
            expired = [k for k, exp_ts in self._seen.items() if exp_ts <= ts]
            for k in expired:
                del self._seen[k]

            if jti in self._seen:
                self._seen.move_to_end(jti)
                return True

            self._seen[jti] = ts + self._ttl
            while len(self._seen) > self._max_size:
                self._seen.popitem(last=False)
            return False


_replay_cache = JtiReplayCache()


def reset_replay_cache() -> None:
    global _replay_cache
    _replay_cache = JtiReplayCache()


def require_internal(
    request: Request,
    fallback_settings: Settings = Depends(get_settings),  # noqa: B008
) -> InternalClaims:
    settings: Settings = getattr(request.app.state, "settings", fallback_settings)
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401)
    token = auth_header.removeprefix("Bearer ").strip()
    if not token or not settings.internal_jwt_public_key:
        raise HTTPException(status_code=401)

    pub_pem = settings.internal_jwt_public_key.replace("\\n", "\n")
    try:
        decoded = jwt.decode(
            token,
            pub_pem,
            algorithms=["EdDSA"],
            audience="ai-service",
            issuer="backend-api",
            leeway=30,
            options={"require": ["exp", "iat", "jti", "scope"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401) from exc

    claims = InternalClaims.model_validate(decoded)
    if _replay_cache.seen_or_record(claims.jti):
        raise HTTPException(status_code=401)
    return claims


def require_scope(
    expected_scope: Literal["face", "clinical", "assistant"],
) -> Callable[[InternalClaims], InternalClaims]:
    def _dep(claims: InternalClaims = Depends(require_internal)) -> InternalClaims:  # noqa: B008
        if claims.scope != expected_scope:
            raise HTTPException(status_code=401)
        return claims

    return _dep

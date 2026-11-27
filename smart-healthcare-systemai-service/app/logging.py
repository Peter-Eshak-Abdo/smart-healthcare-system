from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import Any

import structlog

_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "frame",
        "frames",
        "image",
        "embedding",
        "vector",
        "template",
        "message",
        "text",
        "history",
        "password",
        "token",
    }
)


def _redact_processor(
    _: Any,
    __: str,
    event_dict: MutableMapping[str, Any],
) -> MutableMapping[str, Any]:
    for key in list(event_dict.keys()):
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "[REDACTED]"
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", level=getattr(logging, level.upper(), logging.INFO))
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.add_log_level,
            _redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "ai_service") -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)  # type: ignore[no-any-return]

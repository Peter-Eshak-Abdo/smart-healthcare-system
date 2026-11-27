from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    face_loaded = bool(getattr(request.app.state, "face_loaded", False))
    dataset_version = getattr(request.app.state, "dataset_version", "seed-2026-11")
    llm = getattr(request.app.state, "llm", None)
    llm_ok = await llm.ping() if llm is not None else False
    return {
        "status": "ok",
        "models": {
            "face": "loaded" if face_loaded else "not_loaded",
            "pad": "loaded" if face_loaded else "not_loaded",
        },
        "rules": {"dataset_version": dataset_version},
        "llm": "reachable" if llm_ok else "unreachable",
    }

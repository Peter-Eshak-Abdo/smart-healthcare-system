from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.assistant.pipeline import AssistantPipeline
from app.schemas.assistant import TriageRequest, TriageResponse
from app.security import InternalClaims, require_scope

router = APIRouter()


@router.post("/assistant/triage", response_model=TriageResponse)
async def triage_symptoms(
    payload: TriageRequest,
    request: Request,
    _: InternalClaims = Depends(require_scope("assistant")),  # noqa: B008
) -> TriageResponse:
    pipeline: AssistantPipeline = request.app.state.assistant
    return await pipeline.triage(payload)

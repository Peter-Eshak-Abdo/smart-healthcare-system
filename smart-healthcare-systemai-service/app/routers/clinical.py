from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.clinical.engine import check_interactions
from app.clinical.refdata import RefDataStore
from app.config import Settings, get_settings
from app.schemas.clinical import ClinicalCheckRequest, ClinicalCheckResponse
from app.security import InternalClaims, require_scope

router = APIRouter()


@router.post("/clinical/check-interactions", response_model=ClinicalCheckResponse)
async def check_clinical_interactions(
    payload: ClinicalCheckRequest,
    request: Request,
    settings: Settings = Depends(get_settings),  # noqa: B008
    _: InternalClaims = Depends(require_scope("clinical")),  # noqa: B008
) -> ClinicalCheckResponse:
    refstore: RefDataStore = request.app.state.refdata
    return check_interactions(
        payload,
        refstore.snapshot,
        engine_version=settings.engine_version,
    )

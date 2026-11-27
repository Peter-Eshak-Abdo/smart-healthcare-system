from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/fingerprint/identify")
async def identify_fingerprint() -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "code": "FEATURE_NOT_IMPLEMENTED",
            "detail": "fingerprint_1toN_out_of_mvp_scope",
        },
    )

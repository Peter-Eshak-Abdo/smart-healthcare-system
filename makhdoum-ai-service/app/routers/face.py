from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.concurrency import PriorityExecutors
from app.face.pipeline import ActiveChallengeSpec, FacePipeline
from app.schemas.face import FaceAnalyzeResponse
from app.security import InternalClaims, require_scope

router = APIRouter()


@router.post("/face/analyze", response_model=FaceAnalyzeResponse)
async def analyze_face(
    request: Request,
    mode: Literal["enroll", "identify", "verify"] = Form(...),
    liveness_mode: Literal["active", "passive"] = Form(...),
    challenge: str | None = Form(None),
    frames: list[UploadFile] = File(...),  # noqa: B008
    _: InternalClaims = Depends(require_scope("face")),  # noqa: B008
) -> FaceAnalyzeResponse:
    if len(frames) < 1 or len(frames) > 5:
        raise HTTPException(status_code=400, detail="expected_1_to_5_frames")

    parsed_challenge: ActiveChallengeSpec | None = None
    if liveness_mode == "active":
        if not challenge:
            raise HTTPException(status_code=400, detail="challenge_required_for_active_liveness")
        raw_ch = json.loads(challenge)
        parsed_challenge = ActiveChallengeSpec(
            challenge_id=str(raw_ch["challenge_id"]),
            sequence=[str(x) for x in raw_ch.get("sequence", [])],
        )

    raw_bytes_list: list[bytes] = []
    for upload in frames:
        raw_bytes_list.append(await upload.read())

    pipeline: FacePipeline = request.app.state.face
    executors: PriorityExecutors = request.app.state.executors
    priority = request.headers.get("x-priority", "general")

    return await executors.run(
        priority,
        pipeline.analyze,
        frames_bytes=raw_bytes_list,
        mode=mode,
        liveness_mode=liveness_mode,
        challenge=parsed_challenge,
    )

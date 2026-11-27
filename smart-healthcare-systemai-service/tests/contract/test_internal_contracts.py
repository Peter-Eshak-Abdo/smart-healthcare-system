from __future__ import annotations

import json
from pathlib import Path

from app.schemas.assistant import TriageRequest, TriageResponse
from app.schemas.clinical import ClinicalCheckRequest, ClinicalCheckResponse
from app.schemas.face import FaceAnalyzeResponse

EXAMPLES_DIR = Path("../packages/contracts/examples/internal")


def test_internal_contract_examples_match_pydantic_models() -> None:
    face_res = json.loads((EXAMPLES_DIR / "face-analyze.response.json").read_text(encoding="utf-8"))
    FaceAnalyzeResponse.model_validate(face_res)

    clin_req = json.loads(
        (EXAMPLES_DIR / "clinical-check.request.json").read_text(encoding="utf-8")
    )
    ClinicalCheckRequest.model_validate(clin_req)

    clin_res = json.loads(
        (EXAMPLES_DIR / "clinical-check.response.json").read_text(encoding="utf-8")
    )
    ClinicalCheckResponse.model_validate(clin_res)

    ast_req = json.loads(
        (EXAMPLES_DIR / "assistant-triage.request.json").read_text(encoding="utf-8")
    )
    TriageRequest.model_validate(ast_req)

    ast_res = json.loads(
        (EXAMPLES_DIR / "assistant-triage.response.json").read_text(encoding="utf-8")
    )
    TriageResponse.model_validate(ast_res)

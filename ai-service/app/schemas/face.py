from __future__ import annotations

from typing import Literal

from app.schemas.common import StrictBaseModel


class SelectedFace(StrictBaseModel):
    bbox: list[int]
    det_score: float


class FaceQuality(StrictBaseModel):
    score: float
    blur: float
    brightness: float
    yaw: float
    pitch: float
    passed: bool
    hints: list[str]


class LivenessChecks(StrictBaseModel):
    pad_model: float
    challenge_completed: bool | None = None
    frame_consistency: bool | None = None


class FaceLiveness(StrictBaseModel):
    mode: Literal["active", "passive"]
    score: float
    passed: bool
    checks: LivenessChecks


class FaceTemplateOutput(StrictBaseModel):
    vector: list[float]
    dim: int = 512


class FaceTimingsMs(StrictBaseModel):
    decode: int
    detect: int
    liveness: int
    embed: int
    total: int


class FaceAnalyzeResponse(StrictBaseModel):
    face_detected: bool
    face_count: int
    selected_face: SelectedFace | None = None
    quality: FaceQuality
    liveness: FaceLiveness
    template: FaceTemplateOutput | None = None
    model_version: str
    transform_key_version: int
    timings_ms: FaceTimingsMs

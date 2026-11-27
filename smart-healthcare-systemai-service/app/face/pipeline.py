from __future__ import annotations

import math
import time
from dataclasses import dataclass

import numpy as np
from fastapi import HTTPException
from numpy.typing import NDArray

from app.config import Settings
from app.face.decode import ImageValidationError, validate_and_inspect_frame
from app.face.models import FaceInferenceBackend, FrameInferenceObservation
from app.face.transform import TemplateTransform
from app.schemas.face import (
    FaceAnalyzeResponse,
    FaceLiveness,
    FaceQuality,
    FaceTemplateOutput,
    FaceTimingsMs,
    LivenessChecks,
    SelectedFace,
)


@dataclass(slots=True)
class ActiveChallengeSpec:
    challenge_id: str
    sequence: list[str]


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _cosine(a: NDArray[np.float32], b: NDArray[np.float32]) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def _compute_quality(obs: FrameInferenceObservation, min_score: float) -> FaceQuality:
    raw_norm = float(np.linalg.norm(obs.raw_embedding)) if obs.raw_embedding is not None else 0.0
    norm_q = _clip01((raw_norm - 15.0) / (28.0 - 15.0))
    blur_q = _clip01(obs.blur_var / 300.0)
    light_q = _clip01(1.0 - abs(obs.brightness - 128.0) / 128.0)
    pose_q = _clip01(1.0 - max(abs(obs.yaw) / 45.0, abs(obs.pitch) / 35.0))
    score = round(0.4 * norm_q + 0.2 * blur_q + 0.2 * light_q + 0.2 * pose_q, 4)

    hints: list[str] = []
    if score < min_score:
        subscores = {
            "blurry": blur_q,
            "poor_lighting": light_q,
            "look_straight": pose_q,
            "move_closer": norm_q,
        }
        hints.append(min(subscores, key=lambda k: subscores[k]))

    return FaceQuality(
        score=score,
        blur=round(1.0 - blur_q, 4),
        brightness=round(obs.brightness, 2),
        yaw=round(obs.yaw, 2),
        pitch=round(obs.pitch, 2),
        passed=score >= min_score,
        hints=hints,
    )


def _verify_active_challenge(
    sequence: list[str],
    observations: list[FrameInferenceObservation],
) -> tuple[bool, bool]:
    if not observations:
        return False, False

    ears = [o.eye_aspect_ratio for o in observations]
    yaws = [o.yaw for o in observations]
    mouths = [o.mouth_ratio for o in observations]

    challenge_ok = True
    for action in sequence:
        if action == "blink":
            if not (min(ears) < 0.18 and max(ears) >= 0.25):
                challenge_ok = False
        elif action == "turn_left":
            if not any(y <= -20.0 for y in yaws):
                challenge_ok = False
        elif action == "turn_right":
            if not any(y >= 20.0 for y in yaws):
                challenge_ok = False
        elif action == "smile":
            min_m = max(min(mouths), 0.01)
            if max(mouths) < min_m * 1.15:
                challenge_ok = False

    # Check sequence order when both turn_left and turn_right appear
    if "turn_left" in sequence and "turn_right" in sequence:
        first_left_idx = next((i for i, y in enumerate(yaws) if y <= -20.0), None)
        first_right_idx = next((i for i, y in enumerate(yaws) if y >= 20.0), None)
        if first_left_idx is None or first_right_idx is None or (
            sequence.index("turn_left") < sequence.index("turn_right")
            and first_left_idx > first_right_idx
        ) or (
            sequence.index("turn_right") < sequence.index("turn_left")
            and first_right_idx > first_left_idx
        ):
            challenge_ok = False

    # Identity consistency across frames (catches face swap mid-sequence)
    embeddings = [o.raw_embedding for o in observations if o.raw_embedding is not None]
    consistency_ok = True
    if len(embeddings) >= 2:
        ref = embeddings[0]
        for emb in embeddings[1:]:
            if _cosine(ref, emb) < 0.60:
                consistency_ok = False
                break

    return challenge_ok, consistency_ok


class FacePipeline:
    def __init__(
        self,
        settings: Settings,
        backend: FaceInferenceBackend,
        transform: TemplateTransform,
    ) -> None:
        self._settings = settings
        self.backend = backend
        self.transform = transform

    def analyze(
        self,
        *,
        frames_bytes: list[bytes],
        mode: str,
        liveness_mode: str,
        challenge: ActiveChallengeSpec | None = None,
    ) -> FaceAnalyzeResponse:
        if not self.backend.models_loaded:
            raise HTTPException(status_code=503, detail="biometric_models_not_loaded")

        t_start = time.perf_counter()
        decoded_frames = []
        t_dec0 = time.perf_counter()
        try:
            for raw in frames_bytes:
                decoded_frames.append(validate_and_inspect_frame(raw))
        except ImageValidationError as exc:
            if exc.status_code != 422:
                raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
            return FaceAnalyzeResponse(
                face_detected=False,
                face_count=0,
                selected_face=None,
                quality=FaceQuality(
                    score=0.0,
                    blur=1.0,
                    brightness=0.0,
                    yaw=0.0,
                    pitch=0.0,
                    passed=False,
                    hints=["move_closer"],
                ),
                liveness=FaceLiveness(
                    mode="active" if liveness_mode == "active" else "passive",
                    score=0.0,
                    passed=False,
                    checks=LivenessChecks(pad_model=0.0),
                ),
                template=None,
                model_version=self.backend.model_version,
                transform_key_version=self.transform.current,
                timings_ms=FaceTimingsMs(
                    decode=int((time.perf_counter() - t_dec0) * 1000),
                    detect=0,
                    liveness=0,
                    embed=0,
                    total=int((time.perf_counter() - t_start) * 1000),
                ),
            )

        t_dec_ms = int((time.perf_counter() - t_dec0) * 1000)

        t_inf0 = time.perf_counter()
        observations = [self.backend.analyze_frame(frame) for frame in decoded_frames]
        t_inf_ms = int((time.perf_counter() - t_inf0) * 1000)

        best = observations[0]
        min_q = (
            self._settings.quality_min_identify
            if mode == "identify"
            else self._settings.quality_min_enroll
        )

        if not best.face_detected or best.face_count == 0 or best.face_count > 1:
            return FaceAnalyzeResponse(
                face_detected=best.face_detected,
                face_count=best.face_count,
                selected_face=None,
                quality=FaceQuality(
                    score=0.0,
                    blur=1.0,
                    brightness=best.brightness,
                    yaw=best.yaw,
                    pitch=best.pitch,
                    passed=False,
                    hints=["multiple_faces" if best.face_count > 1 else "no_face"],
                ),
                liveness=FaceLiveness(
                    mode="active" if liveness_mode == "active" else "passive",
                    score=0.0,
                    passed=False,
                    checks=LivenessChecks(pad_model=0.0),
                ),
                template=None,
                model_version=self.backend.model_version,
                transform_key_version=self.transform.current,
                timings_ms=FaceTimingsMs(
                    decode=t_dec_ms,
                    detect=t_inf_ms,
                    liveness=0,
                    embed=0,
                    total=int((time.perf_counter() - t_start) * 1000),
                ),
            )

        quality = _compute_quality(best, min_q)
        pad_avg = round(
            sum(o.pad_score for o in observations) / max(len(observations), 1),
            4,
        )
        pad_ok = pad_avg >= self._settings.liveness_threshold

        challenge_completed: bool | None = None
        frame_consistency: bool | None = None
        if liveness_mode == "active":
            seq = challenge.sequence if challenge else []
            challenge_completed, frame_consistency = _verify_active_challenge(seq, observations)
            liveness_passed = bool(pad_ok and challenge_completed and frame_consistency)
        else:
            liveness_passed = pad_ok

        liveness = FaceLiveness(
            mode="active" if liveness_mode == "active" else "passive",
            score=pad_avg,
            passed=liveness_passed,
            checks=LivenessChecks(
                pad_model=pad_avg,
                challenge_completed=challenge_completed,
                frame_consistency=frame_consistency,
            ),
        )

        template_out: FaceTemplateOutput | None = None
        if quality.passed and liveness.passed:
            valid_embs = [o.raw_embedding for o in observations if o.raw_embedding is not None]
            if valid_embs:
                unit_embs = [e / max(float(np.linalg.norm(e)), 1e-12) for e in valid_embs]
                mean_emb = np.mean(np.stack(unit_embs, axis=0), axis=0).astype(np.float32)
                norm = float(np.linalg.norm(mean_emb))
                if not math.isclose(norm, 0.0):
                    transformed = self.transform.apply(mean_emb)
                    template_out = FaceTemplateOutput(
                        vector=[round(float(x), 7) for x in transformed.tolist()],
                        dim=512,
                    )

        selected = (
            SelectedFace(bbox=best.bbox, det_score=round(best.det_score, 4)) if best.bbox else None
        )

        return FaceAnalyzeResponse(
            face_detected=True,
            face_count=1,
            selected_face=selected,
            quality=quality,
            liveness=liveness,
            template=template_out,
            model_version=self.backend.model_version,
            transform_key_version=self.transform.current,
            timings_ms=FaceTimingsMs(
                decode=t_dec_ms,
                detect=max(1, t_inf_ms // 3),
                liveness=max(1, t_inf_ms // 3),
                embed=max(1, t_inf_ms - (2 * (t_inf_ms // 3))),
                total=int((time.perf_counter() - t_start) * 1000),
            ),
        )

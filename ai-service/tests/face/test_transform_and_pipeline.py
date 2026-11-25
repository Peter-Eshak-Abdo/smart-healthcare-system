from __future__ import annotations

import hashlib
import struct
from pathlib import Path

import numpy as np
import pytest
from fastapi import HTTPException

from app.config import Settings
from app.face.decode import DecodedFrameInfo, ImageValidationError, validate_and_inspect_frame
from app.face.models import (
    FrameInferenceObservation,
    ModelChecksumError,
    UnloadedOnnxBackend,
    verify_model_checksums,
)
from app.face.pipeline import ActiveChallengeSpec, FacePipeline
from app.face.transform import TemplateTransform


def _fake_png(width: int = 640, height: int = 480) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + ihdr + b"\x00\x00\x00\x00"


class _SyntheticFaceBackend:
    model_version = "buffalo_l-arcface-r50@1"
    models_loaded = True

    def __init__(self, observations: list[FrameInferenceObservation]) -> None:
        self._obs = list(observations)

    def analyze_frame(self, frame: DecodedFrameInfo) -> FrameInferenceObservation:
        return self._obs.pop(0)


def test_orthogonal_transform_preserves_cosine_similarity() -> None:
    tf = TemplateTransform(seeds={1: b"seed-v1-abc", 2: b"seed-v2-xyz"}, current=1)
    rng = np.random.Generator(np.random.PCG64(99))
    max_cos_diff = 0.0
    for _ in range(100):
        a = rng.standard_normal(512).astype(np.float32)
        b = rng.standard_normal(512).astype(np.float32)
        a /= np.linalg.norm(a)
        b /= np.linalg.norm(b)
        ta = tf.apply(a, version=1)
        tb = tf.apply(b, version=1)
        diff = abs(float(np.dot(a, b)) - float(np.dot(ta, tb)))
        max_cos_diff = max(max_cos_diff, diff)
    assert max_cos_diff < 1e-5

    rekey = tf.rekey_matrix(1, 2)
    e = rng.standard_normal(512).astype(np.float32)
    e /= np.linalg.norm(e)
    assert float(np.max(np.abs(tf.apply(e, 2) - (rekey @ tf.apply(e, 1))))) < 1e-5


def test_frame_validation_and_checksum_enforcement(tmp_path: Path) -> None:
    valid = validate_and_inspect_frame(_fake_png(640, 480))
    assert valid.format == "png" and valid.width == 640

    with pytest.raises(ImageValidationError) as small_exc:
        validate_and_inspect_frame(_fake_png(200, 200))
    assert small_exc.value.status_code == 422

    with pytest.raises(ImageValidationError) as big_exc:
        validate_and_inspect_frame(b"\x89PNG\r\n\x1a\n" + b"0" * (301 * 1024))
    assert big_exc.value.status_code == 413

    with pytest.raises(ImageValidationError) as bad_fmt:
        validate_and_inspect_frame(b"NOT_AN_IMAGE_AT_ALL")
    assert bad_fmt.value.status_code == 400

    # Checksum enforcement
    sums_lines: list[str] = []
    for name in (
        "det_10g.onnx",
        "w600k_r50.onnx",
        "2d106det.onnx",
        "minifasnet_v2_80x80.onnx",
        "minifasnet_v1se_80x80.onnx",
    ):
        p = tmp_path / name
        content = f"weights-{name}".encode()
        p.write_bytes(content)
        sums_lines.append(f"{hashlib.sha256(content).hexdigest()}  {name}")
    (tmp_path / "SHA256SUMS").write_text("\n".join(sums_lines), encoding="utf-8")
    verify_model_checksums(tmp_path)

    (tmp_path / "det_10g.onnx").write_bytes(b"corrupted")
    with pytest.raises(ModelChecksumError):
        verify_model_checksums(tmp_path)


def test_face_pipeline_fail_closed_and_active_challenge() -> None:
    tf = TemplateTransform(seeds={1: b"seed-1"}, current=1)
    unloaded = FacePipeline(Settings(), UnloadedOnnxBackend(Path("missing")), tf)
    with pytest.raises(HTTPException) as exc:
        unloaded.analyze(frames_bytes=[_fake_png()], mode="identify", liveness_mode="passive")
    assert exc.value.status_code == 503

    base_emb = np.ones(512, dtype=np.float32)
    base_emb = base_emb / np.linalg.norm(base_emb) * 24.0

    obs = [
        FrameInferenceObservation(
            True, 1, [10, 10, 200, 200], 0.95, 290.0, 128.0, 0.0, 0.0, 0.30, 0.30, 0.94, base_emb
        ),
        FrameInferenceObservation(
            True, 1, [10, 10, 200, 200], 0.95, 290.0, 128.0, 0.0, 0.0, 0.14, 0.30, 0.92, base_emb
        ),
        FrameInferenceObservation(
            True, 1, [10, 10, 200, 200], 0.95, 290.0, 128.0, -25.0, 0.0, 0.30, 0.30, 0.93, base_emb
        ),
    ]
    pipe = FacePipeline(Settings(), _SyntheticFaceBackend(obs), tf)
    res = pipe.analyze(
        frames_bytes=[_fake_png(), _fake_png(), _fake_png()],
        mode="enroll",
        liveness_mode="active",
        challenge=ActiveChallengeSpec(challenge_id="c1", sequence=["blink", "turn_left"]),
    )
    assert res.face_detected is True
    assert res.quality.passed is True
    assert res.liveness.passed is True
    assert res.liveness.checks.challenge_completed is True
    assert res.liveness.checks.frame_consistency is True
    assert res.template is not None and res.template.dim == 512

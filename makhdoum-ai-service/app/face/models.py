from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
from numpy.typing import NDArray

from app.face.decode import DecodedFrameInfo

MODEL_FILES = (
    "det_10g.onnx",
    "w600k_r50.onnx",
    "2d106det.onnx",
    "minifasnet_v2_80x80.onnx",
    "minifasnet_v1se_80x80.onnx",
)


class ModelChecksumError(RuntimeError):
    pass


def verify_model_checksums(models_dir: Path) -> None:
    checksums_file = models_dir / "SHA256SUMS"
    if not checksums_file.exists():
        raise ModelChecksumError(f"Missing {checksums_file}")

    expected: dict[str, str] = {}
    for line in checksums_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        digest, fname = parts[0].lower(), parts[-1].lstrip("*")
        expected[fname] = digest

    for fname in MODEL_FILES:
        if fname not in expected:
            raise ModelChecksumError(f"Missing checksum entry for {fname}")
        target = models_dir / fname
        if not target.exists():
            raise ModelChecksumError(f"Missing model file {target}")
        actual = hashlib.sha256(target.read_bytes()).hexdigest().lower()
        if actual != expected[fname]:
            raise ModelChecksumError(f"Checksum mismatch for {fname}")


@dataclass(slots=True)
class FrameInferenceObservation:
    face_detected: bool
    face_count: int
    bbox: list[int] | None
    det_score: float
    blur_var: float
    brightness: float
    yaw: float
    pitch: float
    eye_aspect_ratio: float
    mouth_ratio: float
    pad_score: float
    raw_embedding: NDArray[np.float32] | None


class FaceInferenceBackend(Protocol):
    model_version: str
    models_loaded: bool

    def analyze_frame(self, frame: DecodedFrameInfo) -> FrameInferenceObservation: ...


class UnloadedOnnxBackend:
    """Returned when ONNX model files are absent on host; fails closed with 503 on inference."""

    model_version = "buffalo_l-arcface-r50@1"

    def __init__(self, models_dir: Path) -> None:
        self._models_dir = models_dir
        self.models_loaded = all((models_dir / name).exists() for name in MODEL_FILES)

    def analyze_frame(self, frame: DecodedFrameInfo) -> FrameInferenceObservation:
        raise RuntimeError(
            f"ONNX biometric models not loaded from {self._models_dir}. "
            "Run model download + verify SHA256SUMS before enabling live face inference."
        )

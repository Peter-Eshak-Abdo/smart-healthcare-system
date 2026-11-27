from __future__ import annotations

import base64
import hashlib

import numpy as np
from numpy.typing import NDArray

from app.config import Settings


class TemplateTransform:
    """Keyed orthogonal transform R_v ∈ O(512). cos(R a, R b) == cos(a, b)."""

    def __init__(self, seeds: dict[int, bytes], current: int) -> None:
        if not seeds:
            raise ValueError("At least one biometric transform seed must be configured")
        if current not in seeds:
            raise ValueError(f"Current transform version {current} not present in seeds")
        self._mats: dict[int, NDArray[np.float32]] = {v: self._derive(s) for v, s in seeds.items()}
        self.current = current

    @classmethod
    def from_env(cls, settings: Settings) -> TemplateTransform:
        seeds: dict[int, bytes] = {}
        for ver, raw_seed in (
            (1, settings.face_transform_seed_1),
            (2, settings.face_transform_seed_2),
        ):
            if raw_seed:
                seeds[ver] = base64.b64decode(raw_seed)

        if not seeds:
            # Ephemeral deterministic fallback only for local dev/unit test startup when unset
            fallback_seed = hashlib.sha256(b"smarthealth-local-ephemeral-seed-v1").digest()
            seeds[1] = fallback_seed

        current = (
            settings.face_transform_key_version
            if settings.face_transform_key_version in seeds
            else max(seeds.keys())
        )
        return cls(seeds=seeds, current=current)

    @staticmethod
    def _derive(seed: bytes) -> NDArray[np.float32]:
        digest_int = int.from_bytes(hashlib.sha256(seed).digest(), "big")
        rng = np.random.Generator(np.random.PCG64(digest_int))
        a = rng.standard_normal((512, 512))
        q, r = np.linalg.qr(a)
        signs = np.sign(np.diag(r))
        signs[signs == 0] = 1.0
        q *= signs
        return q.astype(np.float32)

    def apply(self, e: NDArray[np.float32], version: int | None = None) -> NDArray[np.float32]:
        v = version if version is not None else self.current
        vec = e.astype(np.float32, copy=False)
        norm = float(np.linalg.norm(vec))
        if norm == 0.0:
            raise ValueError("Cannot transform zero-norm embedding vector")
        unit_e = vec / norm
        t = self._mats[v] @ unit_e
        out_norm = float(np.linalg.norm(t))
        return (t / out_norm).astype(np.float32)

    def rekey_matrix(self, old: int, new: int) -> NDArray[np.float32]:
        return (self._mats[new] @ self._mats[old].T).astype(np.float32)

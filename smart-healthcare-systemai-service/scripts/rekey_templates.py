from __future__ import annotations

import numpy as np

from app.face.transform import TemplateTransform


def verify_rekey_equivalence(seed_old: bytes, seed_new: bytes, samples: int = 100) -> float:
    tf = TemplateTransform(seeds={1: seed_old, 2: seed_new}, current=1)
    rekey_mat = tf.rekey_matrix(1, 2)
    rng = np.random.Generator(np.random.PCG64(42))
    max_delta = 0.0
    for _ in range(samples):
        e = rng.standard_normal(512).astype(np.float32)
        e /= np.linalg.norm(e)
        t_old = tf.apply(e, version=1)
        t_direct_new = tf.apply(e, version=2)
        t_rekeyed = rekey_mat @ t_old
        t_rekeyed /= np.linalg.norm(t_rekeyed)
        diff = float(np.max(np.abs(t_direct_new - t_rekeyed)))
        max_delta = max(max_delta, diff)
    return max_delta


if __name__ == "__main__":
    delta = verify_rekey_equivalence(b"old-seed-dev", b"new-seed-dev")
    print(f"Rekey verification max |diff|={delta:.2e}")

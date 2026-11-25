from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.security import reset_replay_cache


def _ephemeral_ed25519() -> tuple[str, str]:
    priv = Ed25519PrivateKey.generate()
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode("ascii")
    pub_pem = (
        priv.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("ascii")
    )
    return priv_pem, pub_pem


def _sign_internal_jwt(priv_pem: str, scope: str = "clinical", jti: str | None = None) -> str:
    now = datetime.now(tz=UTC)
    return jwt.encode(
        {
            "iss": "backend-api",
            "aud": "ai-service",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=60)).timestamp()),
            "jti": jti or str(uuid.uuid4()),
            "scope": scope,
        },
        priv_pem,
        algorithm="EdDSA",
    )


def test_internal_health_and_fingerprint_501() -> None:
    _, pub_pem = _ephemeral_ed25519()
    app = create_app(Settings(internal_jwt_public_key=pub_pem))
    with TestClient(app) as client:
        res = client.get("/internal/v1/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["models"] == {"face": "not_loaded", "pad": "not_loaded"}
        assert body["rules"]["dataset_version"] == "seed-2026-11"

        fp = client.post("/internal/v1/fingerprint/identify")
        assert fp.status_code == 501
        assert fp.json()["code"] == "FEATURE_NOT_IMPLEMENTED"


def test_internal_auth_rejects_missing_replayed_and_wrong_scope() -> None:
    reset_replay_cache()
    priv_pem, pub_pem = _ephemeral_ed25519()
    app = create_app(Settings(internal_jwt_public_key=pub_pem))
    payload = {
        "proposed": [{"key": "i1", "drug_id": "DRG-PANADOL-500"}],
        "current": [],
        "allergies": [],
        "conditions": [],
        "locale": "en",
    }

    with TestClient(app) as client:
        assert (
            client.post("/internal/v1/clinical/check-interactions", json=payload).status_code == 401
        )

        jti = str(uuid.uuid4())
        tok = _sign_internal_jwt(priv_pem, scope="clinical", jti=jti)
        ok = client.post(
            "/internal/v1/clinical/check-interactions",
            json=payload,
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert ok.status_code == 200

        # Replay of identical jti must return 401
        replayed = client.post(
            "/internal/v1/clinical/check-interactions",
            json=payload,
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert replayed.status_code == 401

        # Wrong scope ("assistant" calling clinical) must return 401
        wrong_scope = _sign_internal_jwt(priv_pem, scope="assistant")
        denied = client.post(
            "/internal/v1/clinical/check-interactions",
            json=payload,
            headers={"Authorization": f"Bearer {wrong_scope}"},
        )
        assert denied.status_code == 401

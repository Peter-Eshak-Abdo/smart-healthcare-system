---
title: SmartHealth AI Service
emoji: 🏥
colorFrom: teal
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
---

# SmartHealth AI Service

FastAPI microservice for SmartHealth (Face Recognition + PAD Liveness, Deterministic Drug-Interaction Engine, and Emergency-Safe Medical Assistant).

## Hugging Face Space Secrets

Add these variables in **Space Settings → Variables and secrets**:
- `APP_ENV=production`
- `INTERNAL_JWT_PUBLIC_KEY` (Ed25519 public key matching `backend-api` `INTERNAL_JWT_SIGNING_KEY`)
- `FACE_TRANSFORM_KEY_VERSION=1`
- `FACE_TRANSFORM_SEED_1`
- `FACE_TRANSFORM_SEED_2`
- `LLM_PROVIDER=mock` (or `gemini` / `openai_compatible` with `LLM_MODEL` and `LLM_API_KEY`)

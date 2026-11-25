# 🏥 SmartHealth — Digital Healthcare Platform

> **One Identity. One Medical Record. One Secure Healthcare System.**
> **سمارت هيلث — هوية واحدة. ملف طبي واحد. نظام صحي آمن واحد.**

SmartHealth is an integrated, security-first digital healthcare monorepo connecting Patients, Doctors, Pharmacists, Paramedics, and System Administrators.

## Architecture & Monorepo Structure

```text
smart-healthcare-system/
├── AGENTS.md                  # Root AI agent instructions
├── .agents/                   # Workspace rules & workflows
├── docs/                      # Authoritative specs (00-INDEX through UI-08)
├── packages/contracts/        # Single source of truth: Zod schemas, OpenAPI v1, error codes, red-flags.yaml
├── design/                    # Design tokens (DTCG JSON) & Egyptian Arabic UX copy source
├── supabase/                  # PostgreSQL 16 + pgvector + pgcrypto migrations, RLS, SECURITY DEFINER, seed, tests
├── backend-api/               # Express 5 + TypeScript + Zod + Kysely + AES-256-GCM + Ed25519
├── ai-service/                # Python 3.12 + FastAPI + ONNX face/PAD + deterministic DDI engine + triage assistant
├── web-admin/                 # Next.js 16 + Tailwind v4 + shadcn/ui + Motion + Three/R3F (Doctor, Pharmacist, ER, Admin)
├── mobile-app/                # Flutter 3.x + Riverpod + GoRouter + ML Kit + Encrypted Hive (Patient, Paramedic, Pharmacist)
└── infra/                     # Docker Compose, Caddy TLS config, deployment configs
```

## Quick Start

### Prerequisites
- Node.js 22+ & pnpm 9+
- Python 3.12+ & `uv`
- Flutter 3.x stable & Dart 3.x
- Supabase CLI & Docker (for local Postgres + Redis)

### 1. Install Dependencies
```bash
pnpm install
cd ai-service && uv sync && cd ..
cd mobile-app && flutter pub get && cd ..
```

### 2. Generate Local Dev Keys & Start Infrastructure
```bash
docker compose -f infra/docker-compose.yml up -d redis
supabase start
pnpm keys:dev
```

### 3. Build Contracts, Design Tokens & Sync Copy
```bash
pnpm contracts:openapi
pnpm tokens:build
pnpm i18n:sync
```

### 4. Seed & Run Services
```bash
pnpm seed:dev
pnpm --filter backend-api dev     # http://localhost:4000/v1
cd ai-service && uv run uvicorn app.main:app --port 8000  # http://localhost:8000/internal/v1
pnpm --filter web-admin dev       # http://localhost:3000
cd mobile-app && flutter run
```

## Verification
```bash
pnpm -r lint && pnpm -r typecheck && pnpm -r test
pnpm contracts:check
pnpm tokens:contrast
cd ai-service && uv run ruff check . && uv run mypy app && uv run pytest
cd mobile-app && flutter analyze && flutter test
```

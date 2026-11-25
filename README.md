# SmartHealth — Digital Healthcare Platform

> **One Identity. One Medical Record. One Secure Healthcare System.**
> **سمارت هيلث — هوية واحدة. ملف طبي واحد. نظام صحي آمن واحد.**

SmartHealth is an integrated, security-first digital healthcare monorepo connecting Patients, Doctors, Pharmacists, Paramedics, and System Administrators — powered by **npm workspaces**, **Firebase (Auth, Cloud Firestore, Storage, Hosting)**, **Express 5**, **FastAPI**, **Next.js 16**, and **6-platform Flutter**.

## Architecture & Monorepo Structure

```text
smart-healthcare-system/
├── AGENTS.md                  # Root AI agent instructions
├── .agents/rules/             # Workspace rules & security/contract guidelines
├── firebase.json              # Firebase Hosting (Flutter Web + APK) & Firestore/Storage rules config
├── firebase/                  # firestore.rules, firestore.indexes.json, storage.rules
├── render.yaml                # Render Free Tier blueprint for backend-api
├── packages/contracts/        # Single source of truth: Zod schemas, OpenAPI v1, error codes, red-flags.yaml
├── design/                    # Design tokens (DTCG JSON) & Egyptian Arabic UX copy source
├── backend-api/               # Express 5 + TypeScript + Firebase Admin + AES-256-GCM + Ed25519
├── ai-service/                # Python 3.12+ FastAPI + ONNX face/PAD + deterministic DDI + triage assistant (HF Spaces ready)
├── web-admin/                 # Next.js 16 + Tailwind v4 + Firebase Auth + Vercel config (Doctor, Pharmacist, ER, Admin)
├── mobile-app/                # Flutter (Android, iOS, Web, Windows, macOS, Linux) + Firebase Auth + Encrypted Hive
├── env.example                # Documented environment variable template (English + Arabic)
└── req.md                     # Complete Windows 11 local setup & 100% free cloud deployment guide
```

## Quick Start (No Docker Required)

### Prerequisites
- Node.js 24 LTS & npm 10+
- Python 3.12+ & `uv` (`pip install uv` or `python -m uv`)
- Flutter 3.x stable & Dart 3.x
- Firebase project (Spark Free Tier) & optional Upstash Redis Free Tier

### 1. Install Dependencies
```powershell
npm install
cd ai-service; python -m uv sync --dev; cd ..
cd mobile-app; flutter pub get; flutter gen-l10n; cd ..
```

### 2. Configure Environment & Generate Crypto Keys
Copy sections from `env.example` into `backend-api/.env`, `web-admin/.env.local`, and `ai-service/.env`, then generate local Ed25519 + AES-256 keys:
```powershell
npm run keys:dev
npm run contracts:openapi
```

### 3. Deploy Firebase Rules & Seed Reference/Demo Data
```powershell
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
npm run seed:firebase
```

### 4. Run Services Locally (3 Terminals + App)
```powershell
# Terminal 1 — Backend API (http://localhost:4000)
npm run dev:backend

# Terminal 2 — AI Microservice (http://localhost:8000)
cd ai-service; python -m uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 3 — Next.js Web Portal (http://localhost:3000)
npm run dev:web

# Terminal 4 — Flutter Multi-Platform App
cd mobile-app; flutter run -d chrome   # or -d windows / android emulator
```

## Full Verification Suite
```powershell
npm run lint --workspaces
npm run typecheck --workspaces
npm run test --workspaces
npm run build
npm run contracts:check
cd ai-service; python -m uv run ruff check .; python -m uv run mypy app; python -m uv run pytest -v; cd ..
cd mobile-app; flutter analyze --fatal-warnings; flutter test; flutter build web --release; cd ..
```

See [req.md](./req.md) for complete setup, Firebase configuration, Android APK builds, and 100% Free Cloud Deployment (Render, Hugging Face Spaces, Vercel, Firebase Hosting).

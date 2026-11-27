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
├── backend-api/               # Express 5 + TypeScript + Integrated AI/RAG Engine (Gemini + Groq + BM25) + Firebase Admin
├── web-admin/                 # Next.js 16 + Tailwind v4 + Firebase Auth + Vercel config (Doctor, Pharmacist, ER, Admin)
├── mobile-app/                # Flutter (Android, iOS, Web, Windows, macOS, Linux) + Firebase Auth + Encrypted Hive
├── env.example                # Documented environment variable template (English + Arabic)
└── req.md                     # Complete Windows 11 local setup & 100% free cloud deployment guide
```

## Quick Start (No Docker Required)

### Prerequisites
- Node.js 24 LTS & npm 10+
- Flutter 3.x stable & Dart 3.x
- Firebase project (Spark Free Tier) & optional Upstash Redis Free Tier

### 1. Install Dependencies
```powershell
npm install
cd mobile-app; flutter pub get; flutter gen-l10n; cd ..
```

### 2. Configure Environment & Generate Crypto Keys
Copy sections from `env.example` into `backend-api/.env` and `web-admin/.env.local`, then generate local Ed25519 + AES-256 keys:
```powershell
npm run keys:dev
npm run contracts:openapi
npm run ai:index -w backend-api
```

### 3. Deploy Firebase Rules & Seed Reference/Demo Data
```powershell
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
npm run seed:firebase
```

### 4. Run Services Locally (2 Terminals + App)
```powershell
# Terminal 1 — Backend API + Integrated AI/RAG Engine (http://localhost:4000)
npm run dev:backend

# Terminal 2 — Next.js Web Portal (http://localhost:3000)
npm run dev:web

# Terminal 3 — Flutter Multi-Platform App
cd mobile-app; flutter run -d chrome   # or -d windows / android emulator
```

## Full Verification Suite
```powershell
npm run lint --workspaces
npm run typecheck --workspaces
npm run test --workspaces
npm run build
npm run contracts:check
cd mobile-app; flutter analyze --fatal-warnings; flutter test; flutter build web --release; cd ..
```

See [req.md](./req.md) for complete setup, Firebase configuration, Android APK builds, and 100% Free Cloud Deployment (Render, Vercel, Firebase Hosting).

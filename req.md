# SmartHealth — Requirements, Local Run & Free Cloud Deployment Guide (`req.md`)

> **Zero Docker required for local development. 100% Free Cloud Tier architecture:**
> **Firebase Spark (Auth + Firestore + Storage + Hosting) + Render Free (`backend-api`) + Hugging Face Spaces (`ai-service`) + Vercel Hobby (`web-admin`) + Upstash Free Redis.**

---

## 1. Software Prerequisites (Windows 11)

Install the following tools in PowerShell (`winget`) before cloning or building:

| Tool | Required Version | Install Command (PowerShell) | Verify |
|------|------------------|------------------------------|--------|
| **Git** | Latest | `winget install Git.Git` | `git --version` |
| **Node.js & npm** | **Node 24 LTS** & npm 10+ | `winget install OpenJS.NodeJS.LTS` (or NVM for Windows `nvm install 24 && nvm use 24`) | `node -v && npm -v` |
| **Python & `uv`** | Python 3.12+ | `winget install Python.Python.3.13` then `python -m pip install --upgrade uv` | `python --version && python -m uv --version` |
| **Flutter & Dart** | Flutter 3.x+ (Dart 3.x) | Follow [docs.flutter.dev/get-started/install/windows](https://docs.flutter.dev/get-started/install/windows) | `flutter doctor` |
| **OpenSSL** (built into Git Bash / Windows) | Any | Included with Git for Windows (`C:\Program Files\Git\usr\bin\openssl.exe`) | `npm run keys:dev` uses Node `crypto` (zero external OpenSSL needed) |
| **Optional Native Build Toolchains** | Android / Windows Desktop | Android Studio (Android SDK) · Visual Studio 2022 Community ("Desktop development with C++" for Windows builds) | `flutter doctor -v` |

---

## 2. Free Cloud Accounts & Resources Checklist

Create free accounts (no credit card required on Spark/Free tiers shown below):

1. **Firebase (Google Cloud Spark Free Plan)** — [console.firebase.google.com](https://console.firebase.google.com)
   - Create a project (`smarthealth-prod` or similar).
   - Enable **Authentication** → Sign-in method → enable **Email/Password** (and MFA TOTP if upgrading later).
   - Create a **Cloud Firestore** database (Production mode, region `eur3` / `europe-west1` closest to Egypt/MENA).
   - Enable **Firebase Storage** (Free tier).
   - Enable **Firebase Hosting** (for the Flutter Web PWA + hosted Android `.apk`).
   - Generate a **Service Account JSON** (*Project Settings → Service accounts → Generate new private key*) → keep safely out of Git!
   - Register a **Web App** in *Project Settings → Your apps* to obtain `NEXT_PUBLIC_FIREBASE_*` keys.
2. **Upstash Redis (Free Tier)** — [console.upstash.com](https://console.upstash.com)
   - Create 1 Free Redis database (`eu-west-1`), copy the `rediss://default:...@...upstash.io:6379` TLS URL. (Locally optional: `backend-api` falls back to memory when `REDIS_URL` is blank.)
3. **Render.com (Free Web Service)** — [dashboard.render.com](https://dashboard.render.com) (hosts `backend-api`).
4. **Hugging Face Spaces (Free Docker CPU Basic 16GB RAM)** — [huggingface.co/new-space](https://huggingface.co/new-space) (hosts `ai-service`).
5. **Vercel (Hobby Free Tier)** — [vercel.com](https://vercel.com) (hosts `web-admin` Next.js App Router).

---

## 3. Exact Copy-Paste Local Setup (Windows 11 PowerShell — No Docker)

Run these commands from the repository root (`P:\Projects\smart-healthcare-system`):

### Step 3.1 — Install all Node, Python, and Flutter dependencies
```powershell
npm install
cd ai-service
python -m uv sync --dev
cd ..\mobile-app
flutter pub get
flutter gen-l10n
cd ..
```

### Step 3.2 — Generate local cryptographic keys & build `@smarthealth/contracts`
```powershell
npm run keys:dev
npm run contracts:openapi
npm run build -w @smarthealth/contracts
```
`npm run keys:dev` generates fresh AES-256-GCM keys (`KEK_K1`, `BLIND_INDEX_KEY`) and Ed25519 keypairs (`RX_SIGNING_*`, `EMERGENCY_CARD_SIGNING_*`, `INTERNAL_JWT_*`) and prints exact `.env` snippets — never commit real keys!

### Step 3.3 — Create your local `.env` files
Use [env.example](./env.example) as your reference:
1. Create `backend-api/.env` with Section 1 of `env.example` (Firebase Admin credentials + keys from `npm run keys:dev`).
2. Create `web-admin/.env.local` with Section 2 of `env.example` (`NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_*` + `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`).
3. Create `ai-service/.env` with Section 3 of `env.example` (`INTERNAL_JWT_PUBLIC_KEY` matching backend + `FACE_TRANSFORM_SEED_1`/`2`).

### Step 3.4 — Deploy Firestore Security Rules, Indexes & Seed Demo Users
1. Copy `.firebaserc.example` to `.firebaserc` and put your Firebase Project ID.
2. Deploy zero-trust Firestore/Storage rules and composite indexes:
```powershell
npx --yes firebase-tools login
npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```
3. Seed sample facilities, drugs/DDI reference rules, and demo accounts (Patient, Doctor, Pharmacist, Paramedic, Admin) into Firestore & Firebase Auth:
```powershell
npm run seed:firebase
```
> **Note:** Check the console output of `seed:firebase` for the generated/dev credentials of seeded accounts. Change or delete test users before enabling public registration.

---

## 4. Running Locally (4 Terminals — All Services Live)

Open 4 PowerShell terminals at the repo root:

**Terminal 1 — Backend API (`http://localhost:4000`, health: `GET /health` & `GET /v1/health`)**
```powershell
npm run dev:backend
```

**Terminal 2 — AI Microservice (`http://localhost:8000`, health: `GET /internal/v1/health`)**
```powershell
cd ai-service
python -m uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 3 — Next.js Web Portal (`http://localhost:3000`)**
```powershell
npm run dev:web
```

**Terminal 4 — Flutter Multi-Platform App (Web / Desktop / Mobile)**
```powershell
cd mobile-app
# Run in Chrome (Web) with Firebase compile-time defines:
flutter run -d chrome `
  --dart-define=API_BASE_URL=http://localhost:4000 `
  --dart-define=FIREBASE_API_KEY=YOUR_WEB_API_KEY `
  --dart-define=FIREBASE_APP_ID=YOUR_WEB_APP_ID `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID `
  --dart-define=FIREBASE_PROJECT_ID=YOUR_PROJECT_ID

# Or run natively on Windows Desktop:
flutter run -d windows --dart-define=API_BASE_URL=http://localhost:4000 ...

# Or run on Android Emulator (uses 10.0.2.2 -> host localhost automatically if API_BASE_URL omitted):
flutter run -d emulator-5554
```

---

## 5. Verification Commands (All Workspaces)

Run these commands after any change to confirm clean builds, types, lints, and tests:

```powershell
# 1. Node Workspaces (contracts, backend-api, web-admin)
npm run lint --workspaces
npm run typecheck --workspaces
npm run test --workspaces
npm run build
npm run contracts:check

# 2. Verify compiled ESM production boot of backend-api
$env:PORT="4199"; node backend-api/dist/main.js

# 3. AI Service (Python 3.12+ strict checks)
cd ai-service
python -m uv run ruff check .
python -m uv run mypy app
python -m uv run pytest -v
cd ..

# 4. Flutter App (6-Platform static analysis, tests, Web PWA release build)
cd mobile-app
flutter pub get
flutter gen-l10n
flutter analyze --fatal-warnings
flutter test
flutter build web --release
cd ..
```

---

## 6. 100% Free Cloud Deployment Guides

### A. Deploy `ai-service` on Hugging Face Spaces (Free Docker CPU Basic)
1. Create a new **Docker** Space at `huggingface.co/new-space` (e.g., `smarthealth-ai`, SDK = Docker, Hardware = **CPU Basic Free**).
2. Note: Hugging Face Spaces runs container port **7860** cleanly — `ai-service/Dockerfile` already defaults `ENV PORT=7860` and binds `0.0.0.0:${PORT}`.
3. Push `ai-service/` + `packages/contracts/red-flags.yaml` (or adjust `RED_FLAGS_PATH` to copy `red-flags.yaml` inside your Space root) and add these Space **Secrets** in Settings:
   - `APP_ENV=production`
   - `INTERNAL_JWT_PUBLIC_KEY` (matching your `backend-api` key)
   - `FACE_TRANSFORM_KEY_VERSION=1`
   - `FACE_TRANSFORM_SEED_1` & `FACE_TRANSFORM_SEED_2`
   - `LLM_PROVIDER` (`mock` or `gemini`), `LLM_MODEL`, `LLM_API_KEY` (if using Gemini Free Tier)
4. Verify your live endpoint responds `{"status":"ok"}` at `https://<username>-<space>.hf.space/internal/v1/health`.

### B. Deploy `backend-api` on Render.com (Free Web Service)
1. Push your GitHub repository and create a **Blueprint** (or **New Web Service**) pointing to root `render.yaml`.
2. Render automatically uses:
   - **Build Command:** `npm ci && npm run build -w @smarthealth/contracts && npm run build -w backend-api`
   - **Start Command:** `npm run start -w backend-api`
   - **Health Check Path:** `/health`
3. In Render Dashboard → **Environment**, fill every `sync: false` variable (`FIREBASE_*`, `REDIS_URL` from Upstash, `WEB_ORIGIN`, `AI_SERVICE_URL` pointing to your HF Space URL, `KEK_K1`, `BLIND_INDEX_KEY`, `RX_SIGNING_PRIVATE_KEY`, `EMERGENCY_CARD_SIGNING_PRIVATE_KEY`, `INTERNAL_JWT_SIGNING_KEY`).
4. Verify `https://<your-service>.onrender.com/health` returns `200 OK`.

### C. Deploy `web-admin` on Vercel (Free Hobby Tier)
1. Import the GitHub repository in Vercel and set **Root Directory** to `web-admin` (Vercel automatically reads `web-admin/vercel.json`, which builds `@smarthealth/contracts` before `web-admin`).
2. Add **Environment Variables** (`NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`, `NEXT_PUBLIC_FIREBASE_*`, and server-side `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
3. Deploy and add the resulting `https://<your-app>.vercel.app` URL to:
   - `WEB_ORIGIN` on Render (`backend-api`).
   - Firebase Console → Authentication → Settings → **Authorized domains**.

### D. Deploy Flutter Web PWA + Downloadable Android APK on Firebase Hosting (Free Spark Tier)
You can distribute BOTH the live Flutter Web app AND a direct Android `.apk` download link (`/downloads/smarthealth.apk`) from Firebase Hosting (`firebase.json` is already configured with APK headers and SPA rewrites!):

```powershell
# 1. Build Release Android APK
cd mobile-app
flutter build apk --release `
  --dart-define=API_BASE_URL=https://<your-render-service>.onrender.com `
  --dart-define=FIREBASE_API_KEY=... `
  --dart-define=FIREBASE_APP_ID=... `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... `
  --dart-define=FIREBASE_PROJECT_ID=...

# 2. Build Release Flutter Web PWA
flutter build web --release `
  --dart-define=API_BASE_URL=https://<your-render-service>.onrender.com `
  --dart-define=FIREBASE_API_KEY=... `
  --dart-define=FIREBASE_APP_ID=... `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... `
  --dart-define=FIREBASE_PROJECT_ID=... `
  --dart-define=ANDROID_APK_DOWNLOAD_URL=/downloads/smarthealth.apk

# 3. Copy compiled APK into Hosting output folder
New-Item -ItemType Directory -Force build\web\downloads | Out-Null
Copy-Item build\app\outputs\flutter-apk\app-release.apk build\web\downloads\smarthealth.apk

# 4. Deploy Hosting + Firestore Rules + Storage Rules
cd ..
npx --yes firebase-tools deploy --only hosting,firestore:rules,firestore:indexes,storage
```

After deploy:
- **Flutter Web App:** `https://<your-firebase-project>.web.app`
- **Direct Android APK Download:** `https://<your-firebase-project>.web.app/downloads/smarthealth.apk` (also linked directly on the Flutter Web login page).

### E. Building Other Native Targets (Optional)
- **Windows Executable:** `cd mobile-app; flutter build windows --release` (requires Visual Studio C++ Desktop workload).
- **Linux Binary:** On Linux/CI: `flutter build linux --release`.
- **iOS / macOS:** On macOS with Xcode + CocoaPods: `flutter build ios --release` / `flutter build macos --release`.

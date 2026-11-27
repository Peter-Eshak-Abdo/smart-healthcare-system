# SmartHealth — الخطوات المتبقية فقط للنشر النهائي

> **كل ما تم حله وتأكيده بالفعل ✅:**
>
> - **Firebase Auth + Firestore + Hosting (`smart-healthcare-system-cce19`):** تم النشر وزرع البيانات (`seed:firebase`) بنجاح، والويب منشور مبدئياً على `https://smart-healthcare-system-cce19.web.app`.
> - **Vercel (`web-admin`) وملفات `.env` المحلية:** مكتملة.
> - **Render Build (`TS7016: @types/express` / `@types/multer`):** تم حله في `render.yaml` باستخدام `npm ci --include=dev` حتى يتم تثبيت `@types/*` رغم وجود `NODE_ENV=production`.
> - **Android APK Build (`P:\` vs `C:\` Kotlin cross-drive & Gradle OOM):** تم حله في `mobile-app/android/gradle.properties` (`kotlin.incremental=false` + `-Xmx2G`) وتم التأكد فعلياً من بناء `app-release.apk` بنجاح (`71.7MB`).

---

## المتبقي عليك بالضبط (4 خطوات فقط بالترتيب)

### 1) ارفع آخر تعديلين على GitHub

من جذر المشروع `P:\Projects\smart-healthcare-system`:

```powershell
git add .
git commit -m "fix: render devDeps build and android cross-drive gradle config"
git push
```

## تمام

### 2) أضف مفاتيح الذكاء الاصطناعي المجانية في Render (محرك موفر للتوكنز بنسبة 80%–95%)

تم حذف خدمة Python (`ai-service`) وHugging Face Spaces بالكامل ودمج محرك الذكاء الاصطناعي + RAG موفر للتوكنز مباشرة داخل `backend-api`:

1. احصل على مفتاح مجاني من Google AI Studio: `https://aistudio.google.com/apikey` وأضفه في Render تحت اسم `GEMINI_API_KEY` (أو عدة مفاتيح مفصولة بفاصلة في `GEMINI_API_KEYS=key1,key2` للتبديل التلقائي عند `429`).
2. احصل على مفتاح احتياطي مجاني من Groq Console: `https://console.groq.com/keys` وأضفه في Render تحت اسم `GROQ_API_KEY`.
3. أضف `BIOMETRIC_TRANSFORM_SECRET` (مفتاح عشوائي من 32 بايت base64، يمكن توليده عبر `npm run keys:dev`).
4. راقب كفاءة الكاش والتوكنز مباشرة من **لوحة تحكم الأدمن** (`AI Token & Cache Efficiency`) عبر `GET /v1/admin/ai-metrics`.
5. احذف `AI_SERVICE_URL` و`INTERNAL_JWT_SIGNING_KEY` من Render إن وجدت (لم تعد مطلوبة).

---

### 3) أعد نشر `backend-api` على Render (حل خطأ `@types/express`)

1. افتح لوحة **Render Dashboard → Service → Settings** وعدّل **Build Command** ليصبح بالضبط:
   ```bash
   npm ci --include=dev && npm run build -w @smarthealth/contracts && npm run build -w backend-api
   ```
   _(السبب: وجود `NODE_ENV=production` في Render كان يجعل `npm ci` يتجاهل `devDependencies` التي تحتوي على `@types/express` و`@types/multer`.)_
2. تأكد من **Start Command:** `npm run start -w backend-api` و**Health Check Path:** `/health`.
3. اضغط **Manual Deploy → Clear build cache & deploy**.
4. تأكد أن رابط Render يرجع `{"status":"ok",...}` عند فتح:
   `https://smart-healthcare-system-huyh.onrender.com/health`
5. _(تذكير سريع لـ Vercel):_ تأكد أن `NEXT_PUBLIC_API_BASE_URL` في Vercel = رابط Render النهائي، وأن `WEB_ORIGIN` في Render = رابط Vercel النهائي (بدون `/` في الآخر)، ثم أعد نشر Vercel إذا غيّرت الرابط.
   جاب
   2026-11-27T13:59:17.003459827Z ==> Downloading cache...
   2026-11-27T13:59:17.005541593Z ==> Cloning from https://github.com/Peter-Eshak-Abdo/smart-healthcare-system
   2026-11-27T13:59:17.516806138Z ==> Checking out commit c0e769f0417794e70c915fa0230b8fd93c98464d in branch main
   2026-11-27T13:59:26.324897589Z ==> Downloaded and extracted 444 MiB cache in 9s.
   2026-11-27T13:59:27.417177418Z ==> Requesting Node.js version 24
   2026-11-27T13:59:27.516757904Z ==> Using Node.js version 24.22.3 via /opt/render/project/src/.nvmrc
   2026-11-27T13:59:27.516769608Z ==> Docs on specifying a Node.js version: https://render.com/docs/node-version
   2026-11-27T13:59:27.516899714Z ==> Installing Node.js version 24.22.3...
   2026-11-27T13:59:28.506308047Z ==> Running build command 'npm ci --include=dev && npm run build -w @smarthealth/contracts && npm run build -w backend-api'...
   2026-11-27T13:59:43.273367682Z
   2026-11-27T13:59:43.273385697Z added 720 packages, and audited 730 packages in 15s
   2026-11-27T13:59:43.273556523Z
   2026-11-27T13:59:43.273653559Z 148 packages are looking for funding
   2026-11-27T13:59:43.273693051Z run `npm fund` for details
   2026-11-27T13:59:43.52227307Z
   2026-11-27T13:59:43.522292273Z 17 vulnerabilities (9 moderate, 6 high, 2 critical)
   2026-11-27T13:59:43.522294321Z
   2026-11-27T13:59:43.522296013Z To address issues that do not require attention, run:
   2026-11-27T13:59:43.522297434Z npm audit fix
   2026-11-27T13:59:43.522298649Z
   2026-11-27T13:59:43.522300103Z To address all issues (including breaking changes), run:
   2026-11-27T13:59:43.522301739Z npm audit fix --force
   2026-11-27T13:59:43.522302864Z
   2026-11-27T13:59:43.522305007Z Run `npm audit` for details.
   2026-11-27T13:59:43.747439596Z
   2026-11-27T13:59:43.747459181Z > @smarthealth/contracts@1.0.0 build
   2026-11-27T13:59:43.747461835Z > tsc -p tsconfig.build.json
   2026-11-27T13:59:43.747463091Z
   2026-11-27T13:59:46.154376023Z
   2026-11-27T13:59:46.154388931Z > backend-api@1.0.0 build
   2026-11-27T13:59:46.154390465Z > tsc -p tsconfig.build.json
   2026-11-27T13:59:46.154391877Z
   2026-11-27T13:59:49.290606739Z ==> Uploading build...
   2026-11-27T13:59:59.455066002Z ==> Uploaded in 6.3s. Compression took 3.9s
   2026-11-27T13:59:59.460129616Z ==> Build successful 🎉
   2026-11-27T14:00:00.810511392Z ==> Deploying...
   2026-11-27T14:00:00.975169302Z ==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
   2026-11-27T14:00:30.003417054Z ==> Running 'npm run start -w backend-api'
   2026-11-27T14:00:31.311736935Z
   2026-11-27T14:00:31.311778926Z > backend-api@1.0.0 start
   2026-11-27T14:00:31.311790796Z > node dist/main.js
   2026-11-27T14:00:31.311795596Z
   2026-11-27T14:00:37.803915136Z /opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:182
   2026-11-27T14:00:37.803943407Z throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse private key: ' + error);
   2026-11-27T14:00:37.803949957Z ^
   2026-11-27T14:00:37.803953797Z
   2026-11-27T14:00:37.803959047Z FirebaseAppError: Failed to parse private key: Error: error:1E08010C:DECODER routines::unsupported
   2026-11-27T14:00:37.803964917Z at new ServiceAccount (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:182:19)
   2026-11-27T14:00:37.803968827Z at new ServiceAccountCredential (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:119:15)
   2026-11-27T14:00:37.803972938Z at cert (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-factory.js:105:54)
   2026-11-27T14:00:37.803976768Z at createFirebaseBundle (file:///opt/render/project/src/backend-api/dist/firebase/firebase-admin.js:34:56)
   2026-11-27T14:00:37.803981028Z at createAppDeps (file:///opt/render/project/src/backend-api/dist/app-deps.js:20:32)
   2026-11-27T14:00:37.803987308Z at file:///opt/render/project/src/backend-api/dist/main.js:7:14
   2026-11-27T14:00:37.803991328Z at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
   2026-11-27T14:00:37.803996988Z at async node:internal/modules/esm/loader:647:26
   2026-11-27T14:00:37.804000688Z at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
   2026-11-27T14:00:37.804004548Z errorInfo: {
   2026-11-27T14:00:37.804009628Z code: 'app/invalid-credential',
   2026-11-27T14:00:37.804013599Z message: 'Failed to parse private key: Error: error:1E08010C:DECODER routines::unsupported'
   2026-11-27T14:00:37.804017788Z },
   2026-11-27T14:00:37.804021748Z codePrefix: 'app'
   2026-11-27T14:00:37.804025399Z }
   2026-11-27T14:00:37.804029189Z
   2026-11-27T14:00:37.804032949Z Node.js v24.22.3
   2026-11-27T14:00:38.111609392Z npm error Lifecycle script `start` failed with error:
   2026-11-27T14:00:38.111709724Z npm error code 1
   2026-11-27T14:00:38.111788076Z npm error path /opt/render/project/src/backend-api
   2026-11-27T14:00:38.111903159Z npm error workspace backend-api@1.0.0
   2026-11-27T14:00:38.11197781Z npm error location /opt/render/project/src/backend-api
   2026-11-27T14:00:38.112085972Z npm error command failed
   2026-11-27T14:00:38.112231866Z npm error command sh -c node dist/main.js
   2026-11-27T14:00:39.786742014Z ==> Exited with status 1
   2026-11-27T14:00:39.789258802Z ==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
   2026-11-27T14:00:40.211832674Z ==> Instance srv-dc3kt0d9el5s738qg5j0-v5v2v restarted
   2026-11-27T14:00:45.321575666Z ==> Running 'npm run start -w backend-api'
   2026-11-27T14:00:46.507844446Z
   2026-11-27T14:00:46.507867947Z > backend-api@1.0.0 start
   2026-11-27T14:00:46.507874117Z > node dist/main.js
   2026-11-27T14:00:46.507876747Z
   2026-11-27T14:00:52.802874524Z /opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:182
   2026-11-27T14:00:52.802910434Z throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse private key: ' + error);
   2026-11-27T14:00:52.802918635Z ^
   2026-11-27T14:00:52.802921195Z
   2026-11-27T14:00:52.802924635Z FirebaseAppError: Failed to parse private key: Error: error:1E08010C:DECODER routines::unsupported
   2026-11-27T14:00:52.802927685Z at new ServiceAccount (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:182:19)
   2026-11-27T14:00:52.802929955Z at new ServiceAccountCredential (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-internal.js:119:15)
   2026-11-27T14:00:52.802932315Z at cert (/opt/render/project/src/node_modules/firebase-admin/lib/app/credential-factory.js:105:54)
   2026-11-27T14:00:52.802934565Z at createFirebaseBundle (file:///opt/render/project/src/backend-api/dist/firebase/firebase-admin.js:34:56)
   2026-11-27T14:00:52.802936925Z at createAppDeps (file:///opt/render/project/src/backend-api/dist/app-deps.js:20:32)
   2026-11-27T14:00:52.802939905Z at file:///opt/render/project/src/backend-api/dist/main.js:7:14
   2026-11-27T14:00:52.802942315Z at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
   2026-11-27T14:00:52.802945765Z at async node:internal/modules/esm/loader:647:26
   2026-11-27T14:00:52.802949006Z at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
   2026-11-27T14:00:52.802952815Z errorInfo: {
   2026-11-27T14:00:52.802965066Z code: 'app/invalid-credential',
   2026-11-27T14:00:52.802969136Z message: 'Failed to parse private key: Error: error:1E08010C:DECODER routines::unsupported'
   2026-11-27T14:00:52.802973136Z },
   2026-11-27T14:00:52.802977076Z codePrefix: 'app'
   2026-11-27T14:00:52.802980896Z }
   2026-11-27T14:00:52.802984306Z
   2026-11-27T14:00:52.802988216Z Node.js v24.22.3
   2026-11-27T14:00:52.897903999Z npm error Lifecycle script `start` failed with error:
   2026-11-27T14:00:52.898048163Z npm error code 1
   2026-11-27T14:00:52.898166475Z npm error path /opt/render/project/src/backend-api
   2026-11-27T14:00:52.898302468Z npm error workspace backend-api@1.0.0
   2026-11-27T14:00:52.89839684Z npm error location /opt/render/project/src/backend-api
   2026-11-27T14:00:52.898525923Z npm error command failed
   2026-11-27T14:00:52.898679026Z npm error command sh -c node dist/main.js

---

### 4) بناء ورفع النسخة النهائية لـ Android APK + Flutter Web على Firebase Hosting

بعد أن يعمل رابط Render بنجاح، بدّل `YOUR_RENDER_URL` برابط Render الفعلي ونفّذ هذا البلوك كما هو في PowerShell:

```powershell
cd P:\Projects\smart-healthcare-system\mobile-app

$envMap = @{}
Get-Content ..\web-admin\.env.local | Where-Object { $_ -and -not $_.StartsWith('#') -and $_.Contains('=') } | ForEach-Object {
  $p = $_.Split('=', 2); $envMap[$p[0].Trim()] = $p[1].Trim().Trim('"')
}
$RENDER_URL = "https://YOUR_RENDER_URL.onrender.com"

flutter build apk --release `
  --dart-define=API_BASE_URL=$RENDER_URL `
  --dart-define=FIREBASE_API_KEY=$($envMap['NEXT_PUBLIC_FIREBASE_API_KEY']) `
  --dart-define=FIREBASE_APP_ID=$($envMap['NEXT_PUBLIC_FIREBASE_APP_ID']) `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=$($envMap['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']) `
  --dart-define=FIREBASE_PROJECT_ID=$($envMap['NEXT_PUBLIC_FIREBASE_PROJECT_ID'])

flutter build web --release `
  --dart-define=API_BASE_URL=$RENDER_URL `
  --dart-define=FIREBASE_API_KEY=$($envMap['NEXT_PUBLIC_FIREBASE_API_KEY']) `
  --dart-define=FIREBASE_APP_ID=$($envMap['NEXT_PUBLIC_FIREBASE_APP_ID']) `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=$($envMap['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']) `
  --dart-define=FIREBASE_PROJECT_ID=$($envMap['NEXT_PUBLIC_FIREBASE_PROJECT_ID']) `
  --dart-define=ANDROID_APK_DOWNLOAD_URL=/downloads/smarthealth.apk

New-Item -ItemType Directory -Force build\web\downloads | Out-Null
Copy-Item build\app\outputs\flutter-apk\app-release.apk build\web\downloads\smarthealth.apk -Force
cd ..
npx --yes firebase-tools deploy --only hosting
```

عند الانتهاء ستكون الروابط النهائية جاهزة:

- **تطبيق الويب (Flutter PWA):** `https://smart-healthcare-system-cce19.web.app`
- **رابط تحميل الأندرويد المباشر (APK):** `https://smart-healthcare-system-cce19.web.app/downloads/smarthealth.apk`

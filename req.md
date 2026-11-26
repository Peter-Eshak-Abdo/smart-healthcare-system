# SmartHealth — دليل التشغيل والنشر النهائي (الخطوات المتبقية فقط)

> **ملخص سريع للي اتعمل واتحل خلاص ✅:**
>
> - **Firebase Auth & Firestore (`smart-healthcare-system-cce19`):** اتصلّحت مشكلة الـ index واتحذف `storage` نهائياً (بدون الحاجة لـ Blaze) واتعمل Deploy فعلي للقواعد والـ indexes + اتعمل `seed:firebase` بنجاح للأدوار الخمسة.
> - **Firebase Hosting:** اتفعل واتنشر أول إصدار بالفعل على: `https://smart-healthcare-system-cce19.web.app`.
> - **ملفات البيئة محلياً (`.env`) والمفاتيح:** اتسحبت مفاتيحك من `.env.local` وتولّدت مفاتيح التشفير والتوقيع (`keys:dev`) واتوزعت أوتوماتيك في `backend-api/.env` و`web-admin/.env.local` و`ai-service/.env` + اتدعم Upstash REST Redis (`UPSTASH_REDIS_REST_URL` / `TOKEN`).
> - **خطأ Render (`ERR_MODULE_NOT_FOUND` / `pnpm`) واتصال `ai-service`:** اتحلّوا في الكود و`render.yaml` و`ai-service/Dockerfile` و`ai-service/red-flags.yaml` و`ai-service/README.md` — بس محتاجين `git push` وتحديث إعدادات المنصات السحابية بالخطوات اللي تحت.
> - **تطبيق الموبايل والويب Flutter:** شغال وناجح على الويب والاختبارات، وإصدار الأندرويد SDK جاهز على جهازك (أما خطأ `flutter build windows` فسببه الوحيد إن مكون **C++ ATL** مش متعلّم في Visual Studio Build Tools عندك — وده اختياري لو مش محتاج `.exe`).

---

## الخطوات المتبقية بالترتيب للنشر الكامل (100% مجاني)

> **مهم قبل ما تبدأ:** كل المفاتيح اللي هتحتاج تنسخها في Hugging Face وRender وVercel موجودة جاهزة الآن على جهازك. لعرض أي ملف منهم في PowerShell للنسخ السريع (بدون ما نرفعهم على Git):
>
> ```powershell
> Get-Content ai-service\.env
> Get-Content backend-api\.env
> Get-Content web-admin\.env.local
> ```

---

### الخطوة 1: مراجعة إعدادات Firebase Console (دقيقة واحدة)

1. افتح مشروعك على Firebase Console:
   `https://console.firebase.google.com/project/smart-healthcare-system-cce19/authentication/settings`
2. ادخل **Authentication → Settings → Authorized domains** وتأكد إن الدومينات دي مضافة:
   - `localhost`
   - `smart-healthcare-system-cce19.web.app`
   - `smart-healthcare-system-cce19.firebaseapp.com`
   - دومين **Vercel** بتاعك (القيمة اللي حطيتها في `VERCEL_URL_ADMIN_WEB`).
3. في **Authentication → Sign-in method** تأكد إن **Email/Password** مفعّل.

_(اختياري)_ الحسابات التجريبية اللي اتزرعت بـ `seed:firebase` جاهزة للتجربة فوراً:

- المريض: `mona.patient@smarthealth.eg`
- الدكتور: `karim.doctor@smarthealth.eg`
- الصيدلي: `salma.pharmacist@smarthealth.eg`
- المسعف: `tarek.paramedic@smarthealth.eg`
- الأدمن: `admin@smarthealth.eg`
- كلمة السر الافتراضية للتجربة: `SmartHealth@2026!` (غيّرها في الإنتاج).
  تمام

---

### الخطوة 2: ارفع التعديلات الجديدة على GitHub

من جذر المشروع `P:\Projects\smart-healthcare-system`:

```powershell
git status
git add .
git commit -m "chore: fix firebase indexes, upstash rest, hf space docker & deployment configs"
git push
```

_(تأكد إن `git status` مش ظاهر فيه أي ملف `.env` أو `.env.local` — كلهم محميين بـ `.gitignore`.)_

---

### الخطوة 3: نشر `ai-service` على Hugging Face Spaces (`makhdoum-ai-service`)

1. انسخ ملفات `ai-service` النظيفة (من غير `.venv` ومن غير `.env`) للفولدر اللي عملتله clone للـ Space:
   ```powershell
   # عدّل المسار التالي لمسار فولدر makhdoum-ai-service عندك
   $HF_DIR = "..\makhdoum-ai-service"
   robocopy ai-service $HF_DIR /E /XD .venv __pycache__ .pytest_cache .mypy_cache .ruff_cache /XF .env .env.local
   ```
2. ارفعهم لـ Hugging Face:
   ```powershell
   cd $HF_DIR
   git add .
   git commit -m "Deploy SmartHealth AI Service (port 7860, self-contained)"
   git push
   cd ..\smart-healthcare-system
   ```
3. ادخل إعدادات الـ Space على Hugging Face:
   `https://huggingface.co/spaces/peter-eshak/makhdoum-ai-service/settings`
   وفي **Variables and secrets** أضف القيم من `Get-Content ai-service\.env`:
   - `APP_ENV` = `production`
   - `INTERNAL_JWT_PUBLIC_KEY` _(انسخ السطر كامل من `ai-service\.env`)_
   - `FACE_TRANSFORM_KEY_VERSION` = `1`
   - `FACE_TRANSFORM_SEED_1` _(من `ai-service\.env`)_
   - `FACE_TRANSFORM_SEED_2` _(من `ai-service\.env`)_
   - `LLM_PROVIDER` = `mock` _(أو `gemini` لو معاك API Key مجاني من Google AI Studio)_
4. استنى الـ Space يبقى **Running** وجرّب الرابط ده في المتصفح (لازم يرجع `{"status":"ok",...}`):
   `https://peter-eshak-makhdoum-ai-service.hf.space/internal/v1/health`

---

### الخطوة 4: نشر `backend-api` على Render.com

> ليه ظهر خطأ `ERR_MODULE_NOT_FOUND` + `pnpm` المرة اللي فاتت؟ لأن Render كان لسه ساحب الكود القديم قبل التحويل لـ `npm` و`@smarthealth/contracts/dist`.

1. في لوحة **Render Dashboard → Service → Settings**:
   - **Build Command:**
     ```bash
     npm ci && npm run build -w @smarthealth/contracts && npm run build -w backend-api
     ```
   - **Start Command:**
     ```bash
     npm run start -w backend-api
     ```
   - **Health Check Path:** `/health`
   - **Environment (Node Version):** Render هيقرأ Node `24` من ملف `.nvmrc` تلقائياً (أو أضف `NODE_VERSION=24`).
2. في **Environment → Environment Variables** انسخ القيم من `Get-Content backend-api\.env` مع تعديل 3 قيم للإنتاج:
   - `APP_ENV` = `production`
   - `NODE_ENV` = `production`
   - `AI_SERVICE_URL` = `https://peter-eshak-makhdoum-ai-service.hf.space`
   - `WEB_ORIGIN` = رابط **Vercel** بتاعك (من غير `/` في الآخر)
   - وبقية المفاتيح كما هي من `backend-api\.env`:
     `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KEK_CURRENT_ID`, `KEK_K1`, `BLIND_INDEX_KEY`, `RX_SIGNING_KEY_ID`, `RX_SIGNING_PRIVATE_KEY`, `EMERGENCY_CARD_SIGNING_KEY_ID`, `EMERGENCY_CARD_SIGNING_PRIVATE_KEY`, `INTERNAL_JWT_SIGNING_KEY`.
3. اضغط **Manual Deploy → Clear build cache & deploy** ثم تأكد إن رابط Render شغال:
   `https://<your-render-service>.onrender.com/health` → يرجع `{"status":"ok",...}`.

---

### الخطوة 5: تفعيل المتغيرات على Vercel (`web-admin`)

1. افتح مشروعك في **Vercel → Settings → Environment Variables**.
2. انسخ الـ 11 متغير من `Get-Content web-admin\.env.local` مع تغيير قيمة واحدة فقط للإنتاج:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<your-render-service>.onrender.com` _(رابط Render بتاعك بدون `/` في الآخر)_
   - باقي الـ 10 متغيرات كما هي بالظبط من `web-admin\.env.local` (`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
3. تأكد إن **Root Directory** في Vercel مضبوط على `web-admin`، ثم اعمل **Redeploy**.

---

### الخطوة 6: بناء ورفع Flutter Web + Android APK النهائي على Firebase Hosting

بعد ما تاخد رابط Render النهائي وتجرب إن `/health` شغال، نفّذ الأوامر دي بالترتيب (بدّل `YOUR_RENDER_URL` وقيم Firebase من `web-admin\.env.local`):

```powershell
cd P:\Projects\smart-healthcare-system\mobile-app

# 1) اقرأ القيم تلقائياً من web-admin\.env.local بدل ما تكتبها بإيدك!
$envMap = @{}
Get-Content ..\web-admin\.env.local | Where-Object { $_ -and -not $_.StartsWith('#') -and $_.Contains('=') } | ForEach-Object {
  $p = $_.Split('=', 2); $envMap[$p[0].Trim()] = $p[1].Trim().Trim('"')
}
$RENDER_URL = "https://YOUR_RENDER_URL.onrender.com"

# 2) بناء ملف الأندرويد APK النهائي
flutter build apk --release `
  --dart-define=API_BASE_URL=$RENDER_URL `
  --dart-define=FIREBASE_API_KEY=$($envMap['NEXT_PUBLIC_FIREBASE_API_KEY']) `
  --dart-define=FIREBASE_APP_ID=$($envMap['NEXT_PUBLIC_FIREBASE_APP_ID']) `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=$($envMap['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']) `
  --dart-define=FIREBASE_PROJECT_ID=$($envMap['NEXT_PUBLIC_FIREBASE_PROJECT_ID'])

# 3) بناء نسخة الويب PWA مع زرار تحميل الـ APK
flutter build web --release `
  --dart-define=API_BASE_URL=$RENDER_URL `
  --dart-define=FIREBASE_API_KEY=$($envMap['NEXT_PUBLIC_FIREBASE_API_KEY']) `
  --dart-define=FIREBASE_APP_ID=$($envMap['NEXT_PUBLIC_FIREBASE_APP_ID']) `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=$($envMap['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']) `
  --dart-define=FIREBASE_PROJECT_ID=$($envMap['NEXT_PUBLIC_FIREBASE_PROJECT_ID']) `
  --dart-define=ANDROID_APK_DOWNLOAD_URL=/downloads/smarthealth.apk

# 4) نسخ الـ APK جوه Hosting ونشره على Firebase
New-Item -ItemType Directory -Force build\web\downloads | Out-Null
Copy-Item build\app\outputs\flutter-apk\app-release.apk build\web\downloads\smarthealth.apk -Force
cd ..
npx --yes firebase-tools deploy --only hosting
```

بعدها هتلاقي:

- تطبيق الويب: `https://smart-healthcare-system-cce19.web.app`
- رابط تحميل تطبيق الأندرويد APK مباشر: `https://smart-healthcare-system-cce19.web.app/downloads/smarthealth.apk`

---

## التشغيل المحلي السريع (اختياري للتجربة على جهازك قبل أو بعد النشر)

كل ملفات البيئة جاهزة على جهازك بالفعل! افتح 3 نوافذ PowerShell وشغّل:

```powershell
# 1) Backend API (http://localhost:4000)
npm run dev:backend

# 2) AI Service (http://localhost:8000)
cd ai-service; python -m uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3) Web Admin (http://localhost:3000)
npm run dev:web
```

ولتجربة Flutter محلياً في المتصفح (تأكد أن Render أو `localhost:4000` شغال):

```powershell
cd mobile-app; flutter run -d chrome
```

_(ملاحظة اختيارية لبناء Windows `.exe`: لو حبيت مستقبلاً تشغّل `flutter build windows --release` بدون أخطاء `atlstr.h`، افتح **Visual Studio Installer → Modify → Individual components →** فعّل **C++ ATL for latest build tools (x86 & x64)**، ثم أعد تشغيل الأمر.)_

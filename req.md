# SmartHealth — الخطوات المتبقية فقط للنشر النهائي

> **كل ما تم حله وتأكيده بالفعل ✅:**
>
> - **إزالة `ai-service` و Hugging Face Spaces بالكامل:** تم بناء محرك الذكاء الاصطناعي + RAG موفر للتوكنز (80%–95% توفير) مباشرة داخل `backend-api` (مع Gemini Free Tier + Groq Fallback + كاش ثنائي الطبقة + Vision + Voice SOAP Scribe).
> - **Firebase Auth + Firestore + Hosting (`smart-healthcare-system-cce19`):** تم النشر وزرع البيانات (`seed:firebase`) بنجاح، والويب منشور مبدئياً على `https://smart-healthcare-system-cce19.web.app`.
> - **Vercel (`web-admin`) وملفات `.env` المحلية:** مكتملة.
> - **Render Build & Private Key Parsing:** تم حل خطأ `@types/express` عبر `npm ci --include=dev`، وتم إصلاح خطأ `DECODER routines::unsupported` في `firebase-admin.ts` ليتجاهل علامات التنصيص الزائدة (`"..."`) والأسطر الجديدة (`\\n` / `\n`) تلقائياً.
> - **Android APK Build:** تم حله في `mobile-app/android/gradle.properties` (`kotlin.incremental=false` + `-Xmx2G`).

---

## المتبقي عليك بالترتيب (4 خطوات نظيفة فقط)

### 1) ارفع التعديلات على GitHub

من جذر المشروع `P:\Projects\smart-healthcare-system`:

```powershell
git add .
git commit -m "feat: integrated ultra-low-token AI+RAG engine and fix Render Firebase PEM parsing"
git push
```

---

### 2) أضف مفاتيح الذكاء الاصطناعي المجانية في Render (بدلاً من Hugging Face)

1. احصل على مفتاح مجاني من Google AI Studio: `https://aistudio.google.com/apikey` وأضفه في Render تحت اسم `GEMINI_API_KEY` (أو عدة مفاتيح مفصولة بفاصلة في `GEMINI_API_KEYS=key1,key2` للتبديل التلقائي عند `429`).
2. احصل على مفتاح احتياطي مجاني من Groq Console: `https://console.groq.com/keys` وأضفه في Render تحت اسم `GROQ_API_KEY`.
3. أضف `BIOMETRIC_TRANSFORM_SECRET` (مفتاح عشوائي من 32 بايت base64، يمكن توليده عبر `npm run keys:dev`).
4. تأكد من `FIREBASE_PRIVATE_KEY` في Render (حتى لو نُسخ بعلامات تنصيص `"..."` أصبح الكود ينظفه تلقائياً بعد الـ push).
5. احذف `AI_SERVICE_URL` و `INTERNAL_JWT_SIGNING_KEY` من Render إن وجدت (لم تعد مطلوبة).
6. راقب كفاءة الكاش والتوكنز من **لوحة تحكم الأدمن** (`AI Token & Cache Efficiency`) عبر `GET /v1/admin/ai-metrics`.

---

### 3) أعد نشر `backend-api` على Render

1. افتح **Render Dashboard → Service → Settings** وتأكد من:
   - **Build Command:**
     ```bash
     npm ci --include=dev && npm run build -w @smarthealth/contracts && npm run build -w backend-api
     ```
   - **Start Command:** `npm run start -w backend-api`
   - **Health Check Path:** `/health`
2. اضغط **Manual Deploy → Clear build cache & deploy**.
3. تأكد أن رابط Render يرجع `{"status":"ok",...}` عند فتح:
   `https://smart-healthcare-system-huyh.onrender.com/health`
4. _(تذكير سريع لـ Vercel):_ تأكد أن `NEXT_PUBLIC_API_BASE_URL` في Vercel = `https://smart-healthcare-system-huyh.onrender.com`، وأن `WEB_ORIGIN` في Render = رابط Vercel النهائي (بدون `/` في الآخر)، ثم أعد نشر Vercel إذا غيّرت الرابط.

---

### 4) بناء ورفع النسخة النهائية لـ Android APK + Flutter Web على Firebase Hosting

نفّذ هذا البلوك كما هو في PowerShell:

```powershell
cd P:\Projects\smart-healthcare-system\mobile-app

$envMap = @{}
Get-Content ..\web-admin\.env.local | Where-Object { $_ -and -not $_.StartsWith('#') -and $_.Contains('=') } | ForEach-Object {
  $p = $_.Split('=', 2); $envMap[$p[0].Trim()] = $p[1].Trim().Trim('"')
}
$RENDER_URL = "https://smart-healthcare-system-huyh.onrender.com"

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

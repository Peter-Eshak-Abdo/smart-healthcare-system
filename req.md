# SmartHealth — الخطوات المتبقية فقط للنشر النهائي

> **كل ما تم حله وتأكيده بالفعل ✅:**
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

---

### 2) شغّل `ai-service` على Hugging Face (حل خطأ `403 cpu-basic quota limit`)
1. افتح حسابك: `https://huggingface.co/spaces/peter-eshak`
2. افتح أي Space قديم شغال غير مستخدم ← **Settings → Pause this Space** (أو احذفه) لأن الخطة المجانية تسمح بعدد محدود من الـ `cpu-basic` Spaces النشطة معاً.
3. ارجع إلى: `https://huggingface.co/spaces/peter-eshak/makhdoum-ai-service/settings` واضغط **Restart this Space**.
4. انتظر حتى يصبح **Running** وتأكد في المتصفح أن الرابط التالي يرجع `{"status":"ok",...}`:
   `https://peter-eshak-makhdoum-ai-service.hf.space/internal/v1/health`

---

### 3) أعد نشر `backend-api` على Render (حل خطأ `@types/express`)
1. افتح لوحة **Render Dashboard → Service → Settings** وعدّل **Build Command** ليصبح بالضبط:
   ```bash
   npm ci --include=dev && npm run build -w @smarthealth/contracts && npm run build -w backend-api
   ```
   *(السبب: وجود `NODE_ENV=production` في Render كان يجعل `npm ci` يتجاهل `devDependencies` التي تحتوي على `@types/express` و`@types/multer`.)*
2. تأكد من **Start Command:** `npm run start -w backend-api` و**Health Check Path:** `/health`.
3. اضغط **Manual Deploy → Clear build cache & deploy**.
4. تأكد أن رابط Render يرجع `{"status":"ok",...}` عند فتح:
   `https://<your-render-service>.onrender.com/health`
5. *(تذكير سريع لـ Vercel):* تأكد أن `NEXT_PUBLIC_API_BASE_URL` في Vercel = رابط Render النهائي، وأن `WEB_ORIGIN` في Render = رابط Vercel النهائي (بدون `/` في الآخر)، ثم أعد نشر Vercel إذا غيّرت الرابط.

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

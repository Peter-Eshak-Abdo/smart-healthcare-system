# SmartHealth — الدليل النهائي للنشر والتشغيل (100% Free Tiers)

> **حالة المنصة الآن ✅:**
>
> - **Backend API + AI/RAG Engine (Render):** شغال ومباشر (`Your service is live 🎉`) على `https://smart-healthcare-system-huyh.onrender.com/health`
> - **Web Admin (Vercel):** شغال ومباشر على `https://smart-healthcare-system-web-admin.vercel.app`
> - **Firebase Auth + Firestore (`smart-healthcare-system-cce19`):** تم النشر وزرع البيانات (`seed:firebase`) بنجاح.
> - **Android APK Build:** تم حله في `mobile-app/android/gradle.properties` (`kotlin.incremental=false` + `-Xmx2G`).

---

## الخطوة الأخيرة: رفع Flutter Web على Firebase Hosting + Android APK على GitHub Releases

> **سبب فصل الـ APK عن Firebase Hosting:** خطة Firebase Spark المجانية تمنع رفع ملفات `.apk` مباشرة (`Executable files are forbidden on the Spark billing plan`)، لذلك نرفع `smarthealth.apk` مجاناً على **GitHub Releases** وننشر تطبيق الويب على Firebase Hosting.

```powershell
cd P:\Projects\smart-healthcare-system\mobile-app

$envMap = @{}
Get-Content ..\web-admin\.env.local | Where-Object { $_ -and -not $_.StartsWith('#') -and $_.Contains('=') } | ForEach-Object {
  $p = $_.Split('=', 2); $envMap[$p[0].Trim()] = $p[1].Trim().Trim('"')
}
$RENDER_URL = "https://smart-healthcare-system-huyh.onrender.com"
$APK_URL = "https://github.com/Peter-Eshak-Abdo/smart-healthcare-system/releases/latest/download/smarthealth.apk"

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
  --dart-define=ANDROID_APK_DOWNLOAD_URL=$APK_URL

Copy-Item build\app\outputs\flutter-apk\app-release.apk ..\smarthealth.apk -Force
cd ..
npx --yes firebase-tools deploy --only hosting
```

بعدها ارفع `smarthealth.apk` (من جذر المشروع) في **GitHub → Releases → Draft a new release** (باسم `v1.0.0`).

### الروابط النهائية

- **Backend API:** `https://smart-healthcare-system-huyh.onrender.com/health`
- **Web Admin (Doctor / Pharmacist / ER / Admin):** `https://smart-healthcare-system-web-admin.vercel.app`
- **Flutter Web (PWA):** `https://smart-healthcare-system-cce19.web.app`
- **Android APK Direct Download:** `https://github.com/Peter-Eshak-Abdo/smart-healthcare-system/releases/latest/download/smarthealth.apk`

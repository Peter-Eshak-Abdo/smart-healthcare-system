# UI-03 — SmartHealth UX Writing Guide & Egyptian Arabic Microcopy Dictionary

> **«كلام بسيط، دافي، وواضح — زي ممرضة شاطرة وطيبة بتطمّنك.»**
>
> **Owner:** UI/UX (M8) · **Consumers:** Web (`i18n/messages/ar.json`, `en.json`), Mobile (`lib/l10n/app_ar.arb`, `app_en.arb`), AI (fixed templates in `ai-service`, red-flag responses)
> **Status:** Draft for native-speaker review · **Date:** 2026-11-24
> **Decision:** D-UI-01 (UI-01 §0.2): user-facing Arabic is **Egyptian colloquial**. It replaces role-07 §6.1 (MSA).
> **Canonical names:** enum values, error codes and endpoints from `00-INDEX.md` and `03-API-CONTRACTS-AND-INTEGRATION.md`.

---

## 0. How to use this file

1. **Keys are canonical.** The key in the first column goes into `ar.json` / `en.json` (web, `next-intl`) and `app_ar.arb` / `app_en.arb` (Flutter) **with the same name** (role-07 §6.2). Web uses `dot.case` keys as nested JSON. ARB needs camelCase identifiers, so `rx.overrideRequired` becomes `rxOverrideRequired`. A build script (`pnpm i18n:sync`) generates both formats from `design/copy/strings.yaml`.
2. **Placeholders** use ICU MessageFormat: `{name}`, `{count, plural, …}`, `{gender, select, female {…} other {…}}`. Both `next-intl` and Flutter `intl` support ICU.
3. **The Arabic text here is the reviewed source.** English is the parallel string, not the source of the Arabic. Never machine-translate EN → AR for this product.
4. **Existing role-07 §6.2 keys are kept** (same key names) with new Egyptian values. The old MSA values are retired.
5. A string with ⚕ in the notes is **clinically sensitive**. Changing it needs a review by a doctor or pharmacist on the team or the faculty supervisor.
6. A string with ⚖ in the notes is **legal or consent** text. It must stay precise. Changes need Security Lead review (Law 151/2020 principles, NFR-04).

---

## 1. Voice Principles

| # | Principle | Do | Don't |
|---|-----------|----|-------|
| V1 | **Speak like a kind, competent Egyptian nurse** | «خلّي بالك! فيه تعارض بين الدوا ده وحساسيتك» | «تحذير: تم اكتشاف تعارض دوائي» (government-form tone) |
| V2 | **Short sentences, one idea each** | «الكود خلص. اعمل كود جديد.» | «انتهت صلاحية الكود ولذلك يجب عليك إنشاء كود جديد للمتابعة» |
| V3 | **Verb first on buttons** | «اصرف»، «ابعت»، «أكّد»، «سجّل وشك» | «عملية الصرف»، «إرسال البيانات» |
| V4 | **Never blame the user** | «مقدرناش نقرا الكود — جرّب تاني» | «انت دخلت كود غلط» |
| V5 | **Calm in danger, never dramatic** | «الأعراض دي محتاجة طوارئ فوراً. اتصل بالإسعاف ١٢٣.» | «خطر!!! حالتك خطيرة جداً» |
| V6 | **Honest about limits** | «ده مش تشخيص. المساعد بيوجّهك للتخصص الصح بس.» | «المساعد هيعرفك عندك إيه» |
| V7 | **Say what happens next** | «هنبعتلك رسالة أول ما الدكتور يكتبلك الروشتة» | «تمّت العملية» (with no next step) |
| V8 | **Respectful, never childish** | «أهلاً يا {firstName}» | «يا حبيبي»، «يا قمر»، slang that sounds patronising to older patients |
| V9 | **Clinical words stay precise** | «حساسية مفرطة (Anaphylaxis)»، «فصيلة الدم»، «جرعة» | Colloquial words that change meaning («حساسية بسيطة» for anaphylaxis) |
| V10 | **No fear-selling, no false reassurance** | «لو الألم زاد أو جالك ضيق نفس، روح الطوارئ» | «متقلقش خالص، أكيد مفيش حاجة» |

### 1.1 Gender & address
Arabic second-person verbs are gendered. Rules:
1. **Patient app:** use the profile's `sex` (`male`/`female`) through ICU `select`. Example: `{gender, select, female {اتأكدي من بياناتك} other {اتأكد من بياناتك}}`. If `sex` is not set yet (before onboarding step 2), use a gender-neutral phrasing («ممكن نتأكد من البيانات؟») rather than defaulting to masculine.
2. **Staff apps (doctor, pharmacist, paramedic, admin):** prefer **neutral noun phrases and imperatives that read naturally for both** («تأكيد الصرف»، «وثّق السبب»). Where a verb must be conjugated, use the practitioner's `sex` the same way.
3. **Talking about the patient to staff:** «المريض/المريضة» via `select` on the patient's sex.
4. **Respect:** «حضرتك» is used in a small set of high-stakes patient strings (consent, account deletion, emergency-card explanation), where formality reassures. Everywhere else, the direct «انت/انتي» is warmer and shorter.

### 1.2 Words we use (Egyptian-friendly glossary)

| Concept | ✅ Use | ❌ Avoid | Notes |
|---------|-------|---------|-------|
| Prescription | **روشتة** | وصفة طبية | «روشتة إلكترونية» on first mention |
| Medicine | **دوا** (pl. **أدوية**) | عقار | «الدوا ده» |
| Dose | **جرعة** | مقدار | |
| Pharmacy / pharmacist | **صيدلية / صيدلي، صيدلانية** | — | |
| Doctor | **دكتور / دكتورة**, abbreviated «د.» | طبيب (formal; OK in admin) | |
| Paramedic | **مسعف / مسعفة** | فني إسعاف | |
| Ambulance | **الإسعاف ١٢٣** | سيارة إسعاف | The number comes from `EMERGENCY_PHONE_NUMBER` (default `123`) |
| Emergency department | **الطوارئ** / «أقرب مستشفى فيها طوارئ» | قسم الحوادث | |
| Blood type | **فصيلة الدم** | زمرة الدم | |
| Allergy | **حساسية** | تحسّس | |
| Anaphylaxis | **حساسية مفرطة (Anaphylaxis)** | صدمة تحسسية (unclear to many) | ⚕ |
| Chronic diseases | **أمراض مزمنة** | — | Examples: «ضغط»، «سكر»، «ربو» |
| Diabetes / hypertension | **سكر / ضغط** in patient UI; «السكري (Diabetes)» in clinician UI | — | |
| Medical record | **ملفك الطبي** | السجل الصحي الإلكتروني | |
| MRN | **رقم الملف الطبي** | MRN alone | Show `SH-7K2M9Q4D` in Latin mono |
| National ID | **الرقم القومي** | رقم الهوية الوطنية | |
| QR code | **كود QR** / «الكود» | باركود (it's not a barcode) | |
| Verification code | **كود التأكيد** | رمز التحقق | |
| Face scan | **بصمة الوش** in patient copy, **مسح الوش** in actions | التعرف على الوجه البيومتري | «بصمة الوش» is how Egyptians talk about Face ID |
| Device biometric step-up | **أكّد إنه انت** | المصادقة البيومترية | Never call it "identification" (SD-02) |
| Interaction | **تعارض بين الأدوية** | تداخل دوائي | Clinician UI may add «(Interaction)» |
| Override | **تجاوز التنبيه** + «وثّق السبب» | إلغاء التحذير | ⚕ |
| Dispense | **صرف / اصرف / اتصرف** | تسليم الدواء | |
| Share code | **كود المشاركة** | — | 6 digits |
| Access grant | **إذن الاطلاع** | تفويض الوصول | |
| Break-glass | **دخول طوارئ** (staff: «دخول طوارئ (Break-glass)») | كسر الزجاج | |
| Audit log | **سجل العمليات** | سجل التدقيق | |
| Offline | **أوفلاين / مفيش نت** | غير متصل بالشبكة | Both are natural; use «مفيش نت» in short labels |
| Sync | **بنزامن / بنحدّث** | المزامنة | |
| Session | **جلسة** | — | |
| Licence | **ترخيص مزاولة المهنة** (short: «الترخيص») | الرخصة (sounds like a driving licence) | |

### 1.3 Formatting rules
- **Digits:** Western digits (0–9) by default in both languages (UI-01 §4.4). In the Arabic examples below, numbers inside running text like «١٢٣» or «٢٤ ساعة» are shown in Eastern digits **only for readability of this document**. In the product, every number is rendered through the number formatter, which outputs Western digits unless the user turns on Eastern digits, and **doses always stay Western**.
- **Punctuation:** Arabic comma «،», question mark «؟», semicolon «؛». One exclamation mark at most, and only in warm positive moments («تمام!») or a real warning («خلّي بالك!»). Never «!!!».
- **Bidi:** drug names, units, codes, MRN and blood type are LTR-isolated (`<bdi>` / `⁦…⁩`). Example: «خد ‎<bdi>Augmentin 1 g</bdi>‎ مرتين في اليوم».
- **Emoji:** none in clinical, staff or error copy. The patient greeting may use one 👋. Status uses icons, not emoji.
- **Length limits:** buttons ≤ 3 words (≤ 18 characters on mobile); tab labels ≤ 1 word (≤ 10 characters); toast ≤ 2 lines; banner title ≤ 8 words; error body ≤ 2 sentences.
- **Capitalisation (EN):** sentence case everywhere.
- **Time:** relative for recent («من ٥ دقايق»، «امبارح ٩:٣٠ م»), absolute with weekday for older («الخميس ١٢ نوفمبر»). Timezone `Africa/Cairo`. 12-hour clock with «ص / م».
- **Placeholders never reach the screen raw.** CI fails if a rendered string still contains `{`.

---

## 2. Tone per Role

| Role | Context | Tone | Sentence length | Example (AR) | Example (EN) |
|------|---------|------|-----------------|--------------|--------------|
| **Patient** (incl. elderly) | Home, sometimes worried, sometimes in pain | **Warm, reassuring, plain.** Explain why. Say what happens next | ≤ 15 words | «أهلاً يا منى 👋 روشتتك الجديدة وصلت — تقدر تصرفها من أي صيدلية.» | "Hi Mona 👋 Your new prescription is here. You can collect it at any pharmacy." |
| **Patient in danger** (AI red flag, emergency card) | Fear, urgency | **Calm, direct, one action** | ≤ 8 words per line | «الأعراض دي محتاجة طوارئ فوراً.» / «اتصل بالإسعاف ١٢٣» | "These symptoms need emergency care now." / "Call 123" |
| **Paramedic** | Scene, gloves, noise, night, poor signal | **Ultra-short, imperative, no politeness padding** | 1–4 words for labels; ≤ 8 words for hints | «امسح الوش» · «امسح كارت الطوارئ» · «حساسية مفرطة: بنسلين» | "Scan face" · "Scan emergency card" · "Anaphylaxis: penicillin" |
| **Doctor** | Busy clinic, 40 patients/day | **Crisp professional Egyptian.** Medical terms + English in parentheses on first use. Explain blocks precisely | ≤ 12 words | «فيه تنبيهين محتاجين سبب موثّق قبل إصدار الروشتة.» | "2 alerts need a documented reason before issuing." |
| **Pharmacist** | Counter, queue, phone ringing | **Crisp, decisive, status-first** | ≤ 10 words | «روشتة سليمة — اصرف.» · «ماتصرفش — الروشتة مش سليمة.» | "Authentic — dispense." · "Don't dispense — failed check." |
| **Admin** | Desk, careful decisions | **Neutral, precise, consequence-aware** | ≤ 15 words | «سحب الترخيص هيوقف ٣ روشتات لسه ماتصرفتش.» | "Revoking will invalidate 3 open prescriptions." |

---

## 3. Microcopy Dictionary

Columns: **Key** · **Arabic (Egyptian)** · **English** · **Notes**.

### 3.1 Common actions & states

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `common.save` | احفظ | Save | |
| `common.saved` | اتحفظ ✓ | Saved | Toast; the check is an icon, not text |
| `common.cancel` | إلغاء | Cancel | |
| `common.confirm` | أكّد | Confirm | |
| `common.continue` | كمّل | Continue | |
| `common.next` | التالي | Next | |
| `common.back` | رجوع | Back | |
| `common.done` | تمام | Done | |
| `common.close` | اقفل | Close | |
| `common.retry` | جرّب تاني | Try again | |
| `common.edit` | عدّل | Edit | |
| `common.delete` | امسح | Delete | Always followed by a confirm dialog |
| `common.undo` | تراجع | Undo | |
| `common.search` | دوّر | Search | |
| `common.searchPlaceholder` | دوّر بالاسم أو الرقم… | Search by name or number… | |
| `common.seeAll` | شوف الكل | See all | |
| `common.showMore` | اعرض أكتر | Show more | |
| `common.showLess` | اعرض أقل | Show less | |
| `common.copy` | انسخ | Copy | |
| `common.copied` | اتنسخ | Copied | |
| `common.share` | شارك | Share | |
| `common.print` | اطبع | Print | |
| `common.loading` | ثانية واحدة… | One moment… | Only if > 300 ms |
| `common.saving` | بنحفظ… | Saving… | |
| `common.sending` | بنبعت… | Sending… | |
| `common.confirming` | بنأكد… | Confirming… | Pending idempotent request (E-NET-04) |
| `common.optional` | (اختياري) | (optional) | |
| `common.required` | مطلوب | Required | |
| `common.yes` | أيوه | Yes | |
| `common.no` | لأ | No | |
| `common.or` | أو | or | |
| `common.today` | النهارده | Today | |
| `common.yesterday` | امبارح | Yesterday | |
| `common.minutesAgo` | `{count, plural, =0 {دلوقتي} one {من دقيقة} two {من دقيقتين} few {من {count} دقايق} other {من {count} دقيقة}}` | `{count, plural, =0 {just now} one {1 min ago} other {{count} min ago}}` | |
| `common.hoursAgo` | `{count, plural, one {من ساعة} two {من ساعتين} few {من {count} ساعات} other {من {count} ساعة}}` | `{count, plural, one {1 h ago} other {{count} h ago}}` | |
| `common.discardTitle` | تلغي اللي كتبته؟ | Discard your changes? | Clinical sheets (UI-02 §5.5) |
| `common.discardBody` | اللي كتبته مش هيتحفظ. | What you typed won't be saved. | |
| `common.discardConfirm` | أيوه، الغي | Yes, discard | |
| `common.keepEditing` | كمّل تعديل | Keep editing | |
| `common.blockedReason` | `{reason}` | `{reason}` | Rendered under every disabled primary button (P4) |
| `common.skipToContent` | روح للمحتوى | Skip to content | Web a11y |
| `common.offlineRibbon` | أوفلاين — آخر تحديث {time} | Offline — last updated {time} | ⚕ Must always show the time |
| `common.backOnline` | رجع النت — بنحدّث البيانات… | Back online — updating… | |
| `common.slowNetwork` | النت بطيء شوية… | The connection is slow… | |
| `common.unknown` | مش معروف | Unknown | |
| `common.notRecorded` | مش متسجل | Not recorded | ⚕ Never «مفيش» for missing clinical data |

### 3.2 Navigation labels

**Patient app (bottom tabs, max 5):**

| Key | Arabic | English |
|-----|--------|---------|
| `nav.patient.home` | الرئيسية | Home |
| `nav.patient.history` | ملفي | My record |
| `nav.patient.prescriptions` | روشتاتي | Prescriptions |
| `nav.patient.assistant` | المساعد | Assistant |
| `nav.patient.profile` | حسابي | Account |

**Paramedic app (no tabs; one shell):** `nav.er.scan` «مسح» / Scan · `nav.er.card` «كارت QR» / Card QR · `nav.er.search` «الرقم القومي» / National ID · `nav.er.shift` «الوردية» / Shift.

**Pharmacist mobile (bottom tabs):** `nav.rx.scan` «امسح» / Scan · `nav.rx.manual` «رقم الروشتة» / Rx number · `nav.rx.history` «اللي اتصرف» / Dispensed · `nav.rx.account` «حسابي» / Account.

**Web sidebars:**

| Key | Arabic | English | Role |
|-----|--------|---------|------|
| `nav.doctor.dashboard` | لوحة اليوم | Today | Doctor |
| `nav.doctor.patients` | مرضايا | My patients | Doctor |
| `nav.doctor.redeem` | افتح ملف بكود | Open with code | Doctor |
| `nav.doctor.prescriptions` | روشتات كتبتها | Prescriptions issued | Doctor |
| `nav.pharmacy.verify` | تحقق وصرف | Verify & dispense | Pharmacist |
| `nav.pharmacy.history` | سجل الصرف | Dispensing log | Pharmacist |
| `nav.er.console` | حالات الطوارئ | Emergency cases | ER desk |
| `nav.er.identify` | تعرّف على مريض | Identify patient | ER desk |
| `nav.admin.overview` | نظرة عامة | Overview | Admin |
| `nav.admin.users` | المستخدمين | Users | Admin |
| `nav.admin.licenses` | التراخيص | Licences | Admin |
| `nav.admin.facilities` | المنشآت | Facilities | Admin |
| `nav.admin.audit` | سجل العمليات | Audit log | Admin |
| `nav.admin.breakGlass` | مراجعة دخول الطوارئ | Break-glass review | Admin |
| `nav.admin.security` | تنبيهات أمنية | Security flags | Admin |
| `nav.common.settings` | الإعدادات | Settings | All |
| `nav.common.logout` | خروج | Log out | All |
| `nav.common.language` | English | العربية | All (shows the *other* language) |

### 3.3 Splash, welcome & authentication

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `app.name` | سمارت هيلث | SmartHealth | |
| `app.tagline` | هوية واحدة. ملف واحد. أمان كامل. | One identity. One record. Fully secure. | |
| `welcome.title` | أهلاً وسهلاً في سمارت هيلث | Welcome to SmartHealth | Gender-neutral, because sex is unknown before sign-up |
| `welcome.back` | `{gender, select, female {أهلاً بيكي تاني يا {firstName}} other {أهلاً بيك تاني يا {firstName}}}` | Welcome back, {firstName} | Returning users (the brief's «أهلاً بيك» form) |
| `welcome.body` | ملفك الطبي وروشتاتك وكارت الطوارئ… كله في مكان واحد وآمن. | Your record, prescriptions and emergency card, together and secure. | |
| `welcome.login` | ادخل | Log in | |
| `welcome.signup` | اعمل حساب جديد | Create account | |
| `welcome.emergencyCard` | 🆘 كارت الطوارئ (من غير دخول) | Emergency card (no login) | Opens cached card (EXT-04) |
| `login.title` | تسجيل الدخول | Log in | |
| `login.identifier` | الإيميل أو رقم الموبايل | Email or mobile number | |
| `login.password` | كلمة السر | Password | |
| `login.showPassword` | اظهر كلمة السر | Show password | a11y |
| `login.forgot` | نسيت كلمة السر؟ | Forgot password? | |
| `login.submit` | ادخل | Log in | |
| `login.failed` | الإيميل أو كلمة السر مش مظبوطين. جرّب تاني. | Email or password is incorrect. | Never says which one |
| `login.throttled` | محاولات كتير. استنى {minutes} دقايق وجرّب تاني. | Too many attempts. Try again in {minutes} min. | US-19-AC3 |
| `login.captcha` | أكّد إنك مش روبوت | Confirm you're not a robot | E-AUTH-07 |
| `signup.title` | حساب جديد | New account | |
| `signup.passwordHelp` | ١٠ حروف على الأقل، ويفضّل تكون جملة سهلة تفتكرها. | At least 10 characters. A memorable phrase works well. | |
| `signup.passwordBreached` | كلمة السر دي ظهرت في تسريبات قبل كده — اختار واحدة تانية. | This password appeared in a data leak. Choose another. | |
| `signup.terms` | موافق على <terms>الشروط</terms> و<privacy>سياسة الخصوصية</privacy> | I agree to the <terms>Terms</terms> and <privacy>Privacy policy</privacy> | ⚖ |
| `otp.title` | اكتب الكود اللي وصلك | Enter the code we sent | |
| `otp.body` | بعتنا كود من ٦ أرقام على {destination} | We sent a 6-digit code to {destination} | Destination masked: `+20 10•• ••• 334` |
| `otp.resend` | ابعت الكود تاني | Resend code | |
| `otp.resendIn` | تقدر تطلب كود جديد بعد {seconds} ثانية | Resend in {seconds}s | |
| `otp.invalid` | الكود مش صح. اتأكد منه وجرّب تاني. | That code isn't right. | |
| `otp.expired` | الكود خلص. اطلب كود جديد. | The code expired. Request a new one. | |
| `mfa.enroll.title` | أمّن حسابك بخطوة زيادة | Secure your account with a second step | Staff |
| `mfa.enroll.body` | امسح الكود ده بتطبيق Google Authenticator أو Microsoft Authenticator، وبعدين اكتب الـ٦ أرقام. | Scan this with an authenticator app, then enter the 6 digits. | |
| `mfa.enroll.secret` | مش عارف تمسح؟ اكتب المفتاح ده يدوي: | Can't scan? Enter this key manually: | |
| `mfa.verify.title` | اكتب كود التطبيق | Enter your authenticator code | |
| `mfa.verify.body` | افتح تطبيق المصادقة واكتب الـ٦ أرقام اللي ظاهرين. | Open your authenticator app and enter the 6 digits. | |
| `mfa.lost` | ضيّعت الموبايل؟ كلّم مسؤول النظام. | Lost your device? Contact your administrator. | E-AUTH-08 |
| `forgot.title` | نرجّعلك حسابك | Reset your password | |
| `forgot.sent` | لو الإيميل ده عندنا، هيوصلك لينك تغيّر بيه كلمة السر. | If this email is registered, you'll get a reset link. | No account enumeration |
| `role.webOnly.title` | الحساب ده بيشتغل على الموقع | This account works on the web portal | Doctor/admin on mobile |
| `role.webOnly.body` | افتح بوابة سمارت هيلث من اللابتوب عشان تكمّل. | Open the SmartHealth portal on a computer to continue. | |
| `web.phoneSize` | الشاشة دي معمولة للابتوب — لو عندك التطبيق استخدمه. | This screen is designed for a computer. Use the app if you have it. | UI-01 §5.2 |

### 3.4 Patient onboarding (3 steps + accessibility question)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `onb.progress` | خطوة {step} من {total} | Step {step} of {total} | |
| `onb.fontSize.title` | تحب الكلام يبقى أكبر؟ | Would you like bigger text? | UI-01 §4.6; asked first |
| `onb.fontSize.normal` | عادي | Normal | |
| `onb.fontSize.large` | كبير | Large | |
| `onb.fontSize.xl` | كبير جداً | Extra large | |
| `onb.fontSize.preview` | كده الكلام هيبان في التطبيق. تقدر تغيّره بعدين من الإعدادات. | This is how text will look. You can change it later in Settings. | |
| `onb.id.title` | الرقم القومي وتاريخ الميلاد | National ID and date of birth | |
| `onb.id.why` | محتاجينهم عشان نتأكد إن ملفك ليك انت بس، ومحدش يعمل حساب باسمك. | We need these so your record belongs only to you and nobody can open an account in your name. | ⚖ |
| `onb.id.nationalId` | الرقم القومي (١٤ رقم) | National ID (14 digits) | |
| `onb.id.dob` | تاريخ الميلاد | Date of birth | |
| `onb.id.mismatch` | تاريخ الميلاد مش متطابق مع الرقم القومي — راجع الاتنين. | Date of birth doesn't match the national ID. Check both. | E-ID-02 |
| `onb.id.invalid` | الرقم القومي لازم يكون ١٤ رقم صحيح. | National ID must be 14 valid digits. | |
| `onb.id.duplicate` | الرقم القومي ده متسجل قبل كده. كلّم الدعم وهنساعدك. | This national ID is already registered. Contact support. | US-01-AC4, never reveals whose |
| `onb.id.noNationalId` | معييش رقم قومي (جواز سفر / شهادة ميلاد) | I don't have a national ID (passport / birth certificate) | E-ID-03 |
| `onb.basics.title` | معلومات أساسية | Basic information | |
| `onb.basics.sex` | النوع | Sex | |
| `onb.basics.sexMale` | ذكر | Male | |
| `onb.basics.sexFemale` | أنثى | Female | |
| `onb.basics.bloodType` | فصيلة الدم | Blood type | |
| `onb.basics.bloodUnknown` | `{gender, select, female {مش متأكدة} other {مش متأكد}}` | I'm not sure | Sex is chosen on the same screen, just above |
| `onb.basics.bloodSelfReported` | هنعلّمها إنها «انت اللي كاتبها» لحد ما دكتور يأكدها. | We'll mark it as self-reported until a doctor confirms it. | ⚕ US-04-AC2 |
| `onb.consent.title` | موافقاتك | Your consents | ⚖ |
| `onb.consent.terms` | الشروط وسياسة الخصوصية (لازم) | Terms and privacy policy (required) | |
| `onb.consent.emergencyContacts` | أسمح للمسعفين يشوفوا جهات الطوارئ بتاعتي وقت الطوارئ بس | Let paramedics see my emergency contacts, in emergencies only | Default ON with explanation |
| `onb.consent.emergencyContactsWhy` | ده بيخلّي المسعف يكلّم أهلك بسرعة لو حصلك حاجة. تقدر تقفله في أي وقت. | This lets a paramedic call your family quickly. You can turn it off anytime. | |
| `onb.consent.ai` | أستخدم المساعد الذكي (اختياري) | Use the AI assistant (optional) | |
| `onb.consent.aiWhy` | المساعد بيساعدك تعرف تروح لأنهي تخصص. مش بيشخّص ومش بيكتب أدوية. | It helps you find the right specialty. It doesn't diagnose or prescribe. | ⚕ |
| `onb.done.title` | {gender, select, female {جاهزة!} other {جاهز!}} ملفك اتعمل | You're all set! Your record is ready | |
| `onb.done.mrn` | رقم ملفك الطبي: | Your medical record number: | Followed by `SH-…` mono + copy |
| `onb.done.next` | الخطوة الجاية: سجّل بصمة وشك عشان الطوارئ | Next: register your face for emergencies | Optional CTA |
| `onb.minor.ai` | المساعد الذكي مش متاح للحسابات اللي أقل من ١٦ سنة. | The AI assistant isn't available for accounts under 16. | US-01-AC7 |

### 3.5 Biometric enrolment, step-up & device security

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `bio.consent.title` | استخدم بصمة وشك في الطوارئ | Use your face in emergencies | Keeps role-07 key |
| `bio.consent.body` | لو حصلك حاجة ومقدرتش تتكلم، المسعف يقدر يعرفك من وشك ويشوف فصيلة دمك وحساسيتك فوراً. | If you can't speak in an emergency, a paramedic can recognise you and see your blood type and allergies right away. | ⚖ |
| `bio.consent.storage` | مش بنحفظ صورتك أبداً. بنحفظ نموذج رياضي محمي لوشك، وتقدر تمسحه في أي وقت. | We never store your photo. We keep a protected mathematical template that you can delete anytime. | ⚖ role-07 `bio.consent.body` |
| `bio.consent.who` | مين يقدر يستخدمه؟ المسعفين المرخّصين بس، وكل استخدام بيتسجل وبيوصلك إشعار. | Who can use it? Only licensed paramedics. Every use is logged and you're notified. | ⚖ |
| `bio.consent.agree` | موافق، سجّل وشي | I agree, register my face | Gender select variant: «موافقة» |
| `bio.consent.later` | بعدين | Later | |
| `bio.tips.title` | قبل ما نبدأ | Before we start | |
| `bio.tips.light` | اقف في مكان منوّر | Stand somewhere bright | |
| `bio.tips.glasses` | شيل النضارة والماسك لو تقدر | Remove glasses or mask if you can | |
| `bio.tips.steady` | امسك الموبايل قدام وشك | Hold the phone in front of your face | |
| `bio.tips.start` | يلا نبدأ | Let's start | |
| `bio.success` | تمام! وشك اتسجل بأمان. | Done! Your face is registered securely. | `scan.success.enrol` alias |
| `bio.duplicate` | الوش ده متسجل على حساب تاني. كلّم الدعم وهنحلها. | This face is registered to another account. Contact support. | EXT-03-AC5 / E-BIO-04, never says which |
| `bio.locked` | جرّبت كتير. استنى ٢٤ ساعة وجرّب تاني، أو كلّم الدعم. | Too many attempts. Try again in 24 hours or contact support. | EXT-03-AC3 |
| `bio.delete.title` | تمسح بصمة وشك؟ | Delete your face data? | ⚖ |
| `bio.delete.body` | لو مسحتها، المسعف مش هيقدر يعرفك من وشك. هيعتمد على كارت الطوارئ اللي على موبايلك بس. | If you delete it, paramedics can't recognise your face. They'll rely only on the emergency card on your phone. | EXT-03-AC4 |
| `bio.delete.confirm` | أيوه، امسحها | Yes, delete it | Destructive |
| `bio.delete.done` | اتمسحت. تقدر تسجلها تاني في أي وقت. | Deleted. You can register again anytime. | |
| `stepUp.title` | أكّد إنه انت | Confirm it's you | Keeps role-07 key |
| `stepUp.reason.pickup` | عشان نعملك كود الصيدلية | To create your pharmacy code | |
| `stepUp.reason.dispense` | عشان تأكيد الصرف | To confirm dispensing | Pharmacist |
| `stepUp.reason.share` | عشان تعمل كود مشاركة مع دكتور | To create a doctor share code | |
| `stepUp.reason.deleteFace` | عشان تمسح بصمة وشك | To delete your face data | |
| `stepUp.failed` | مقدرناش نتأكد. جرّب تاني. | We couldn't confirm it's you. Try again. | |
| `stepUp.keyChanged` | بصمات الموبايل اتغيّرت. ادخل بكلمة السر عشان نسجّل الجهاز تاني. | Your device biometrics changed. Log in with your password to re-register this device. | E-AUTH-04 |
| `stepUp.noBiometrics` | الموبايل ده مفيهوش بصمة — هنستخدم رمز قفل الموبايل. | This device has no biometrics. We'll use your screen lock. | E-AUTH-05 (patients) |
| `stepUp.staffNeedsBiometric` | حسابات الطاقم الطبي محتاجة موبايل فيه بصمة، أو اكتب كود التطبيق. | Staff accounts need a device with biometrics, or enter your authenticator code. | E-AUTH-05 (staff) |
| `reauth.title` | أكّد إنه انت | Confirm it's you | Web TOTP re-auth |
| `reauth.body` | للأمان، اكتب كود تطبيق المصادقة عشان نكمّل. | For security, enter your authenticator code to continue. | |
| `reauth.draftSafe` | متقلقش — اللي كتبته محفوظ. | Don't worry, your work is saved. | Session timeout overlay |
| `session.warning` | هتخرج تلقائياً بعد {seconds} ثانية لو مفيش نشاط. | You'll be signed out in {seconds}s due to inactivity. | |
| `session.stay` | خلّيني داخل | Stay signed in | |
| `session.ended` | خرجناك للأمان. ادخل تاني عشان تكمّل. | You were signed out for security. Log in again to continue. | |
| `session.revoked` | خرجناك من الجهاز ده لأن حسابك اتقفل من جهاز تاني. | You were signed out because your sessions were ended from another device. | `AUTH_SESSION_REVOKED` |

### 3.5b Face scanner hints & liveness challenges (UI-02 §6.1)

Strings spoken to the person in front of the camera use ICU `select` on that person's sex when it is known (enrolment: the patient; pharmacy 1:1: the patient on the prescription). Example: `{gender, select, female {رمّشي بعينك مرة} other {رمّش بعينك مرة}}`. The masculine form is shown below. Emergency hints address the paramedic about the patient.

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `scan.hint.placeFace` | حط وشك جوه الدايرة | Place your face inside the circle | Enrolment / pharmacy |
| `scan.hint.placeFace.emergency` | خلّي وش المريض جوه الدايرة | Keep the patient's face inside the circle | Paramedic |
| `scan.hint.closer` | قرّب شوية | Move closer | |
| `scan.hint.farther` | بعّد الموبايل شوية | Move the phone back a little | |
| `scan.hint.center` | خلّي وشك في نص الدايرة | Centre your face in the circle | |
| `scan.hint.lookStraight` | بص للكاميرا على طول | Look straight at the camera | |
| `scan.hint.moreLight` | النور قليل — روح مكان منوّر | Too dark — move somewhere brighter | Front camera |
| `scan.hint.torchOn` | النور قليل — شغّلنا الكشاف | Low light — flashlight on | Rear camera, auto torch |
| `scan.hint.backlight` | النور جامد ورا الوش — غيّر الزاوية | Strong light behind the face — change the angle | |
| `scan.hint.holdSteady` | ثبّت الموبايل ثانية | Hold the phone steady | |
| `scan.hint.obstruction.enrol` | لو تقدر، شيل النضارة أو الماسك ثانية | If you can, remove glasses or mask for a moment | |
| `scan.hint.obstruction.emergency` | لو فيه ماسك أكسجين أو رباط كمّل عادي — ولو مانفعش، امسح كارت الطوارئ | Oxygen mask or bandage? Continue — if it fails, scan the emergency card | ⚕ Never ask to remove medical equipment |
| `scan.hint.oneFace.enrol` | لازم وشك انت بس يبقى في الصورة | Only your face should be in the picture | E-BIO-08 |
| `scan.hint.oneFace.emergency` | خلّي وش المريض بس في الكادر | Only the patient's face in the frame | E-BIO-08 |
| `scan.hint.holdStill` | تمام كده — متتحركش | Good — hold still | |
| `scan.challenge.blink` | رمّش بعينك مرة | Blink once | |
| `scan.challenge.turnLeft` | لف وشك ناحية الشمال شوية | Turn your head a little to the left | Arrow never mirrors (UI-02 §6.1) |
| `scan.challenge.turnRight` | لف وشك ناحية اليمين شوية | Turn your head a little to the right | |
| `scan.challenge.smile` | ابتسم ابتسامة صغيرة | Give a small smile | |
| `scan.capturing` | ثانية واحدة… | One moment… | |
| `scan.verifying` | بنتأكد… | Checking… | |
| `scan.slowNetwork` | النت بطيء — تقدر تمسح كارت الطوارئ بدل كده | Slow connection — you can scan the emergency card instead | Request keeps running |
| `scan.success.enrol` | تمام! وشك اتسجل بأمان. | Done! Your face is registered securely. | Alias of `bio.success` |
| `scan.success.verify` | تمام — اتأكدنا إنه المريض | Confirmed — it's the patient | Pharmacy 1:1 |
| `scan.retry` | `{left, plural, one {جرّب تاني (فاضل محاولة واحدة)} two {جرّب تاني (فاضل محاولتين)} few {جرّب تاني (فاضل {left} محاولات)} other {جرّب تاني (فاضل {left} محاولة)}}` | `{left, plural, one {Try again (1 attempt left)} other {Try again ({left} attempts left)}}` | |
| `scan.liveness.retry` | مقدرناش نتأكد من الصورة. جرّب تاني في نور كويس. | We couldn't verify the image. Try again in good light. | Non-accusatory (E-BIO-05) |
| `scan.locked.staff` | المسح اتقفل — فيه محاولة غير طبيعية واتسجلت للمراجعة. | Scanning locked — an unusual attempt was logged for review. | Paramedic / pharmacist |
| `scan.locked.patient` | المسح اتوقف مؤقتاً لأسباب أمنية. جرّب بعد شوية أو كلّم الدعم. | Scanning is paused for security. Try later or contact support. | Patient |
| `scan.permission` | محتاجين الكاميرا عشان نمسح الوش. | We need the camera to scan the face. | |
| `scan.permission.open` | افتح الإعدادات | Open settings | |
| `scan.aiDown` | التعرّف على الوش واقف دلوقتي. | Face recognition is unavailable right now. | E-BIO-12; paired with card QR + national ID buttons |

### 3.6 Patient home, greetings & Medical ID card

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `home.greeting.morning` | صباح الخير يا {firstName} 👋 | Good morning, {firstName} 👋 | 05:00–11:59 |
| `home.greeting.afternoon` | أهلاً يا {firstName} 👋 | Hi {firstName} 👋 | 12:00–16:59 |
| `home.greeting.evening` | مساء الخير يا {firstName} 👋 | Good evening, {firstName} 👋 | 17:00–04:59 |
| `home.subtitle.allGood` | كل حاجة تمام النهارده. | Everything's in order today. | No pending items |
| `home.subtitle.dueDose` | عندك جرعة {time} | You have a dose at {time} | |
| `home.subtitle.newRx` | عندك روشتة جديدة مستنياك. | You have a new prescription. | |
| `home.tile.card` | الكارت الطبي | Medical ID | |
| `home.tile.prescriptions` | `{count, plural, =0 {مفيش روشتات شغّالة} one {روشتة شغّالة} two {روشتتين شغّالين} few {{count} روشتات شغّالة} other {{count} روشتة شغّالة}}` | `{count, plural, =0 {No active prescriptions} one {1 active prescription} other {{count} active prescriptions}}` | |
| `home.tile.doses` | جرعات النهارده | Today's doses | |
| `home.tile.critical` | معلوماتك المهمة | Your critical info | |
| `home.tile.assistant` | اسأل المساعد | Ask the assistant | |
| `home.tile.access` | مين شايف ملفك | Who can see your record | |
| `home.tile.accessCount` | `{count, plural, =0 {محدش} one {دكتور واحد} two {دكتورين} few {{count} دكاترة} other {{count} دكتور}}` | `{count, plural, =0 {Nobody} one {1 doctor} other {{count} doctors}}` | |
| `card.title` | الكارت الطبي | Medical ID | |
| `card.flipHint` | اقلب الكارت عشان الكود | Flip the card for the code | |
| `card.back.instruction` | ورّي الكود ده للمسعف لو مقدرتش تتكلم | Show this code to a paramedic if you can't speak | |
| `card.back.contacts` | `{count, plural, =0 {مفيش جهات طوارئ} one {جهة طوارئ واحدة} two {جهتين طوارئ} few {{count} جهات طوارئ} other {{count} جهة طوارئ}}` | `{count, plural, =0 {No emergency contacts} one {1 emergency contact} other {{count} emergency contacts}}` | |
| `card.issued` | اتعمل {date} · صالح لحد {expiry} | Issued {date} · valid until {expiry} | |
| `card.updated` | محدّث | Up to date | |
| `card.offline` | أوفلاين — آخر تحديث {time} | Offline — last updated {time} | ⚕ |
| `card.expired` | الكارت ده قديم — افتح النت عشان نحدّثه | This card is out of date — go online to refresh it | ⚕ EXT-04-AC3 |
| `card.blood.label` | فصيلة الدم | Blood type | |
| `card.blood.confirmed` | متأكد منها الدكتور | Confirmed by a doctor | |
| `card.blood.self` | انت اللي كاتبها | Self-reported | |
| `card.blood.unknown` | فصيلة الدم مش معروفة | Blood type unknown | ⚕ |
| `card.allergy.label` | الحساسية | Allergies | |
| `card.allergy.none` | مفيش حساسية متسجلة | No allergies recorded | ⚕ NOT «مفيش حساسية» |
| `card.allergy.more` | +{count} كمان | +{count} more | Never hides anaphylaxis |
| `card.conditions.label` | أمراض مزمنة | Chronic conditions | |
| `card.conditions.none` | مفيش أمراض مزمنة متسجلة | No chronic conditions recorded | ⚕ |
| `card.missing` | لسه ماعملناش الكارت — كمّل بياناتك الطبية | Your card isn't ready yet — complete your medical info | |
| `card.action.fullscreen` | افتح كارت الطوارئ (شاشة كاملة) | Open emergency card (full screen) | |
| `card.action.refresh` | حدّث البيانات | Refresh | |
| `card.a11ySummary` | الكارت الطبي. فصيلة الدم {blood}، {bloodSource}. {allergies}. {conditions}. | Medical ID. Blood type {blood}, {bloodSource}. {allergies}. {conditions}. | Screen-reader summary |
| `card.outdoorMode` | وضع الشمس (تباين عالي) | Sunlight mode (high contrast) | UI-01 Sunlight theme |
| `emergencyCard.title` | كارت الطوارئ | Emergency card | Full-screen Emergency theme |
| `emergencyCard.subtitle` | معلومات طبية مهمة — للمسعفين والأطباء | Critical medical information — for paramedics and doctors | |

### 3.7 Medical history (US-02)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `history.title` | ملفي الطبي | My medical record | |
| `history.filter.all` | الكل | All | |
| `history.filter.visits` | الزيارات | Visits | |
| `history.filter.diagnoses` | التشخيصات | Diagnoses | |
| `history.filter.medications` | الأدوية | Medications | |
| `history.visitBy` | زيارة عند د. {doctor} — {specialty} | Visit with Dr {doctor} — {specialty} | |
| `history.at` | في {facility} | at {facility} | |
| `history.diagnosis` | التشخيص | Diagnosis | |
| `history.doctorNotes` | كلام الدكتور ليك | Your doctor's notes for you | Patient-visible summary only |
| `history.linkedRx` | الروشتة بتاعة الزيارة دي | Prescription from this visit | |
| `history.restrict` | خلّي الزيارة دي مخفية عن باقي الدكاترة | Hide this visit from other doctors | US-20 |
| `history.restrictBody` | الدكاترة التانيين هيشوفوا إن فيه «سجل مخفي» بس. المسعف هيفضل شايف معلوماتك المهمة، وفحص الأدوية هيفضل شغّال عشان سلامتك. | Other doctors will only see "1 hidden record". Paramedics still see your critical info, and drug-safety checks still run for your safety. | ⚖ ⚕ US-20-AC2 |
| `history.restricted` | مخفية | Hidden | |
| `history.empty.title` | ملفك لسه فاضي | Your record is empty for now | US-02-AC5 |
| `history.empty.body` | الزيارات والتشخيصات بيضيفها الدكتور بعد الكشف. | Visits and diagnoses are added by your doctor after a visit. | |
| `history.loadMore` | اعرض أقدم | Show older | Cursor pagination |

### 3.8 Prescriptions, pickup QR & dose reminders (US-03)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `rx.tabs.active` | شغّالة | Active | |
| `rx.tabs.past` | قديمة | Past | |
| `rx.status.pending` | قيد الصرف | Ready to dispense | D-UI-10 |
| `rx.status.partially_dispensed` | اتصرف جزء منها | Partially dispensed | |
| `rx.status.dispensed` | اتصرفت بالكامل | Fully dispensed | D-UI-10 |
| `rx.status.cancelled` | اتلغت | Cancelled | |
| `rx.status.expired` | انتهت صلاحيتها | Expired | |
| `rx.item.pending` | لسه متبقّي | Remaining | |
| `rx.item.partially_dispensed` | اتصرف جزء — فاضل {remaining} | Part dispensed — {remaining} left | |
| `rx.item.dispensed` | اتصرف | Dispensed | |
| `rx.item.cancelled` | اتلغى | Cancelled | |
| `rx.number` | رقم الروشتة | Prescription number | |
| `rx.by` | كتبها د. {doctor} | Prescribed by Dr {doctor} | |
| `rx.expiresIn` | `{days, plural, =0 {بتنتهي النهارده} one {فاضل يوم} two {فاضل يومين} few {فاضل {days} أيام} other {فاضل {days} يوم}}` | `{days, plural, =0 {Expires today} one {1 day left} other {{days} days left}}` | |
| `rx.signedBy` | موقّعة إلكترونياً من د. {doctor} | Digitally signed by Dr {doctor} | Seal caption (UI-02 §6.3.1) |
| `rx.remaining` | فاضل {quantity} {unit} | {quantity} {unit} remaining | ⚕ quantity Western digits |
| `rx.remainingAnywhere` | الباقي تقدر تصرفه من أي صيدلية لحد {date}. | You can collect the rest at any pharmacy until {date}. | E-RX-01 |
| `rx.showAtPharmacy` | ورّي الكود في الصيدلية | Show at pharmacy | Primary CTA |
| `rx.cancelledReason.prescribing_error` | الدكتور لغاها عشان كان فيه خطأ في الكتابة | Cancelled due to a prescribing error | US-03-AC5 |
| `rx.cancelledReason.patient_request` | اتلغت بناءً على طلبك | Cancelled at your request | |
| `rx.cancelledReason.therapy_changed` | الدكتور غيّر العلاج | Your doctor changed the treatment | |
| `rx.cancelledReason.adverse_reaction` | اتلغت بسبب أعراض جانبية | Cancelled due to a side effect | |
| `rx.cancelledReason.other` | الدكتور لغاها | Cancelled by your doctor | |
| `rx.empty.title` | لسه مفيش روشتات | No prescriptions yet | |
| `rx.empty.body` | أول ما الدكتور يكتبلك روشتة هتلاقيها هنا، وهيوصلك إشعار. | As soon as a doctor writes you one, it'll appear here and you'll be notified. | |
| `rx.offlineCached` | دي آخر نسخة اتحفظت على موبايلك. | This is the last copy saved on your phone. | E-NET-05 |
| `rx.offlineNoQr` | مفيش نت، فمش هنقدر نعمل كود. قول للصيدلي رقم الروشتة والكود اللي تحت. | No connection, so we can't make a QR. Give the pharmacist the prescription number and code below. | E-NET-05 |
| `pickup.title` | كود الصيدلية | Pharmacy code | |
| `pickup.instruction` | ورّي الكود ده للصيدلي | Show this code to the pharmacist | |
| `pickup.countdown` | الكود صالح {time} | Code valid for {time} | mm:ss |
| `pickup.expired` | الكود خلص | The code expired | |
| `pickup.new` | اعمل كود جديد | Create a new code | |
| `pickup.noPhone` | مش معاك موبايل؟ قول للصيدلي الكود ده: | No phone? Tell the pharmacist this code: | Followed by `K7Q-2MX` |
| `pickup.screenshotBlocked` | مش مسموح بسكرين شوت للكود ده عشان أمانك. | Screenshots are blocked for this code to keep you safe. | FLAG_SECURE (E-RX-09) |
| `pickup.proxy` | حد هيستلم بدالك؟ ابعتله الكود من هنا. | Someone collecting for you? Send them the code here. | E-RX-09 proxy, audited |
| `dose.morning` | الصبح | Morning | Chip |
| `dose.noon` | الضهر | Noon | |
| `dose.evening` | بالليل | Evening | |
| `dose.bedtime` | قبل النوم | Bedtime | |
| `dose.afterFood` | بعد الأكل | After food | Only if instructions say so |
| `dose.beforeFood` | قبل الأكل | Before food | |
| `dose.withFood` | مع الأكل | With food | |
| `dose.frequency.once_daily` | مرة في اليوم | Once a day | |
| `dose.frequency.twice_daily` | مرتين في اليوم (كل ١٢ ساعة) | Twice a day (every 12 h) | |
| `dose.frequency.three_times_daily` | ٣ مرات في اليوم (كل ٨ ساعات) | 3 times a day (every 8 h) | |
| `dose.frequency.four_times_daily` | ٤ مرات في اليوم (كل ٦ ساعات) | 4 times a day (every 6 h) | |
| `dose.frequency.every_x_hours` | كل {hours} ساعات | Every {hours} hours | |
| `dose.frequency.at_bedtime` | قبل النوم | At bedtime | |
| `dose.frequency.as_needed` | وقت اللزوم | As needed | ⚕ |
| `dose.frequency.once` | مرة واحدة بس | One time only | |
| `dose.frequency.weekly` | مرة في الأسبوع | Once a week | |
| `dose.setTimes` | حدد مواعيد التذكير | Set reminder times | UI-02 §6.3.2 safety rule |
| `dose.userTimes` | المواعيد دي انت اللي حددتها | You set these times | ⚕ |
| `dose.taken` | خدت الجرعة | I took this dose | Gender: «خدت» works for both in Egyptian speech |
| `dose.takenToast` | تمام! اتسجلت. | Done! Logged. | Undo 5 s |
| `dose.missed` | الجرعة دي فاتت | Missed dose | |
| `dose.missedHelp` | لو نسيت جرعة، اسأل الصيدلي أو الدكتور تعمل إيه — متاخدش جرعتين مع بعض من غير ما تسأل. | If you missed a dose, ask your pharmacist or doctor. Don't double up without asking. | ⚕ |
| `dose.reminder.notification` | فاكر جرعة الساعة {time}؟ افتح التطبيق تشوف التفاصيل. | Time for your {time} dose. Open the app for details. | **No drug name in the push** (no PHI, role-01) |

### 3.9 Critical info & allergies (US-04)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `critical.title` | معلوماتي المهمة | My critical info | |
| `critical.intro` | دي المعلومات اللي المسعف والدكتور بيشوفوها الأول. خلّيها مظبوطة. | Paramedics and doctors see this first. Keep it accurate. | |
| `critical.source.clinician` | متأكد منها الدكتور | Confirmed by a clinician | |
| `critical.source.self` | انت اللي كاتبها | Self-reported | |
| `critical.blood.lockedByDoctor` | فصيلة الدم دي أكدها دكتور. لو فيها غلط، كلّم دكتورك. | A doctor confirmed this blood type. If it's wrong, contact your doctor. | US-04-AC3 |
| `critical.allergy.add` | ضيف حساسية | Add an allergy | |
| `critical.allergy.searchHint` | اكتب اسم الدوا أو المادة… (زي بنسلين) | Type a medicine or substance… (e.g. penicillin) | |
| `critical.allergy.notFound` | مش لاقيها؟ اكتبها زي ما هي وهنحفظها. | Can't find it? Type it as is and we'll save it. | US-04-AC5 |
| `critical.allergy.uncodedNote` | هنحفظها نص، والدكتور هيشوفها كتنبيه يراجعه بنفسه. | We'll save it as text. Doctors will see it as a note to review. | ⚕ |
| `critical.allergy.severity` | الحساسية بتعمل إيه معاك؟ | What happens when you're exposed? | |
| `critical.allergy.sev.mild` | حاجة بسيطة (هرش أو طفح خفيف) | Mild (itching or light rash) | ⚕ |
| `critical.allergy.sev.moderate` | متوسطة (طفح منتشر أو ورم بسيط) | Moderate (widespread rash or mild swelling) | ⚕ |
| `critical.allergy.sev.severe` | شديدة (ورم في الوش أو صعوبة في البلع) | Severe (facial swelling or trouble swallowing) | ⚕ |
| `critical.allergy.sev.anaphylaxis` | خطيرة جداً — ضيق نفس أو إغماء (حساسية مفرطة) | Life-threatening — breathing trouble or fainting (anaphylaxis) | ⚕ |
| `critical.allergy.addedNote` | اتضافت. أي دكتور هيكتبلك دوا هيتنبّه لها فوراً. | Added. Any doctor prescribing for you will be alerted immediately. | US-04-AC4 |
| `critical.conditions.title` | الأمراض المزمنة | Chronic conditions | |
| `critical.meds.title` | الأدوية اللي بتاخدها دلوقتي | Medicines you take now | |
| `critical.verifyWarning.staff` | انت اللي كاتبها — اتأكد منها قبل نقل الدم | Self-reported — verify before transfusion | ⚕ Staff-facing, US-04-AC2 |

### 3.10 Emergency contacts (US-05)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `contacts.title` | جهات الطوارئ | Emergency contacts | |
| `contacts.intro` | الناس اللي المسعف يكلّمهم لو حصلك حاجة. رتّبهم بالأهمية. | People a paramedic can call if something happens. Order them by priority. | |
| `contacts.add` | ضيف شخص | Add a contact | |
| `contacts.name` | الاسم | Name | |
| `contacts.relationship` | صلة القرابة | Relationship | |
| `contacts.rel.father` | الأب | Father | |
| `contacts.rel.mother` | الأم | Mother | |
| `contacts.rel.spouse` | الزوج/الزوجة | Spouse | |
| `contacts.rel.sibling` | أخ/أخت | Sibling | |
| `contacts.rel.child` | ابن/بنت | Child | |
| `contacts.rel.friend` | صاحب/صاحبة | Friend | |
| `contacts.rel.other` | حد تاني | Other | |
| `contacts.phone` | رقم الموبايل | Mobile number | |
| `contacts.phoneHint` | زي 01012345678 | e.g. 01012345678 | Normalised to +20 (US-05-AC6) |
| `contacts.share` | المسعف يقدر يشوفه | Paramedics can see this contact | |
| `contacts.shareHelp` | لو قفلتها، المسعف مش هيشوف الشخص ده خالص. | If off, paramedics won't see this person at all. | US-05-AC3 |
| `contacts.priority` | الأولوية {n} | Priority {n} | |
| `contacts.reorderHint` | اسحب عشان ترتّب | Drag to reorder | Also up/down buttons for a11y |
| `contacts.max` | أقصى حاجة ٥ أشخاص. امسح حد عشان تضيف غيره. | Maximum 5 contacts. Remove one to add another. | US-05-AC2 |
| `contacts.globalOff` | مشاركة جهات الطوارئ مقفولة. المسعف مش هيشوف أي حد. | Contact sharing is off. Paramedics won't see anyone. | E-PRIV-02 |
| `contacts.turnOnSharing` | افتح المشاركة | Turn sharing on | |
| `contacts.saved` | اتحفظ — وكارت الطوارئ اتحدّث. | Saved — your emergency card was updated. | US-05-AC5 |
| `contacts.empty.title` | لسه مضفتش حد | No contacts yet | |
| `contacts.empty.body` | ضيف حد من أهلك عشان المسعف يقدر يطمّنهم عليك. | Add a family member so a paramedic can reach them. | |

### 3.11 Sharing, access log & break-glass transparency (US-09, US-20, EXT-06)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `access.title` | مين شايف ملفك | Who can see your record | |
| `access.generateCode` | اعمل كود للدكتور | Create a code for your doctor | |
| `access.codeTitle` | قول الكود ده للدكتور | Read this code to your doctor | 6 digits, `code-lg` |
| `access.codeValid` | صالح {time} — ومرة واحدة بس | Valid for {time}, one use only | |
| `access.duration` | الدكتور هيقدر يشوف ملفك لمدة {days} يوم | The doctor can view your record for {days} days | Default 30 |
| `access.active` | شغّال لحد {date} | Active until {date} | |
| `access.revoke` | الغي الإذن | Revoke access | |
| `access.revokeConfirm` | د. {doctor} مش هيقدر يفتح ملفك تاني. اللي كتبه قبل كده هيفضل في ملفك. | Dr {doctor} won't be able to open your record again. What they wrote stays in your record. | E-PRIV-03 |
| `access.revoked` | الإذن اتلغى. | Access revoked. | |
| `access.history` | سجل الاطلاع | Access history | EXT-06 |
| `access.historyRow` | {role} {name} — {facility} — {action} — {time} | {role} {name} — {facility} — {action} — {time} | |
| `access.action.read` | فتح ملفك | Viewed your record | |
| `access.action.write` | ضاف/عدّل في ملفك | Added to your record | |
| `access.action.emergency` | دخول طوارئ | Emergency access | |
| `access.empty` | محدش فتح ملفك لحد دلوقتي. | Nobody has opened your record yet. | |
| `access.restrictedCount` | سجل واحد مخفي (انت اللي خفيته) | 1 hidden record (hidden by you) | Patient-side variant of role-07 `privacy.restricted` |
| `breakGlass.notification` | ملفك اتفتح في طوارئ بواسطة {service} الساعة {time}. افتح التطبيق للتفاصيل. | Your emergency profile was accessed by {service} at {time}. Open the app for details. | ⚖ US-17-AC4. Push: service name + time only |
| `breakGlass.detail.title` | دخول طوارئ على ملفك | Emergency access to your record | |
| `breakGlass.detail.body` | مسعف من {service} شاف معلومات الطوارئ بس (فصيلة الدم، الحساسية، الأمراض المزمنة، الأدوية) يوم {date} الساعة {time}. | A paramedic from {service} viewed only your emergency information on {date} at {time}. | ⚖ |
| `breakGlass.detail.method.face` | بطريقة: بصمة الوش | Method: face | |
| `breakGlass.detail.method.emergency_card_qr` | بطريقة: كارت الطوارئ | Method: emergency card | |
| `breakGlass.detail.method.manual_search` | بطريقة: الرقم القومي | Method: national ID | |
| `breakGlass.detail.reviewed` | الدخول ده بيتراجع من إدارة النظام. | This access is reviewed by the system administrators. | |
| `breakGlass.detail.notMe` | مكنتش في طوارئ؟ بلّغنا | Wasn't an emergency? Report it | Opens support form; audited |

### 3.12 AI Medical Assistant (US-13…US-15, E-AI-*)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `assistant.title` | المساعد الطبي | Medical assistant | |
| `assistant.disclaimer` | المساعد بيوجّهك للتخصص المناسب، ومش بديل عن الدكتور ومش بيشخّص. في الطوارئ اتصل بالإسعاف ١٢٣. | The assistant guides you to the right specialty. It doesn't replace a doctor or diagnose. In an emergency call 123. | ⚕ ⚖ Keeps role-07 key; **always visible, not dismissible** |
| `assistant.consent.title` | قبل ما نبدأ | Before we start | |
| `assistant.consent.body` | المساعد بيسمع منك الأعراض ويقولك تروح لأنهي تخصص وإمتى. مش بيشخّص، ومش بيكتب أدوية، ومحادثتك بتتحفظ متشفّرة ٩٠ يوم وبعدها بتتمسح. | The assistant listens to your symptoms and tells you which specialty to see and when. It doesn't diagnose or prescribe. Chats are stored encrypted for 90 days, then deleted. | ⚖ US-13-AC5 |
| `assistant.consent.agree` | موافق، يلا نبدأ | I agree, let's start | |
| `assistant.greeting` | أهلاً يا {firstName}. احكيلي حاسس بإيه، وأنا أساعدك تعرف تروح لمين. | Hi {firstName}. Tell me how you feel and I'll help you find the right doctor. | `select` on gender: «حاسة» |
| `assistant.inputHint` | اكتب الأعراض… (من غير أسماء أو أرقام قومية) | Describe your symptoms… (no names or ID numbers) | E-AI-06 |
| `assistant.send` | ابعت | Send | |
| `assistant.state.listening` | سامعك… | Listening… | Orb label |
| `assistant.state.thinking` | بفكّر… | Thinking… | |
| `assistant.state.guidance` | دي إرشادات عامة | General guidance | |
| `assistant.state.idle` | أنا هنا لو محتاجني | I'm here if you need me | |
| `assistant.clarify.intro` | محتاج أفهم أكتر شوية: | I need a bit more detail: | US-14-AC3 |
| `assistant.chip.since` | من إمتى؟ | Since when? | Quick-reply chip groups |
| `assistant.chip.since.today` | من النهارده | Since today | |
| `assistant.chip.since.days` | من كام يوم | A few days | |
| `assistant.chip.since.week` | أكتر من أسبوع | Over a week | |
| `assistant.chip.since.month` | أكتر من شهر | Over a month | |
| `assistant.chip.severity` | شدته قد إيه؟ | How bad is it? | |
| `assistant.chip.severity.mild` | خفيف | Mild | |
| `assistant.chip.severity.moderate` | متوسط | Moderate | |
| `assistant.chip.severity.severe` | جامد جداً | Very bad | |
| `assistant.chip.where` | فين بالظبط؟ | Where exactly? | |
| `assistant.chip.where.head` | الراس | Head | |
| `assistant.chip.where.chest` | الصدر | Chest | Sending this alone doesn't trigger a red flag; the rules engine decides |
| `assistant.chip.where.belly` | البطن | Belly | |
| `assistant.chip.where.back` | الضهر | Back | |
| `assistant.chip.where.skin` | الجلد | Skin | |
| `assistant.chip.where.other` | حتة تانية | Somewhere else | |
| `assistant.chip.fever` | عندك سخونية؟ | Do you have a fever? | |
| `assistant.chip.fever.yes` | أيوه | Yes | |
| `assistant.chip.fever.no` | لأ | No | |
| `assistant.chip.fever.unsure` | مش عارف | Not sure | |
| `assistant.selfCare` | تقدر تعمل إيه في البيت | What you can do at home | Collapsible |
| `assistant.warningSigns` | روح الطوارئ فوراً لو حصل أي حاجة من دول: | Go to the ER immediately if any of these happen: | ⚕ |
| `assistant.specialty` | التخصص المناسب: {specialty} | Suggested specialty: {specialty} | US-14-AC1 |
| `assistant.specialtyWhy` | ليه؟ {reason} | Why? {reason} | One line |
| `assistant.findDoctor` | شوف دكاترة {specialty} | Find {specialty} doctors | P2 directory link |
| `triage.emergency` | طوارئ — اتصل بالإسعاف دلوقتي | Emergency — call now | ⚕ UI-01 §9.2 |
| `triage.urgent` | لازم تشوف دكتور خلال ٢٤ ساعة | See a doctor within 24 hours | ⚕ |
| `triage.soon` | احجز مع دكتور في أقرب وقت (خلال كام يوم) | Book a doctor soon (within a few days) | |
| `triage.routine` | ميعاد عادي مع دكتور | A routine visit | |
| `triage.self_care` | تقدر تتابع في البيت — وخلّي بالك من العلامات دي | You can manage at home — watch for these signs | |
| `emergency.takeover.title` | الأعراض دي محتاجة طوارئ فوراً | These symptoms need emergency care now | ⚕ US-15-AC1 |
| `emergency.takeover.body` | متستناش. اتصل بالإسعاف دلوقتي، أو خلّي حد ياخدك لأقرب طوارئ. | Don't wait. Call an ambulance now, or have someone take you to the nearest emergency department. | ⚕ |
| `emergency.callNow` | اتصل بالإسعاف ١٢٣ | Call ambulance 123 | Keeps role-07 key; `{phone}` from `EMERGENCY_PHONE_NUMBER` |
| `emergency.nearestEr` | أقرب طوارئ ليك | Nearest emergency department | Opens maps with the query only (no PHI in URL) |
| `emergency.notifyFamily` | ابعت لأهلك إنك رايح الطوارئ | Tell your family you're going to the ER | Opens SMS composer; never auto-sends (role-06) |
| `emergency.whileWaiting` | لحد ما الإسعاف يوصل: اقعد أو نام في وضع مريح، وماتسوقش بنفسك. | Until help arrives: sit or lie in a comfortable position. Don't drive yourself. | ⚕ Generic, reviewed |
| `emergency.closeLocked` | تقدر تقفل بعد {seconds} ثانية | You can close in {seconds}s | 5 s lock |
| `emergency.closeConfirm` | أنا كويس، ارجع للمحادثة | I'm OK, back to the chat | After lock; logged |
| `crisis.title` | إحنا معاك | We're with you | ⚕ E-AI-02, calm design |
| `crisis.body` | اللي انت حاسس بيه مهم، ومش لازم تعدّي بيه لوحدك. كلّم حد بتثق فيه دلوقتي، أو كلّم خط الدعم النفسي. | What you're feeling matters, and you don't have to go through it alone. Reach out to someone you trust now, or call a support line. | ⚕ Reviewed by a clinician; `select` on gender |
| `crisis.callLine` | كلّم خط الدعم النفسي {crisisLine} | Call the support line {crisisLine} | `{crisisLine}` comes from `ref.crisis_resources` (verified with the Ministry of Health before demo); **never hard-coded** |
| `crisis.callEmergency` | لو في خطر دلوقتي، اتصل بالإسعاف ١٢٣ | If you're in danger now, call 123 | |
| `crisis.trustedPerson` | ابعت لحد بتثق فيه | Message someone you trust | Opens contacts picker; no auto-send |
| `crisis.continue` | عايز أكمّل كلام | I want to keep talking | Generative output stays off unless the user continues (E-AI-02) |
| `assistant.unavailable` | المساعد مش متاح دلوقتي. لو تعبان جداً اتصل بالإسعاف ١٢٣ أو روح أقرب طوارئ. | The assistant is unavailable right now. If you feel very unwell, call 123 or go to the nearest ER. | ⚕ US-13-AC4 |
| `assistant.fallback.directory` | اختار التخصص بنفسك | Choose a specialty yourself | Manual specialty directory |
| `assistant.fallback.directoryHint` | مش متأكد؟ ابدأ بـ «باطنة عامة» وهو هيوجّهك. | Not sure? Start with general medicine — they'll refer you. | |
| `assistant.retry` | جرّب تبعت تاني | Try sending again | Same `client_message_id` |
| `assistant.offTopic` | أنا بساعد في الأسئلة الصحية بس. احكيلي عن أي أعراض حاسس بيها. | I can only help with health questions. Tell me about any symptoms. | E-AI-05 |
| `assistant.drugSeeking` | مقدرش أساعد في أدوية من غير روشتة. الصيدلي أو الدكتور هيقدروا يساعدوك صح. | I can't help with getting medicines without a prescription. A pharmacist or doctor can help you properly. | ⚕ E-AI-04 |
| `assistant.ownRecord` | معنديش اطلاع على ملفك الطبي. اسأل الصيدلي أو الدكتور عن الأدوية اللي بتاخدها. | I don't have access to your record. Ask your pharmacist or doctor about your medicines. | E-AI-08 |
| `assistant.closed` | المحادثة اتقفلت لمدة ساعة. | This chat is paused for one hour. | E-AI-05 |
| `assistant.delete` | امسح المحادثة | Delete this chat | |
| `assistant.deleteConfirm` | المحادثة هتتمسح نهائي. | The chat will be permanently deleted. | |
| `assistant.minor` | المساعد مش متاح للحسابات اللي أقل من ١٦ سنة. | The assistant isn't available for accounts under 16. | |

**Specialty labels** (patient-facing names for `ref.specialties`; codes must match the seed exactly. The codes below are the proposed seed values and should be confirmed by the AI/DB owners):

| Code | Arabic | English |
|------|--------|---------|
| `general_practice` | باطنة عامة / ممارس عام | General practice |
| `internal_medicine` | باطنة | Internal medicine |
| `cardiology` | قلب وأوعية دموية | Cardiology |
| `neurology` | مخ وأعصاب | Neurology |
| `dermatology` | جلدية | Dermatology |
| `pediatrics` | أطفال | Paediatrics |
| `obstetrics_gynecology` | نسا وتوليد | Obstetrics & gynaecology |
| `orthopedics` | عظام | Orthopaedics |
| `ent` | أنف وأذن وحنجرة | ENT |
| `ophthalmology` | رمد (عيون) | Ophthalmology |
| `psychiatry` | نفسية | Psychiatry |
| `urology` | مسالك بولية | Urology |
| `gastroenterology` | جهاز هضمي وكبد | Gastroenterology |
| `pulmonology` | صدرية | Pulmonology |
| `endocrinology` | غدد صماء وسكر | Endocrinology |
| `nephrology` | كلى | Nephrology |
| `dentistry` | أسنان | Dentistry |
| `emergency_medicine` | طوارئ | Emergency medicine |

### 3.13 Doctor workspace (US-06…US-09, EXT-01, EXT-02)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `doctor.dashboard.greeting` | صباح الخير يا د. {lastName} | Good morning, Dr {lastName} | Time-based like `home.greeting.*` |
| `doctor.kpi.activeGrants` | ملفات مفتوحة ليك | Active patient grants | |
| `doctor.kpi.issuedToday` | روشتات النهارده | Prescriptions today | |
| `doctor.kpi.overridesWeek` | تجاوزات التنبيهات الأسبوع ده | Alert overrides this week | |
| `doctor.recent` | آخر مرضى فتحتهم | Recently opened patients | |
| `doctor.expiring` | أذونات قربت تخلص | Grants expiring soon | |
| `doctor.expiringHint` | اطلب من المريض كود جديد لو محتاج تكمّل متابعة. | Ask the patient for a new code if you need ongoing access. | |
| `doctor.empty.title` | لسه مفيش مرضى | No patients yet | |
| `doctor.empty.body` | اطلب من المريض كود المشاركة (٦ أرقام) من تطبيقه. | Ask the patient for the 6-digit share code from their app. | |
| `doctor.search.placeholder` | رقم الملف الطبي أو الرقم القومي… | MRN or national ID… | Min 4 chars; only granted patients |
| `doctor.search.noResults` | مفيش مريض بالرقم ده عندك إذن تشوفه. | No patient you have access to matches this number. | US-09-AC4; doesn't reveal existence |
| `redeem.title` | افتح ملف مريض بكود | Open a patient record with a code | |
| `redeem.mrn` | رقم الملف الطبي | MRN | |
| `redeem.code` | كود المشاركة (٦ أرقام) | Share code (6 digits) | |
| `redeem.submit` | افتح الملف | Open record | |
| `redeem.invalid` | الكود أو رقم الملف مش مظبوط، أو الكود خلص. اطلب كود جديد من المريض. | The code or MRN is incorrect, or the code expired. Ask for a new code. | E-PRIV-04 |
| `redeem.rateLimited` | محاولات كتير. استنى {minutes} دقيقة. | Too many attempts. Wait {minutes} min. | |
| `patientHeader.grantUntil` | الإذن لحد {date} | Access until {date} | |
| `patientHeader.anaphylaxis` | حساسية مفرطة: {allergen} | ANAPHYLAXIS: {allergen} | ⚕ First chip |
| `patientHeader.bloodSelf` | {blood} (من كلام المريض ⚠) | {blood} (self-reported ⚠) | ⚕ |
| `patientHeader.meds` | أدوية حالية ({count}) | Current meds ({count}) | |
| `patientHeader.endVisit` | قفل الزيارة | End visit | |
| `privacy.restricted` | `{count, plural, one {سجل واحد مقيّد (المريض خفاه)} two {سجلين مقيّدين} few {{count} سجلات مقيّدة} other {{count} سجل مقيّد}}` | `{count, plural, one {1 restricted record (hidden by the patient)} other {{count} restricted records}}` | Keeps role-07 key |
| `encounter.chiefComplaint` | الشكوى الرئيسية | Chief complaint | |
| `encounter.notesInternal` | ملاحظات للأطباء بس 👁‍🗨 | Clinician-only notes | Eye-slash icon (not emoji in UI) |
| `encounter.notesPatient` | ملخص للمريض (هيشوفه) | Patient summary (visible to patient) | |
| `encounter.diagnoses` | التشخيصات (ICD-10) | Diagnoses (ICD-10) | |
| `encounter.primary` | تشخيص أساسي | Primary diagnosis | |
| `encounter.onePrimary` | مسموح بتشخيص أساسي واحد بس في الزيارة. | Only one primary diagnosis per visit. | US-07-AC2 |
| `encounter.addToProblemList` | ضيفه لقايمة الأمراض المزمنة | Add to problem list | US-07-AC4 |
| `encounter.locked` | عدّى ٢٤ ساعة — تقدر تضيف ملحق بس. | 24 h have passed — you can only add an addendum. | US-06-AC3 |
| `encounter.addAddendum` | ضيف ملحق | Add addendum | |
| `encounter.conflict` | الملف اتعدّل من مكان تاني. شوف الفرق وأعد تعديلك. | This record changed elsewhere. Review the differences and reapply. | E-REC-03 |
| `encounter.enteredInError` | اتسجل بالغلط | Entered in error | E-REC-02 |
| `rxb.title` | روشتة جديدة | New prescription | |
| `rxb.addDrug` | ضيف دوا | Add medicine | |
| `rxb.drugSearch` | دوّر باسم الدوا التجاري أو العلمي… | Search brand or generic name… | |
| `rxb.controlled` | جدول (مراقب) | Controlled | |
| `rxb.notInCatalog` | الدوا مش موجود؟ اطلب إضافته | Medicine not listed? Request it | E-CLIN-06 |
| `rxb.dose` | الجرعة | Dose | |
| `rxb.route` | طريقة الاستخدام | Route | |
| `rxb.frequency` | عدد المرات | Frequency | |
| `rxb.duration` | المدة (أيام) | Duration (days) | |
| `rxb.quantity` | الكمية | Quantity | |
| `rxb.quantitySuggested` | مقترح: {quantity} {unit} | Suggested: {quantity} {unit} | |
| `rxb.instructions` | تعليمات للمريض | Patient instructions | |
| `rxb.substitution` | مسموح بالبديل | Substitution allowed | |
| `rxb.substitutionControlled` | الأدوية المراقبة مفيهاش بديل. | Controlled medicines can't be substituted. | US-08-AC7 |
| `rxb.checking` | بنراجع التعارضات… | Checking interactions… | |
| `rxb.alerts.title` | تنبيهات السلامة | Safety alerts | |
| `rxb.alerts.none` | مفيش تعارضات معروفة. | No known conflicts. | ⚕ Never «آمن تماماً» |
| `rxb.alerts.minorGroup` | `{count, plural, one {ملاحظة بسيطة} two {ملاحظتين بسيطة} few {{count} ملاحظات بسيطة} other {{count} ملاحظة بسيطة}}` | `{count, plural, one {1 minor note} other {{count} minor notes}}` | E-CLIN-08 |
| `rxb.alerts.previouslyReviewed` | اتراجع قبل كده: د. {doctor} — {date} | Previously reviewed by Dr {doctor} on {date} | |
| `rxb.alerts.source` | المصدر: {source} | Source: {source} | e.g. DDInter 2.0 |
| `rxb.alerts.restrictedMed` | دوا شغّال من سجل مقيّد | an active medication from a restricted record | E-PRIV-07 |
| `alert.severity.contraindicated` | ممنوع | Contraindicated | ⚕ |
| `alert.severity.major` | خطير | Major | ⚕ |
| `alert.severity.moderate` | متوسط | Moderate | ⚕ |
| `alert.severity.minor` | بسيط | Minor | ⚕ |
| `alert.drugAllergy.title` | ممنوع — حساسية {severity} من {allergen} | Contraindicated — {severity} allergy to {allergen} | ⚕ |
| `alert.drugAllergy.body` | ‎<bdi>{drug}</bdi>‎ فيه ‎<bdi>{ingredient}</bdi>‎ من نفس العيلة. المريض عنده حساسية مفرطة (Anaphylaxis) متسجلة. | {drug} contains {ingredient} from the same class. The patient has recorded anaphylaxis. | ⚕ |
| `alert.crossReactivity.title` | متوسط — احتمال حساسية متقاطعة | Moderate — possible cross-reactivity | ⚕ EXT-02-AC2 |
| `alert.drugDrug.title` | {severity} — تعارض بين ‎<bdi>{drugA}</bdi>‎ و‎<bdi>{drugB}</bdi>‎ | {severity} — {drugA} + {drugB} interaction | ⚕ |
| `alert.drugDrug.mechanism` | التأثير: {mechanism} | Effect: {mechanism} | e.g. «زيادة خطر النزيف» |
| `alert.drugDrug.management` | المقترح: {management} | Suggested: {management} | |
| `alert.duplicate.title` | متوسط — تكرار علاج من نفس المجموعة | Moderate — duplicate therapy | ⚕ EXT-01-AC3 |
| `alert.drugCondition.title` | {severity} — مش مناسب مع {condition} | {severity} — caution with {condition} | ⚕ |
| `alert.uncodedAllergy` | فيه حساسية مكتوبة نص: «{text}» — راجعها بنفسك. | Uncoded allergy on file: "{text}" — review manually. | ⚕ EXT-02-AC4 |
| `alert.documentOverride` | وثّق سبب التجاوز | Document override | |
| `rx.overrideRequired` | `{n, plural, one {فيه تنبيه محتاج سبب موثّق قبل الإصدار} two {فيه تنبيهين محتاجين سبب موثّق قبل الإصدار} few {فيه {n} تنبيهات محتاجة سبب موثّق قبل الإصدار} other {فيه {n} تنبيه محتاج سبب موثّق قبل الإصدار}}` | `{n, plural, one {1 alert needs a documented reason before issuing} other {{n} alerts need a documented reason before issuing}}` | ⚕ Keeps role-07 key; shown under the disabled button |
| `rx.checkUnavailable` | فحص السلامة الآلي مش شغّال دلوقتي — راجع التعارضات بنفسك. | Automated safety check unavailable — review manually. | ⚕ Keeps role-07 key |
| `rx.manualReviewAttest` | أنا راجعت التعارضات والحساسية بنفسي | I have manually reviewed interactions and allergies | ⚕ EXT-01-AC4 |
| `rx.checkPartial` | الأدوية دي مش متكوّدة ومش هتتفحص آلياً: {drugs} | These medicines couldn't be checked automatically: {drugs} | |
| `override.title` | توثيق تجاوز التنبيه | Document alert override | ⚕ |
| `override.alertSummary` | التنبيه: {alert} | Alert: {alert} | |
| `override.reason` | السبب | Reason | |
| `override.reason.benefit_outweighs_risk` | الفايدة أكبر من الخطر | Benefit outweighs risk | ⚕ |
| `override.reason.allergy_disputed` | الحساسية مش مؤكدة / متنازع عليها | Allergy disputed | ⚕ |
| `override.reason.desensitisation_protocol` | بروتوكول إزالة حساسية (Desensitisation) | Desensitisation protocol | ⚕ |
| `override.reason.monitored_setting` | تحت ملاحظة طبية (مستشفى/عيادة) | Monitored setting | ⚕ |
| `override.reason.other` | سبب تاني | Other | |
| `override.justification` | اشرح السبب (١٥ حرف على الأقل) | Explain your reason (at least 15 characters) | E-CLIN-02 |
| `override.justificationTooShort` | محتاجين شرح أوضح — ٣ كلمات على الأقل. | Please add more detail — at least 3 words. | |
| `override.counter` | {count}/١٥ | {count}/15 | |
| `override.responsibility` | أنا متحمّل المسؤولية الطبية عن القرار ده | I take clinical responsibility for this decision | ⚕ ⚖ |
| `override.contraindicatedReauth` | التنبيه ده «ممنوع». هنطلب كود تطبيق المصادقة عشان نأكد القرار. | This alert is contraindicated. We'll ask for your authenticator code to confirm. | Pending Security Lead decision (UI-01 §9.1) |
| `override.save` | احفظ التوثيق | Save override | |
| `signIssue.button` | وقّع وابعت الروشتة | Sign & issue | |
| `signIssue.preview` | معاينة | Preview | |
| `signIssue.summary` | `{items, plural, one {دوا واحد} two {دوايين} few {{items} أدوية} other {{items} دوا}}` · {alertsText} | {items} items · {alertsText} | |
| `signIssue.serverNewAlert` | ظهر تنبيه جديد (غالباً المريض ضاف حساسية دلوقتي). راجعه قبل الإصدار. | A new alert appeared (the patient may have just added an allergy). Review it before issuing. | E-CLIN-03 |
| `issued.title` | الروشتة اتبعتت | Prescription issued | |
| `issued.number` | رقم الروشتة: {rx} | Prescription no.: {rx} | |
| `issued.paperCode` | كود الورقة (بيظهر مرة واحدة بس) | Paper verification code (shown once) | |
| `issued.paperCodeHint` | اطبعه للمريض لو معندوش موبايل. | Print it for patients without a phone. | E-RX-10 |
| `issued.print` | اطبع للمريض | Print for patient | |
| `rx.cancel.title` | تلغي الروشتة؟ | Cancel this prescription? | |
| `rx.cancel.reason` | سبب الإلغاء | Cancellation reason | Values = `rx.cancelledReason.*` staff variants below |
| `rx.cancel.reason.prescribing_error` | خطأ في الكتابة | Prescribing error | |
| `rx.cancel.reason.patient_request` | بناءً على طلب المريض | Patient request | |
| `rx.cancel.reason.therapy_changed` | تغيير العلاج | Therapy changed | |
| `rx.cancel.reason.adverse_reaction` | أعراض جانبية | Adverse reaction | |
| `rx.cancel.reason.other` | سبب تاني | Other | |
| `rx.cancel.remainingOnly` | جزء منها اتصرف — الإلغاء هيكون على الباقي بس. | Part was dispensed — only the remaining items will be cancelled. | E-RX-08 |
| `rx.cancel.done` | الروشتة اتلغت والمريض اتبلّغ. | Prescription cancelled; the patient was notified. | |
| `draft.restore` | فيه روشتة ماكملتهاش. ترجّعها؟ | You have an unsaved prescription draft. Restore it? | E-NET-06 |
| `draft.restoreYes` | رجّعها | Restore | |
| `draft.discard` | ابدأ من الأول | Start over | |
| `grant.revokedRedirect` | المريض لغى إذن الاطلاع. رجّعناك لصفحة البحث. | The patient revoked access. You've been returned to search. | US-20-AC3 |

### 3.14 Pharmacist (US-10…US-12)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `pharmacy.selectFacility` | انت شغّال في أنهي صيدلية النهارده؟ | Which pharmacy are you working at today? | |
| `verify.title` | تحقق من روشتة | Verify a prescription | |
| `verify.tab.scan` | امسح الكود | Scan QR | |
| `verify.tab.manual` | رقم الروشتة + الكود | Rx number + code | |
| `verify.scanHint` | خلّي كود المريض جوه المربع | Fit the patient's code inside the frame | |
| `verify.torch` | الكشاف | Flashlight | |
| `verify.cameraDenied` | محتاجين الكاميرا عشان نمسح الكود — أو اكتب رقم الروشتة يدوي. | We need the camera to scan — or enter the Rx number manually. | |
| `verify.manual.rx` | رقم الروشتة | Prescription number | Mask `RX-____-______` |
| `verify.manual.code` | كود الورقة (٦ حروف) | Paper code (6 characters) | |
| `presence.title` | اتأكد إن المريض موجود | Confirm the patient is present | US-10-AC4 |
| `presence.sms` | ابعت كود SMS لموبايل المريض ({maskedPhone}) | Send an SMS code to the patient's phone ({maskedPhone}) | |
| `presence.face` | تحقق بوش المريض | Verify patient's face | Staff device |
| `presence.none` | من غير موبايل ولا بصمة وش متسجلة، مينفعش نصرف. | Without a phone or registered face, dispensing isn't possible. | E-RX-10 |
| `rx.verify.checking` | بنتأكد من الروشتة… | Checking the prescription… | Seal `verifying` |
| `rx.verify.valid` | روشتة سليمة وموثّقة | Authentic prescription | |
| `rx.verify.validOffline` | الروشتة سليمة — بس الصرف محتاج نت | Authentic — dispensing needs a connection | E-NET-03 |
| `rx.doNotDispense` | الروشتة دي مش سليمة — ماتصرفهاش | FAILED AUTHENTICITY CHECK — Do NOT dispense | ⚕ Keeps role-07 key |
| `rx.doNotDispenseBody` | التوقيع الإلكتروني مش مطابق. ممكن تكون متزوّرة أو اتعدّلت. | The digital signature doesn't match. It may be forged or altered. | |
| `rx.report` | بلّغ عن الروشتة | Report this prescription | |
| `rx.alreadyDispensed` | اتصرفت بالكامل يوم {date} في {pharmacy} | Already dispensed on {date} at {pharmacy} | Keeps role-07 key |
| `rx.verify.expired` | الروشتة انتهت صلاحيتها يوم {date} | This prescription expired on {date} | |
| `rx.verify.cancelled` | الدكتور لغى الروشتة دي | The doctor cancelled this prescription | |
| `rx.verify.prescriberInvalid` | ترخيص الدكتور مش ساري — كلّم دكتور المريض. | The prescriber's licence is not valid — contact the patient's doctor. | US-10-AC3 |
| `rx.verify.prescriberSuspendedInfo` | الروشتة اتكتبت قبل إيقاف ترخيص الدكتور، وتقدر تتصرف. | Issued before the prescriber's suspension; it can still be dispensed. | E-LIC-02 |
| `rx.verify.overrideNote` | الدكتور وثّق تجاوز تنبيه: {alert} | Prescriber documented an override: {alert} | EXT-02-AC3 |
| `rx.verify.checkBypassed` | فحص السلامة الآلي كان واقف وقت الكتابة. | Automated safety check was unavailable at prescribing. | E-CLIN-04 |
| `rx.verify.prescriber` | الدكتور: {name} · ترخيص {license} · {facility} | Prescriber: {name} · licence {license} · {facility} | |
| `rx.verify.patient` | المريض: {name} · {age} سنة · {sex} | Patient: {name} · {age} y · {sex} | Minimum necessary |
| `rx.verify.allergies` | حساسية المريض | Patient allergies | |
| `rx.continueDispense` | كمّل للصرف | Continue to dispense | |
| `dispense.context` | صلاحية التحقق: فاضل {time} | Verification valid: {time} left | 15 min |
| `dispense.contextExpired` | وقت التحقق خلص — امسح الروشتة تاني. | Verification expired — scan again. | |
| `dispense.lease.held` | الروشتة دي بتتجهّز في صيدلية تانية دلوقتي. | This prescription is being prepared at another pharmacy. | US-12-AC6 |
| `dispense.lease.proceed` | كمّل برضه | Proceed anyway | Confirm dialog |
| `dispense.col.drug` | الدوا | Medicine | |
| `dispense.col.prescribed` | المكتوب | Prescribed | |
| `dispense.col.dispensed` | اتصرف قبل كده | Already dispensed | |
| `dispense.col.remaining` | الباقي | Remaining | |
| `dispense.col.now` | هتصرف دلوقتي | Dispense now | |
| `dispense.col.substitute` | بديل | Substitute | |
| `dispense.col.batch` | رقم التشغيلة | Batch no. | |
| `dispense.col.expiry` | تاريخ الصلاحية | Expiry | |
| `dispense.itemDispense` | اتصرف | Dispensed | Brief: item checkbox state |
| `dispense.itemRemaining` | لسه متبقّي | Still remaining | Brief: item checkbox state |
| `dispense.notAvailable` | مش متوفر عندي | Not in stock | Sets row to 0 |
| `dispense.partialNote` | `{count, plural, one {فيه دوا هيفضل متبقّي} two {فيه دوايين هيفضلوا متبقّيين} few {فيه {count} أدوية هتفضل متبقّية} other {فيه {count} دوا هيفضل متبقّي}}` — المريض يقدر يصرفهم من أي صيدلية لحد {date}. | `{count}` item(s) will remain — the patient can collect them anywhere until {date}. | E-RX-01 |
| `dispense.substitute.title` | اختار بديل بنفس المادة والتركيز | Choose an equivalent (same ingredient and strength) | E-RX-11 |
| `dispense.substitute.invalid` | البديل لازم يكون نفس المادة الفعالة والتركيز. | The substitute must have the same active ingredient and strength. | |
| `dispense.counselling` | شرحت للمريض طريقة الاستخدام | Counselling given | |
| `dispense.notes` | ملاحظات (اختياري) | Notes (optional) | |
| `dispense.submit` | اصرف | Dispense | |
| `dispense.submitPartial` | اصرف {count} من {total} | Dispense {count} of {total} | |
| `dispense.confirming` | بنأكد الصرف… متقفلش الشاشة. | Confirming… don't close this screen. | E-NET-04 |
| `dispense.success` | اتصرفت ✓ | Dispensed ✓ | |
| `dispense.successFull` | الروشتة اتصرفت بالكامل. | Prescription fully dispensed. | |
| `dispense.successPartial` | اتصرف جزء. الباقي يتصرف من أي صيدلية لحد {date}. | Partially dispensed. The rest can be collected anywhere until {date}. | |
| `dispense.race` | صيدلية تانية صرفت جزء دلوقتي — حدّثنا الكميات. راجعها وكمّل. | Another pharmacy just dispensed part of this — quantities updated. Review and continue. | E-RX-02 |
| `dispense.offlineDisabled` | الصرف محتاج نت عشان مايحصلش صرف مرتين. | Dispensing needs a connection to prevent double dispensing. | SD-06 |
| `pharmacy.offline` | مفيش نت: تقدر تتأكد إن الروشتة سليمة، بس مينفعش تصرف. | Offline: you can check authenticity but cannot dispense. | Keeps role-07 key |
| `dispense.controlledRule` | الدوا ده مراقب: الصرف الجزئي مرة واحدة بس، في نفس الصيدلية، خلال ٧٢ ساعة. | Controlled medicine: one partial pickup only, same pharmacy, within 72 h. | E-RX-13 |

### 3.15 Paramedic & ER (US-16…US-18, EXT-04)

All paramedic copy is **short and imperative** (§2).

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `er.shift.title` | بداية الوردية | Shift start | |
| `er.shift.location` | اسمح بالموقع (اختياري) | Allow location (optional) | Asked at shift start only |
| `er.shift.locationWhy` | بيساعد في مراجعة دخول الطوارئ. مش هنطلبه وقت الحالة. | Helps review emergency access. We won't ask during a case. | |
| `er.shift.defaultReason` | السبب الافتراضي | Default reason | |
| `er.reason.unconscious` | فاقد الوعي | Unconscious | `reason_code` values (03 §9.1) |
| `er.reason.unable_to_communicate` | مش قادر يتكلم | Unable to communicate | |
| `er.reason.altered_mental_status` | مش في وعيه الكامل | Altered mental status | |
| `er.reason.language_barrier` | مشكلة لغة | Language barrier | |
| `er.reason.other` | سبب تاني | Other | |
| `er.incidentRef` | رقم البلاغ (اختياري) | Incident ref (optional) | |
| `er.scan.title` | مسح طوارئ | Emergency scan | |
| `er.scan.live` | مباشر | LIVE | |
| `er.scan.capture` | صوّر | Capture | Manual shutter |
| `er.scan.card` | امسح كارت الطوارئ | Scan emergency card | Always visible |
| `er.scan.nationalId` | دوّر بالرقم القومي | Search national ID | Always visible |
| `er.scan.identifying` | بنتعرّف… | Identifying… | |
| `scan.*` | (see §3.5b) | | Emergency variants: `scan.hint.placeFace.emergency`, `scan.hint.obstruction.emergency`, `scan.hint.oneFace.emergency` |
| `er.result.match` | اتعرّفنا عليه | Patient identified | `select` on sex: «عليها» |
| `er.possible.title` | فيه تطابق محتمل — أكّد | Possible match — confirm | |
| `er.possible.body` | اختار المريض لو متأكد. مش متأكد؟ استخدم كارت الطوارئ أو الرقم القومي. | Choose only if sure. Not sure? Use the emergency card or national ID. | ⚕ E-BIO-03 |
| `er.possible.candidate` | {sex} · {ageBand} سنة | {sex} · age {ageBand} | |
| `er.possible.confirm` | ده المريض | This is the patient | |
| `er.possible.none` | مش حد فيهم | None of these | |
| `er.lowConfidence` | تعرّف ضعيف — اتأكد من الهوية أول ما تقدر | Low-confidence identification — verify identity when possible | ⚕ Keeps role-07 key; persistent yellow banner |
| `er.noMatch.title` | مش متسجل عندنا | No registered match | ⚕ Keeps role-07 key |
| `er.noMatch.body` | اعتبر تاريخه الطبي مش معروف. | Treat as UNKNOWN medical history. | ⚕ Keeps role-07 key |
| `er.noMatch.checklist.title` | احتياطات المريض المجهول | Unknown-patient precautions | ⚕ E-BIO-01 |
| `er.noMatch.checklist.allergies` | افترض إن عنده حساسية ممكنة | Assume possible allergies | ⚕ |
| `er.noMatch.checklist.bracelet` | دوّر على سوار أو كارت طبي | Look for a medical bracelet or card | |
| `er.noMatch.checklist.phone` | دوّر على موبايله — ممكن فيه كارت طوارئ | Check for a phone with an emergency card | |
| `er.noMatch.checklist.id` | دوّر على بطاقة شخصية | Look for an ID card | |
| `er.noMatch.retry` | امسح تاني ({left} فاضل) | Scan again ({left} left) | Max 3 |
| `er.noMatch.tempRecord` | افتح ملف طوارئ مؤقت | Open temporary ER record | ⚠ Scope change, UI-07 §2.1 |
| `er.profile.allergies` | الحساسية | ALLERGIES | |
| `er.profile.anaphylaxis` | ⛔ {allergen} — حساسية مفرطة | ⛔ {allergen} — ANAPHYLAXIS | ⚕ Red block; icon not emoji in UI |
| `er.profile.noAllergies` | مفيش حساسية متسجلة | No allergies recorded | ⚕ |
| `er.profile.blood` | فصيلة الدم | BLOOD TYPE | |
| `er.profile.bloodVerified` | ✓ متأكدة | ✓ verified | |
| `er.profile.bloodSelf` | ⚠ من كلام المريض — اتأكد قبل نقل الدم | ⚠ Self-reported — verify before transfusion | ⚕ |
| `er.profile.chronic` | أمراض مزمنة | CHRONIC | |
| `er.profile.meds` | أدوية حالية | MEDICATIONS | |
| `er.profile.callContact` | 📞 كلّم أهله | 📞 Call emergency contact | `select` on sex «أهلها»; icon not emoji in UI |
| `er.profile.noContacts` | المريض مش مشارك جهات طوارئ. | The patient hasn't shared emergency contacts. | US-18-AC2 |
| `er.session.timer` | ⏱ فاضل {minutes} دقيقة | ⏱ {minutes} min left | |
| `er.session.audited` | الدخول ده متسجل وبيتراجع | This access is logged and reviewed | |
| `er.session.extend` | مدّ ٣٠ دقيقة | Extend 30 min | Once only |
| `er.session.extendReason` | ليه محتاج تمد؟ | Why do you need more time? | |
| `er.session.extendUsed` | مديت مرة قبل كده. مينفعش تمد تاني. | Already extended once. | |
| `er.session.expired` | وقت الجلسة خلص. امسح المريض تاني لو لسه محتاج. | Session ended. Scan again if still needed. | ⚕ `EMERG_SESSION_EXPIRED` |
| `er.session.close` | اقفل الحالة | Close case | |
| `er.contacts.title` | أهل المريض | Emergency contacts | |
| `er.contacts.call` | كلّم | Call | 72 dp button |
| `er.offline.ribbon` | أوفلاين | OFFLINE | Orange ribbon |
| `er.offline.scanCard` | امسح كارت الطوارئ (شغّال من غير نت) | Scan emergency card (works offline) | ⚕ E-NET-01 |
| `er.offline.waiting` | هنمسح الوش أول ما النت يرجع | Face scan will run when signal returns | |
| `er.offline.cardBanner` | كارت أوفلاين — اتعمل {date} | Offline card — issued {date} | EXT-04-AC2 |
| `er.offline.cardExpired` | الكارت قديم — البيانات ممكن تكون اتغيرت | Expired — data may be outdated | ⚕ EXT-04-AC3 |
| `er.offline.cardInvalid` | الكارت ده مش سليم — متعتمدش عليه | This card failed verification — don't rely on it | ⚕ |
| `er.offline.openLive` | افتح الجلسة الكاملة | Open full live session | |
| `er.offline.queued` | `{count, plural, one {عملية واحدة مستنية تتبعت} two {عمليتين مستنيين يتبعتوا} few {{count} عمليات مستنية تتبعت} other {{count} عملية مستنية تتبعت}}` | `{count}` event(s) waiting to sync | Audit outbox |
| `er.nationalId.title` | دوّر بالرقم القومي | Search by national ID | |
| `er.nationalId.onlyIfHeld` | استخدمه بس لو البطاقة في إيدك. البحث ده متسجل. | Use only if you hold the ID card. This search is logged. | E-BIO-01 |
| `er.rateLimited` | وصلت للحد المسموح من المحاولات. اتواصل مع المشرف. | Attempt limit reached. Contact your supervisor. | US-16-AC7 |
| `er.desk.title` | كونسول الطوارئ | ER console | Web |
| `er.desk.activeCases` | الحالات المفتوحة | Active cases | |

### 3.16 Admin (US-21, EXT-05)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `admin.overview.title` | نظرة عامة | Overview | |
| `admin.kpi.users` | المستخدمين النشطين | Active users | |
| `admin.kpi.pendingLicenses` | تراخيص مستنية مراجعة | Licences pending review | |
| `admin.kpi.breakGlass` | دخول طوارئ (٧ أيام) | Break-glass (7 days) | |
| `admin.kpi.flags` | تنبيهات أمنية مفتوحة | Open security flags | |
| `admin.kpi.overrideRate` | نسبة تجاوز التنبيهات لكل دكتور | Alert override rate per doctor | |
| `admin.users.title` | المستخدمين | Users | |
| `admin.users.invite` | ادعو حد من الطاقم | Invite staff | |
| `admin.users.suspend` | أوقف الحساب | Suspend | |
| `admin.users.suspendBody` | الشخص ده هيخرج من كل الأجهزة خلال ٣٠ ثانية. | This person will be signed out everywhere within 30 seconds. | US-21-AC2 |
| `admin.users.reactivate` | رجّع الحساب | Reactivate | |
| `admin.users.reasonRequired` | السبب (مطلوب) | Reason (required) | |
| `admin.users.selfAction` | مينفعش تعمل الإجراء ده على حسابك. لازم أدمن تاني. | You can't do this to your own account. Another admin must. | US-21-AC3 |
| `admin.users.pendingApproval` | مستني موافقة أدمن تاني | Awaiting a second admin's approval | Two-person rule |
| `admin.invite.license` | رقم الترخيص | Licence number | |
| `admin.invite.authority` | جهة الترخيص | Issuing authority | |
| `admin.invite.expiry` | تاريخ انتهاء الترخيص | Licence expiry | |
| `admin.invite.specialty` | التخصص | Specialty | Doctors |
| `admin.invite.facilities` | المنشآت | Facilities | |
| `admin.invite.sent` | الدعوة اتبعتت. الشخص مش هيقدر يشتغل غير لما توثّق الترخيص. | Invite sent. They can't work until you verify the licence. | US-21-AC1 |
| `admin.license.verify` | وثّق الترخيص | Verify licence | |
| `admin.license.suspend` | أوقف الترخيص مؤقتاً | Suspend licence | |
| `admin.license.revoke` | اسحب الترخيص | Revoke licence | |
| `admin.license.revokeImpact` | `{count, plural, =0 {مفيش روشتات مفتوحة هتتأثر.} one {روشتة واحدة لسه ماتصرفتش هتبقى غير صالحة.} two {روشتتين لسه ماتصرفوش هيبقوا غير صالحين.} few {{count} روشتات لسه ماتصرفتش هتبقى غير صالحة.} other {{count} روشتة لسه ماتصرفتش هتبقى غير صالحة.}}` | `{count, plural, =0 {No open prescriptions are affected.} one {1 open prescription will become invalid.} other {{count} open prescriptions will become invalid.}}` | E-LIC-02 |
| `admin.license.suspendImpact` | الروشتات اللي اتكتبت قبل الإيقاف هتفضل تتصرف. | Prescriptions issued before the suspension stay dispensable. | E-LIC-02 |
| `admin.reauth` | للإجراء ده محتاجين كود تطبيق المصادقة. | This action needs your authenticator code. | ≤ 5 min `auth_time` |
| `admin.audit.title` | سجل العمليات | Audit log | |
| `admin.audit.filter.actor` | مين عمل | Actor | |
| `admin.audit.filter.action` | العملية | Action | |
| `admin.audit.filter.mrn` | رقم الملف الطبي | Patient MRN | |
| `admin.audit.filter.outcome` | النتيجة | Outcome | |
| `admin.audit.filter.date` | الفترة | Date range | |
| `admin.audit.export` | صدّر CSV (من غير بيانات حساسة) | Export CSV (PHI excluded) | EXT-05-AC1 |
| `admin.audit.chainOk` | سلسلة السجل سليمة — اتراجعت {time} | Audit chain verified {time} | |
| `admin.audit.chainBroken` | السلسلة مكسورة عند العملية رقم {n} | Audit chain broken at event #{n} | ⚖ EXT-05-AC3 |
| `admin.breakGlass.title` | مراجعة دخول الطوارئ | Break-glass review | |
| `admin.breakGlass.card` | {paramedic} · {service} · {method} · {reason} · {time} | {paramedic} · {service} · {method} · {reason} · {time} | |
| `admin.breakGlass.lowConfidence` | تعرّف ضعيف | Low confidence | Sorted first |
| `admin.breakGlass.appropriate` | مناسب | Appropriate | |
| `admin.breakGlass.inappropriate` | مش مناسب | Inappropriate | |
| `admin.breakGlass.note` | ملاحظة | Note | |
| `admin.security.title` | تنبيهات أمنية | Security flags | |
| `admin.security.spoof` | محاولات تلاعب بالوش | Face spoof attempts | |
| `admin.security.rate` | محاولات كتير بشكل غير طبيعي | Unusual attempt volume | |
| `admin.security.forgedRx` | روشتات مزوّرة من نفس الصيدلية | Forged prescriptions from one pharmacy | E-RX-05 |
| `admin.noClinicalData` | الأدمن مش بيشوف بيانات طبية. | Admins don't see clinical data. | US-21-AC5 (shown as info) |

### 3.17 Account & licence states (lock screens)

| Key | Arabic | English | Notes |
|-----|--------|---------|-------|
| `lock.suspended.title` | الحساب موقوف | Account suspended | `ACCOUNT_SUSPENDED` |
| `lock.suspended.body` | حسابك اتوقف من إدارة النظام. لو شايف إن ده غلط، كلّمهم. | Your account was suspended by the administrators. If this is a mistake, contact them. | |
| `lock.license.title` | الترخيص مش ساري | Licence not valid | `LICENSE_NOT_VALID` |
| `lock.license.suspended` | ترخيصك موقوف مؤقتاً، فمش هتقدر تكتب أو تصرف روشتات دلوقتي. | Your licence is suspended, so you can't prescribe or dispense right now. | |
| `lock.license.revoked` | ترخيصك اتسحب. كل الصلاحيات الطبية اتقفلت. | Your licence was revoked. All clinical permissions are closed. | |
| `lock.license.expired` | ترخيصك انتهى يوم {date}. جدّده وابعت النسخة الجديدة للإدارة. | Your licence expired on {date}. Renew it and send the new copy to the administrators. | E-LIC-04 |
| `lock.license.pending` | ترخيصك لسه بيتراجع. هنبلّغك أول ما يتوثّق. | Your licence is under review. We'll notify you when it's verified. | US-21-AC1 |
| `lock.contactAdmin` | كلّم الإدارة | Contact administrators | Opens `mailto:` with no PHI |
| `license.reminder` | ترخيصك هينتهي بعد {days} يوم. جدّده بدري. | Your licence expires in {days} days. Renew early. | 30/7/1 days |

### 3.18 Error messages by error code (00-INDEX §7)

Each code has a **patient-facing** and/or a **staff-facing** string. The UI switches on `code` (role-06 `ApiException`, role-05 `lib/api/errors.ts`), never on HTTP status alone. Messages never leak whether a resource exists.

| Code | Key | Arabic | English | Action |
|------|-----|--------|---------|--------|
| `AUTH_TOKEN_MISSING` / `AUTH_TOKEN_INVALID` | `err.auth.invalid` | محتاجين تدخل تاني. | Please log in again. | → Login |
| `AUTH_TOKEN_EXPIRED` | (silent refresh) | — | — | Refresh once; if it fails → `err.auth.invalid` |
| `AUTH_SESSION_REVOKED` | `session.revoked` | (see §3.5) | | → Login |
| `AUTH_MFA_REQUIRED` | `err.auth.mfa` | محتاجين كود تطبيق المصادقة عشان تكمّل. | Enter your authenticator code to continue. | → MFA verify |
| `AUTH_STEP_UP_REQUIRED` | `err.auth.stepUp` | أكّد إنه انت عشان نكمّل. | Confirm it's you to continue. | Re-auth overlay → auto-retry |
| `AUTH_STEP_UP_INVALID` | `stepUp.failed` | (see §3.5) | | Retry |
| `ACCOUNT_SUSPENDED` | `lock.suspended.*` | (see §3.17) | | Lock screen |
| `LICENSE_NOT_VALID` | `lock.license.*` | (see §3.17) | | Lock screen |
| `RBAC_FORBIDDEN` | `err.rbac` | الصفحة دي مش ضمن صلاحياتك. | This isn't available for your role. | Back to home |
| `ACCESS_GRANT_REQUIRED` | `err.grant` | معندكش إذن تشوف ملف المريض ده دلوقتي. اطلب منه كود مشاركة. | You don't have access to this patient. Ask them for a share code. | → Redeem |
| `RESOURCE_NOT_FOUND` | `err.notFound` | مش لاقيين اللي بتدوّر عليه. | We couldn't find that. | Back |
| `VALIDATION_FAILED` | `err.validation` | فيه بيانات محتاجة تتظبط — بصّ على الخانات المعلّمة. | Some fields need attention — check the highlighted ones. | Inline errors |
| `IDEMPOTENCY_KEY_REQUIRED` / `IDEMPOTENCY_KEY_CONFLICT` | `err.idempotency` | حصلت لخبطة في الطلب. حدّث الصفحة وجرّب تاني. | Something got mixed up. Refresh and try again. | Reset form key |
| `CONFLICT_VERSION` | `encounter.conflict` | (see §3.13) | | Diff dialog |
| `RATE_LIMITED` | `err.rateLimited` | محاولات كتير ورا بعض. استنى {seconds} ثانية. | Too many attempts. Wait {seconds}s. | Countdown from `Retry-After` |
| `RX_NOT_FOUND` | `err.rx.notFound` | مفيش روشتة بالرقم ده. اتأكد من الرقم والكود. | No prescription matches. Check the number and code. | |
| `RX_SIGNATURE_INVALID` | `rx.doNotDispense` | (see §3.14) | | Red full screen + Report |
| `RX_EXPIRED` | `rx.verify.expired` | (see §3.14) | | |
| `RX_CANCELLED` | `rx.verify.cancelled` | (see §3.14) | | |
| `RX_ALREADY_DISPENSED` | `rx.alreadyDispensed` | (see §3.14) | | |
| `RX_QUANTITY_EXCEEDED` | `dispense.race` | (see §3.14) | | Refresh rows |
| `RX_LEASE_HELD` | `dispense.lease.held` | (see §3.14) | | Proceed anyway |
| `RX_ALERT_OVERRIDE_REQUIRED` | `signIssue.serverNewAlert` | (see §3.13) | | Highlight alerts |
| `RX_PRESCRIBER_INVALID` | `rx.verify.prescriberInvalid` | (see §3.14) | | |
| `PICKUP_TOKEN_INVALID` | `err.pickup.invalid` | الكود ده خلص أو اتستخدم. اطلب من المريض يعمل كود جديد. | This code expired or was already used. Ask the patient for a new one. | Staff side |
| `EMERG_NO_MATCH` | `er.noMatch.*` | (see §3.15) | | Fallbacks |
| `EMERG_SESSION_EXPIRED` | `er.session.expired` | (see §3.15) | | Rescan |
| `EMERG_CONTACTS_NOT_SHARED` | `er.profile.noContacts` | (see §3.15) | | |
| `BIO_NO_FACE` | `scan.hint.placeFace` / `.emergency` | (see §3.5b) | | Retry |
| `BIO_MULTIPLE_FACES` | `scan.hint.oneFace.enrol` / `.emergency` | (see §3.5b) | | Retry |
| `BIO_LOW_QUALITY` | `scan.retry` + the server hint's key | (see §3.5b) | | Retry ×3 → fallbacks |
| `BIO_LIVENESS_FAILED` | `scan.liveness.retry` / `scan.locked.staff` / `scan.locked.patient` | (see §3.5b) | | Retry / lock |
| `BIO_CONSENT_REQUIRED` | `err.bio.consent` | محتاجين موافقتك الأول قبل ما نسجّل وشك. | We need your consent before registering your face. | → Consent |
| `BIO_ALREADY_ENROLLED` | `bio.duplicate` | (see §3.5) | | Support |
| `AI_SERVICE_UNAVAILABLE` | `assistant.unavailable` / `scan.aiDown` / `rx.checkUnavailable` | (context-specific) | | Fallbacks |
| `AI_TIMEOUT` | same as above | | | |
| `FEATURE_NOT_IMPLEMENTED` | `err.notImplemented` | الميزة دي لسه مش متاحة. | This feature isn't available yet. | |
| `INTERNAL_ERROR` | `err.internal` | حصلت مشكلة عندنا، مش عندك. جرّب تاني بعد شوية. لو اتكررت، ابعتلنا الكود ده: {requestId} | Something went wrong on our side. Try again shortly. If it repeats, send us this code: {requestId} | Shows `X-Request-Id` |
| Network timeout (client) | `err.network` | النت فصل أو بطيء. اتأكد من الاتصال وجرّب تاني. | Connection lost or slow. Check it and try again. | Retry |

### 3.19 Notifications (push / SMS / email): **no PHI** (role-01, rule 11)

Payloads must not include drug names, diagnoses, allergies or record contents. They point the user into the app.

| Key | Arabic | English | Channel |
|-----|--------|---------|---------|
| `notif.rxIssued` | عندك روشتة جديدة. افتح التطبيق تشوفها. | You have a new prescription. Open the app to view it. | Push |
| `notif.rxDispensed` | روشتتك اتصرفت في {pharmacy}. | Your prescription was dispensed at {pharmacy}. | Push |
| `notif.rxPartial` | جزء من روشتتك اتصرف. الباقي متاح لحد {date}. | Part of your prescription was dispensed. The rest is available until {date}. | Push |
| `notif.rxCancelled` | الدكتور لغى روشتة. افتح التطبيق للتفاصيل. | A doctor cancelled a prescription. Open the app for details. | Push |
| `notif.rxPrescriberInvalid` | فيه روشتة محتاجة تكتبها من دكتور تاني. افتح التطبيق. | One of your prescriptions needs to be rewritten by another doctor. Open the app. | Push (E-LIC-02) |
| `notif.breakGlass` | (= `breakGlass.notification`) | | Push + in-app |
| `notif.accessGranted` | د. {doctor} بقى يقدر يشوف ملفك لحد {date}. | Dr {doctor} can now view your record until {date}. | In-app |
| `notif.doseReminder` | (= `dose.reminder.notification`) | | Local notification |
| `notif.cardRefreshed` | كارت الطوارئ اتحدّث. | Your emergency card was updated. | In-app |
| `notif.sms.otp` | كود سمارت هيلث: {code}. ماتديهوش لحد. | SmartHealth code: {code}. Don't share it. | SMS |
| `notif.sms.presence` | كود التأكيد في الصيدلية: {code}. ماتديهوش غير للصيدلي اللي قدامك. | Pharmacy confirmation code: {code}. Give it only to the pharmacist in front of you. | SMS (US-10-AC4) |
| `notif.licenseExpiring` | ترخيصك هينتهي بعد {days} يوم. | Your licence expires in {days} days. | Email + in-app |
| `notif.newDevice` | حد دخل على حسابك من جهاز جديد. مش انت؟ افتح الإعدادات وأوقف الجهاز. | New device sign-in. Not you? Open Settings and revoke the device. | Push + email |

### 3.20 Settings

| Key | Arabic | English |
|-----|--------|---------|
| `settings.title` | الإعدادات | Settings |
| `settings.language` | اللغة | Language |
| `settings.textSize` | حجم الخط | Text size |
| `settings.theme` | المظهر | Appearance |
| `settings.theme.system` | زي الموبايل | Same as device |
| `settings.theme.light` | فاتح | Light |
| `settings.theme.dark` | غامق | Dark |
| `settings.theme.sunlight` | تباين عالي (للشمس) | High contrast (sunlight) |
| `settings.easternDigits` | استخدم الأرقام العربية (١٢٣) في التواريخ | Use Arabic-Indic digits for dates |
| `settings.easternDigitsNote` | الجرعات والكميات هتفضل بالأرقام الإنجليزي عشان الأمان. | Doses and quantities always stay in Western digits for safety. |
| `settings.haptics` | الاهتزاز | Haptics |
| `settings.devices` | الأجهزة المتصلة | Signed-in devices |
| `settings.revokeDevice` | اقفل الجهاز ده | Revoke this device |
| `settings.logoutAll` | اخرج من كل الأجهزة | Log out of all devices |
| `settings.deleteFace` | امسح بصمة وشي | Delete my face data |
| `settings.deleteAccount` | امسح حسابي | Delete my account |
| `settings.deleteAccountBody` | حضرتك هتخرج نهائياً، وبصمة الوش والمحادثات وأرقام أهلك هيتمسحوا. السجلات الطبية نفسها لازم تفضل محفوظة قانونياً، بس محدش هيقدر يدخل بحسابك تاني. | You'll be signed out permanently. Face data, chats and contact details will be deleted. Medical records must be retained by law, but nobody can use your account again. |
| `settings.about` | عن التطبيق | About |
| `settings.privacy` | سياسة الخصوصية | Privacy policy |
| `settings.support` | الدعم | Support |

`settings.deleteAccountBody` is ⚖ (E-PRIV-06).

### 3.21 Accessibility labels (screen readers only)

| Key | Arabic | English |
|-----|--------|---------|
| `a11y.severityContraindicated` | تنبيه ممنوع | Contraindicated alert |
| `a11y.severityMajor` | تنبيه خطير | Major alert |
| `a11y.anaphylaxisChip` | حساسية مفرطة من {allergen} | Anaphylaxis to {allergen} |
| `a11y.statusBadge` | الحالة: {status} | Status: {status} |
| `a11y.countdown` | فاضل {minutes} دقيقة و{seconds} ثانية | {minutes} minutes {seconds} seconds left |
| `a11y.qr` | كود QR للصيدلي. الكود الاحتياطي: {code} | QR code for the pharmacist. Backup code: {code} |
| `a11y.orb` | (hidden; the state label is read instead) | |
| `a11y.flipCard` | اقلب الكارت | Flip card |
| `a11y.torch` | شغّل الكشاف | Turn on flashlight |
| `a11y.flipCamera` | اقلب الكاميرا | Switch camera |
| `a11y.reorderUp` | انقله لفوق | Move up |
| `a11y.reorderDown` | انقله لتحت | Move down |
| `a11y.closeLocked` | زرار القفل هيشتغل بعد {seconds} ثانية | Close button available in {seconds} seconds |

---

## 4. Review Process & Definition of Done (UI-03)

1. **Native-speaker pass:** two team members from different governorates read every Arabic string aloud. Anything that sounds stiff, regional-only, or patronising is flagged.
2. **Elderly test:** 3 people aged 60+ read the patient strings in §3.4–§3.12 at Large-Font ×1.30. Every string must be understood on first read.
3. **Clinical review (⚕):** every ⚕ string is checked by a clinician (faculty supervisor or a doctor/pharmacist the team knows). Pay special attention to anaphylaxis, self-reported blood type, missed dose and the crisis texts.
4. **Legal review (⚖):** Security Lead checks consent and deletion strings against Law 151/2020 principles.
5. **Engineering checks:**
   - [ ] `ar.json` / `en.json` and `app_ar.arb` / `app_en.arb` generated from `design/copy/strings.yaml`; `next-intl` strict mode and `flutter gen-l10n` report **0 missing keys**.
   - [ ] ICU plural rules use the Arabic categories (`zero`, `one`, `two`, `few`, `many`, `other`) where counts appear.
   - [ ] No PHI in any notification string (lint: notification keys can only reference allow-listed placeholders: `{time}`, `{date}`, `{pharmacy}`, `{doctor}`, `{service}`, `{days}`, `{code}`).
   - [ ] Doses and codes render LTR-isolated (golden tests in AR).
   - [ ] Crisis line comes from `ref.crisis_resources`; the emergency number comes from `EMERGENCY_PHONE_NUMBER`.
   - [ ] The emergency, crisis and AI red-flag fixed templates are identical in the app and in `ai-service` (one source file shared through `packages/contracts`).

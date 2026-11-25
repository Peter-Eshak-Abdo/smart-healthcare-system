# UI-06 — Mobile Screen Blueprints (iPhone-first · Flutter · Android parity)

> **Owner:** UI/UX (M8) · **Implementer:** Mobile (R6, `mobile-app/`)
> **Status:** Draft for team review · **Date:** 2026-11-24
> **Depends on:** UI-01 (tokens, §12 mapping), UI-02 (3D components, haptics, fallbacks), UI-03 (copy keys), UI-04 (routes §3, flows §5), role-06 (architecture, camera, step-up, offline), 03-API.
> **Artboards:** **390 × 844** (primary) and **402 × 874** (iPhone 16 Pro, prototype). Android checks at **360 × 800**. Safe areas from `MediaQuery.paddingOf`, never hard-coded.

---

## 0. Conventions

### 0.1 Spec format per screen
**ID · Route · Stories** → **Purpose** → **Wireframe** (RTL) → **Structure & widgets** → **Data** → **States** → **Interactions, motion, haptics** → **iOS vs Android** → **Copy keys** → **A11y** → **Edge cases**.

### 0.2 Wireframe notation
Drawn **RTL** at 390 wide (≈ 34 characters). Labels are short English stand-ins for UI-03 keys (Arabic in monospace art misaligns). `▔▔` = status bar / Dynamic Island area, `▁▁` = home indicator, `[Btn]` primary, `(btn)` secondary, `{field}`, `▣` tile.

### 0.3 Platform adaptation (UI-01 §12)
- **System chrome adapts:** iOS uses large-title `CupertinoSliverNavigationBar`, `CupertinoTabBar` (glass), Cupertino sheets/dialogs/pickers/switches, edge-swipe back. Android uses `SliverAppBar.large`, `NavigationBar`, M3 sheets/dialogs, predictive back.
- **Clinical components are identical** on both: buttons, cards, severity banners, chips, ID card, scanner, seal, orb, Emergency theme.
- **Haptics** via `HapticService` (UI-02 §7). **FLAG_SECURE / iOS snapshot blur** on: pickup QR, emergency card, emergency profile/contacts, chat, history, critical info (role-06 §7).

### 0.4 States every screen implements
`loading` (skeleton after 300 ms; never on Emergency screens) · `empty` · `error` (`ProblemView`, code-driven copy) · `offline` (ribbon + cached copy or offline empty state) · Large-Font ×1.15/×1.30 reflow · Dark · Reduced Motion.

---

## 1. Patient App

### M-PAT-00 Splash
Static native splash (brand gradient + shield mark; `flutter_native_splash`) → Flutter first frame. **No splash animation longer than 600 ms.** In parallel: restore session, open Hive (encrypted), refresh the emergency card if online (role-06 §6.4). Cold start target ≤ 1.5 s to the first usable screen.

### M-PAT-01 Welcome + 3D onboarding carousel · `/auth/welcome`
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
                          [EN]
     ┌──────────────────────┐
     │   Rive hero scene    │   ← slide 1: 3D ID card floats & tilts
     │   (Tier C: static)   │      slide 2: face mesh ring
     └──────────────────────┘      slide 3: Rx seal stamps
   Welcome to SmartHealth           slide 4: calm AI orb
   Your record, Rx & emergency
   card — together, secure.
             ● ○ ○ ○
   [         Log in          ]
   (     Create account      )
   ─────────────────────────────
   🆘 Emergency card (no login)
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- 4 slides (`PageView`, RTL swipes start from the right). Each slide: Rive scene (UI-02 §3) 260 dp tall, title `h1`, body `body-lg`. Auto-advance: **off** (elderly users need time). Dots are tappable.
- Slide copy: ① «ملفك الطبي معاك في أي مكان» ② «المسعف يعرفك حتى لو مقدرتش تتكلم» ③ «روشتة إلكترونية متتزوّرش» ④ «مساعد يوجّهك للتخصص الصح».
- The **Emergency card** link is always visible at the bottom (EXT-04), separated by a divider, with the danger outline style.
- **Reduced Motion / Tier C:** static illustrations, crossfade between slides.

### M-PAT-02 Log in / Sign up / OTP · `/auth/*` · US-01, US-19
- **Login:** large-title «تسجيل الدخول»; `{identifier}` (email or `01…` phone, auto-detected keyboard), `{password}` with show toggle, «نسيت كلمة السر؟», primary «ادخل» pinned above the keyboard. After the first successful login, offer **«ادخل بـ Face ID المرة الجاية»** (device step-up key, SD-02).
- **Sign up:** identifier, password with strength meter + `signup.passwordHelp`, terms checkbox with links (⚖). Primary «اعمل الحساب».
- **OTP:** 6 boxes (`code-lg`), iOS `oneTimeCode` autofill / Android SMS Retriever, resend countdown `otp.resendIn`. Wrong → boxes shake (non-clinical) + `otp.invalid` + `warning` haptic.
- **Device registration** happens silently after OTP (role-06 §6.2); failure is retried later and never blocks onboarding.

### M-PAT-03 Onboarding (text size + 3 steps) · `/onboarding` · US-01
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ✕                      Step 1 of 3
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 National ID and date of birth
 We need these so your record
 belongs only to you…  (why ⓘ)
 {National ID ____ ____ ____ __}  ✓
 {Date of birth  ▾}
 (I don't have a national ID)
                                 
 [            Continue           ]
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- **Step 0 (before step 1): «تحب الكلام يبقى أكبر؟»** with three big options showing live preview text (UI-01 §4.6). Saved immediately.
- **Step 1:** national ID mask + live validation (century/DOB/governorate, E-ID-02) with a ✓ when valid; DOB picker (Cupertino wheel on iOS, M3 date picker on Android). Alternate document path (E-ID-03).
- **Step 2:** sex (two large segmented options), blood type grid (8 chips + «مش متأكد»), note `onb.basics.bloodSelfReported`.
- **Step 3:** consent cards with toggles: terms (required), emergency contacts share (default ON + why), AI assistant (optional + why). ⚖ copy.
- **Done:** confetti-free success (`spring.celebrate` check), MRN in mono with copy, CTA «سجّل بصمة وشك» (→ M-PAT-12) and «بعدين».
- Progress bar flows right → left in Arabic. Back keeps entered values.

### M-PAT-04 Home · `/p/home` · US-03/04, EXT-04
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 (⚙)                Good morning, Mona 👋
                    You have a dose at 9:00 PM
 ┌───────── HERO 2×2 (342×216) ─────┐
 │ ◈ Medical ID              ●Up to │  ← 3D tilt card (UI-02 §6.2)
 │ Mona Adel · SH-7K2M9Q4D          │
 │ O+  (self ⚠)        🛡            │
 │ [⛔ Penicillin] [Ibuprofen] +1    │
 │ Asthma · Updated 2 h ago          │
 └──────────────────────────────────┘
 ┌─── 1×1 (171) ───┐┌─── 1×1 (171) ───┐
 │ 💊 Today's doses ││ 📜 2 active Rx   │
 │ ✓ 9 AM  ○ 9 PM   ││ 1 ready at pharm.│
 └─────────────────┘└─────────────────┘
 ┌─── 1×1 ─────────┐┌─── 1×1 ─────────┐
 │ ◯ Ask assistant  ││ 👁 Who can see   │
 │ (orb idle 56 dp) ││ 1 doctor         │
 └─────────────────┘└─────────────────┘
 ┌──────────── 2×1 wide ────────────┐
 │ 🛡 Critical info: 1 allergy needs │
 │    your doctor's confirmation   › │
 └──────────────────────────────────┘
 ┌────┬────┬────┬────┬────┐ tab bar (glass)
 │Home│Rec.│ Rx │ AI │Acct│
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- **Bento (UI-01 §5.3):** hero = `MedicalIdCard3D`; then doses, prescriptions, assistant, access, critical-info nudge. Max 5 tiles above the fold. At Large-Font ×1.30 → single column.
- **Greeting** by time (`home.greeting.*`) + one contextual subtitle (`home.subtitle.*`), chosen by priority: due dose > new Rx > all good.
- **ID card interactions:** tilt (gyro + drag), tap flip → QR back, long-press menu (open full-screen emergency card, refresh). UI-02 §6.2.
- **Doses tile:** next 2 doses with check circles; tapping a circle marks taken (`light` haptic, then `success` on save, undo toast 5 s).
- **Rx tile:** count + the most actionable line («١ جاهزة للصرف»). Tap → T-01 hero into the Rx list.
- **Pull to refresh** (adaptive) refreshes critical info + emergency card.
- **Offline:** ribbon; tiles show cached data with their `fetched_at`; the assistant tile shows «مش متاح من غير نت».
- **Empty account** (new user): hero shows `card.missing` with CTA «كمّل بياناتك الطبية»; doses tile hidden; Rx tile shows `rx.empty.title`.

### M-PAT-05 Medical history timeline · `/p/history` · US-02
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 My medical record (large title)
 [All] [Visits] [Diagnoses] [Meds]   ← segmented / chips
 ─── November 2026 ───────────────
 ● 12 Nov · Dr Sara Fathy        ›
   Chest · Ismailia General
   [J45.9 Asthma]  📜 1 Rx
 │
 ● 02 Nov · 🔒 Hidden visit
 │   (only you and its doctor)
 ─── October 2026 ────────────────
 ● 18 Oct · Dr Karim Adel        ›
   Internal medicine
   [I10 Hypertension]
          (Show older)
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- `CustomScrollView` + `SliverList`; month headers sticky. Each node: date, doctor + specialty (Arabic name from UI-03 §3.12), facility, diagnosis chips (ICD code + Arabic title), linked Rx icon.
- Hidden (restricted) visits show a lock and «مخفية»; the patient can open them (they own them).
- Cursor pagination (20 per page); «اعرض أقدم» at the end (also auto-load on scroll).
- **Empty:** `history.empty.*` with an illustration of a doctor writing.
- **Offline:** cached last page only, with ribbon.

### M-PAT-06 Encounter detail · `/p/history/:encounterId`
Header (date, doctor, specialty, facility) → «التشخيص» chips → «كلام الدكتور ليك» (patient summary, `body-lg`) → linked prescription card (T-01 into Rx detail) → **«خلّي الزيارة دي مخفية عن باقي الدكاترة»** switch with the explanation sheet `history.restrictBody` (⚖ ⚕). Internal notes are never returned (US-02-AC3).

### M-PAT-07 Prescriptions list & detail · `/p/prescriptions`, `/p/prescriptions/:id` · US-03
**List:** segmented «شغّالة | قديمة»; cards (radius 20): Rx number (mono), doctor, date, **status badge** (UI-01 §9.3), expiry `rx.expiresIn`, item count. Tap → **T-01** hero (card expands into the detail).

**Detail (M-PAT-07D):**
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ‹                    RX-2026-000123
 ┌──────────────────────────────────┐
 │  (seal)  Digitally signed by      │
 │          Dr Karim Adel            │
 │  [قيد الصرف]      6 days left      │
 └──────────────────────────────────┘
 ┌─ Medication card ────────────────┐
 │ 💊(tablet) Augmentin 875/125 mg   │
 │ 1 tablet — twice a day (12 h)     │
 │ [☀ Morning] [🌙 Evening] After food│
 │ 14 tablets remaining              │
 │ (Set reminder times)              │
 └──────────────────────────────────┘
 ┌─ Medication card ────────────────┐
 │ 💨(inhaler) Ventolin 100 mcg      │
 │ 2 puffs — as needed               │
 │ Dispensed ✓ (El-Shifa, 12 Nov)    │
 └──────────────────────────────────┘
 ⓘ You can collect the rest at any
   pharmacy until 24 Dec.
 [     Show at pharmacy  (Face ID)  ]
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- **Seal** (UI-02 §6.3.1) in `authentic` style with `rx.signedBy`; stamp animation once per Rx per device.
- **Medication cards** (UI-02 §6.3.2): dosage-form glyph, dose line, time chips (**only** from instructions or the patient's own reminder times), food relation, remaining (instant swap), per-item status.
- Primary «ورّي الكود في الصيدلية» pinned at the bottom (thumb zone). Hidden for `dispensed`/`cancelled`/`expired`.
- **Cancelled:** grey seal band, reason category `rx.cancelledReason.*` (US-03-AC5). **Expired:** grey with stripes.
- **Offline:** cached copy (`rx.offlineCached`); primary replaced by the paper-code fallback `rx.offlineNoQr` (E-NET-05).

### M-PAT-08 Pickup QR · `/p/prescriptions/:id/pickup` · US-03-AC3/AC4
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ✕                     Pharmacy code
   Show this code to the pharmacist
   ┌──────────────────────────────┐
   │ ██▀▀██  ▄▄  ██▀▀██           │  ← pure white panel, 280×280,
   │ ██  ██ ▀██▀ ██  ██           │    quiet zone ≥ 4 modules
   │ ▀▀▀▀▀▀ █▄▀█ ▀▀▀▀▀▀  (QR)     │
   └──────────────────────────────┘
          ◔  09:41  valid           ← countdown ring (UI-02 §5.9)
        RX-2026-000123
   No phone? Tell the pharmacist:
          K7Q-2MX   ⧉
   (Someone collecting for you?)
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Opens only after **step-up** (`stepUp.title`, system Face ID/fingerprint sheet). Brightness → max (`screen_brightness`, restored on exit). Wakelock on. `FLAG_SECURE` on Android; on iOS, a screenshot notification shows `pickup.screenshotBlocked`, and the app-switcher snapshot is blurred.
- Countdown is driven by the server `expires_at`. At 60 s → amber + `light` haptic. At 0 → blur σ12 + `pickup.expired` + [«اعمل كود جديد»] (new step-up).
- Live update: when the pharmacy dispenses (push or 5 s polling while this screen is open), the screen morphs into a success state («اتصرفت ✓» + status badge morph) and offers «رجوع».
- **Proxy pickup** (E-RX-09): share sheet sends a short-lived deep link that opens the QR on the other phone after its owner logs in; audited. (If the team prefers, P2.)

### M-PAT-09 Critical info · `/p/critical` · US-04
Sections (inset-grouped list on iOS, cards on Android): **فصيلة الدم** (value + source tag; locked if clinician-confirmed with `critical.blood.lockedByDoctor`) · **الحساسية** (anaphylaxis first; each row: allergen, severity chip, source tag; swipe/menu to remove self-reported ones) · **الأمراض المزمنة** · **الأدوية الحالية** (read-only, derived).
- **Add allergy sheet** (large detent): search-as-you-type against the catalogue (`critical.allergy.searchHint`), not-found path to free text (`critical.allergy.notFound` + `uncodedNote`), severity picker with plain-language options (`critical.allergy.sev.*`). Save → `critical.allergy.addedNote` + card re-issue.
- Edits trigger the emergency-card refresh (US-05-AC5 pattern) and a `notif.cardRefreshed` in-app toast.

### M-PAT-10 Emergency contacts manager · `/p/account/contacts` · US-05
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ‹                 Emergency contacts
 People a paramedic can call. Order
 them by priority.
 ┌──────────────────────────────────┐
 │ ≡ 1  Adel Hassan · Father    ✎   │
 │      +20 111 222 3334  👁 shared │
 ├──────────────────────────────────┤
 │ ≡ 2  Sara Adel · Sister      ✎   │
 │      +20 100 555 7788  ⊘ hidden  │
 └──────────────────────────────────┘
 [ ↑ ][ ↓ ] reorder buttons (a11y)
 [         + Add a contact          ]
 ⓘ 2 of 5
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- `ReorderableListView` with drag handles (`selection` haptic per slot) **and** up/down buttons for accessibility (no drag-only action).
- Add/edit sheet: name, relationship (chips `contacts.rel.*`), phone (normalised to E.164, US-05-AC6; contact-picker import), share toggle with `contacts.shareHelp`.
- 5 max → the add button disables with reason `contacts.max`.
- Global consent off → top banner `contacts.globalOff` + «افتح المشاركة».
- Delete → confirm sheet → soft delete; saved → `contacts.saved` (card re-issued).
- **Empty:** `contacts.empty.*` + illustration of a family.

### M-PAT-11 Emergency card (full screen) · `/card` (no login) and `/p/card` · EXT-04
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  (black, Emergency theme)
 ✕   EMERGENCY CARD   ☀ (sunlight)
 MONA ADEL · 36 F · …9Q4D
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃ ⛔ ALLERGIES                    ┃  (red block #7F1D1D, white)
 ┃ PENICILLINS — ANAPHYLAXIS       ┃
 ┃ Ibuprofen — rash                ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
 BLOOD TYPE     O+   ⚠ self-reported   (40 sp)
 CHRONIC        Asthma
 MEDICATIONS    Salbutamol inhaler
                Warfarin 5 mg
 ┌──────────────────────────────────┐
 │  QR (white panel 220)            │
 │  Show to paramedic               │
 └──────────────────────────────────┘
 Issued 20 Nov · valid until 20 Dec
 [ OFFLINE — last updated 2 h ago ]  (orange ribbon, only if offline)
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- **Tier E:** no 3D, no animation, instant open. Brightness max, wakelock.
- Order fixed: allergies (anaphylaxis first) → blood → chronic → meds → QR (role-06 §6.3).
- Expired → red banner `card.expired` at the top; content still shown (EXT-04-AC3).
- From `/card` (logged out): **only this screen** is reachable; ✕ returns to Welcome.
- ☀ toggles the Sunlight theme for bright outdoor light.

### M-PAT-12 Biometric enrolment · `/p/account/face` · EXT-03
Sequence: **Consent** (`bio.consent.*`, ⚖, illustration of a shield + face) → **Tips** (3 icon rows) → **Scanner** (`FaceMeshScanner` mode `enrol`, front camera, UI-02 §6.1) → **Result**.
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ✕                         Face scan
 ┌──────────────────────────────────┐
 │ ░░░░░░░ dark vignette ░░░░░░░░░░ │
 │ ░░░░  ╭───────────────╮  ░░░░░░ │
 │ ░░░░ ╱  ⟍ depth ring ⟋ ╲ ░░░░░░ │
 │ ░░░ │   • contour mesh •  │ ░░░░ │
 │ ░░░░ ╲   (live camera)   ╱ ░░░░░ │
 │ ░░░░░ ╰───────────────╯ ░░░░░░░ │
 │ ░░░░  ◐◐○ challenge arc  ░░░░░░ │
 │      ⟨ Blink once ⟩  (hint chip) │
 └──────────────────────────────────┘
   Step 2 of 3 · ← Turn left a bit
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- All states, hints, colours and haptics per UI-02 §6.1 state table.
- Result: success (`bio.success`, `spring.celebrate` ring close, `success` haptic, CTA «تمام»); duplicate (`bio.duplicate`, support CTA); locked (`bio.locked`); AI down (`scan.aiDown`, «جرّب بعدين»).
- **Manage screen** (when enrolled): status «بصمة وشك متسجلة ✓ — {date}», «سجّلها تاني», «امسح بصمة وشي» (step-up + `bio.delete.*` confirm, ⚖).

### M-PAT-13 Sharing & access · `/p/account/access` · US-09/20, EXT-06
- **Generate code card:** big «اعمل كود للدكتور» → step-up → code screen: 6 digits in `code-lg` grouped 3+3, countdown ring 10 min, `access.codeValid`, `access.duration` (30 days default; «غيّر المدة» picker 7/30/90/365).
- **Active grants list:** doctor name, specialty, facility, until date, «الغي» (destructive confirm `access.revokeConfirm`).
- **Access history** (EXT-06): grouped by day; rows `access.historyRow`; emergency rows highlighted with a shield icon → M-PAT-16.
- **Empty:** `access.empty`.

### M-PAT-14 AI Medical Assistant · `/p/assistant` · US-13/14/15
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 (⋯)                Medical assistant
 ┌ ⓘ Guides you to the right specialty;│  ← disclaimer, permanent,
 │   not a diagnosis. Emergency: 123  │    not dismissible
 └────────────────────────────────────┘
            ◯  (AI orb 120 dp)
          «Thinking…»  (live label)
                 ┌─────────────────┐
                 │ Headache 3 days, │  ← user bubble (end side)
                 │ worse in morning │
                 └─────────────────┘
 ┌──────────────────────────────┐
 │ Guidance card (violet edge)  │      ← assistant card (start side)
 │ triage: Book soon (blue)     │
 │ ▸ What you can do at home    │
 │ ▸ Go to ER immediately if…   │
 │ [🧠 Neurology — مخ وأعصاب]    │
 │ Why? persistent morning…     │
 └──────────────────────────────┘
 Since when?  [Today][Few days][>1 wk]   ← clarify chips
 ┌──────────────────────────────┬───┐
 │ Describe symptoms (no IDs)…  │ ➤ │  ← composer (glass)
 └──────────────────────────────┴───┘
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- **Entry gating:** minor → `assistant.minor`; no consent → consent sheet (`assistant.consent.*`, ⚖).
- **Orb** (UI-02 §6.4): idle → listening (typing) → thinking (request) → guidance / urgent; label below it in a live region. Shrinks to 56 dp in a compact header when the user scrolls up (`spring.gentle`).
- **Assistant card:** `reply.text` (`body-lg`), collapsible «تقدر تعمل إيه في البيت» and «روح الطوارئ فوراً لو…», specialty chip (fixed list), one-line reason, triage pill: `soon` blue, `urgent` amber card «لازم تشوف دكتور خلال ٢٤ ساعة», `routine` neutral, `self_care` teal.
- **Clarify chips** (US-14-AC3): up to 3 groups (`assistant.chip.*`), tap sends the chip text.
- **Composer:** max 2,000 chars, hint `assistant.inputHint`, send disabled while pending, retry with the same `client_message_id`.
- **Fallback (AI down / timeout):** inline card `assistant.unavailable` + [«اختار التخصص بنفسك»] → specialty directory sheet (list from UI-03 §3.12, each with a one-line description). The red-flag engine still runs (US-13-AC4).
- **Menu ⋯:** delete chat (`assistant.delete*`), about the assistant.

#### M-PAT-14E Red-flag emergency takeover · US-15-AC1 · E-AI-01
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  (solid #7F1D1D, white text)
 ◔ 5 (close locked)
        🚑
  These symptoms need
  emergency care NOW
  Don't wait. Call an ambulance, or
  have someone take you to the ER.
 ┌──────────────────────────────────┐
 │  📞  CALL AMBULANCE 123          │  ← 72 dp, #30D158 / black text
 └──────────────────────────────────┘
 (   📍 Nearest emergency department   )
 (   ✉ Tell your family                 )
 Until help arrives: sit or lie down
 comfortably. Don't drive yourself.
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Opens **instantly** (T-13, 0 ms), `error` haptic once, no orb, no 3D. Close button locked 5 s with a ring, then «أنا كويس، ارجع للمحادثة» (logged). No LLM text appears on this screen.
- Call button uses `tel:{EMERGENCY_PHONE_NUMBER}`. «أقرب طوارئ» opens Maps with the query «طوارئ» near the device (no PHI in the URL). «بلّغ أهلك» opens the SMS composer prefilled with a generic message, never auto-sent.

#### M-PAT-14C Crisis screen · US-15-AC3 · E-AI-02
Calm design: soft blue/teal gradient background (not red), slow orb `crisis` state (0.1 Hz) or a static circle in RM, `crisis.title`, `crisis.body`, [«كلّم خط الدعم النفسي»] (number from `ref.crisis_resources`), («لو في خطر دلوقتي اتصل ١٢٣»), («ابعت لحد بتثق فيه»), («عايز أكمّل كلام»). No haptic. Generative replies stay off unless the user continues.

### M-PAT-15 Settings · `/p/account/settings`
Grouped list: Language · Text size (live preview) · Appearance (system/light/dark/sunlight) · Eastern digits (with `settings.easternDigitsNote`) · Haptics · Signed-in devices (revoke) · Log out of all devices (confirm) · Face data (→ M-PAT-12 manage) · Delete account (⚖ `settings.deleteAccountBody`, step-up, typed confirmation) · Privacy policy · Support · About (version, licences incl. DDInter attribution).

### M-PAT-16 Break-glass detail · `/p/access/break-glass/:eventId` · US-17-AC4
Shield icon header, `breakGlass.detail.title`; body `breakGlass.detail.body`; method line; «الدخول ده بيتراجع من إدارة النظام»; secondary «مكنتش في طوارئ؟ بلّغنا» → support form (category preset, audited).

### M-PAT-17 Dose reminders setup · `/p/prescriptions/:id/reminders`
Per medication: frequency (from the prescription, read-only) → time pickers (Cupertino wheel / M3 time picker) pre-filled with **suggested** times that the patient must confirm (labelled «مقترح — عدّله براحتك»). Saved times show `dose.userTimes` on cards. Local notifications use `dose.reminder.notification` (no drug names). Missed dose → card state `dose.missed` + `dose.missedHelp` (⚕).

---

## 2. Paramedic Emergency Mode (always Emergency theme, Tier E)

Global rules: black background, `em.*` type, targets ≥ 64 dp (calls 72 dp), no swipe-only actions, no glass/3D/decorative motion, wakelock while a session is open, OFFLINE ribbon on every screen when offline, primary actions at the bottom.

### M-PAR-01 Shift start · `/er/shift`
After login + TOTP (`aal2`). Big rows: location permission (`er.shift.location` + why), default reason (`er.reason.*` large radio list, default «فاقد الوعي»), incident ref (optional), [«ابدأ الوردية»]. Background: refresh emergency-card JWKS, pre-refresh the token (E-NET-07). Next time, opens straight to the scanner (settings remembered for the shift).

### M-PAR-02 One-tap face scan · `/er/scan` · US-16
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  (black)
 ≡ shift      EMERGENCY SCAN  ● LIVE
 ┌──────────────────────────────────┐
 │                                  │
 │       ╭──────────────╮           │  ← static 4 px white oval
 │       │  rear camera │           │    (no mesh, no ring: Tier E)
 │       │   preview    │           │
 │       ╰──────────────╯           │
 │                                  │
 │   ⟨ Light is low — torch on ⟩    │  ← em.body hint chip
 └──────────────────────────────────┘
 ▓▓▓▓▓▓▓▓▓░░░  identifying…           ← only animation allowed
 [🔦]          [ ◉ CAPTURE ]   [↺cam]  (64 dp)
 ┌───────────────┐┌───────────────┐
 │ ▣ SCAN CARD QR ││ 🪪 NATIONAL ID │  (64 dp, always visible)
 └───────────────┘└───────────────┘
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Camera opens in ≤ 1 s (US-16-AC1). **Auto-capture** after 500 ms of a green quality gate; manual shutter also available. Torch auto-on when dark (E-BIO-02).
- Hints from UI-02 §6.1 (emergency variants: never ask to remove masks/bandages).
- At 8 s without a response → `scan.slowNetwork` + card button highlighted (request continues).
- Results: `match` → M-PAR-03 (0 ms) + `success` haptic; `possible_match` → M-PAR-04 + `warning`; `no_match` → M-PAR-05 + `warning`; `BIO_LOW_QUALITY` ×3 → fallbacks emphasised; `BIO_LIVENESS_FAILED` → retry + card; `AI_SERVICE_UNAVAILABLE` → `scan.aiDown` with the two big buttons; offline → M-PAR-06.

### M-PAR-03 High-contrast emergency profile · `/er/profile/:sid` · US-17
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  (black)
 ⚠ LOW-CONFIDENCE ID — verify when   ← yellow band, only if low_confidence
   possible
 MONA ADEL · 36 F · …9Q4D   ⏱ 52 min
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃ ⛔ ALLERGIES                    ┃  #7F1D1D block, white, em.h
 ┃ PENICILLINS — ANAPHYLAXIS  ✓   ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
 BLOOD TYPE        O+      ✓ verified   (em.display 40)
 ───────────────────────────────────
 CHRONIC           Asthma (2015)
 ───────────────────────────────────
 MEDICATIONS       Warfarin 5 mg — daily
                   Salbutamol — as needed
 ───────────────────────────────────
 ⓘ Logged and reviewed
 ┌──────────────────────────────────┐
 │  📞  CALL FAMILY                 │  72 dp green, bottom
 └──────────────────────────────────┘
 (Extend 30 min)          (Close case)
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Shows **exactly** the closed-schema fields (03 §9.4). The critical block fits without scrolling on a 6" screen.
- Self-reported blood type → yellow ⚠ line `er.profile.bloodSelf`. No allergies → `er.profile.noAllergies` (never blank).
- `has_shared_contacts = false` → call button replaced by the text `er.profile.noContacts`.
- Timer: at 10 min left → «مدّ ٣٠ دقيقة» becomes prominent; extend sheet asks the reason (once only). Expired → full overlay `er.session.expired` + «امسح تاني» (`410`).
- No navigation exists to history or any other patient data (US-17-AC5).

### M-PAR-04 Possible-match confirmation (sheet, 90%) · US-16-AC3 · E-BIO-03
Title `er.possible.title`, body `er.possible.body`. Up to 2 candidate cards (each 120 dp tall): big sex icon + «أنثى · ٣٠–٣٩ سنة» and [«ده المريض»]. Below: («مش حد فيهم») → M-PAR-05. A 120 s countdown shows the candidate-token expiry. Confirm → profile with the low-confidence band.

### M-PAR-05 No registered match · E-BIO-01
Grey header `er.noMatch.title` + `er.noMatch.body`; the unknown-patient checklist (4 large tappable check rows: they are reminders, not stored); actions: [«امسح تاني ({left} فاضل)»], [«امسح كارت الطوارئ»], [«دوّر بالرقم القومي»], and, **only if the UI-07 §2.1 scope change is approved**, («افتح ملف طوارئ مؤقت»).

### M-PAR-06 Offline mode & card QR · `/er/offline` · EXT-04, E-NET-01
Orange OFFLINE ribbon. Big QR scanner viewport with `er.offline.scanCard`; under it `er.offline.waiting` and the outbox count `er.offline.queued`. Result: the M-PAR-03 layout with an orange `er.offline.cardBanner` (or red `er.offline.cardExpired` / `er.offline.cardInvalid`). When back online with the card on screen → («افتح الجلسة الكاملة»).

### M-PAR-07 Emergency contacts · `/er/contacts/:sid` · US-18
List ordered by priority: name (`em.h`), relationship, phone (Western digits, `em.body`), and a 72 dp «كلّم» button per row (`tel:`). Re-fetched on every open (E-PRIV-01). 403 → `er.profile.noContacts`.

### M-PAR-08 National ID search · `/er/search`
Warning line `er.nationalId.onlyIfHeld`; one 64 dp numeric field (14 digits, grouped), reason pre-filled from the shift; [«دوّر»]. Rate limit → `er.rateLimited`.

---

## 3. Pharmacist Mobile Mode

### M-PHA-01 Scanner · `/rx/scan` · US-10
Full-screen rear camera with a 260 dp square frame, torch, hint `verify.scanHint`. Decode → local signature check (cached `rx-jwks`) → if bad: instant red screen (M-PHA-02 failed) with `error` haptic; if good → verify call with the seal in `verifying`.

### M-PHA-02 Verification result
Same result matrix as web W-PHA-01r (UI-05 §4) in a full-height card: coloured header, `RxSeal` (stamp + `success` haptic for valid), prescriber block, patient minimum (name, age, sex, **allergies**), notes (override / check bypassed / suspended-after-issue). Primary [«كمّل للصرف»] at the bottom. Offline → `authenticOffline` and the dispense button disabled with `pharmacy.offline`.

### M-PHA-03 Partial / full dispensing sheet (large detent) · US-11/12
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
            ━━━━ (grabber)
 RX-…0123 · قيد الصرف    ⏱ 14:32
 Mona A. · 36 F · [⛔ Penicillins]
 ┌──────────────────────────────────┐
 │ 💊 Augmentin 875/125 mg tab      │
 │ Prescribed 14 · Remaining 14     │
 │ [ − ]   14   [ + ]   (Substitute)│
 │ [✓ Dispensed]  [ Not in stock ]  │
 ├──────────────────────────────────┤
 │ 💊 Aspocid 75 mg                 │
 │ 30 · 20 done (El-Nour) · left 10 │
 │ [ − ]   10   [ + ]               │
 │ [✓ Dispensed]  [ Not in stock ]  │
 ├──────────────────────────────────┤
 │ 💨 Ventolin inhaler              │
 │ [ − ]    0   [ + ]  → Remaining  │
 │ [  Dispensed ]  [✓ Not in stock ]│
 └──────────────────────────────────┘
 ⚠ 1 item stays remaining (any pharmacy until 24 Dec)
 [x] Counselling given
 [      Dispense 2 of 3  (Face ID)  ]
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```
- Item-level controls from the brief: «اتصرف» / «لسه متبقّي» (via «مش متوفر عندي»), steppers with max = remaining, substitute sheet (equivalents only).
- Not swipe-dismissible while edited (UI-02 §5.5 clinical rule).
- Primary triggers **pharmacist step-up** once per verification context (`stepUp.reason.dispense`), then the idempotent dispense with `dispense.confirming`. Lease, race, context-expiry and offline behaviours match web W-PHA-02.

### M-PHA-04 Success
Status badge morph («قيد الصرف» → «اتصرفت بالكامل» or «اتصرف جزء منها»), `success` haptic, summary of what was dispensed, [«امسح روشتة تانية»] focused.

### M-PHA-05 Manual Rx entry · `/rx/manual`
Rx number field with mask + 6-char code field (uppercase, ambiguous characters handled: O/0, I/1), [«كمّل»] → M-PHA-06.

### M-PHA-06 Presence verification
Two big options: SMS code to the masked patient phone (then a 6-box OTP), or face 1:1 (`FaceMeshScanner` mode `pharmacyVerify`, front/rear flip so the pharmacist can point the phone at the patient, with challenge prompts addressed to the patient). Neither → `presence.none`.

### M-PHA-07 Dispensed log · `/rx/history`
Grouped by day; rows: time, Rx tail, n/m items, method icon; no patient names in the list.

---

## 4. Shared Mobile Overlays

| Overlay | Trigger | Spec |
|---------|---------|------|
| Step-up | Pickup QR, share code, delete face, pharmacist dispense | Our pre-sheet (`stepUp.title` + reason) for 300 ms → system biometric prompt; failure → `stepUp.failed`; key invalidated → re-register flow |
| Session lock | Token revoked / suspended / licence invalid | Full-screen lock (`lock.*`), only «خروج» and «كلّم الإدارة» |
| Offline ribbon | `connectivity_plus` none, or request timeout | Top ribbon (40 dp patient/pharmacist, 48 dp emergency), with last-updated time |
| Update required (P2) | Backend minimum version | Blocking card with store link; Emergency card stays reachable |

---

## 5. Definition of Done (UI-06)
- [ ] Every screen above exists in Figma at 390 × 844 and 402 × 874 (iPhone) and 360 × 800 (Android) in AR + EN, Light + Dark, plus Emergency/Sunlight where relevant.
- [ ] Large-Font ×1.30 verified on M-PAT-04, 07D, 08, 11, 14 and all paramedic screens (capped at ×1.30).
- [ ] iOS/Android chrome differences implemented via adaptive widgets; clinical components identical (golden tests on both platforms).
- [ ] Tier E rules verified on all paramedic screens and on M-PAT-11/14E (widget tests from UI-02 §11).
- [ ] FLAG_SECURE / snapshot blur on the screens in §0.3.
- [ ] Usability targets (role-07 §10): paramedic ≤ 10 s to state the allergy; patient finds the call button on chest-pain wording; pharmacist partial dispense ≤ 60 s.

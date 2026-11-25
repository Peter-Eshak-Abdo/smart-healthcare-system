# UI-05 — Web Desktop & Laptop Screen Blueprints (Next.js 16 · Tailwind v4 · shadcn/ui)

> **Owner:** UI/UX (M8) · **Implementer:** Web (R5, `web-admin/`)
> **Status:** Draft for team review · **Date:** 2026-11-24
> **Depends on:** UI-01 (tokens, components §10–§12), UI-02 (motion T-xx, §5), UI-03 (copy keys), UI-04 (routes, flows), role-05 (stack, components, API usage), 03-API.
> **Design widths:** **1440** (desktop) and **1280** (laptop), with responsive notes for 1024 and 768.

---

## 0. Conventions

### 0.1 How each screen is specified
**ID · Route · Role · Stories** → **Purpose** → **Layout** (RTL wireframe) → **Regions & components** → **Data** → **States** → **Interactions & shortcuts** → **Motion** → **Copy keys** → **Accessibility** → **Edge cases** (links to UI-07).

### 0.2 Wireframe notation
Wireframes are drawn **RTL** (Arabic is the default locale), so the sidebar is on the **right** and reading starts top-right. Labels are short English stand-ins for the UI-03 keys, because Arabic inside monospace diagrams misaligns in most renderers. `[Btn]` = primary, `(btn)` = secondary/ghost, `{field}`, `▣` = card/bento tile, `⛔ ⚠ ●` = severity, `≡` = menu, `⌘K` = command palette.

### 0.3 Shell grid (all logged-in screens)

| Width | Sidebar | Page padding | Content width | Columns × gutter | Column width |
|-------|---------|--------------|---------------|------------------|--------------|
| 1440 | 264 | 32 | 1440 − 264 − 64 = **1112** | 12 × 24 | ≈ 70.7 |
| 1280 | 264 (auto 72 on Rx builder) | 24 | 1280 − 264 − 48 = **968** | 12 × 20 | ≈ 62.3 |
| 1024 | 72 | 24 | 1024 − 72 − 48 = **904** | 12 × 16 | ≈ 60.7 |
| 768 | slide-over | 16 | 736 | 8 × 16 | ≈ 78 |

TopBar height 64 (glass). Page title row 56. Bento gap 20 (xl) / 16 (lg).

### 0.4 States every page implements (role-05 §7, role-07 DoD)
`loading` (skeleton after 300 ms) · `empty` · `error` (`ProblemAlert` with code-driven copy and `X-Request-Id`) · `offline` (ribbon + disabled network-only actions) · `forbidden` (redirect, never a half-rendered page) · `session-timeout` overlay.

---

## 1. Shared Shell

### W-SHELL TopBar + Sidebar
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [Avatar▾] [🔔] [EN] [◐]    {⌘K  Search patients / Rx / users…}         SmartHealth ◈ [≡] │  ← TopBar 64, glass
├───────────────────────────────────────────────────────────────────────┬──────────────┤
│                                                                       │ ◈ Today      │
│                       PAGE CONTENT                                     │ 👥 Patients  │
│                                                                       │ 🔑 Open code │
│                                                                       │ 📜 Issued Rx │
│                                                                       │ ──────────── │
│                                                                       │ ⚙ Settings  │
│                                                                       │ ⎋ Log out    │
└───────────────────────────────────────────────────────────────────────┴──────────────┘
```
- **Sidebar item:** 40 px tall, icon 20, label `label` token; active = `--sh-primary-subtle` fill + 3 px inline-start bar + bold label. Collapsed (72): icon only with tooltip.
- **Notifications 🔔:** popover with up to 10 items (licence expiry, new alert re-check results E-CLIN-04, admin approvals). No PHI beyond what the role may see.
- **Theme ◐:** Light / Dark / Sunlight / System. **Text size** lives in the avatar menu (UI-01 §4.6).
- **Offline ribbon** (UI-01 §11.7) docks under the TopBar, full width, 36 px.
- **Session-timeout overlay** (T-12): 60 s warning dialog (`session.warning`), then the full overlay with `ReauthDialog`; page stays mounted.
- **Motion:** sidebar collapse width `spring.gentle`; labels fade at 50%.

---

## 2. Authentication

### W-AUTH-01 Login · `/[locale]/login` · all staff · US-19
**Purpose:** fast, trustworthy sign-in for clinicians and admins.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                         [EN]  SmartHealth ◈   │
│  ┌────────────────────────────────┐   ┌──────────────────────────────────┐   │
│  │                                │   │  Log in  (login.title)            │   │
│  │   3D brand object (Tier A):    │   │  {Email or mobile}                │   │
│  │   slow-turning shield + pulse  │   │  {Password            👁}         │   │
│  │   line, brand gradient         │   │                (Forgot password?) │   │
│  │   Tier B/C: static SVG         │   │  [        Log in        ]          │   │
│  │                                │   │  ── or ──                          │   │
│  │  "One identity. One record."   │   │  (Passkey — P2, hidden by flag)    │   │
│  └────────────────────────────────┘   │  🔒 Protected by 2-step login      │   │
│        inline-end half (left in AR)   └──────────────────────────────────┘   │
│                                              inline-start half (right in AR) │
└──────────────────────────────────────────────────────────────────────────────┘
```
- **Layout:** 2 columns at ≥ 1024 (form 480 wide on the inline-start side, hero on the inline-end side); single column below. Canvas uses the brand glows (UI-01 §3.2.4).
- **"Biometric login" on web:** in MVP the second factor is TOTP (role-05 §4.2). A **Passkey (WebAuthn)** button is designed but hidden behind `NEXT_PUBLIC_FEATURE_PASSKEY=false` until the Security Lead approves it. It would be an extra factor, never a replacement for MFA on staff accounts.
- **States:** idle · submitting (button loading, fields disabled) · `login.failed` (inline banner above the button; password field cleared, focus returns to it) · `login.throttled` (countdown) · CAPTCHA after 3 failures (E-AUTH-07) · offline (`common.offlineRibbon`; button disabled with reason «محتاج نت عشان تدخل»).
- **Shortcuts:** Enter submits. Caps-lock warning under the password field.
- **Copy:** `login.*`, `forgot.*`, `app.tagline`.
- **A11y:** labels visible; error announced with `role="alert"`; the 3D object is `aria-hidden`.
- **Edge cases:** E-AUTH-07, E-NET-07.

### W-AUTH-02 MFA enrolment · `/mfa/enroll`
Two-step card (max-width 560): ① QR (200 px, white panel, quiet zone) + manual secret (mono, copy) ② 6-box OTP. Primary: «فعّل» (disabled until 6 digits). Help link `mfa.lost`. Success → role home with toast «الحماية الإضافية اشتغلت».

### W-AUTH-03 MFA verify · `/mfa/verify`
Single card: `mfa.verify.title`, OTP 6 boxes (`code-lg`), auto-submit on the 6th digit, paste support, «جرّب طريقة تانية» → `mfa.lost`. Wrong code → boxes turn danger, shake (non-clinical form; UI-02 §5.6), clear, refocus.

### W-AUTH-05 Not authorised / locks · `/not-authorized?reason=…`
Centred card, illustration, title + body by reason: `rbac` → `err.rbac`; `license` → `lock.license.*` (status-specific); `suspended` → `lock.suspended.*`. Actions: «كلّم الإدارة» (mailto, no PHI) and «خروج». **No other navigation** is shown.

---

## 3. Doctor Workspace

### W-DOC-01 Doctor Dashboard · `/doctor` · US-09 · role-05 §7.1
**Purpose:** today's work at a glance; reach any granted patient in ≤ 2 actions.

```
┌──────────────────────────────────────────────────────────────────────────┬────────┐
│ Good morning, Dr Karim                    [ Open with code (R) ] (⌘K)     │Sidebar │
│                                                                          │        │
│ ┌──────────────────────────────── HERO 12×1 ────────────────────────────┐│        │
│ │ 🔎 {Search granted patients by MRN or national ID…}         4+ chars   ││        │
│ └───────────────────────────────────────────────────────────────────────┘│        │
│ ┌──── S 3×1 ────┐┌──── S 3×1 ────┐┌──── S 3×1 ────┐┌──── S 3×1 ────┐     │        │
│ │ Active grants ││ Rx today      ││ Overrides/wk  ││ Expiring ≤3d  │     │        │
│ │      18       ││      7        ││      1        ││   2 ⚠         │     │        │
│ └───────────────┘└───────────────┘└───────────────┘└───────────────┘     │        │
│ ┌──────────── L 8×2: Recently opened patients ─────┐┌── M 4×2: Expiring ─┐│        │
│ │ Mona Adel · 36F · SH-…9Q4D · ⛔ Penicillin   ›   ││ Ahmed S. · 2 days  ││        │
│ │ Youssef K. · 61M · SH-…2LX7 · ⚠ Warfarin     ›   ││ (Ask for new code) ││        │
│ │ …10 rows, row = 56 px                            ││ Hana M. · 1 day    ││        │
│ └──────────────────────────────────────────────────┘└────────────────────┘│        │
└──────────────────────────────────────────────────────────────────────────┴────────┘
```
- **Regions:** HERO search (`Command`-style combobox: results show name, age/sex, MRN last 4, top critical chip). KPI tiles (S) use `display` numbers; **no count-up tickers** on clinical screens (UI-02 §5.12). Recent patients (L) list with the most critical chip per patient (anaphylaxis first). Expiring grants (M) with hint `doctor.expiringHint`.
- **Data:** `GET /v1/doctor/patients?query=` (debounced 300 ms), `GET /v1/doctor/patients` (recent, expiring), `GET /v1/doctor/prescriptions` (today count, overrides).
- **States:** skeleton tiles; empty (`doctor.empty.*` with a big «افتح ملف بكود» CTA); error ProblemAlert per tile (a failing tile never blanks the whole page).
- **Interactions:** row click → T-02 shared transition into W-DOC-04. Keyboard: ↑/↓ moves through rows, Enter opens. `R` opens Redeem.
- **Responsive:** 1280: tiles keep spans; 1024: Recent (12×2) above Expiring (12×1); 768: single column.

### W-DOC-02 My patients · `/doctor/patients`
DataTable: name · age/sex · MRN (last 4 shown, full on hover with copy) · critical chips (max 2 + «+n») · grant until · last visit · actions (Open, New Rx). Filters: grant expiring, has anaphylaxis, chronic. Empty → redeem CTA. Search is the same scoped search (US-09-AC4).

### W-DOC-03 Redeem share code · `/doctor/access/redeem` · US-09-AC1
Centred card (560):
```
┌ Open a patient record with a code ───────────────────────┐
│ {MRN  SH-________}                                        │
│ {Share code  [ ][ ][ ][ ][ ][ ]}                          │
│ ⓘ Access lasts 30 days (set by the patient)               │
│ [ Open record ]                                           │
└───────────────────────────────────────────────────────────┘
```
States: invalid/expired → `redeem.invalid` (both fields marked, code cleared); rate limited → `redeem.rateLimited` with countdown; success → T-02 into the profile with toast «الملف اتفتح لحد {date}».

### W-DOC-04 Patient Medical Profile · `/doctor/patients/[patientId]` · US-06/09/20 · role-05 §7.2
**Purpose:** everything a clinician needs about this patient, with critical safety info impossible to miss.

```
┌──────────────────────────────────────────────────────────────────────────┬────────┐
│ ┌ PatientHeader (sticky, 120 px) ─────────────────────────────────────┐  │Sidebar │
│ │ (End visit)  Grant until 24 Dec  ·  SH-7K2M9Q4D ⧉  ·  36F  · Mona Adel│ │ (72 on │
│ │ [⛔ ANAPHYLAXIS: Penicillins] [🩸 O+ self-reported ⚠] [Asthma]        │  │ narrow)│
│ │ [Meds (2) ▾]  [ⓘ 1 restricted record]                                 │  │        │
│ │ Tabs:  Summary | History | New encounter | Prescribe                  │  │        │
│ └──────────────────────────────────────────────────────────────────────┘  │        │
│ ┌──── L 6×2: Allergies & critical ─────┐┌── L 6×2: Active prescriptions ─┐│        │
│ │ ⛔ Penicillins — anaphylaxis ✓ clin.  ││ RX-2026-000123 · قيد الصرف     ││        │
│ │ ● Ibuprofen — rash (self) (Verify)   ││   2 items · 6 days left    ›   ││        │
│ │ ◌ "Dust" uncoded (Code it)           ││ RX-2026-000101 · اتصرف جزء     ││        │
│ │ Blood: O+ (self) (Confirm)           ││   1 item left              ›   ││        │
│ └──────────────────────────────────────┘└───────────────────────────────┘│        │
│ ┌──── W 6×1: Problem list ─────────────┐┌── W 6×1: Recent encounters ───┐│        │
│ │ Asthma (since 2015) · HTN   (+ Add)  ││ 12 Nov · Dr Sara · J45.9   ›  ││        │
│ └──────────────────────────────────────┘└───────────────────────────────┘│        │
└──────────────────────────────────────────────────────────────────────────┴────────┘
```
- **PatientHeader** (`components/patient/PatientHeader`) is identical on every tab and **never scrolls away**. Order of chips: anaphylaxis/severe allergies → blood type → chronic conditions → meds popover → restricted indicator. Self-reported items carry the ⚠ style and the tooltip `critical.verifyWarning.staff`.
- **Allergies tile:** each row has actions per source: patient-reported → «أكّد / ارفض» (US-06-AC4); uncoded → «كوّدها» (E-CLIN-05). Confirming opens a small dialog with the coded allergen combobox and severity.
- **Blood type:** «أكّد فصيلة الدم» opens a dialog (requires a reason source: lab report / transfusion record). Clinician-confirmed values show ✓.
- **Data:** `GET /v1/doctor/patients/{id}/summary`.
- **States:** header skeleton keeps its height (no layout jump); `ACCESS_GRANT_REQUIRED` → redirect + toast (`grant.revokedRedirect`); 404 → `err.notFound` page.
- **Motion:** T-02 from list; tab switch T-06; header chips never animate.
- **A11y:** header is a `region` with `aria-label="معلومات المريض المهمة"`; the anaphylaxis chip is the first focusable element after the skip link.

### W-DOC-05 History · `/doctor/patients/[patientId]/history` · US-09-AC2
Virtualised timeline (role-05 `HistoryTimeline`): month separators, encounter cards (date, facility, doctor, specialty, diagnoses chips with ICD code, linked Rx). Filter chips: Visits / Diagnoses / Medications. Restricted entries → `RestrictedPlaceholder` («سجل مقيّد — المريض خفاه»), no click. Cursor pagination with «اعرض أقدم». Entered-in-error items appear collapsed and struck through for the author only (E-REC-02).

### W-DOC-06 Encounter · `/doctor/patients/[patientId]/encounters/[encounterId]` · US-06/07
```
┌──────────────────────────────────────────────────────────────────┬────────┐
│ PatientHeader (sticky)                                            │Sidebar │
│ ┌─────────── 7 cols: Notes ───────────────┐┌── 5 cols: Diagnoses ─┐│        │
│ │ {Chief complaint}                       ││ {ICD-10 search AR/EN}││        │
│ │ 👁‍🗨 Clinician-only notes  {textarea}     ││ ★ J45.9 Asthma (primary)│      │
│ │ 👁 Patient summary (visible) {textarea} ││ ○ I10 Hypertension    ││        │
│ │ ✓ Draft saved 10:42                     ││ [x] Add to problem list││       │
│ └─────────────────────────────────────────┘└──────────────────────┘│        │
│ Addenda (after 24 h): list + (Add addendum)                        │        │
│                                   (Prescribe for this visit)  [Save]│        │
└──────────────────────────────────────────────────────────────────┴────────┘
```
- The two note fields are visually distinct: clinician-only has a sunken background + eye-slash icon; the patient-visible one has a white background + eye icon and the caption «المريض هيشوف ده».
- Autosave every 5 s of idle (draft indicator, UI-02 §5.6). `If-Match` versioning: 409 → diff dialog (`encounter.conflict`) with "Theirs / Yours" columns and «أعد تعديلي».
- After 24 h: fields read-only, banner `encounter.locked`, «ضيف ملحق».
- One-primary rule: choosing a second primary shows `encounter.onePrimary` inline and keeps the first.

### W-DOC-07 Dynamic E-Prescription Builder · `/doctor/patients/[patientId]/prescribe` · US-08 · EXT-01/02 · role-05 §7.3
**Purpose:** prescribe fast while making harmful prescriptions very hard.

```
┌──────────────────────────────────────────────────────────────────────────────────┬──┐
│ PatientHeader (sticky)                                                           │SB│
│ ┌──────── 8 cols: Items ──────────────────────────────┐┌─ 4 cols: Safety (sticky) ─┐│72│
│ │ 1 ┃⛔ {Augmentin 875/125 mg tab  ▾}  [Controlled?]   ││ Safety alerts  ● checking ││  │
│ │   ┃  {1 tab} {oral▾} {twice daily▾} {7 d} {14 tab}  ││ ┌─────────────────────────┐││  │
│ │   ┃  {After meals…}   [x] Substitution allowed  (🗑) ││ ▌⛔ CONTRAINDICATED       │││  │
│ │ ───────────────────────────────────────────────────  ││ ▌Penicillin anaphylaxis   │││  │
│ │ 2 ┃⚠ {Aspocid 75 mg tab ▾}                           ││ ▌Augmentin → amoxicillin  │││  │
│ │   ┃  {1 tab} {oral} {once daily} {30 d} {30 tab}    ││ ▌Source: DDInter 2.0      │││  │
│ │ ───────────────────────────────────────────────────  ││ ▌   (Document override)   │││  │
│ │ (+ Add medicine)                                     ││ └─────────────────────────┘││  │
│ │                                                      ││ ┌─────────────────────────┐││  │
│ │                                                      ││ ▌⚠ MAJOR Warfarin+Aspirin │││  │
│ │                                                      ││ ▌↑ bleeding risk          │││  │
│ │                                                      ││ ▌Reviewed: Dr Sara 1 Sep  │││  │
│ │                                                      ││ ▌   (Document override)   │││  │
│ │                                                      ││ └─────────────────────────┘││  │
│ │                                                      ││ • 1 minor note ▾          ││  │
│ └──────────────────────────────────────────────────────┘└───────────────────────────┘│  │
│ ┌ SignAndIssueBar (sticky bottom, e2) ─────────────────────────────────────────────┐ │  │
│ │ [Sign & issue ⌘↵](disabled)  (Preview)   2 alerts need a documented reason ·2 items│ │  │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │  │
└──────────────────────────────────────────────────────────────────────────────────────┴──┘
```

**Item row (`RxItemRow`)**
| Field | Component | Behaviour |
|-------|-----------|-----------|
| Drug | `DrugSearchCombobox` (`Command` in `Popover`) | Searches brand + generic; results show strength, form, «Controlled» badge; ↑↓ Enter; recently used first |
| Dose | text with presets by dosage form | e.g. tablet: ½, 1, 2 tab |
| Route | `Select` | Defaulted from drug |
| Frequency | `Select` | `every_x_hours` reveals hours input (1–24) |
| Duration | number (days) | |
| Quantity | number + unit | Auto-suggested = dose × frequency × days (`rxb.quantitySuggested`), editable; base units (E-RX-12) |
| Instructions | textarea (1 line, grows) | Patient-facing; shown in the app |
| Substitution | `Switch` | Disabled + off for controlled (`rxb.substitutionControlled`) |
| Row alert marker | 3 px inline-start bar + icon | Colour of the highest alert touching this drug |

**Safety panel (`AlertList`)**
- Sticky, 4 columns, scrolls independently; header shows a live status dot: «بنراجع…» while the check runs (`useDebouncedSafetyCheck`, 400 ms, previous results kept visible).
- Ordered by severity (contraindicated → major → moderate → minor group). Each banner per UI-01 §10.3: title, body (mechanism + management), source, "previously reviewed", **Document override** (for blocking ones).
- `checks_status = unavailable` → grey banner `rx.checkUnavailable` + `ManualReviewAttestation` checkbox (blocking until ticked). `partial` → info banner `rx.checkPartial`.
- Uncoded allergy → permanent moderate banner `alert.uncodedAllergy`.
- Restricted record medication → body uses `rxb.alerts.restrictedMed`.
- Clicking a banner scrolls to and highlights the related row (1 s highlight fade); clicking a row's marker focuses its banner.

**SignAndIssueBar**
- Left (inline-end in AR) to right: primary **«وقّع وابعت الروشتة»** (`⌘/Ctrl Enter`) · «معاينة» · summary text.
- Disabled while: any blocking alert lacks an override, a check is in flight, or the attestation is missing. The reason is always shown (`rx.overrideRequired` / `rxb.checking`). Pressing it while blocked moves focus to the first blocking banner (role-05).
- On click: `MorphButton` loading → `POST /v1/prescriptions` with `Idempotency-Key`. `AUTH_STEP_UP_REQUIRED` → `ReauthDialog` → auto-retry with the same key. `RX_ALERT_OVERRIDE_REQUIRED` → new alert pinned at the top with `signIssue.serverNewAlert` and the bar re-blocks. Success → W-DOC-07c.

**States:** empty builder («ضيف أول دوا» illustration + combobox focused) · draft restore banner (`draft.restore`, E-NET-06) · offline (alerts panel greys, Sign & Issue disabled «محتاج نت عشان تبعت الروشتة») · grant revoked → redirect.

**Responsive:** 1280 → sidebar auto-collapses to 72; items 8 / alerts 4 kept. 1024 → alerts panel becomes a collapsible right-side (inline-end) drawer with a badge count on the toggle; blocking alerts also show inline under their rows. 768 → stacked; the bar stays sticky.

**A11y:** blocking banners `role="alert"`; the panel is a `complementary` landmark «تنبيهات السلامة»; row markers have text equivalents.

#### W-DOC-07a Override dialog (`OverrideDialog`) · EXT-02-AC3 · E-CLIN-02
```
┌ Document alert override ────────────────────────── ✕ ┐
│ ⛔ Contraindicated — Penicillin anaphylaxis            │
│ Reason (required)                                      │
│ ( ) Benefit outweighs risk                             │
│ ( ) Allergy disputed                                   │
│ ( ) Desensitisation protocol                           │
│ ( ) Monitored setting                                  │
│ ( ) Other                                              │
│ Justification {…………………………………………………}   12/15          │
│ [x] I take clinical responsibility for this decision   │
│ ⓘ Contraindicated: we'll ask for your authenticator code│
│                         (Cancel)   [Save override]      │
└────────────────────────────────────────────────────────┘
```
- Width 560. Save disabled until reason + justification (≥ 15 chars, ≥ 3 words, not repeated characters) + checkbox. Counter turns success at 15.
- For `contraindicated`: Save → `ReauthDialog` (TOTP) → stored (pending Security Lead decision, UI-01 §9.1). For `major`: stored directly.
- Not dismissible by Esc/scrim when the justification has text (discard confirm).
- After saving, the banner collapses to a green-bordered line «اتوثّق — {reason}» with «عدّل».

#### W-DOC-07b Preview (read-only modal, 880 wide)
Exactly what the pharmacist and patient will see: items, instructions in Arabic, overrides summary, expiry. Buttons: «رجوع للتعديل», «وقّع وابعت».

#### W-DOC-07c Issued confirmation (`RxSummaryCard`)
Seal in `authentic` state (UI-02 §6.3.1, `spring.snappy`), `issued.title`, Rx number (`code-lg` + copy), **paper code shown once** in a dashed box with `issued.paperCodeHint`, [«اطبع للمريض»] → W-DOC-09, (رجوع لملف المريض). Leaving this screen hides the paper code forever (the server only stores its hash).

### W-DOC-08 Prescriptions issued · `/doctor/prescriptions`
DataTable: Rx number · patient (name, MRN last 4) · issued · status badge (UI-01 §9.3) · items · overrides icon · expiry. Row actions: Open, Print, **Cancel** (only for the issuing doctor; dialog with reason radios `rx.cancel.reason.*`; partially dispensed → `rx.cancel.remainingOnly`). Live status: badges morph when dispensing happens (polling 30 s, UI-02 §5.4).

### W-DOC-09 Print view · `/print/prescriptions/[id]` (role-05 §7.6)
A4, monochrome-friendly, no chrome. Header (logo, «روشتة إلكترونية»), Rx number large, prescriber (name, licence, facility), patient (name, age, MRN), items table (Arabic instructions), dates, **verification code box**, QR of the Rx number (not the pickup token), footer «اتحقق منها في أي صيدلية سمارت هيلث. الورقة لوحدها مش كفاية — الصيدلي هيتأكد من هويتك.» Bilingual print toggle (AR / AR+EN).

---

## 4. Pharmacist Verification & Dispensing Portal

### W-PHA-01 Verify · `/pharmacy` · US-10 · role-05 §7.4
```
┌──────────────────────────────────────────────────────────────────────────┬────────┐
│ Verify a prescription        Pharmacy: El-Shifa — Ismailia ▾             │Sidebar │
│ ┌────────── 7 cols ──────────────────────────────┐┌──── 5 cols ─────────┐│        │
│ │ [ Scan QR (S) | Rx number + code (M) ]          ││ Recent verifications ││        │
│ │ ┌────────────────────────────────────────────┐ ││ 10:41 RX-…0123 ✓     ││        │
│ │ │             webcam viewport                 │ ││ 10:12 RX-…0098 ⛔    ││        │
│ │ │          ┌──────────────────┐               │ ││ 09:55 RX-…0091 ⚪    ││        │
│ │ │          │  QR frame 240px  │               │ ││ (no patient names)   ││        │
│ │ │          └──────────────────┘               │ │└─────────────────────┘│        │
│ │ │  "Fit the patient's code inside the frame" │ │                        │        │
│ │ └────────────────────────────────────────────┘ │                        │        │
│ │ (🔦 Torch)  (Switch camera)                     │                        │        │
│ └────────────────────────────────────────────────┘                        │        │
└──────────────────────────────────────────────────────────────────────────┴────────┘
```
- **Scan tab:** `QrScanner` (BarcodeDetector → `@zxing/browser` fallback). On decode: local Ed25519 verification against cached `rx-jwks` **first**; a bad signature goes straight to the red screen without a network call (E-RX-05).
- **Manual tab:** Rx mask `RX-____-______` + 6-char code → presence step (W-PHA-01p).
- **Recent verifications:** time, Rx number tail, result icon. No patient names (minimum necessary on a shared counter screen).
- **Camera denied:** `verify.cameraDenied` + auto-switch to Manual.
- **Offline:** banner `pharmacy.offline`; scanning still works (authenticity only).

#### W-PHA-01p Presence step (manual path) · US-10-AC4
Card with two large options: «ابعت كود SMS لموبايل المريض (+20 10•• ••• 334)» → OTP field; «تحقق بوش المريض» → webcam `FaceMeshScanner` (2D guide on web by default; UI-02 §3) with the challenge prompts. Neither → `presence.none` (danger). Success → result.

#### W-PHA-01r Verification result (replaces the scanner area; header coloured by result)

| Result | Header | Seal (UI-02 §6.3.1) | Body | Actions |
|--------|--------|---------------------|------|---------|
| `valid` | Green «روشتة سليمة وموثّقة» | `authentic` stamp | Prescriber block (name, licence, facility, issued/expiry) · patient minimum (name, age, sex, **allergies**) · override note / check-bypassed note if any | [«كمّل للصرف»] |
| valid + offline | Green outline | `authenticOffline` | Same + `rx.verify.validOffline` | Dispense disabled with reason |
| `already_dispensed` | Grey | `alreadyDispensed` | `rx.alreadyDispensed` with date + pharmacy | (مسح روشتة تانية) |
| `expired` | Grey | `expired` | `rx.verify.expired` | — |
| `cancelled` | Grey | `cancelled` | `rx.verify.cancelled` | — |
| `prescriber_invalid` | Red | `prescriberInvalid` | `rx.verify.prescriberInvalid` | — |
| suspended-after-issue | Green + amber info | `prescriberSuspendedButValid` | `rx.verify.prescriberSuspendedInfo` | [«كمّل للصرف»] |
| `RX_SIGNATURE_INVALID` | **Full-page red takeover** | `failed` (static) | `rx.doNotDispense` + `rx.doNotDispenseBody` | (بلّغ عن الروشتة) · (رجوع) |
| `PICKUP_TOKEN_INVALID` | Amber | — | `err.pickup.invalid` | (امسح تاني) |

### W-PHA-02 Dispense · `/pharmacy/prescriptions/[id]` · US-11/12 · E-RX-01..04
```
┌──────────────────────────────────────────────────────────────────────────────┬────────┐
│ RX-2026-000123 · قيد الصرف           ⏱ verification 14:32 left (ring)        │Sidebar │
│ Patient: Mona Adel · 36 · F   Allergies: [⛔ Penicillins]                    │        │
│ ⓘ Prescriber documented override: Warfarin + Aspirin                         │        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │        │
│ │Medicine            Prescr. Already      Remain  Now     Subst.  Batch Exp │ │        │
│ │Augmentin 875/125   14      0            14      [14▲▼]  (Sub▾)  {…}  {…}  │ │        │
│ │  [✓ اتصرف]  [ ] مش متوفر عندي                                            │ │        │
│ │Aspocid 75          30      20 (El-Nour) 10      [10▲▼]  —       {…}  {…}  │ │        │
│ │Ventolin inhaler    1       0            1       [ 0▲▼]  —                 │ │        │
│ │  [ ] اتصرف  [✓] مش متوفر عندي  → لسه متبقّي                              │ │        │
│ └──────────────────────────────────────────────────────────────────────────┘ │        │
│ ⚠ 1 item will remain — the patient can collect it anywhere until 24 Dec       │        │
│ [x] Counselling given   {Notes…}                                              │        │
│                                              (Cancel)   [Dispense 2 of 3]     │        │
└──────────────────────────────────────────────────────────────────────────────┴────────┘
```
- **Lease:** on open, `POST …/lease`. `RX_LEASE_HELD` → amber `LeaseBanner` `dispense.lease.held` + «كمّل برضه» (confirm). Informational only (US-12-AC6).
- **Item row:** default «هتصرف دلوقتي» = remaining; stepper max = remaining. Two big per-item toggles from the brief: «اتصرف» (sets now = remaining) and «مش متوفر عندي» (sets now = 0 → row label «لسه متبقّي»). Substitute combobox enabled only when allowed; lists equivalents only (E-RX-11). Batch/expiry optional fields.
- **Controlled items:** badge + rule note `dispense.controlledRule`; the stepper enforces the rule client-side; the server is authoritative.
- **Footer:** partial note (`dispense.partialNote`), counselling checkbox, notes, primary «اصرف» / «اصرف {count} من {total}».
- **Submit:** `MorphButton` → `dispense.confirming`; the idempotency key is kept until a definitive response (E-NET-04). The button never re-enables with a new key while one is pending.
- **Race (`RX_QUANTITY_EXCEEDED`):** rows refresh; changed cells flash once (UI-02 §5.10); banner `dispense.race`; the pharmacist reviews and presses again.
- **Context expiry:** ring hits 0 → overlay `dispense.contextExpired` + «امسح تاني».
- **Offline:** Dispense disabled with `dispense.offlineDisabled`.
- **Success:** status badge morph (UI-02 §5.4) → `dispense.successFull` / `dispense.successPartial`; [«امسح روشتة تانية»] focused.

### W-PHA-03 Dispensing log · `/pharmacy/history`
Table: time · Rx tail · items dispensed (n of m) · method (pickup token / SMS / face) · pharmacist · result. Filters: today / week, partial only. No patient names in the list view (open a row to see the minimum details again, which is audited).

---

## 5. ER Desktop Console (P2 route group, Sunlight theme by default)

### W-ER-01 Active cases board · `/er`
```
┌──────────────────────────────────────────────────────────────────────────┬────────┐
│ Emergency cases — General Hospital Ismailia        [ Identify patient (I) ]│Sidebar │
│ ┌──── 4×1 ───────────────┐┌──── 4×1 ───────────────┐┌──── 4×1 ─────────┐ │        │
│ │ MONA A. · 36F · …9Q4D  ││ UNKNOWN #3 (temp)      ││ YOUSSEF K. 61M   │ │        │
│ │ ⛔ PENICILLIN ANAPHYL.  ││ ⚠ treat as unknown     ││ ⚠ low confidence │ │        │
│ │ O+ ✓ · ⏱ 41 min left   ││ ⏱ —                    ││ ⏱ 12 min left    │ │        │
│ └────────────────────────┘└────────────────────────┘└──────────────────┘ │        │
└──────────────────────────────────────────────────────────────────────────┴────────┘
```
- Cards show only emergency-profile fields (closed schema, 03 §9.4) plus the timer. Low-confidence cards have a yellow top band. Temporary records appear only if the scope change in UI-07 §2.1 is approved.
- **Sunlight theme:** black on white, 2 px black borders, `em.*` type sizes on desktop (UI-01 §4.3), no glass, no motion (Tier E).

### W-ER-02 Identify · `/er/identify`
Three equal large tiles (each 360 × 240): «امسح الوش بالكاميرا» (webcam 2D guide), «امسح كارت الطوارئ» (QR), «دوّر بالرقم القومي» (with `er.nationalId.onlyIfHeld`). Reason picker (`er.reason.*`) + incident ref above them. Results follow F-ER1; possible match → candidate dialog (sex + age band only).

### W-ER-03 Emergency profile · `/er/sessions/[sessionId]`
Two-column Sunlight layout: inline-start column = **Allergies block** (red border 4 px, anaphylaxis first, `em.h`) then Blood type (`em.display`) then Chronic then Meds; inline-end column = identity (name, age, sex, MRN last 4), session timer + extend/close, contacts list with call buttons (desk phones dial manually; numbers are large and copyable), audit notice `er.session.audited`. Low-confidence → persistent yellow banner across the top. Expired → full overlay `er.session.expired`.

---

## 6. Admin RBAC & Audit

### W-ADM-01 Overview · `/admin`
Bento: HERO 8×1 «سلسلة السجل» `ChainIntegrityBadge` (green verified time / red broken #N) · KPIs S×4 (active users, pending licences, break-glass 7 d, open security flags) — KPI count-up allowed (admin only) · L 8×2 override-rate-per-doctor table (sortable; outliers highlighted amber, not red) · M 4×2 pending approvals (two-person rule) with Approve/Reject. Info chip `admin.noClinicalData`.

### W-ADM-02 Users · `/admin/users`
DataTable (compact 44 px rows): name · email · role badge · status badge · licence status · facilities · last active · ⋯ actions. Filters: role, status, licence status, facility; search. Row actions: View, Suspend/Reactivate, Change role, View licence. Bulk actions: none (deliberate; every action needs a reason).

- **Suspend dialog:** reason (required), consequence `admin.users.suspendBody`, re-auth if `auth_time` > 5 min (`admin.reauth`).
- **Self-action:** menu items disabled with tooltip `admin.users.selfAction`.
- **Change role → admin:** creates a pending approval (`admin.users.pendingApproval` badge on the row).

### W-ADM-03 User detail · `/admin/users/[id]`
Header (name, role, status) · tabs: Profile · Facilities · Devices (revoke) · Activity (audit filtered to this actor) · Licence (link to W-ADM-05).

### W-ADM-04 Invite staff · `/admin/users/invite` · US-21-AC1
Stepper (RTL flow right→left): ① Role & identity (email, name, role) ② Licence (number, authority, expiry, document upload P2) ③ Specialty (doctors) & facilities (multi-select) ④ Review → «ابعت الدعوة». Success `admin.invite.sent`.

### W-ADM-05 Licence panel · `/admin/practitioners/[id]/license`
Status timeline (pending → verified → suspended …) with who/when/reason. Actions: Verify / Suspend / Revoke with reason + re-auth. **Revoke** shows the impact count (`admin.license.revokeImpact`, from the API) in a danger dialog that requires typing the practitioner's licence number to confirm. Suspend shows `admin.license.suspendImpact`.

### W-ADM-06 Facilities · `/admin/facilities`
Table (name, type badge, city, members count) + side sheet CRUD; members tab with add/end membership (E-LIC-05).

### W-ADM-07 Audit log · `/admin/audit` · EXT-05-AC1/3
```
┌──────────────────────────────────────────────────────────────────────────┬────────┐
│ Audit log                              [● Chain verified 03:00] (Export CSV)│Sidebar│
│ {Actor▾} {Action ▾ multi} {MRN SH-…} {Outcome▾} {From–To} (Reset)          │        │
│ ┌──────────────────────────────────────────────────────────────────────┐   │        │
│ │Time      Actor        Role   Action                 Resource  MRN Out│   │        │
│ │10:41:07  Dr Karim     doctor PATIENT_RECORD_READ    patient   9Q4D ✓ │   │        │
│ │10:39:52  Ahmed (EMS)  param. EMERGENCY_PROFILE_READ session   9Q4D ✓ │   │        │
│ │10:12:30  Dr Salma     pharm. RX_VERIFY_FAILED       rx        —    ✕ │   │        │
│ │… virtualised, 44 px rows, sticky header                               │   │        │
│ └──────────────────────────────────────────────────────────────────────┘   │        │
└──────────────────────────────────────────────────────────────────────────┴────────┘
```
- Action filter lists the audit catalogue with Arabic descriptions (tooltip). MRN search resolves via blind index server-side; the table shows only the last 4.
- Row click → side sheet with the full (non-PHI) event JSON, hash and previous hash.
- Chain badge red → page-level danger banner `admin.audit.chainBroken` with a link to the event.
- Export excludes PHI columns (`admin.audit.export`).

### W-ADM-08 Break-glass review · `/admin/emergency-review` · EXT-05-AC2
Card queue (low-confidence first, then oldest). Card: paramedic, service, method chip, reason, incident ref, score band (never raw score), time, small map (if location), duration. Actions: «مناسب» / «مش مناسب» + note (required for inappropriate). Keyboard: `A` appropriate, `I` inappropriate, `J/K` next/prev.

### W-ADM-09 Security flags · `/admin/security-flags`
Tabs: Spoof attempts (E-BIO-05) · Unusual volume (US-16-AC7) · Forged Rx clusters (E-RX-05) · Duplicate face enrolment tickets (E-BIO-04). Each row links to the actor's audit trail; actions: Resolve (note), Suspend actor.

---

## 7. Global Error & System Pages

| Page | Visual | Copy |
|------|--------|------|
| 404 | Illustration + search | `err.notFound` |
| 500 | Illustration + request ID copy | `err.internal` |
| Offline (no cached page) | Ribbon + card | `common.offlineRibbon` + `err.network` |
| Maintenance (P2) | Card | «بنحسّن النظام — راجعين خلال {minutes} دقيقة» |

---

## 8. Definition of Done (UI-05)
- [ ] Every screen above has Figma frames at 1440 and 1280 in AR (RTL) and EN (LTR), plus 1024 behaviour notes verified.
- [ ] All states in §0.4 present per page; Playwright visual tests for AR/EN.
- [ ] Rx Builder: alert latency ≤ 1 s p95 after a drug change; blocking logic and focus behaviour verified; idempotent issue (double click = one Rx).
- [ ] Pharmacist: QR + manual + SMS/face presence, partial dispense, race highlight, lease banner, offline disable.
- [ ] Admin: re-auth on sensitive actions, two-person rule UI, chain badge, CSV export without PHI.
- [ ] Keyboard shortcuts (UI-04 §2.4) implemented and listed in the `?` dialog; axe: 0 serious/critical.

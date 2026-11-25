# UI-ANTIGRAVITY-HANDOFF — Implementing the SmartHealth UI with Google Antigravity

> **Audience:** the Antigravity agent and the Web (R5) / Mobile (R6) engineers driving it.
> **Goal:** implement every screen from UI-01…UI-08 identically in **Next.js 16** (`web-admin/`) and **Flutter** (`mobile-app/`) without breaking RTL, motion/3D rules, safety rules or Egyptian Arabic copy.
> **Status:** Draft for Tech Lead review · **Date:** 2026-11-24. Rule files below follow the loading rules verified in `ANTIGRAVITY-RULES.md` §0 (frontmatter `trigger:`, 24,000-byte limit per file, `always_on` budget).

---

## 1. Files and reading order

| Order | File | What the agent takes from it |
|------:|------|------------------------------|
| 1 | `docs/ui/UI-01-DESIGN-SYSTEM.md` | Tokens, themes, type, spacing, components, Web ↔ Flutter mapping (§12) |
| 2 | `docs/ui/UI-03-EGYPTIAN-ARABIC-UX-COPY.md` | Every user-facing string by key (AR + EN) |
| 3 | `docs/ui/UI-04-IA-AND-USER-FLOWS.md` | Routes, navigation, flows, task budgets |
| 4 | `docs/ui/UI-05-WEB-DESKTOP-SCREENS.md` / `UI-06-MOBILE-IPHONE-SCREENS.md` | The screen being built |
| 5 | `docs/ui/UI-07-EDGE-CASES-UI-MATRIX.md` | Every failure state of that screen |
| 6 | `docs/ui/UI-02-3D-AND-MOTION-SPEC.md` | Only when the screen moves or has 3D |
| 7 | `docs/ui/UI-08-INTERACTIVE-PROTOTYPE.html` | **Visual and interaction reference only** (see §6). Never copy its code into production |

Copy all eight files into `docs/ui/` and add them to `docs/00-INDEX.md` §1 (Document Map) in the same PR (Tech Lead owns 00-INDEX). Owner: UI/UX (M8).

---

## 2. Rule files to add (copy exactly)

Keep them `glob`-triggered so they don't consume the `always_on` budget (ANTIGRAVITY-RULES §0).

### 2.1 `.agents/rules/35-ui-web.md`
```markdown
---
trigger: glob
globs: "web-admin/**/*.tsx, web-admin/**/*.ts, web-admin/**/*.css, web-admin/i18n/messages/*.json"
description: SmartHealth UI rules for the Next.js portal (design system, RTL, copy, motion, safety)
---
# Web UI rules (source: docs/ui/UI-01, UI-02, UI-03, UI-05, UI-07)
- Before building a screen, open its spec in docs/ui/UI-05 (screen ID W-…) and its rows in UI-07. Implement EVERY state listed: loading (skeleton after 300 ms), empty, error (ProblemAlert by `code`), offline, forbidden.
- Colours/radii/shadows/fonts ONLY from tokens (app/tokens.css + @theme in globals.css). No hex in components. Themes: data-theme = light | dark | emergency | sunlight on <html> (ER route group forces sunlight).
- RTL first: Tailwind logical utilities only; rtl:rotate-180 on directional icons; drug names, doses, codes, blood type inside <bdi> with class "num" or "code". Doses/quantities are ALWAYS Western digits.
- Copy: every string through next-intl with the exact key from UI-03. Never invent Arabic; if a key is missing, stop and ask (add it to UI-03 first).
- Severity UI = icon + Arabic label + colour (UI-01 §9). contraindicated/major banners use role="alert" and block Sign & Issue until documented; disabled primary buttons always show their reason underneath.
- Glass (.glass utility) only on: TopBar, floating docks. Never behind clinical data, forms, severity banners, QR, emergency/sunlight themes.
- Motion: import durations/easings/springs from lib/motion/tokens.ts (UI-02 §9.1). Wrap the app in <MotionConfig reducedMotion="user">. Clinical numbers never animate. springs.celebrate is forbidden in doctor/pharmacist/admin routes.
- 3D: three/@react-three/* only inside components/three/**, loaded with next/dynamic(ssr:false), never on the Rx builder, dispense or audit routes. Web face scanner = 2D guide unless docs/ui/UI-07 §2.4 is approved.
- Seal/verification visuals are driven ONLY by the verify API result (UI-02 M4). Never show "verified" before the check completes.
- No PHI in URLs, localStorage, IndexedDB, toasts or notification text. Rx-builder draft in sessionStorage = drug IDs + patient ID only.
- Each new screen ships with Playwright screenshots in ar + en, a reducedMotion:'reduce' run, and axe with 0 serious/critical issues.
```

### 2.2 `.agents/rules/45-ui-mobile.md`
```markdown
---
trigger: glob
globs: "mobile-app/lib/**/*.dart, mobile-app/lib/l10n/*.arb, mobile-app/shaders/*.frag, mobile-app/assets/rive/*.riv"
description: SmartHealth UI rules for the Flutter app (patient, paramedic, pharmacist modes)
---
# Mobile UI rules (source: docs/ui/UI-01, UI-02, UI-03, UI-06, UI-07)
- Before building a screen, open its spec in docs/ui/UI-06 (screen ID M-…) and its rows in UI-07. Implement every listed state, including offline and Large-Font x1.15/x1.30 reflow.
- Colours from context.sh (ShColors ThemeExtension) and ShSpace/ShRadius/ShType only. No Color(0x…) outside lib/core/theme/**.
- RTL: EdgeInsetsDirectional / AlignmentDirectional / PositionedDirectional / BorderRadiusDirectional only. Doses, codes, blood type in LTR-isolated spans; Western digits for all clinical numbers.
- Strings only from ARB keys that exist in UI-03 (camelCase form of the dot.case key). ICU select on sex for second-person verbs (UI-03 §1.1).
- Adaptive chrome (Switch.adaptive, showAdaptiveDialog, CupertinoSliverNavigationBar on iOS, NavigationBar on Android); clinical widgets (buttons, cards, SeverityBanner, chips, ID card, scanner, seal, orb, Emergency theme) are IDENTICAL on both platforms.
- Emergency (paramedic shell, /card, AI takeover): Tier E — NoTransitionPage, no BackdropFilter, no widgets from lib/core/visuals/**, no skeletons, targets >= 64 dp (call 72 dp), body >= 20 sp, wakelock on, text scale capped at 1.30.
- Motion from lib/core/motion/motion_tokens.dart via ShMotion.of(context, ref).d(...). Respect MediaQuery.disableAnimationsOf. ShSpring.celebrate only in patient features.
- Haptics only through HapticService (UI-02 §7.2 event map). Never call HapticFeedback directly.
- FaceMeshScanner reflects real ML Kit signals only (enableContours: true). Never ask paramedics to remove masks/bandages. Never offer fingerprint identification of another person (SD-01).
- Dose time chips appear only from prescription instructions or patient-set reminders — never invented.
- FLAG_SECURE / iOS snapshot blur on: pickup QR, emergency card, emergency profile/contacts, chat, history, critical info.
- No PHI in push/local notification text (only {time}, {date}, {pharmacy}, {doctor}, {service}, {days}, {code}).
- Each screen ships with golden tests (ar + en, light + dark, emergency where relevant) and a widget test for its UI-07 rows.
```

### 2.3 `.agents/rules/55-ui-copy.md`
```markdown
---
trigger: model_decision
description: Use when adding or changing any user-facing text, error message, notification, or i18n key
---
# Copy protocol
1. Find the key in docs/ui/UI-03-EGYPTIAN-ARABIC-UX-COPY.md. Use its Arabic exactly (Egyptian colloquial) and its English.
2. Missing key → add it to design/copy/strings.yaml AND UI-03 in the same PR, in the matching section, with notes (⚕ clinical / ⚖ legal if applicable). Tag UI/UX (M8) for review.
3. Run `pnpm i18n:sync` to regenerate ar.json, en.json, app_ar.arb, app_en.arb. Never edit the generated files by hand.
4. Error UI switches on the ProblemDetails `code` (UI-03 §3.18), never on HTTP status alone, and never reveals whether a resource exists.
5. ⚕ and ⚖ strings cannot change without the reviewer named in UI-03 §0.
```

### 2.4 Workflow `.agents/workflows/build-screen.md`
```markdown
---
description: Build one UI screen end-to-end from the SmartHealth UI specs
---
1. Ask for the screen ID (W-… or M-…). Open its section in docs/ui/UI-05 or UI-06, its flow in UI-04 §5, and every UI-07 row that names it.
2. List the copy keys it needs; confirm each exists in UI-03 (follow 55-ui-copy if not).
3. List the components it needs from UI-01 §11–§12; reuse existing ones in components/** or lib/core/widgets/**; create missing ones there first.
4. Implement states in this order: happy path → loading → empty → error codes → offline → edge-case rows → Large-Font → dark/emergency/sunlight.
5. Add motion last, from UI-02 tokens only, with reduced-motion and Tier E variants.
// turbo
6. Run `pnpm --filter web-admin test && pnpm --filter web-admin e2e` (web) or `cd mobile-app && flutter analyze && flutter test` (mobile).
7. Produce a table: every state/edge row → ✅/❌ with evidence (test name or screenshot path).
```

---

## 3. Build order (matches role-07 stage gates: web visual QA at Stage 5, mobile at Stage 6)

| Step | Web (`web-admin/`) | Mobile (`mobile-app/`) |
|-----:|--------------------|-------------------------|
| 1 | Tokens: generate `tokens.css`, `globals.css` (UI-01 §14.2), fonts via `next/font` | Tokens: `sh_colors.dart`, `app_theme.dart` (UI-01 §14.3), bundled fonts |
| 2 | Motion tokens + tier detection (UI-02 §9.1) | Motion tokens + `motionTierProvider` + `HapticService` (UI-02 §9.2, §7) |
| 3 | Shared components (UI-01 §11–§12): buttons, inputs, `SafetyAlertBanner`, `StatusBadge`, `OfflineRibbon`, `ReauthDialog`, `Countdown`, `GlassPanel`, `BentoGrid` | Same set + `SeverityBanner`, `OfflineBanner`, `StepUpOverlay`, `GlassSurface`, `BentoGrid` |
| 4 | Shell + auth (W-SHELL, W-AUTH-*) | Auth + onboarding (M-PAT-00…03) |
| 5 | **P0:** Rx Builder (W-DOC-07 + 07a/b/c), Pharmacist verify + dispense (W-PHA-01/02) | **P0:** Paramedic scan + profile + possible/no-match + offline card (M-PAR-02…06); Assistant + takeover (M-PAT-14/14E) |
| 6 | Doctor dashboard, profile, history, encounter, redeem, issued list, print | Patient home + ID card, Rx list/detail/pickup QR, critical info, contacts, emergency card, enrolment |
| 7 | Admin (W-ADM-01…09) | Pharmacist mobile (M-PHA-01…07), sharing & access, settings, break-glass detail |
| 8 | ER desk (W-ER-*) — P2 | Dose reminders, crisis screen polish, P2 OS entry points |
| 9 | 3D/motion polish per UI-02 (behind tier checks) | 3D/motion polish per UI-02 (behind tier checks) |

---

## 4. Prototype → production mapping

| Prototype component (UI-08) | Web production path | Flutter production path | Spec |
|-----------------------------|---------------------|-------------------------|------|
| `IdCard` (CSS 3D tilt, foil, flip) | `components/three/MedicalIdCard3D.tsx` | `lib/core/visuals/medical_id_card_3d.dart` | UI-02 §6.2 |
| `FaceMesh` (canvas depth ring + contour grid) | `components/three/FaceMeshScanner.tsx` | `lib/features/biometrics/presentation/widgets/face_mesh_painter.dart` | UI-02 §6.1 |
| `Orb` (WebGL fragment shader) | `components/three/AiOrb.tsx` (R3F) | `lib/features/assistant/presentation/widgets/ai_orb.dart` + `shaders/ai_orb.frag` | UI-02 §6.4 |
| `Seal` (SVG rings + stamp) | `components/three/RxSeal.tsx` | `lib/core/visuals/rx_seal.dart` + `assets/rive/rx_seal.riv` | UI-02 §6.3.1 |
| `Badge` (status morph) | `components/common/StatusBadge.tsx` | `lib/core/widgets/status_badge.dart` | UI-01 §9.3, UI-02 §5.4 |
| `Sev` | `components/prescription/SafetyAlertBanner.tsx` | `lib/core/widgets/severity_banner.dart` | UI-01 §10.3 |
| `RxBuilder` + `OverrideDlg` + `Reauth` | `components/prescription/{RxBuilder,AlertList,OverrideDialog,SignAndIssueBar}.tsx`, `components/shell/ReauthDialog.tsx` | — | UI-05 W-DOC-07 |
| `Pharmacist` dispense view | `components/pharmacy/{DispenseTable,LeaseBanner,VerificationResult}.tsx` | `lib/features/pharmacy/presentation/screens/dispense_sheet.dart` | UI-05 W-PHA-02, UI-06 M-PHA-03 |
| `Paramedic` screens | ER desk only | `lib/features/emergency/presentation/screens/*` | UI-06 §2 |
| `Takeover` / `Crisis` | — | `lib/features/assistant/presentation/screens/{emergency_takeover,crisis}_screen.dart` | UI-06 M-PAT-14E/C |
| `PickupQR` + `Ring` | — | `lib/features/prescriptions/presentation/widgets/pickup_qr_panel.dart`, `lib/core/widgets/countdown.dart` | UI-06 M-PAT-08 |
| `TimeoutOverlay` | `components/shell/SessionTimeoutDialog.tsx` | (staff mobile) `lib/core/security/step_up_overlay.dart` | UI-07 S6 |

---

## 5. Non-negotiables checklist (the agent verifies these on every UI PR)

- [ ] Arabic RTL renders correctly; English LTR renders correctly; no physical left/right in code.
- [ ] All strings come from UI-03 keys; no raw `{placeholder}` reaches the screen.
- [ ] No hex outside token files; contrast CI green (UI-01 §14.5).
- [ ] Severity = icon + text + colour; blocking alerts block and explain why.
- [ ] Anaphylaxis is the first critical chip on every patient view and the first block on every emergency view.
- [ ] Clinical numbers never animate and are always Western digits.
- [ ] Emergency screens obey Tier E (no 3D, no blur, 0 ms transitions, big targets).
- [ ] Glass only on allow-listed chrome.
- [ ] 3D/seal/orb visuals reflect real data or results only.
- [ ] Reduced Motion and Low Power fallbacks work (tests).
- [ ] No PHI in URLs, notifications, logs, local storage (except the encrypted Hive boxes from role-06).
- [ ] Every UI-07 row for the screen has a test named with its spec ID.

---

## 6. What the prototype simplifies (do NOT copy into production)

| Prototype shortcut | Production reality |
|--------------------|--------------------|
| No backend; all data is hard-coded sample data | Typed API clients (`openapi-fetch` / dio) per `03-API`; server is authoritative |
| Drug-safety alerts computed in the browser from a 5-drug list | Deterministic engine in `ai-service` via `POST /v1/prescriptions/check` (SD-05); the client never decides |
| QR codes are random illustrative patterns | Real signed tokens (`SH1.` / `SHEC1.`) rendered with `qrcode` / `qr_flutter`; verified with Ed25519 |
| Face scan and liveness are simulated animations (no camera in the sandbox) | `camera` + ML Kit signals + server PAD/matching (role-06 §6.1, role-04) |
| Face ID / TOTP prompts accept anything | `local_auth` + device-bound key (SD-02); Supabase MFA `challengeAndVerify` |
| Uses React UMD + `htm` in one HTML file | Next.js App Router components; Flutter widgets with Riverpod |
| `navigator.vibrate` as a haptic stand-in | `HapticService` platform mapping (UI-02 §7) |
| Countdown timers start locally | Countdown driven by server `expires_at` |
| Status changes via demo buttons | Status from API responses / push events |

---

## 7. Open decisions the agent must not resolve on its own

Stop and ask the Tech Lead / Security Lead before implementing anything that depends on these (details in UI-07 §2):
1. Temporary ER intake record (`FEATURE_ER_INTAKE`, new table + endpoints).
2. TOTP re-auth on every `contraindicated` override.
3. Doctor break-glass (`admin_override` grant flow).
4. MediaPipe/WASM on pharmacy web routes (CSP change).
5. Passkeys on web login (`NEXT_PUBLIC_FEATURE_PASSKEY`).
6. iOS Live Activities, lock-screen widget, proxy pickup (native extensions, P2).
7. Fingerprint identification of another person: **rejected** (SD-01). Do not build.

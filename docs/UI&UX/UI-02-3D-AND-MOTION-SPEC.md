# UI-02 — SmartHealth 3D, Motion, Transitions & Haptics Specification

> **Owner:** UI/UX (M8) · **Implementers:** Web (R5), Mobile (R6) · **Reviewers:** Security (R1) for scanner honesty rules, AI (R4) for orb/triage mapping
> **Status:** Draft for team review · **Date:** 2026-11-24
> **Depends on:** `UI-01-DESIGN-SYSTEM.md` (tokens, themes, colours), `role-06-mobile-flutter.md` §6 (camera pipeline, emergency mode), `role-05-frontend-web.md` §7, `02-EDGE-CASES-AND-FAILURE-MODES.md`.
> **Replaces:** role-07 §3.4 "Motion" bullet. The role-07 rule *"No animation in emergency screens except the scan progress indicator"* is **kept and strengthened** in §8.4.

---

## 0. Motion Principles

| # | Principle | Rule that enforces it |
|---|-----------|-----------------------|
| M1 | **Motion explains a change of state.** It never decorates. | Every animation in this file names the state change it explains. Anything that doesn't is cut |
| M2 | **Nobody waits for an animation.** | Input is never blocked by an animation. Content is interactive from the first frame of a transition. No transition on a critical path lasts more than **350 ms** |
| M3 | **3D only where it carries meaning.** | The four 3D components (§6) each express something real: identity (card), detection quality (scanner), authenticity (seal), AI state (orb). No 3D backgrounds, no spinning logos |
| M4 | **Visuals never lie.** | The scanner mesh reflects real detector signals. The seal shows "verified" only after a real signature check. The orb's "urgent" state comes only from the triage result. Progress bars show real progress or are indeterminate |
| M5 | **Emergency = instant.** | §8.4: no decorative motion, no 3D, no blur, 0 ms page transitions |
| M6 | **Clinical numbers never animate.** | Doses, quantities, remaining counts, blood type and vitals swap instantly (no count-up), because an intermediate value could be misread. KPI counters (admin only) may tick |
| M7 | **Calm amplitude.** | Overshoot ≤ 1% for clinical UI. The playful spring (13.6% overshoot) is allowed only in patient celebration moments (§1.3) |
| M8 | **Respect the body.** | Honour Reduced Motion. Nothing flashes more than 3 times per second (WCAG 2.3.1). No parallax larger than 12° tilt. All ambient loops pause when off-screen |
| M9 | **RTL-aware, physics-true.** | Navigation motion mirrors with the reading direction. Physical motion (tilt, head-turn cues, light, gravity) never mirrors |

---

## 1. Motion Tokens

### 1.1 Durations

| Token | ms | Use |
|-------|---:|-----|
| `dur.instant` | 0 | Emergency transitions, reduced-motion swaps of clinical values |
| `dur.micro` | 100 | Press feedback, icon swaps, checkbox tick |
| `dur.short` | 150 | Hover lift, toggles, tooltips, fades in reduced-motion mode (role-07 "micro" kept) |
| `dur.base` | 250 | Panels, badge morph, tab content, banners (role-07 "panels" kept) |
| `dur.medium` | 350 | Page push, hero flight, dialog enter |
| `dur.long` | 500 | Onboarding hero, card flip, seal stamp |
| `dur.ambient.slow` | 6000 | Orb idle breathing cycle, card foil drift |
| `dur.ambient.seal` | 24000 | One full rotation of the seal micro-text ring |
| `dur.shimmer` | 1200 | Skeleton shimmer sweep |
| `dur.toast` | 4000 / 6000 | Toast lifetime (6000 when it has an action) |
| `dur.takeoverLock` | 5000 | AI emergency takeover close-button lock (role-06 §6.5) |

Exit animations use **≈ 70%** of the enter duration (`dur.medium` enter 350 → exit 250).

### 1.2 Easing curves

| Token | cubic-bezier | Flutter | Use |
|-------|--------------|---------|-----|
| `ease.standard` | `(0.2, 0, 0, 1)` | `Cubic(0.2, 0, 0, 1)` = `Easing.standard` | Default UI movement (role-07 curve kept) |
| `ease.emphasizedDecel` | `(0.05, 0.7, 0.1, 1)` | `Easing.emphasizedDecelerate` | Things entering the screen (pages, sheets, dialogs) |
| `ease.emphasizedAccel` | `(0.3, 0, 0.8, 0.15)` | `Easing.emphasizedAccelerate` | Things leaving the screen |
| `ease.exit` | `(0.4, 0, 1, 1)` | `Cubic(0.4, 0, 1, 1)` | Fast dismiss (toasts, popovers) |
| `ease.linear` | `linear` | `Curves.linear` | Progress, shimmer, countdown ring, seal ring rotation |
| `ease.inOutSine` | `(0.37, 0, 0.63, 1)` | `Curves.easeInOutSine` | Ambient breathing (orb, foil) |

### 1.3 Springs (same numbers in Framer Motion and Flutter)

All springs use `mass`, `stiffness` and `damping`. Framer Motion: `{ type: "spring", stiffness, damping, mass }`. Flutter: `SpringDescription(mass:, stiffness:, damping:)`. The derived values below were **computed** (ζ = c / 2√(km), response = 2π / √(k/m), settle ≈ time to stay within 2%).

| Token | stiffness | damping | mass | ζ (damping ratio) | Response | Settle ≈ | Overshoot | Use |
|-------|----------:|--------:|-----:|------------------:|---------:|---------:|----------:|-----|
| `spring.snappy` | 500 | 38 | 1 | 0.85 | 0.28 s | 210 ms | 0.6% | Toggles, press release, morphing button, chips |
| `spring.gentle` | 260 | 30 | 1 | 0.93 | 0.39 s | 270 ms | 0% | Cards, bento tile expand, layout shifts |
| `spring.hero` | 320 | 34 | 1 | 0.95 | 0.35 s | 235 ms | 0% | Shared-element flights, card flip |
| `spring.sheet` | 380 | 36 | 1 | 0.92 | 0.32 s | 220 ms | 0.1% | Bottom sheets, detent snap, rubber-band return |
| `spring.tilt` | 150 | 18 | 0.6 | 0.95 | 0.40 s | 270 ms | 0% | ID-card tilt following pointer/gyro |
| `spring.orb` | 80 | 12 | 1 | 0.67 | 0.70 s | 670 ms | 5.8% | Orb amplitude/colour transitions between states |
| `spring.celebrate` | 420 | 22 | 1 | 0.54 | 0.31 s | 365 ms | 13.6% | **Patient app only:** enrolment success, seal "stamp", dose-taken check. **Never** in staff UIs or Emergency |

iOS mapping (for designers working in Figma/Origami with "response + damping fraction"): `spring.sheet` ≈ response 0.32, dampingFraction 0.92.

### 1.4 Distances & stagger

| Token | Value | Use |
|-------|-------|-----|
| `move.xs` | 4 px | Text crossfade slide, badge label |
| `move.sm` | 8 px | Toast/banner enter, list item enter |
| `move.md` | 16 px | Dialog enter (scale 0.96 → 1 + 16 px rise) |
| `move.lift` | −2 px | Card hover lift |
| `press.scale` | 0.97 (buttons) / 0.98 (cards) | Press feedback |
| `stagger.list` | 30 ms per item, max 8 items (240 ms total cap) | List/bento entrance. Items after the 8th appear together |
| `tilt.max` | 12° (web pointer) / 10° (mobile gyro) | ID card |
| `parallax.layer` | 0 / 8 / 16 / 24 px `translateZ` | Card layers (§6.2) |

---

## 2. Device Capability Tiers

All heavy visuals pick a **tier** at runtime. The tier can only go **down** during a session (never back up automatically), which prevents flicker.

| Tier | Meaning | Typical devices | 3D | Glass | Ambient loops |
|------|---------|-----------------|----|-------|---------------|
| **A** | Full | Desktop/laptop with WebGL2 and a decent GPU; iPhone 12+; Android flagships and upper-mid (≥ 6 GB RAM) | Full (shaders, foil, mesh ring) | Yes | Yes (60 fps) |
| **B** | Reduced | Mid Android (4–6 GB RAM, e.g. Oppo A-series); older laptops; integrated GPUs that fail the FPS probe | Simplified (lower geometry, no post effects, 30 fps ambient) | Tab bar only | 30 fps, paused when idle 10 s |
| **C** | 2D | Low-end Android (≤ 3 GB RAM, `isLowRamDevice`), Battery Saver / Low Power Mode, battery < 20% and not charging, **Reduced Motion on**, no WebGL2 | **None**; static 2D equivalents | None (opaque fallback) | None |
| **E** | Emergency fast-path | Paramedic mode, Emergency theme, AI emergency takeover, patient Emergency Card screen | **None** | None | None; only the scan progress indicator and countdowns animate |

### 2.1 Detection, web (`web-admin/lib/motion/tier.ts`)

| Signal | API | Effect |
|--------|-----|--------|
| Emergency/Sunlight ER console | `data-theme` | → E (ER console) |
| Reduced Motion | `matchMedia('(prefers-reduced-motion: reduce)')` | → C for 3D, and reduced-motion variants for all transitions (§8.2) |
| No WebGL2 | `canvas.getContext('webgl2') === null` | → C |
| Low memory / cores | `navigator.deviceMemory < 4` (Chromium only) or `navigator.hardwareConcurrency <= 4` | → B |
| Battery | `navigator.getBattery()` (Chromium only; absent in Safari/Firefox, so ignore if missing): `level < 0.2 && !charging` | → C, sets `data-power="low"` |
| Runtime FPS | drei `<PerformanceMonitor onDecline>` inside 3D scenes; a 60-frame rAF probe elsewhere: average frame > 22 ms | Step down one tier |
| Tab hidden | `document.visibilityState === 'hidden'` | Pause all loops (`frameloop="never"`) |

### 2.2 Detection, Flutter (`lib/core/motion/motion_tier_provider.dart`)

| Signal | API | Effect |
|--------|-----|--------|
| Emergency mode | `appModeProvider == AppMode.emergency` or the route is in the emergency shell, `/card`, or the AI takeover | → E |
| OS Reduce Motion / Remove Animations | `MediaQuery.disableAnimationsOf(context)` | → C + reduced-motion variants |
| Battery saver / Low Power Mode | `battery_plus`: `isInBatterySaveMode` (verify iOS Low Power Mode reporting at Stage 0) | → C |
| Battery level | `battery_plus`: `batteryLevel < 20 && state != charging` | → C |
| Low-RAM Android | `device_info_plus` `AndroidDeviceInfo.isLowRamDevice` if exposed by the pinned version; else a 10-line platform channel calling `ActivityManager.isLowRamDevice()` | → C |
| RAM < 6 GB / Android SDK < 29 | platform channel (`ActivityManager.MemoryInfo.totalMem`) | → B |
| Frame timing | `SchedulerBinding.instance.addTimingsCallback`: if > 10% of the first 120 frames exceed 16.7 ms (build + raster) | Step down one tier |
| App backgrounded / widget off-screen | `AppLifecycleState`, `TickerMode`, `VisibilityDetector` | Pause tickers, unsubscribe sensors |

---

## 3. Implementation Stack

| Concern | Web | Flutter |
|---------|-----|---------|
| UI motion | **Motion** (the library formerly called Framer Motion; import from `motion/react`. If the team pins the older `framer-motion` package, the API is the same) | Implicit animations (`AnimatedContainer`, `AnimatedSwitcher`, `AnimatedSize`), `AnimationController` + `SpringSimulation`, `Hero`, the `animations` package (`OpenContainer`, `SharedAxisTransition`) |
| Shared elements | Same page: Motion `layoutId`. Across routes: View Transitions API (`view-transition-name`) with React's `<ViewTransition>` if the pinned Next.js 16 / React version exposes it behind a flag, otherwise a 200 ms crossfade. **Verify at Stage 0**; never block on it | `Hero` with custom `flightShuttleBuilder`; `OpenContainer` for list → detail on Android |
| Real 3D | `three` + `@react-three/fiber` v9 (React 19) + `@react-three/drei` (`PerformanceMonitor`, `AdaptiveDpr`). Loaded with `next/dynamic(..., { ssr: false })` | No general 3D engine in MVP. "3D" is built from `Transform` + `Matrix4` perspective (card), `CustomPainter` with manual perspective projection (scanner ring), and `FragmentShader` (orb, foil) |
| 2.5D / CSS 3D | CSS `perspective`, `transform-style: preserve-3d` (ID card, seal) | `Transform` (`Matrix4..setEntry(3, 2, 0.0012)`) |
| Vector animation | Inline SVG + Motion `pathLength` | **Rive** (`rive` package) for onboarding hero and the seal "stamp" (state machines, small files). Lottie only for third-party assets that come as Lottie |
| Shaders | GLSL in `shaderMaterial` | GLSL `.frag` via `FragmentProgram.fromAsset` (declared under `flutter: shaders:` in `pubspec.yaml`) |
| Haptics | None on desktop (`navigator.vibrate` is unsupported on iOS Safari and pointless on laptops) | `HapticService` (§7) |
| Camera face signals | MediaPipe Face Landmarker (`@mediapipe/tasks-vision`, WASM) **Tier A only**, pharmacist webcam presence step | `google_mlkit_face_detection` (role-06 §6.1). **Add `enableContours: true`** to the options for the mesh overlay |

**Security note for R1 / R5:** MediaPipe's WASM runtime needs `'wasm-unsafe-eval'` in `script-src` and a worker source. The role-05 §9 CSP does not allow it today. Options: (a) add `'wasm-unsafe-eval'` only on `/[locale]/pharmacy/*` via route-specific headers, or (b) skip MediaPipe on web and use the 2D oval guide (Tier C visual) for the pharmacist webcam. **The default in this spec is (b)** until the Security Lead approves (a).

---

## 4. Navigation & Shared-Element Transitions

Notation: **RM** = Reduced-Motion variant. **E** = Emergency variant. "Inline-end" means left in RTL and right in LTR.

| ID | Transition | Trigger | Web | Flutter (iOS / Android) | Timing | RM | E |
|----|-----------|---------|-----|--------------------------|--------|----|---|
| T-01 | **Rx card → full E-Prescription** | Tap an Rx card on Patient Home / Rx list | Same page: `layoutId={"rx-"+id}` card expands to the detail panel | `Hero(tag: 'rx-card-$prescriptionId')`. Shuttle morphs radius 20 → 0 and e1 → e0; the detail body fades in when the flight is 60% done, staggered 30 ms per section | `spring.hero` (≈ 350 ms) | 150 ms crossfade, no flight | n/a (not in emergency) |
| T-02 | **Patient row → Patient record** (doctor) | Click a row in Recent Patients / search | View Transition: `view-transition-name: patient-{id}` on the avatar+name group and on the `PatientHeader` identity group; the rest crossfades 200 ms | n/a (web only) | 300 ms `ease.emphasizedDecel` | 150 ms crossfade | ER console: instant |
| T-03 | **Bento tile → expanded view** | Click/tap a tile with details | `layoutId` tile → `Dialog` (desktop) / `Drawer` (tablet) | `OpenContainer` (Android), `Hero` + `CupertinoPageRoute` (iOS) | `spring.gentle` | crossfade | n/a |
| T-04 | Page push (forward) | Navigate deeper | Content enters 24 px from **inline-end** + fade | iOS: `CupertinoPageRoute` (it slides from the end side and mirrors in RTL automatically). Android: `SharedAxisTransition(transitionType: horizontal)` | 350 ms `ease.emphasizedDecel` | 150 ms fade | 0 ms |
| T-05 | Page pop (back) | Back | Reverse of T-04 | iOS edge-swipe from the **inline-start** edge (right edge in Arabic) | 250 ms `ease.emphasizedAccel` | 150 ms fade | 0 ms |
| T-06 | Tab switch | Bottom tab / sidebar | Content crossfade + 4 px rise | `FadeThroughTransition` (animations pkg) | 250 ms | 100 ms fade | 0 ms |
| T-07 | Locale switch AR ↔ EN | Language toggle | **Crossfade only**, never a horizontal slide (a sliding mirror is disorienting) | Same | 200 ms | 100 ms | 0 ms |
| T-08 | Theme switch | Light ↔ Dark ↔ Sunlight | Colour crossfade on `background-color` / `color` | `AnimatedTheme` duration 250 ms (ShColors lerp is a **step**, so semantic colours never pass through odd hues, UI-01 §14.3) | 250 ms | instant | Entering Emergency is always **instant** |
| T-09 | Dialog open/close | — | Scale 0.96 → 1 + 16 px rise + scrim fade | `showAdaptiveDialog` defaults (iOS spring zoom, M3 fade-scale) themed to 250 ms | enter `dur.medium` / exit 70% | fade only | instant |
| T-10 | Bottom sheet | — | `Drawer` (vaul) | §5.5 physics | `spring.sheet` | fade + no drag-follow overshoot | Emergency sheets (contacts list) open instantly |
| T-11 | Emergency Card hero (patient) | Long-press the 3D ID card → «افتح كارت الطوارئ» | n/a | The card flattens to 0° tilt (`spring.hero`), then an **instant** cut to the Emergency theme card. The 3D card never animates into the Emergency screen | 200 ms + 0 | instant | — |
| T-12 | Session-timeout lock | 15 min idle (doctor/pharmacist) | Overlay fades in over a blurred page; **the page stays mounted** (drafts keep their state) | Same (`Overlay` at z 100) | 250 ms | instant | n/a |
| T-13 | AI red-flag takeover | Triage `emergency` | n/a | **Instant** opaque route (`transitionDuration: Duration.zero`). Haptic `error` once. The close button shows a 5 s linear progress ring before it unlocks | 0 ms | 0 ms | — |
| T-14 | Spoof lock | `BIO_LIVENESS_FAILED` after the 3rd failure, or `security_flag` | Instant red lock screen | Same | 0 ms | 0 ms | 0 ms |

---

## 5. Micro-interactions

### 5.1 Rules
1. The feedback must appear within **100 ms** of input (INP target ≤ 200 ms on web).
2. Only `transform` and `opacity` are animated on web (no layout-thrashing properties). Size changes use Motion `layout` (FLIP).
3. Every micro-interaction has an RM variant (§8.2) and an E variant (§8.4).

### 5.2 Press, hover, focus

| Element | Hover (web) | Press | Release | Focus |
|---------|-------------|-------|---------|-------|
| Primary/secondary button | Background → hover token, 150 ms | `scale(0.97)`, 100 ms `ease.standard` | `spring.snappy` back to 1 | 2 px ring appears instantly (no animation; focus must never lag) |
| Card / bento tile | `translateY(-2px)` + e1 → e2, 150 ms | `scale(0.98)` | `spring.gentle` | Ring |
| Critical tile (2 px severity border) | **No lift** (critical things don't float) | `scale(0.99)` | — | Ring |
| List row | Background `--muted`, 100 ms | Android: M3 ripple (`InkSparkle`); iOS: background highlight 100 ms, no ripple | — | Ring |
| Icon button | Background circle fades in | `scale(0.92)` | `spring.snappy` | Ring |
| Emergency buttons | — | Background darkens 10%, **no scale** (gloved presses are long) | Instant | Yellow ring |

### 5.3 Morphing action button (`MorphButton`)
Used for: «ابعت الروشتة» (Sign & Issue), «اصرف» (Dispense), «ابدأ المسح», «سجّل وشك».

| State | Visual | Transition in |
|-------|--------|---------------|
| `idle` | Full-width label + icon | — |
| `disabled` (blocked) | 40% opacity + reason text appears under it (height grows via `AnimatedSize`) | 150 ms |
| `loading` | **Width locked**; label stays; a spinner replaces the icon (`AnimatedSwitcher`, scale 0.6 → 1) | 100 ms |
| `success` | Morphs to a pill → circle with a check that draws (`pathLength` 0 → 1) | `spring.snappy`; check stroke 200 ms; success haptic |
| `error` | Back to `idle`; the error shows in a banner/inline (never inside the button) | 150 ms |
| `requiresReauth` | Icon swaps to a lock; label «أكّد إنه انت» | 150 ms |

The button never morphs on the **pharmacist Dispense** action until the server confirms (idempotent, E-NET-04). While waiting, the label reads «بنأكد…» and pressing again does nothing.

### 5.4 Status badge morph (e.g. «قيد الصرف» → «اتصرفت بالكامل»)
1. Badge width animates to the new label width (Motion `layout` / `AnimatedSize`, 250 ms `ease.standard`).
2. Background and text colour crossfade, 250 ms.
3. Old icon: scale 1 → 0.6 + fade out (100 ms). New icon: the check strokes on (`pathLength` 0 → 1, 200 ms, starting at 80 ms).
4. Label text: old fades out with 4 px rise, new fades in from 4 px below (150 ms, 50 ms overlap).
5. `aria-live="polite"` / `SemanticsService.announce` reads the new status.
6. Haptic `success` only on the device whose user caused the change (pharmacist), not on the patient's phone when a push update arrives.

Intermediate states: `pending → partially_dispensed → dispensed` follow the same choreography. `cancelled` and `expired` add a 200 ms diagonal-stripe fade-in.

### 5.5 Bottom sheets: rubber-band physics (iOS-grade)

| Parameter | Value |
|-----------|-------|
| Detents | `medium` = 40% of screen height, `large` = 90%. The dispense sheet opens at `large`; info sheets open at `medium` |
| Drag follow | 1:1 within the detent range |
| Rubber band beyond `large` | offset = `(c · d · H) / (H + c · d)`, with `c = 0.55`, `d` = overscroll distance and `H` = sheet height (UIScrollView's formula) |
| Release projection | `projected = position + velocity × 0.499` (iOS `normal` deceleration rate 0.998 → `r / (1 − r) / 1000`) |
| Snap target | The detent nearest to `projected` |
| Dismiss | `projected` below 25% of `medium`, **or** downward velocity > 1000 px/s |
| Snap animation | `spring.sheet` with the release velocity as the initial velocity |
| Handle haptic | `selection` on each detent snap |
| **Clinical sheets with unsaved input** (dispense, override reason, add allergy) | Not dismissible by swipe or scrim tap. A drag past the dismiss threshold springs back and asks «تلغي اللي كتبته؟» (Flutter `PopScope(canPop: false)` + `onPopInvokedWithResult`; web vaul `dismissible={false}` + confirm) |

### 5.6 Forms & validation
- **Inline validation** after blur, not on every keystroke (except masks).
- **Error appear:** helper text crossfades to the error (150 ms); border colour changes instantly.
- **Shake on submit** (only for non-clinical forms such as login, OTP and share code): 3 cycles, ±6 px, 300 ms total, `ease.standard`; **not** in RM, **never** in Emergency or in clinical forms (Rx builder, dispense); there, focus moves to the first invalid field and the field scrolls into view.
- **Success tick** on validated fields (national ID): check icon scales 0.6 → 1, `spring.snappy`.
- **Auto-save indicator** (Rx builder draft, encounter notes): «اتحفظ مسودة ✓» fades in 150 ms, stays 2 s, fades out. No motion while typing.

### 5.7 Loading: skeletons & progress
- Skeleton appears only if loading takes > 300 ms. Shimmer = linear gradient sweep from **inline-start to inline-end** (it mirrors in RTL), 1200 ms linear, infinite; RM → static `--muted` blocks.
- Skeleton → content: crossfade 150 ms; no layout jump (skeleton shapes match the final layout, UI-01 §10.9).
- Determinate progress (uploads, scan burst): linear bar/ring, `ease.linear`, value-driven.
- Indeterminate spinner: Android `CircularProgressIndicator`, iOS `CupertinoActivityIndicator` (via `.adaptive`).
- Never show fake determinate progress (M4).

### 5.8 Toggles, checkboxes, radios
- Switch thumb: `spring.snappy`; track colour 150 ms. Haptic `light` on mobile.
- Checkbox: box fills 100 ms; check stroke draws 150 ms. Pharmacist item checkboxes («اتصرف» / «لسه متبقّي») use the same animation plus `selection` haptic.
- Radio: inner dot scales 0 → 1, `spring.snappy`.

### 5.9 Countdown ring (pickup QR 10 min, share code 10 min, break-glass 60 min, verification context 15 min)
- The ring depletes linearly (`ease.linear`), driven by the **server expiry** (`expires_at`), never by a local timer start.
- At 60 s: colour → warning, one `light` haptic, label turns bold. No pulsing.
- At 0: the QR/code blurs (σ 12) + 50% scrim + «الكود خلص — اعمل كود جديد» button (role-06 §6.6). 250 ms.

### 5.10 Lists & data changes
- Insert: fade + 8 px rise, `spring.gentle`, stagger 30 ms (max 8).
- Remove: height collapse + fade, 200 ms.
- **Changed value highlight** (e.g. remaining quantity changed by another pharmacy, `RX_QUANTITY_EXCEEDED`): the cell background flashes `--sh-warning-surface` → transparent once over 1200 ms (a single fade, not a blink), plus an inline note «صيدلية تانية صرفت جزء دلوقتي». The number itself swaps instantly (M6).
- Reorder (emergency contacts priority): drag lift = scale 1.03 + e3; others shift with `spring.gentle`; `selection` haptic on each slot change.

### 5.11 Banners & toasts
- **Severity banner** (`SafetyAlertBanner`): enters with `AnimatedSize` height expansion + fade, 200 ms. **No slide from the side, no bounce.** A blocking banner (`contraindicated`/`major`) gets **one** outline pulse the first time it appears (2 px ring, opacity 0 → 1 → 0 over 600 ms). It never loops (alert fatigue, E-CLIN-08). RM: appears instantly.
- **Offline ribbon:** slides down 200 ms. On reconnect it turns success-coloured «رجع النت — بنزامن البيانات…» for 2 s, then slides up.
- **Toast:** 8 px rise + fade 150 ms in; out 100 ms. Stacks max 3, newest on top.

### 5.12 Number tickers (non-clinical only)
Admin KPI tiles may count up over 600 ms (`ease.emphasizedDecel`), only on first load. Doctor and pharmacist screens: **no tickers at all**. Patient app: no tickers on anything medical.

---

## 6. The Four 3D Components

Each component spec has: **purpose → where used → inputs → visual structure → state table → web build → Flutter build → accessibility → fallbacks → budget → tests.**

### 6.1 3D Biometric Face-Mesh Scanner (`FaceMeshScanner`)

**Purpose:** show the person (or the operator) in real time whether the face capture is good enough, guide them to fix it, and run the liveness challenge. It is a **visualisation of real detector signals** (M4). It never decides anything: the quality gate (role-06 §6.1) and the server (AI service) decide.

**Where used**

| Mode | Device | Camera | Challenge | Tier |
|------|--------|--------|-----------|------|
| `enrol` | Patient phone | Front | Active (server sequence, e.g. `["blink","turn_left"]`) | A/B/C by device |
| `pharmacyVerify` | Pharmacist phone (pointed at the patient) or pharmacist webcam | Front/rear (flip) / webcam | Active | A/B/C (web defaults to C, §3) |
| `emergencyIdentify` | Paramedic phone | **Rear** (flip available) | **None** (passive PAD only, E-BIO-07) | **Always E** (2D fast-path) |

**Inputs (per analysed frame, every 150 ms):** face count; bounding box; `headEulerAngleX/Y/Z` (pitch/yaw/roll); eye-open and smile probabilities; contours (face oval + eyes + lips; `enableContours: true`); mean luminance from the Y plane; blur score; current challenge step; server hints from `422 BIO_LOW_QUALITY` (`increase_light`, `face_camera`, `remove_obstruction`).

**Visual structure (Tiers A/B)**
1. **Camera preview**, full-bleed, mirrored for the front camera.
2. **Vignette mask:** `rgba(0,0,0,0.55)` everywhere except an oval cut-out (width 62% of the screen, aspect 1 : 1.3), centred 42% from the top. The oval edge is feathered 12 px.
3. **Depth ring** (the "3D" part): three ellipses on a virtual sphere at normalised heights −0.25, 0, +0.25 (96 points each). Each frame they are rotated by the **real** head angles (yaw, pitch, roll, low-pass filtered with α = 0.35) and perspective-projected (`x' = x · f / (f + z)`, `f = 3.0`), then scaled and centred on the face bounding box. Front-facing segments are drawn at 2.5 px / 100% opacity, back-facing segments at 1 px / 30%, so the ring visibly turns with the head.
4. **Contour mesh:** ML Kit contour points drawn as 2 px dots joined by 1 px lines along each contour (Tier A: plus a glow `MaskFilter.blur(BlurStyle.outer, 3)`; Tier B: no glow).
5. **Challenge arc:** segmented arc around the oval, one segment per challenge step. Completed segments fill with `spring.snappy`; the active one pulses its opacity at 0.5 Hz.
6. **Scan sweep:** a horizontal band (8% of oval height, gradient transparent → ring colour → transparent) sweeps top → bottom in 1.6 s, **only** during `capturing` and `uploading`.
7. **Hint chip:** an opaque pill `rgba(0,0,0,0.72)`, white `body-lg` text, icon, at 78% from the top. Text swaps with a 150 ms crossfade, and a new hint can show at most once per 1.2 s (no flicker).
8. **Controls row** (bottom, thumb zone): torch toggle (rear camera), flip camera, and in emergency mode **«امسح كارت الطوارئ»** and **«دوّر بالرقم القومي»** are always visible.

**Head-turn direction rule:** the arrow and the word describe the turn **relative to the person's own face**. In `enrol` (front camera, mirrored preview), the user's left appears on the screen's left, so «لف وشك ناحية الشمال» shows an arrow pointing to screen-left. The sign mapping from `headEulerAngleY` is platform-specific (role-06 §6.1), so it is held in one constant `kYawSign` verified on real iOS and Android devices at Stage 3. **These arrows never mirror in RTL** (UI-01 §5.5).

**State table** (copy keys are canonical in UI-03; Egyptian Arabic shown here for review)

| State | Detector condition | Ring colour (UI-01 §3.2.6) | Motion | Haptic | Hint (AR) | Key |
|-------|-------------------|----------------------------|--------|--------|-----------|-----|
| `searching` | 0 faces | white 70% | Ring idles flat (no rotation), slow 0.25 Hz opacity breath | — | «حط وشك جوه الدايرة» | `scan.hint.placeFace` |
| `faceFound` | 1 face first detected | amber | Ring snaps to the face (`spring.snappy`) | `selection` | — | — |
| `tooFar` | box < 25% of frame width | amber | — | — | «قرّب شوية» | `scan.hint.closer` |
| `tooClose` | box > 70% of frame width | amber | — | — | «بعّد الموبايل شوية» | `scan.hint.farther` |
| `offCenter` | box centre > 15% from oval centre | amber | Ring follows the face | — | «خلي وشك في نص الدايرة» | `scan.hint.center` |
| `poseOff` | \|yaw\| > 30° or \|pitch\| > 25° (neutral frames) | amber | Ring tilts visibly | — | «بص للكاميرا على طول» | `scan.hint.lookStraight` |
| `tooDark` | luminance < 60 | amber | — | — | Front: «النور قليل — روح مكان منوّر». Rear: torch auto-on + «شغّلنا الكشاف» | `scan.hint.moreLight` / `scan.hint.torchOn` |
| `tooBright` | luminance > 200 | amber | — | — | «النور جامد ورا الوش — غيّر الزاوية» | `scan.hint.backlight` |
| `blurry` | blur score < threshold | amber | — | — | «ثبّت الموبايل ثانية» | `scan.hint.holdSteady` |
| `obstructed` | server hint `remove_obstruction` | amber | — | — | Enrol: «لو تقدر، شيل النضارة أو الماسك ثانية». **Emergency: never ask to remove medical equipment:** «لو فيه ماسك أكسجين أو رباط كمّل عادي — ولو مانفعش، امسح كارت الطوارئ» | `scan.hint.obstruction.enrol` / `.emergency` |
| `multipleFaces` | > 1 face and no dominant face (E-BIO-08) | amber | — | — | Enrol: «لازم وشك انت بس يبقى في الصورة». Emergency: «خلي وش المريض بس في الكادر» | `scan.hint.oneFace.*` |
| `aligned` | All gates green | teal | Ring brightens; contour glow on (Tier A) | `selection` (once) | «تمام كده — متتحركش» | `scan.hint.holdStill` |
| `challengeBlink` | Active step `blink` | blue | Eye contours highlight | `light` when passed | «رمّش بعينك مرة» | `scan.challenge.blink` |
| `challengeTurnLeft` / `Right` | Active step `turn_left` / `turn_right` | blue | Ring shows a ghost target rotated 25° in the required direction | `light` when passed | «لف وشك ناحية الشمال شوية» / «… اليمين شوية» | `scan.challenge.turnLeft` / `turnRight` |
| `challengeSmile` | Active step `smile` | blue | Lip contour highlight | `light` when passed | «ابتسم ابتسامة صغيرة» | `scan.challenge.smile` |
| `capturing` | Gates green ≥ 500 ms (emergency auto-capture) or challenge frames | green | Sweep band runs | `medium` | «ثانية واحدة…» | `scan.capturing` |
| `uploading` | Request in flight | green | Sweep continues; indeterminate progress | — | «بنتأكد…» | `scan.verifying` |
| `slowNetwork` | Request > 8 s | green | — | — | «النت بطيء — تقدر تمسح كارت الطوارئ بدل كده» + QR button (the request is **not** cancelled) | `scan.slowNetwork` |
| `success` | Enrol OK / verify OK / `match` | green | Ring closes into a full circle, then a check draws (`spring.celebrate` in **patient enrol only**; `spring.snappy` otherwise) | `success` | Enrol: «تمام! وشك اتسجل بأمان» | `scan.success.*` |
| `failedQuality` | `422 BIO_LOW_QUALITY` | amber | Ring resets | `warning` | Server hint text + «جرّب تاني (فاضل {n} محاولات)» | `scan.retry` |
| `livenessFailed` | `422 BIO_LIVENESS_FAILED` (1st/2nd time) | amber | Ring resets | `warning` | «مقدرناش نتأكد من الصورة. جرّب تاني في نور كويس» (non-accusatory) | `scan.liveness.retry` |
| `spoofLocked` | 3rd liveness failure in 10 min, or server `security_flag` | **red, solid lock icon** | Instant cut (T-14); camera stops | `error` | Staff: «المسح اتقفل — فيه محاولة غير طبيعية واتسجلت للمراجعة». Patient: «المسح اتوقف مؤقتاً لأسباب أمنية. جرّب بعد شوية أو كلّم الدعم» | `scan.locked.*` |
| `permissionDenied` | Camera permission denied | — | No ring | — | «محتاجين الكاميرا عشان نمسح الوش» + «افتح الإعدادات»; emergency also shows the QR and national-ID buttons | `scan.permission` |
| `aiDown` | `503 AI_SERVICE_UNAVAILABLE` (E-BIO-12) | — | Ring hidden | `warning` | «التعرّف على الوش واقف دلوقتي» + two big buttons (QR, national ID) | `scan.aiDown` |

**Emergency variant (Tier E, always):** black background, a **static** 4 px white oval outline (no vignette blur, no ring, no contour mesh), hint chip at `em.body` size, the progress indicator during `capturing`/`uploading` (the one animation role-07 allows), torch auto-on when dark, and the result screen appears with **0 ms** transition. A `possible_match` result goes to the candidate-confirm screen (UI-06/UI-07) with a `warning` haptic.

**Web build (pharmacist webcam, Tier A only when Security approves §3 option (a))**

```tsx
// components/three/FaceMeshScanner.tsx (client component; dynamically imported, ssr:false)
'use client';
import { useEffect, useRef } from 'react';
import { useMotionTier } from '@/lib/motion/tier';

type ScannerState =
  | 'searching' | 'aligned' | 'challengeBlink' | 'challengeTurnLeft' | 'challengeTurnRight'
  | 'challengeSmile' | 'capturing' | 'uploading' | 'success' | 'failedQuality' | 'livenessFailed' | 'spoofLocked';

export function FaceMeshScanner({ state, pose, hint }: {
  state: ScannerState;
  pose: { yaw: number; pitch: number; roll: number; box: DOMRectReadOnly } | null; // from the detector, never invented
  hint: string;
}) {
  const tier = useMotionTier();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (tier === 'C' || tier === 'E' || !pose) return;            // 2D oval only
    const ctx = canvas.current!.getContext('2d')!;
    drawDepthRing(ctx, pose, ringColorFor(state));                 // same projection as §6.1 step 3
  }, [tier, pose, state]);
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black">
      {/* <video> preview is owned by the parent; it is stopped with track.stop() on unmount (role-05 §9) */}
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
      <div role="status" aria-live="polite"
           className="absolute inset-x-0 bottom-[22%] mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-white">
        {hint}
      </div>
    </div>
  );
}
```

**Flutter build**

```dart
// lib/features/biometrics/presentation/widgets/face_mesh_painter.dart
class FaceMeshPainter extends CustomPainter {
  FaceMeshPainter({required this.pose, required this.contours, required this.ringColor,
                   required this.tier, required this.sweepT}) : super(repaint: null);
  final HeadPose? pose;                 // filtered yaw/pitch/roll (radians) + face rect in widget coords
  final List<List<Offset>> contours;     // ML Kit contours mapped to widget coords
  final Color ringColor;
  final MotionTier tier;
  final double? sweepT;                  // 0..1 during capturing/uploading, else null

  static const _f = 3.0;
  static const _heights = [-0.25, 0.0, 0.25];

  @override
  void paint(Canvas canvas, Size size) {
    final p = pose;
    if (p == null || tier == MotionTier.c || tier == MotionTier.e) return; // 2D oval is drawn by the parent
    final r = p.rect;
    for (final h in _heights) {
      final radius = math.sqrt(1 - h * h);
      Offset? prev;
      double prevZ = 0;
      for (var i = 0; i <= 96; i++) {
        final a = i / 96 * 2 * math.pi;
        var v = Vector3(radius * math.cos(a), h, radius * math.sin(a));
        v = rotate(v, yaw: p.yaw, pitch: p.pitch, roll: p.roll);   // same order on every platform
        final s = _f / (_f + v.z);
        final pt = Offset(r.center.dx + v.x * s * r.width * 0.62, r.center.dy + v.y * s * r.height * 0.62);
        if (prev != null) {
          final front = (v.z + prevZ) / 2 < 0;
          canvas.drawLine(prev, pt, Paint()
            ..color = ringColor.withValues(alpha: front ? 1 : 0.3)
            ..strokeWidth = front ? 2.5 : 1
            ..strokeCap = StrokeCap.round);
        }
        prev = pt;
        prevZ = v.z;
      }
    }
    final dot = Paint()..color = ringColor;
    if (tier == MotionTier.a) dot.maskFilter = const MaskFilter.blur(BlurStyle.outer, 3);
    for (final c in contours) {
      for (final o in c) { canvas.drawCircle(o, 1.6, dot); }
    }
    if (sweepT != null) _drawSweep(canvas, r, sweepT!);
  }

  @override
  bool shouldRepaint(FaceMeshPainter old) =>
      old.pose != pose || old.ringColor != ringColor || old.sweepT != sweepT || old.tier != tier;
}
// Wrap in RepaintBoundary; the CameraPreview is a sibling, never rebuilt when hints change.
```

**Accessibility:** the hint chip is a live region (`SemanticsService.announce` on change, throttled to one announcement per 2 s). VoiceOver/TalkBack users get spoken challenge steps. Every state with a retry has a visible button, not just a gesture.

**Budget:** overlay paint ≤ 2 ms per frame on Tier B; analysis stays at one frame per 150 ms (role-06); no allocation inside `paint` beyond the 3 × 97 points.

**Tests:** golden tests for each state (static pose fixtures, RTL and LTR); a unit test that the yaw sign mapping turns the ring the correct way; a widget test that Emergency mode renders **no** `FaceMeshPainter`; a manual test with glasses, a mask, low light and a bandage.

---

### 6.2 3D Holographic Medical Identity Card (`MedicalIdCard3D`)

**Purpose:** give the patient a tangible, trustworthy "medical ID" they understand instantly (like an Apple Wallet pass), showing the life-critical facts. It is the hero tile on Patient Home.

**Inputs:** the signed emergency card data (role-06 §6.4): name, MRN, blood type + `data_source`, allergies (sorted: anaphylaxis first, then severity), chronic conditions, emergency-contacts count, `fetched_at`, `expires_at`, offline flag.

**Size & shape:** ISO/IEC 7810 ID-1 aspect **1.586** (85.60 × 53.98 mm). Mobile width = screen width − 32 (358 dp on 390 wide → 226 dp tall). Radius 20 (UI-01 §6).

**Layers (front), from back to front**

| z (`translateZ`) | Layer | Content |
|---:|-------|---------|
| 0 | Base plate | `--sh-brand-gradient` (light) / deep variant (dark) + 2% noise |
| 0 | Guilloché | Fine SVG line pattern at 8% white (security-document feel) |
| 4 px | Foil | Holographic sheen: `conic-gradient` (web) / foil `FragmentShader` (Flutter Tier A) at 30% opacity, `mix-blend-mode: color-dodge`. Its position shifts with tilt. **Tier B:** a 2-stop linear gradient that shifts with tilt. **Tier C:** none |
| 8 px | Content | Top row: logo + «الكارت الطبي» + status pill. Middle: name (`h3`), MRN (`code`). Large: **blood type** (`display`, Inter 800, LTR-isolated) with a source tag. Bottom: allergy chips (max 3 + «+{n}»), chronic conditions (1 line), «آخر تحديث {relative}» |
| 16 px | Verified shield | `ShieldCheck` emboss on the inline-end side, only when blood type is `clinician_confirmed` |
| 24 px | Specular sheen | Radial highlight (white 0 → 18% → 0) centred at the pointer/gyro position |

**Back side** (tap to flip): a **flat, pure-white QR panel** (`--sh-qr-bg`, quiet zone ≥ 4 modules, no foil, no tilt, no sheen; scanners need a flat, high-contrast code), with «ورّي الكود ده للمسعف لو مقدرتش تتكلم», the issued/expiry dates and «جهات الطوارئ: {n}». While the back is showing, **tilt is disabled and the card settles to 0°**.

**Interactions**

| Input | Behaviour | Spring/duration |
|-------|-----------|-----------------|
| Pointer move (web, Tier A/B) | rotateX = −(y − 0.5) × 2 × 12°, rotateY = (x − 0.5) × 2 × 12°; sheen follows the pointer | `spring.tilt` |
| Gyro (mobile, Tier A/B) | Device pitch/roll from the accelerometer gravity vector (`sensors_plus`, game interval), low-pass α = 0.12, relative to a baseline captured when the card becomes visible; ±20° device tilt → ±10° card tilt (clamped) | `spring.tilt` |
| Drag (mobile) | Same mapping as pointer while dragging; release → back to the gyro value | `spring.tilt` |
| Tap | Flip (rotateY 180°, backface hidden) | `spring.hero` (≈ 500 ms) |
| Long-press | Sheet: «افتح كارت الطوارئ (شاشة كاملة)», «شارك مع المسعف (QR)», «حدّث البيانات» | `selection` haptic |
| Keyboard (web) | Enter/Space flips; no tilt from keys | — |
| Pointer leave | Return to 0° | `spring.tilt` |

**Data states**

| State | Visual | Copy (AR) |
|-------|--------|-----------|
| `loaded` (online) | Status pill: teal «محدّث» | — |
| `cachedOffline` | Status pill: offline colours «أوفلاين — آخر تحديث من {relative}» | `card.offline` |
| `expired` (card past `expires_at`, EXT-04-AC3) | Red banner strip across the bottom «الكارت ده قديم — افتح النت عشان نحدّثه»; foil off | `card.expired` |
| Blood type `clinician_confirmed` | Shield + «متأكد منها الدكتور» | `card.blood.confirmed` |
| Blood type `patient_reported` | Amber outline tag «انت اللي كاتبها» | `card.blood.self` |
| Blood type `unknown` | `display` «؟» + «فصيلة الدم مش معروفة» | `card.blood.unknown` |
| No allergies recorded | «مفيش حساسية متسجلة» (**not** «مفيش حساسية»: no record ≠ no allergy) | `card.allergy.none` |
| Anaphylaxis present | First chip solid red with siren icon; it is never hidden behind «+{n}» | — |
| `loading` | Skeleton card (same size, no tilt) | — |
| `error` (never fetched) | Neutral card «لسه ماعملناش الكارت — كمّل بياناتك الطبية» + CTA | `card.missing` |

**Web build (CSS 3D; no WebGL needed: crisper text, accessible DOM, ~0 KB extra)**

```tsx
// components/three/MedicalIdCard3D.tsx
'use client';
import { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import { springs, dur } from '@/lib/motion/tokens';

export function MedicalIdCard3D({ data, summaryText }: { data: EmergencyCardView; summaryText: string }) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const px = useMotionValue(0.5), py = useMotionValue(0.5);
  // Outer layer: tilt (pointer-driven springs). Inner layer: flip (state-driven animate).
  const rx = useSpring(useTransform(py, [0, 1], [12, -12]), springs.tilt);
  const ry = useSpring(useTransform(px, [0, 1], [-12, 12]), springs.tilt);
  const sheenX = useTransform(px, v => `${v * 100}%`);
  const sheenY = useTransform(py, v => `${v * 100}%`);
  const tiltOn = !reduce && !flipped;

  return (
    <div className="[perspective:1000px]" role="group" aria-label={summaryText}>
      <motion.div
        style={{ rotateX: tiltOn ? rx : 0, rotateY: tiltOn ? ry : 0 }}
        onPointerMove={e => {
          if (!tiltOn) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => { px.set(0.5); py.set(0.5); }}
        className="[transform-style:preserve-3d]"
      >
        <motion.button
          type="button"
          aria-pressed={flipped}
          onClick={() => setFlipped(f => !f)}
          animate={reduce ? { opacity: 1 } : { rotateY: flipped ? 180 : 0 }}
          transition={reduce ? { duration: dur.short } : springs.hero}
          className="relative aspect-[1.586] w-full rounded-[20px] [transform-style:preserve-3d] shadow-[var(--shadow-e5)]"
        >
          {/* Reduced motion: no 3D flip; front/back swap with a 150 ms crossfade inside CardFace */}
          <CardFront data={data} sheenX={sheenX} sheenY={sheenY} foil={!reduce} hidden={reduce ? flipped : false} />
          <CardBack qrPayload={data.qrPayload} hidden={reduce ? !flipped : false} />  {/* rotateY(180deg), flat white */}
        </motion.button>
      </motion.div>
    </div>
  );
}
```

**Flutter build**

```dart
// lib/core/visuals/medical_id_card_3d.dart (excerpt)
Widget build(BuildContext context) {
  final tier = ref.watch(motionTierProvider);
  final tilt = tier == MotionTier.a || tier == MotionTier.b ? ref.watch(cardTiltProvider) : Tilt.zero; // springed
  return Semantics(
    label: summaryText,               // "فصيلة الدم O موجب، متأكد منها الدكتور. حساسية مفرطة من البنسلين…"
    button: true,
    child: GestureDetector(
      onTap: _flip,
      onLongPress: _openActions,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0012)    // perspective
          ..rotateX(_flipped ? 0 : tilt.x)
          ..rotateY(_flipAngle.value + (_flipped ? 0 : tilt.y)),
        child: AspectRatio(
          aspectRatio: 1.586,
          child: _flipAngle.value < math.pi / 2
              ? CardFront(data: data, sheen: tilt.sheen, foil: tier == MotionTier.a)
              : Transform(alignment: Alignment.center, transform: Matrix4.rotationY(math.pi),
                          child: CardBack(qr: data.qrPayload)),   // flat white QR
        ),
      ),
    ),
  );
}
// cardTiltProvider listens to accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval)
// only while the card is visible (VisibilityDetector) and the app is resumed; cancels the subscription otherwise.
```

**Accessibility:** the whole card has one semantic label that reads all critical info in order (anaphylaxis first). Flip has a visible affordance «اقلب الكارت عشان الكود». The foil is decorative and invisible to screen readers.

**Fallbacks:** Tier C/RM → flat card, no tilt, no foil, flip becomes a 150 ms crossfade. Tier E → this component is never mounted (the Emergency screen is a flat high-contrast layout).

**Budget:** web ≤ 1 ms script per pointer event (motion values, no React re-render); Flutter: tilt rebuilds only the `Transform` (content is a `RepaintBoundary` child).

---

### 6.3 E-Prescription Authenticity Seal & Medication Cards

#### 6.3.1 Authenticity Seal (`RxSeal`)

**Purpose:** a single glance answer to "is this prescription genuine and dispensable?" for the pharmacist, and "this was signed by a real verified doctor" for the patient.

**Hard rule (M4):** the seal's state comes **only** from a verification result (local Ed25519 check + server `verify`), never from the presence of data. Before verification it shows `verifying`, never `authentic`.

**Anatomy (96 px web result header; 120 dp mobile):**
1. Outer ring: micro-text «SmartHealth • روشتة موثّقة • Ed25519 •» repeated around the circle (2.5 pt equivalent; decorative, `aria-hidden`).
2. Middle ring: 48 radial guilloché ticks.
3. Core: shield + check (authentic), cracked shield (failed), clock-ban (expired/cancelled).
4. Holo layer (Tier A only): conic foil sweep, 20% opacity.

**States**

| State | Trigger | Visual | Motion | Haptic (mobile) | Copy (AR) |
|-------|---------|--------|--------|-----------------|-----------|
| `verifying` | Scan decoded, checks running | Grey seal, dashed ring | Ring dashes rotate (`ease.linear`, 1.2 s per turn) | — | «بنتأكد من الروشتة…» |
| `authentic` | Local signature OK + server `valid` | Green seal, solid ring, check | **Stamp:** scale 1.15 → 1 (`spring.celebrate` on the patient app; `spring.snappy` on the pharmacist screen) + a single 400 ms ring glow; then the micro-text ring rotates once per 24 s (Tier A only) | `success` | «روشتة سليمة وموثّقة» |
| `authenticOffline` | Local signature OK, no network (E-NET-03, SD-06) | Green **outline** seal + offline pill | Stamp, no glow | `success` | «الروشتة سليمة — بس الصرف محتاج نت» |
| `failed` | `RX_SIGNATURE_INVALID` (local or server) | Red cracked seal, **static** | **No animation** (danger never "performs") | `error` | «الروشتة دي مش سليمة — ماتصرفهاش» |
| `alreadyDispensed` | `already_dispensed` | Grey seal + green check badge | Crossfade 150 ms | `warning` | «اتصرفت بالكامل يوم {date} في {pharmacy}» |
| `expired` | `expired` | Grey desaturated seal + diagonal band «انتهت» | Crossfade | `warning` | «الروشتة انتهت صلاحيتها» |
| `cancelled` | `cancelled` | Grey seal + band «اتلغت» | Crossfade | `warning` | «الدكتور لغى الروشتة دي» |
| `prescriberInvalid` | `prescriber_invalid` (E-LIC-02) | Red seal with a "license" glyph, static | None | `error` | «رخصة الدكتور مش سارية — كلّم الدكتور بتاع المريض» |
| `prescriberSuspendedButValid` | Suspended after issue (E-LIC-02) | Green seal + amber info banner | Stamp | `success` | «الروشتة سليمة (اتكتبت قبل إيقاف الرخصة)» |

The patient's Rx detail shows the seal in `authentic` styling with the caption «موقّعة إلكترونياً من د. {name}» once the server reports the prescription as signed. The stamp animation plays **once per prescription per device** (remembered locally by Rx ID only, no PHI).

**Build:** web = inline SVG + Motion (no WebGL). Flutter = `CustomPainter` for rings + **Rive** file `assets/rive/rx_seal.riv` with a state machine (`verifying`, `authentic`, `failed`, `inactive`); Tier C uses static SVG/PNG frames for each state.

#### 6.3.2 Medication cards & dose visuals

**Purpose:** make it impossible for an elderly patient to confuse which medicine to take when.

| Element | Spec |
|---------|------|
| Dosage-form glyph | Soft 2.5D icon (64 dp) per form: tablet (round, score line), capsule (two-tone), syrup (bottle + spoon), inhaler, injection pen, eye/ear drops, cream tube, suppository. Tier A: a subtle 6° idle tilt on first appear (`spring.gentle`, once). Tier B/C: static |
| Drug name | `h3` Inter (LTR-isolated) + generic name `caption` |
| Dose line | «قرص واحد — مرتين في اليوم» in `body-lg`, with the strength `<bdi>875/125 mg</bdi>` |
| Time-of-day chips | Icon **and** text **and** colour, never colour alone: «الصبح» (sunrise, amber tint), «الضهر» (sun, yellow tint), «بالليل» (sunset, violet tint), «قبل النوم» (moon, indigo tint). Selected = solid; others = outline |
| Food relation | Chip «بعد الأكل» / «قبل الأكل» / «مع الأكل», only if the instructions state it |
| Remaining | «فاضل ٦ أيام» / «فاضل قرصين في العلبة», swapped instantly (M6) |
| Take action | «خدت الجرعة» checkbox: check draws (150 ms) + `success` haptic + the chip fills (`spring.celebrate`, patient only). Undo for 5 s via a toast |

**Safety rule (critical):** the app **never invents dose times.** Chips appear only if (a) the prescription instructions specify the time, or (b) the patient set reminder times themselves; in case (b) the card says «المواعيد دي انت اللي حددتها». If neither applies, the card shows the frequency only («مرتين في اليوم — كل ١٢ ساعة») and a button «حدد مواعيد التذكير».

**Dose Timeline (`DoseTimeline`):** a 24-hour horizontal bar on mobile (time flows **left → right in both languages**, per role-07 §5 chart-axis rule) with dose markers and a "now" needle. Past doses: filled ✓ or hollow ✗ (missed, amber). The needle moves with real time (no animation beyond a 1-minute tick).

---

### 6.4 3D Living AI Medical Orb (`AiOrb`)

**Purpose:** a calm, recognisable presence for the AI assistant that tells the user what the assistant is doing (listening, thinking, guiding, warning) at a glance. It is **decorative**: every state is also shown as a text label, and safety actions never depend on noticing the orb.

**Where used:** patient mobile app, AI assistant screen header (120 dp) and the Patient Home "اسأل المساعد" tile (56 dp, idle only). The orb is not used in staff UIs and not in Emergency mode.

**State parameters** (colours in UI-01 §3.2.5)

| State | Trigger | Noise amplitude | Noise frequency | Flow speed | Pulse (scale) | Label (AR) |
|-------|---------|----------------:|----------------:|-----------:|---------------|------------|
| `idle` | Screen open, nothing typed | 0.08 | 1.2 | 0.25 | 0.98 ↔ 1.00 at **0.17 Hz** (6 s, `ease.inOutSine`) | «أنا هنا لو محتاجني» |
| `listening` | User is typing (debounced 300 ms) | 0.14 | 1.6 | 0.60 | Each keystroke burst nudges amplitude +0.03 (`spring.orb`) | «سامعك…» |
| `thinking` | Request in flight | 0.18 | 2.4 | 1.00 | Slow rotation 0.3 rad/s | «بفكّر…» |
| `guidance` | Reply with triage `self_care`/`routine`/`soon` | 0.10 | 1.0 | 0.35 | 0.17 Hz | «دي إرشادات عامة» |
| `urgent` | Reply with triage `urgent` (E-AI-10) | 0.16 | 1.8 | 0.80 | 0.5 Hz | «محتاج تشوف دكتور خلال ٢٤ ساعة» |
| `emergency` | Triage `emergency` (E-AI-01) | — | — | — | — | The orb switches to its red palette **in the same frame** the takeover route is pushed (T-13, 0 ms). The takeover has no orb and no 3D |
| `crisis` | Crisis path (E-AI-02) | 0.06 | 0.8 | 0.20 | 0.10 Hz (10 s, very slow) | «أنا معاك — مش لوحدك» |
| `unavailable` | `AI_SERVICE_UNAVAILABLE` / `AI_TIMEOUT` (E-AI-07) | 0 | — | 0 | none (static grey) | «المساعد مش متاح دلوقتي — اختار التخصص بنفسك» |

**Safety constraints:** every pulse is ≤ 1 Hz (WCAG 2.3.1 allows at most 3 flashes per second; we stay far below). Colour changes between states use `spring.orb` on a 0–1 mix uniform, so there is never a hard flash. The `emergency` state never relies on animation to alert: the takeover is what alerts.

**Web build (R3F, Tier A/B; used in the UI-08 prototype and any future web patient portal)**

```tsx
// components/three/AiOrb.tsx (dynamically imported, ssr:false)
'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ORB_STATES, type OrbState } from '@/lib/motion/orb-states';
import { orbVertex, orbFragment } from './shaders/orb.glsl'; // simplex noise: Ashima Arts / S. Gustavson (MIT) — keep attribution

function Blob({ state, detail }: { state: OrbState; detail: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmp: { value: 0.08 }, uFreq: { value: 1.2 }, uSpeed: { value: 0.25 },
    uColorA: { value: new THREE.Color('#7C3AED') }, uColorB: { value: new THREE.Color('#2563EB') },
  }), []);
  useFrame((_, dt) => {
    const u = mat.current!.uniforms, t = ORB_STATES[state];
    u.uTime.value += dt * u.uSpeed.value;
    const k = 1 - Math.exp(-dt * 6);                       // critically damped approach (≈ spring.orb feel)
    u.uAmp.value += (t.amp - u.uAmp.value) * k;
    u.uFreq.value += (t.freq - u.uFreq.value) * k;
    u.uSpeed.value += (t.speed - u.uSpeed.value) * k;
    u.uColorA.value.lerp(t.colorA, k);
    u.uColorB.value.lerp(t.colorB, k);
  });
  return (
    <mesh>
      <icosahedronGeometry args={[1, detail]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={orbVertex} fragmentShader={orbFragment} />
    </mesh>
  );
}

export default function AiOrb({ state, label }: { state: OrbState; label: string }) {
  const [detail, setDetail] = useState(5);                // Tier A ≈ 20k faces; Tier B → 3 (≈ 1.3k faces)
  const [dpr, setDpr] = useState(1.75);
  return (
    <figure className="flex flex-col items-center gap-2">
      <Canvas dpr={dpr} frameloop={state === 'unavailable' ? 'never' : 'always'}
              camera={{ position: [0, 0, 3], fov: 40 }} aria-hidden>
        <PerformanceMonitor onDecline={() => { setDetail(3); setDpr(1.25); }} />
        <Blob state={state} detail={detail} />
      </Canvas>
      <figcaption role="status" aria-live="polite" className="text-sm text-ai">{label}</figcaption>
    </figure>
  );
}
```

Vertex shader: displace each vertex along its normal by `uAmp * snoise(normal * uFreq + uTime)`. Fragment shader: mix `uColorA`→`uColorB` by the displaced height, add a fresnel rim `pow(1.0 - dot(N, V), 2.5) * 0.6`. No textures, one draw call.

**Flutter build (fragment shader on a quad: one draw call, no 3D engine)**

```glsl
// mobile-app/shaders/ai_orb.frag
#include <flutter/runtime_effect.glsl>
uniform vec2 uSize;
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3 uColorA;
uniform vec3 uColorB;
out vec4 fragColor;

// Paste the full 3D simplex noise implementation here, ABOVE main()
// (Ashima Arts / Stefan Gustavson, MIT licence — keep the attribution comment).
// Define it in full; don't rely on a forward declaration.
float snoise(vec3 v) { /* … full implementation … */ return 0.0; }

void main() {
  vec2 uv = (FlutterFragCoord().xy / uSize) * 2.0 - 1.0;   // -1..1
  float r = length(uv);
  float n = snoise(vec3(uv * uFreq, uTime)) * uAmp;
  float edge = 0.82 + n;                                      // wobbly silhouette
  if (r > edge) { fragColor = vec4(0.0); return; }
  float z = sqrt(max(0.0, 1.0 - (r / edge) * (r / edge)));    // fake sphere normal
  vec3 col = mix(uColorA, uColorB, clamp(0.5 + uv.y * 0.5 + n, 0.0, 1.0));
  float rim = pow(1.0 - z, 2.5) * 0.6;
  col += rim;
  float alpha = smoothstep(edge, edge - 0.02, r);             // antialiased edge
  fragColor = vec4(col * alpha, alpha);                        // premultiplied
}
```

```dart
// lib/features/assistant/presentation/widgets/ai_orb.dart (excerpt)
class AiOrb extends ConsumerStatefulWidget { /* state, label, size */ }
// Loads FragmentProgram.fromAsset('shaders/ai_orb.frag') once (cached provider).
// A Ticker drives uTime; on Tier B the shader is repainted every 2nd frame (30 fps).
// Tier C / Reduced Motion: a static RadialGradient circle in the state's colours + the text label.
// TickerMode(enabled: false) when off-screen; the ticker is disposed when the chat screen is popped.
// The label sits under the orb in a Semantics(liveRegion: true) Text.
```

**Accessibility:** the orb is `aria-hidden` / `ExcludeSemantics`; the label carries the state. Under Reduced Motion the orb is a static gradient disc and only the label changes.

**Budget:** web ≤ 2 ms GPU per frame at 160 × 160 px; Flutter ≤ 2 ms raster on Tier B; nothing runs while the chat is not visible.

---

## 7. Haptics

### 7.1 `HapticService` (Flutter)
One injectable service (`lib/core/haptics/haptic_service.dart`) with seven semantic methods. Screens never call `HapticFeedback` directly.

| Method | iOS | Android | Flutter mechanism |
|--------|-----|---------|-------------------|
| `selection()` | `UISelectionFeedbackGenerator` | `HapticFeedbackConstants.CLOCK_TICK` (or `SEGMENT_TICK` on API 34+) | `HapticFeedback.selectionClick()` |
| `light()` | `UIImpactFeedbackGenerator(.light)` | `KEYBOARD_TAP` | `HapticFeedback.lightImpact()` |
| `medium()` | `UIImpactFeedbackGenerator(.medium)` | `CONTEXT_CLICK` | `HapticFeedback.mediumImpact()` |
| `heavy()` | `UIImpactFeedbackGenerator(.heavy)` | `LONG_PRESS` | `HapticFeedback.heavyImpact()` |
| `success()` | `UINotificationFeedbackGenerator(.success)` | `CONFIRM` (API 30+), else `medium()` | Platform channel `sh/haptics` (Flutter's `HapticFeedback` has no notification types), or a maintained package verified at Stage 0 |
| `warning()` | `UINotificationFeedbackGenerator(.warning)` | `REJECT` (API 30+) at lower intensity, else `medium()` | Same channel |
| `error()` | `UINotificationFeedbackGenerator(.error)` | `REJECT` (API 30+), else `heavy()` | Same channel |

**Rules:** at most one haptic per 150 ms (the service drops extras); no repeating/looping vibration patterns; disabled when the user turns off «الاهتزاز» in Settings; the OS setting is respected automatically. Every haptic accompanies a visible change. Web: no haptics.

### 7.2 Event map

| Event | Role | Haptic |
|-------|------|--------|
| Tab change, segmented control change, sheet detent snap, picker tick | All | `selection` |
| Switch toggle, checkbox (dispense item), dose marked taken (press) | All | `light` |
| Face found in frame / aligned | Patient, pharmacist | `selection` (once per alignment) |
| Liveness challenge step passed | Patient, pharmacist | `light` |
| Capture taken | All scanner modes | `medium` |
| Enrolment success | Patient | `success` |
| Quality fail / liveness retry | All | `warning` |
| Spoof lock | All | `error` |
| Emergency identify `match` | Paramedic | `success` |
| Emergency `possible_match` / `no_match` | Paramedic | `warning` |
| Offline card QR valid | Paramedic | `success` |
| Offline card QR invalid signature | Paramedic | `error` |
| Rx authentic (verify) | Pharmacist | `success` |
| Rx failed / prescriber invalid | Pharmacist | `error` |
| Rx already dispensed / expired / cancelled | Pharmacist | `warning` |
| Dispense recorded | Pharmacist | `success` |
| `RX_QUANTITY_EXCEEDED` race | Pharmacist | `warning` |
| Pickup QR shown | Patient | `light` |
| Countdown reaches 60 s | Patient, pharmacist | `light` |
| Countdown expired | Patient, pharmacist | `warning` |
| Step-up (Face ID / fingerprint) success / fail | All | `light` / `warning` |
| AI emergency takeover | Patient | `error` (exactly once) |
| AI crisis path | Patient | **none** (calm) |
| Pull-to-refresh threshold | All | `medium` |
| Long-press menus (ID card) | Patient | `selection` |

---

## 8. Fallback System

### 8.1 Master matrix (what each component becomes)

| Component | Tier A | Tier B | Tier C / Reduced Motion | Tier E (Emergency) | Offline | Screen reader on |
|-----------|--------|--------|--------------------------|--------------------|---------|------------------|
| Face scanner | Ring + contour glow + sweep | Ring + contours, no glow | **Static oval + text hints**; progress only | Static white oval, no mask, progress only | Not available → QR / national-ID buttons | Spoken hints; capture button always visible |
| ID card | Tilt + foil shader + sheen | Tilt + linear foil | Flat card; flip = crossfade | **Not mounted** (flat Emergency layout) | Same + offline pill | Single semantic summary |
| Rx seal | Stamp + glow + ring rotation | Stamp only | Static state image | n/a | `authenticOffline` | State text read |
| AI orb | Shader 60 fps | Shader 30 fps, lower detail | Static gradient disc + label | **Not mounted** | `unavailable` | Hidden; label read |
| Glass surfaces | Blur | Tab bar only | Opaque | Opaque | — | — |
| Page transitions | Full | Full | 150 ms crossfade | 0 ms | — | — |
| Skeleton shimmer | Yes | Yes | Static | Not used | — | Busy state announced |
| Ambient loops | Yes | 30 fps; pause after 10 s idle | Off | Off | — | Off when `accessibleNavigation` is true |

### 8.2 Reduced Motion (OS setting): exact substitutions
- All translate/scale/rotate transitions → opacity crossfades ≤ 150 ms.
- No tilt, no parallax, no shaders, no shimmer, no shake, no stamp, no orb movement.
- Progress indicators, countdown rings and the scan progress **stay** (they convey information).
- Haptics unchanged.
- Web: `<MotionConfig reducedMotion="user">` at the root + `@media (prefers-reduced-motion: reduce)` CSS overrides. Flutter: check `MediaQuery.disableAnimationsOf(context)` in `ShMotion.of(context)` (§9.2), which returns zero or crossfade durations.

### 8.3 Low Power (battery saver, battery < 20% unplugged, thermal pressure)
- Tier → C for 3D and glass; motion durations unchanged (short UI transitions cost little).
- Sensors (gyro/accelerometer) unsubscribed.
- Web sets `data-power="low"`, which switches `.glass` to opaque (UI-01 §14.2).

### 8.4 Emergency fast-path (Tier E): non-negotiable rules
Applies to: paramedic mode (whole shell), `/card` (patient emergency card), the AI emergency takeover, and the ER desktop console's active-case view.

| # | Rule |
|---|------|
| E1 | Paramedic mode opens directly to the scanner. Static splash ≤ 400 ms; no onboarding animations |
| E2 | 3D components are **unmounted**, not hidden (no GPU work, no shader compile) |
| E3 | Page transitions 0 ms. The only animated elements are: scan progress, the break-glass session timer, countdowns |
| E4 | No blur, no shadows, no gradients, no glass, no skeletons |
| E5 | `wakelock_plus` keeps the screen on while an emergency session is open (role-06 §6.3) |
| E6 | Haptics on scan success/failure (§7.2) |
| E7 | If two consecutive frames exceed 32 ms while scanning, the overlay drops to the static oval for the rest of the session |
| E8 | At 8 s without a response, show the QR fallback button without cancelling the request; the identify request has a 20 s timeout (role-06 §5) |
| E9 | The profile renders complete from the first frame after the response: no staged reveals, no stagger |

**Time-to-critical-info budget** (role-07 §8.1 target ≤ 10 s, ≤ 3 taps):

| Step | Budget (p95, mid Android, 4G) |
|------|-------------------------------|
| App icon tap → camera live | ≤ 1.5 s cold / ≤ 0.8 s warm |
| Face aligned → auto-capture | 0.5 s gate (role-06) |
| Upload (≤ 200 KB) + identify | ≤ 3.0 s |
| Response → profile first frame | ≤ 100 ms |
| **Total (warm start)** | **≤ 5 s**, leaving margin for real-scene alignment |

### 8.5 Visibility & lifecycle
- Web: `document.visibilitychange` → R3F `frameloop="never"`; `IntersectionObserver` pauses scenes scrolled out of view.
- Flutter: `TickerMode` for off-screen routes; `VisibilityDetector` for in-page widgets; `AppLifecycleState.paused` → stop sensors, stop the camera (role-06), pause tickers.
- The camera is always released on leave (`CameraController.dispose()` / `track.stop()`).

---

## 9. Code: Shared Motion Modules

### 9.1 Web: `web-admin/lib/motion/tokens.ts`

```ts
export const dur = { instant: 0, micro: 0.1, short: 0.15, base: 0.25, medium: 0.35, long: 0.5 } as const; // seconds (Motion)
export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasizedDecel: [0.05, 0.7, 0.1, 1],
  emphasizedAccel: [0.3, 0, 0.8, 0.15],
  exit: [0.4, 0, 1, 1],
} as const;
export const springs = {
  snappy:    { type: 'spring', stiffness: 500, damping: 38, mass: 1 },
  gentle:    { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
  hero:      { type: 'spring', stiffness: 320, damping: 34, mass: 1 },
  sheet:     { type: 'spring', stiffness: 380, damping: 36, mass: 1 },
  tilt:      { type: 'spring', stiffness: 150, damping: 18, mass: 0.6 },
  orb:       { type: 'spring', stiffness: 80,  damping: 12, mass: 1 },
  celebrate: { type: 'spring', stiffness: 420, damping: 22, mass: 1 }, // patient-facing only; lint-banned in staff routes
} as const;
```

```ts
// web-admin/lib/motion/tier.ts
'use client';
import { create } from 'zustand';
export type MotionTier = 'A' | 'B' | 'C' | 'E';
const rank: Record<MotionTier, number> = { A: 3, B: 2, C: 1, E: 0 };

export const useMotionTierStore = create<{ tier: MotionTier; downgrade: (t: MotionTier) => void }>((set, get) => ({
  tier: 'A',
  downgrade: t => { if (rank[t] < rank[get().tier]) set({ tier: t }); }, // never upgrades within a session
}));

export async function detectInitialTier(): Promise<MotionTier> {
  const root = document.documentElement;
  if (root.dataset.theme === 'emergency') return 'E';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'C';
  if (!document.createElement('canvas').getContext('webgl2')) return 'C';
  const nav = navigator as Navigator & { deviceMemory?: number; getBattery?: () => Promise<{ level: number; charging: boolean }> };
  const battery = await nav.getBattery?.().catch(() => undefined);
  if (battery && battery.level < 0.2 && !battery.charging) { root.dataset.power = 'low'; return 'C'; }
  if ((nav.deviceMemory ?? 8) < 4 || navigator.hardwareConcurrency <= 4) return 'B';
  return 'A';
}
export const useMotionTier = () => useMotionTierStore(s => s.tier);
```

(Zustand is allowed for UI prefs per role-05 §6; this store holds no server data.)

### 9.2 Flutter: `lib/core/motion/`

```dart
// motion_tokens.dart
abstract final class ShDur {
  static const instant = Duration.zero;
  static const micro = Duration(milliseconds: 100);
  static const short = Duration(milliseconds: 150);
  static const base = Duration(milliseconds: 250);
  static const medium = Duration(milliseconds: 350);
  static const long = Duration(milliseconds: 500);
}
abstract final class ShEase {
  static const standard = Cubic(0.2, 0, 0, 1);
  static const emphasizedDecel = Cubic(0.05, 0.7, 0.1, 1);
  static const emphasizedAccel = Cubic(0.3, 0, 0.8, 0.15);
  static const exit = Cubic(0.4, 0, 1, 1);
}
abstract final class ShSpring {
  static const snappy = SpringDescription(mass: 1, stiffness: 500, damping: 38);
  static const gentle = SpringDescription(mass: 1, stiffness: 260, damping: 30);
  static const hero = SpringDescription(mass: 1, stiffness: 320, damping: 34);
  static const sheet = SpringDescription(mass: 1, stiffness: 380, damping: 36);
  static const tilt = SpringDescription(mass: 0.6, stiffness: 150, damping: 18);
  static const orb = SpringDescription(mass: 1, stiffness: 80, damping: 12);
  static const celebrate = SpringDescription(mass: 1, stiffness: 420, damping: 22); // patient app only
}

enum MotionTier { a, b, c, e }

/// Resolves the effective duration for the current context (reduced motion / emergency).
class ShMotion {
  const ShMotion._(this.tier, this.reduced);
  final MotionTier tier;
  final bool reduced;
  static ShMotion of(BuildContext context, WidgetRef ref) =>
      ShMotion._(ref.watch(motionTierProvider), MediaQuery.disableAnimationsOf(context));
  Duration d(Duration normal) =>
      tier == MotionTier.e ? Duration.zero : reduced ? (normal > ShDur.short ? ShDur.short : normal) : normal;
  bool get allow3D => tier == MotionTier.a || tier == MotionTier.b;
  bool get allowAmbient => allow3D && !reduced;
}
```

```dart
// motion_tier_provider.dart
@riverpod
class MotionTierController extends _$MotionTierController {
  @override
  MotionTier build() {
    final mode = ref.watch(appModeProvider);                 // patient | emergency | pharmacy
    if (mode == AppMode.emergency) return MotionTier.e;
    final power = ref.watch(powerStateProvider).valueOrNull;  // battery_plus wrapper
    if (power != null && (power.saver || (power.level < 20 && !power.charging))) return MotionTier.c;
    final device = ref.watch(deviceClassProvider).valueOrNull; // RAM / low-RAM via platform channel
    return switch (device) { DeviceClass.low => MotionTier.c, DeviceClass.mid => MotionTier.b, _ => MotionTier.a };
  }
  /// Called by the frame-timing monitor; only ever lowers the tier.
  void downgrade(MotionTier to) { if (to.index > state.index) state = to; }
}
```

Route-level emergency rule: the emergency `ShellRoute` (role-06 §4) sets `appModeProvider` to `AppMode.emergency` in its builder, and its pages use `NoTransitionPage` in go_router.

### 9.3 Lint guards
- **Web:** ESLint `no-restricted-imports` bans `@react-three/*` and `three` outside `components/three/**`; bans `springs.celebrate` in `app/[locale]/(doctor|pharmacist|admin)/**`.
- **Flutter:** custom lint bans `ShSpring.celebrate` outside `lib/features/{home,biometrics,prescriptions,assistant}/**` and bans any widget from `lib/core/visuals/**` inside `lib/features/emergency/**`.

---

## 10. Performance Budgets & Measurement

| Metric | Target | How measured |
|--------|--------|--------------|
| Web LCP (doctor dashboard, laptop) | ≤ 2.5 s | Lighthouse CI on seeded staging |
| Web INP | ≤ 200 ms | Playwright + `web-vitals` |
| Web CLS | ≤ 0.05 | Same |
| 3D chunk size (three + R3F + drei subset) | ≤ 250 KB gzipped, lazy, never on Rx builder, dispense or audit routes | `@next/bundle-analyzer` in CI |
| WebGL scene | ≤ 60 draw calls, ≤ 50k triangles, DPR clamped to [1, 1.75] (Tier A) / 1.25 (Tier B) | `renderer.info` in dev overlay |
| Flutter frame time (Tier A/B) | 95% of frames ≤ 16.7 ms build+raster on the Patient Home with the ID card visible | `flutter run --profile` + DevTools; `integration_test` `traceAction` timeline summary |
| Scanner overlay | ≤ 2 ms paint/frame | DevTools raster timeline |
| Shader orb | ≤ 2 ms raster on Tier B | Same |
| Emergency card cold open (`/card` quick action) | ≤ 1.5 s to fully drawn on mid Android | Manual stopwatch + `reportFullyDrawn` |
| Memory for visuals | ≤ 8 MB textures; no leaks after 20 open/close cycles of the assistant | DevTools memory |
| Battery (ambient) | Orb + card idle for 10 min: no measurable extra drain vs. a static screen on Tier B (ambient pauses after 10 s idle) | Android Battery Historian (manual, Stage 6) |

---

## 11. Testing & QA

| Test | Tool | Pass criteria |
|------|------|---------------|
| Reduced-motion E2E | Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` | No element animates `transform`; key flows complete |
| Flutter reduced motion | Widget tests with `MediaQuery(data: MediaQueryData(disableAnimations: true))` | `ShMotion.d()` returns ≤ 150 ms; no `AiOrb` shader widget built |
| Emergency fast-path | Widget test of every emergency route | No `BackdropFilter`, `FaceMeshPainter`, `AiOrb`, `MedicalIdCard3D` in the tree; route transition duration = 0 |
| Golden tests | `flutter test --update-goldens` for each scanner, seal, card and orb state (animations frozen) in AR + EN, Light + Dark | Reviewed by UI/UX |
| Visual regression (web) | Playwright screenshots with animations disabled (`animations: 'disabled'`) | Reviewed by UI/UX |
| Photosensitivity | Screen-record the orb in every state and the takeover; analyse with a photosensitive-epilepsy analysis tool (e.g. Trace Center's PEAT) | 0 failures; no element > 3 flashes/s |
| Device matrix | Low-end Android (2–3 GB), mid Android (Oppo A-series class), iPhone (if available), Chrome/Edge/Safari on laptops | Tier detection matches expectation; budgets in §10 met |
| Sunlight & gloves | Emergency screens outdoors; gloved presses | Readable; all actions reachable without swipes |
| Haptic audit | Manual walkthrough of §7.2 on iOS and Android | Each event fires once, never doubles, respects the in-app toggle |
| Honesty audit (M4) | Code review checklist | Seal state ← verify result only; ring angles ← detector only; orb urgent ← triage only; no fake determinate progress |

---

## 12. Definition of Done (UI-02)
- [ ] Motion tokens (§1) exist in `lib/motion/tokens.ts` and `lib/core/motion/motion_tokens.dart`; no ad-hoc durations/curves in feature code (lint).
- [ ] Tier detection (§2) implemented on web and Flutter, downgrade-only, with a debug overlay showing the active tier.
- [ ] All four 3D components implemented with every state in their tables, AR + EN, plus Tier C and Tier E behaviour.
- [ ] Transitions T-01…T-14 implemented with RM and E variants.
- [ ] `HapticService` implemented with the §7.2 map; platform channel or package verified on both OSes.
- [ ] Emergency fast-path widget tests green (§11); time-to-critical-info ≤ 10 s median in the usability test (role-07 §10).
- [ ] Security Lead decision recorded on MediaPipe/WASM CSP (§3); default remains the 2D web scanner.
- [ ] Mobile team adds `enableContours: true` to the ML Kit options (role-06 §6.1) and verifies `kYawSign` on real devices.
- [ ] Performance budgets (§10) measured and recorded in the Stage 5/6 reports.

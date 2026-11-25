# UI-01 — SmartHealth Design System (v2 · "Calm Clinical Spatial")

> **سمارت هيلث — هوية واحدة. ملف طبي واحد. نظام صحي آمن واحد.**
>
> **Owner:** UI/UX (M8) · **Consumers:** Web (R5 — `web-admin/`), Mobile (R6 — `mobile-app/`), AI (R4, triage visuals)
> **Status:** Draft for team review · **Date:** 2026-11-24
> **Extends:** `role-07-ui-ux.md` §3–§5 and §9. Where this file and role-07 disagree, **this file wins** (each change is listed in §0.2, so nothing changes silently).
> **Companion files:** `UI-02-3D-AND-MOTION-SPEC.md` (all motion, 3D and haptics), `UI-03-EGYPTIAN-ARABIC-UX-COPY.md` (canonical copy dictionary).
> **Canonical names:** `00-INDEX.md`. Every enum value, error code and role named here is taken from it verbatim.

---

## 0. How to read this file

### 0.1 Scope
This file defines everything **static** about the UI:
- colour, type, spacing, radius, elevation, glass and iconography tokens
- the five themes and modes
- the severity and status systems
- component anatomy
- the **Web ↔ Flutter component mapping**
- how tokens flow into code

Everything that **moves** lives in UI-02: transitions, springs, 3D, haptics and fallbacks.

### 0.2 Decision log: changes from role-07 (review these in the PR)

| ID | Change | Reason | Affects |
|----|--------|--------|---------|
| D-UI-01 | Arabic UX voice is now **Egyptian colloquial** (العامية المصرية), replacing role-07 §6.1 "Modern Standard Arabic". Drug names stay Latin (in `<bdi>` / LTR spans). Medical terms appear in Arabic with the English term in parentheses on first use. Consent and legal texts use clear colloquial wording but must stay legally precise, and need a review before demo. | Product brief: warm, natural copy for elderly patients and stressed staff | `ar.json`, `app_ar.arb`, UI-03 |
| D-UI-02 | Caution icon colour `#CA8A04` → **`#A16207`** | Old value is **2.94:1** on white and fails WCAG 1.4.11 (3:1 for non-text). New value is 4.92:1 | Severity `moderate` |
| D-UI-03 | New token `border.input` **`#7B8494`** (3.77:1). role-07 `neutral.300 #D1D5DB` becomes **decorative dividers only** | Input boundaries must reach 3:1 | All inputs, checkboxes, radios |
| D-UI-04 | Radius scale extended with `2xl 20` and `3xl 28`. Cards move from `lg 12` to **`xl 16` (web)** and **`2xl 20` (mobile)**. Buttons move from `md 8` to **`lg 12`** | Bento / spatial look; iOS continuous-corner feel | Cards, buttons, sheets |
| D-UI-05 | Elevation becomes a 6-step stack (§7). The role-07 dialog shadow is replaced | Depth = hierarchy | All surfaces |
| D-UI-06 | **Glass (backdrop blur) is a decorative layer only.** It is never placed behind severity banners, clinical tables, forms, QR codes or anything in Emergency mode | Readability and safety; blur also costs a lot on low-end Android | §7.3 |
| D-UI-07 | New **Sunlight theme** (high-contrast light) for the ER desktop console, bright clinics and outdoor use of the patient's emergency card | The ER desk is often under harsh light; black Emergency theme reflects glare on glossy laptop screens | §3.5 |
| D-UI-08 | Fonts are fixed: **Cairo** for display/headings, **IBM Plex Sans Arabic** for body/UI, **Inter** for Latin, numbers and codes, **JetBrains Mono** for MRN, Rx numbers and codes | role-07 allowed either Arabic family; mixing them without rules looked inconsistent | §4 |
| D-UI-09 | **No fingerprint option for identifying another person**, anywhere in the UI. Secondary verification for a low-confidence emergency match = **Emergency Card QR** or **National ID search** | SD-01 and E-BIO-14: `local_auth` can only confirm the device owner | UI-04, UI-06, UI-07 |
| D-UI-10 | Prescription `pending` label in Arabic is **«قيد الصرف»** (from the brief), and `dispensed` is **«اتصرفت بالكامل»** | Brief | §9 |

### 0.3 Design principles

P1–P7 are inherited from role-07 §2 unchanged. P8–P13 are new for v2.

| # | Principle | In practice |
|---|-----------|-------------|
| P1 | **Critical first** | Anaphylaxis allergies are the first thing a clinician sees on every patient view, on every device |
| P2 | **One primary action per screen** | Exactly one filled primary button per view (Emergency: one per zone) |
| P3 | **Never colour alone** | Severity = icon + text + colour + shape |
| P4 | **Explain blocks** | Every disabled primary button shows the reason under it |
| P5 | **Forgiving input** | Masks, autocomplete, Western digits for doses, undo |
| P6 | **Privacy visible** | "Who can see this" hints, access log, restricted placeholders |
| P7 | **Bilingual parity** | Every screen is designed RTL-first, then checked LTR |
| P8 | **Depth = hierarchy, not decoration** | z-order follows importance: canvas → cards → floating controls → modals → takeovers. Nothing floats without a reason |
| P9 | **Calm by default, loud only when it matters** | Neutral surfaces with one brand accent. Red is reserved for real danger. No decorative red, ever |
| P10 | **Glass never carries critical information** | Glass is allowed only on chrome (nav bars, docks, composer). Clinical data sits on opaque surfaces |
| P11 | **Emergency strips everything** | Emergency mode = black, huge type, zero blur, zero 3D, zero decorative motion (UI-02 §8) |
| P12 | **Same clinic, two platforms** | Clinical components look and behave **identically** on iOS, Android and web. Only system chrome adapts (switches, pickers, sheets, nav bars). See §12 |
| P13 | **Warm Egyptian voice** | Copy sounds like a kind, competent Egyptian nurse, never a government form (UI-03) |

---

## 1. Brand Foundations

| Element | Spec |
|---------|------|
| Name | **SmartHealth** / **سمارت هيلث** |
| Tagline (AR) | «هوية واحدة. ملف واحد. أمان كامل.» |
| Tagline (EN) | One Identity. One Record. One Secure System. |
| Logo mark | A rounded shield (trust) containing a continuous line that is a pulse on the left and a face contour on the right (identity). The mark is never mirrored in RTL |
| Brand colour | **Trust Blue** `#2563EB` (primary.600) |
| Brand accent | **Care Teal** `#0D9488` (teal.600). Decorative only. Teal text uses teal.700 `#0F766E` |
| AI accent | **Insight Violet** `#7C3AED` (violet.600). Used **only** for the AI assistant, so users always know when they are talking to the AI |
| Brand gradient | `linear-gradient(135deg, #2563EB 0%, #0D9488 100%)`. Allowed only on: splash, onboarding hero, Medical ID card base, empty-state illustrations, marketing. Never on buttons, never behind text smaller than 18 px |
| Imagery | Soft 3D clay-style illustrations (rounded, matte, warm skin-tone diversity, Egyptian context: Arabic signage, local clothing). No stock photos of patients. No gore, no needles in close-up |
| Illustration palette | primary.100–400, teal.100–400, amber.200, neutral.100–300. Never use severity red in illustrations |

---

## 2. Theme & Mode Architecture

### 2.1 Themes (exactly one is active)

| Theme | `data-theme` (web) / `ShThemeId` (Flutter) | Used by | Activation |
|-------|----------------------------------------------|---------|------------|
| **Light** | `light` | All roles (default) | Default |
| **Dark** | `dark` | All roles except Emergency screens | User toggle, or "system" |
| **Emergency** (high-contrast black) | `emergency` | Paramedic mode (mobile, always), patient Emergency Card screen, AI red-flag takeover | **Automatic.** The user cannot switch it off inside these screens |
| **Sunlight** (high-contrast light) | `sunlight` | ER desktop console (default), any user via Accessibility settings, patient Emergency Card "outdoor" toggle | ER console default. Optional for everyone else |

### 2.2 Modes (stackable modifiers on top of a theme)

| Mode | Attribute / provider | Effect | Combinable with |
|------|----------------------|--------|-----------------|
| **Large-Font** «خط كبير» | `data-font-scale="lg"\|"xl"` / `textScaleProvider` | Type ×1.15 (`lg`) or ×1.30 (`xl`); layout reflows (§4.6) | All themes (Emergency caps the total at ×1.30) |
| **Reduced Motion** | `prefers-reduced-motion` / `MediaQuery.disableAnimationsOf` | UI-02 §8.2 | All |
| **Low Power** | `data-power="low"` / `motionTierProvider` | UI-02 §8.3 | All |
| **Offline** | `data-network="offline"` / `connectivityProvider` | Offline ribbon, disabled network-only actions (§11.9) | All |
| **RTL / LTR** | `<html dir>` / `Directionality` | §5.5 | All |

### 2.3 Precedence rules (when settings conflict)
1. **Emergency** beats everything: the theme is forced, glass is off, 3D is off, motion is fast-path, and text scale is capped at ×1.30 because the emergency type is already large.
2. **Sunlight** beats Light/Dark.
3. **Reduced Motion** (OS) beats any in-app animation preference.
4. **Low Power** downgrades the 3D tier but never changes colours or type.
5. **Large-Font** never shrinks a touch target and never truncates clinical text. Clinical text wraps; it is never ellipsised.

---

## 3. Colour System

### 3.1 Primitive palette (raw values; never used directly in components)

Primitives use Tailwind's palette names so engineers recognise them. Components **only** reference semantic tokens (§3.2).

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|------|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| `blue` | `#EFF6FF` | `#DBEAFE` | `#BFDBFE` | `#93C5FD` | `#60A5FA` | `#3B82F6` | `#2563EB` | `#1D4ED8` | `#1E40AF` | `#1E3A8A` | `#172554` |
| `teal` | `#F0FDFA` | `#CCFBF1` | `#99F6E4` | `#5EEAD4` | `#2DD4BF` | `#14B8A6` | `#0D9488` | `#0F766E` | `#115E59` | `#134E4A` | `#042F2E` |
| `red` | `#FEF2F2` | `#FEE2E2` | `#FECACA` | `#FCA5A5` | `#F87171` | `#EF4444` | `#DC2626` | `#B91C1C` | `#991B1B` | `#7F1D1D` | `#450A0A` |
| `amber` | `#FFFBEB` | `#FEF3C7` | `#FDE68A` | `#FCD34D` | `#FBBF24` | `#F59E0B` | `#D97706` | `#B45309` | `#92400E` | `#78350F` | `#451A03` |
| `yellow` | `#FEFCE8` | `#FEF9C3` | `#FEF08A` | `#FDE047` | `#FACC15` | `#EAB308` | `#CA8A04` | `#A16207` | `#854D0E` | `#713F12` | `#422006` |
| `green` | `#F0FDF4` | `#DCFCE7` | `#BBF7D0` | `#86EFAC` | `#4ADE80` | `#22C55E` | `#16A34A` | `#15803D` | `#166534` | `#14532D` | `#052E16` |
| `sky` | `#F0F9FF` | `#E0F2FE` | `#BAE6FD` | `#7DD3FC` | `#38BDF8` | `#0EA5E9` | `#0284C7` | `#0369A1` | `#075985` | `#0C4A6E` | `#082F49` |
| `violet` | `#F5F3FF` | `#EDE9FE` | `#DDD6FE` | `#C4B5FD` | `#A78BFA` | `#8B5CF6` | `#7C3AED` | `#6D28D9` | `#5B21B6` | `#4C1D95` | `#2E1065` |
| `gray` | `#F9FAFB` | `#F3F4F6` | `#E5E7EB` | `#D1D5DB` | `#9CA3AF` | `#6B7280` | `#4B5563` | `#374151` | `#1F2937` | `#111827` | `#030712` |

**Extra primitives** (not on a ramp):

| Name | Hex | Purpose |
|------|-----|---------|
| `ink.dark` | `#0B1220` | Dark canvas |
| `ink.raised` | `#1A2333` | Dark raised surface |
| `ink.line` | `#243044` | Dark borders |
| `slate.input` | `#7B8494` | Light input border (D-UI-03) |
| `ios.red` | `#FF3B30` | Emergency danger fill |
| `ios.red.dark` | `#FF453A` | Emergency danger text/icons on black |
| `ios.yellow` | `#FFD60A` | Emergency warning fill |
| `ios.orange` | `#FF9F0A` | Emergency offline ribbon |
| `ios.green` | `#30D158` | Emergency success fill |
| `ios.blue` | `#0A84FF` | Emergency info fill (large bold text only) |
| `ios.gray6` | `#1C1C1E` | Emergency surface |
| `ios.sep` | `#3A3A3C` | Emergency divider (decorative) |
| `sun.blue` | `#0040C1` | Sunlight primary |
| `sun.red` | `#B00020` | Sunlight danger |
| `sun.green` | `#006B2D` | Sunlight success |

### 3.2 Semantic tokens: all four themes

CSS variable names follow shadcn/ui conventions (`--primary`, `--destructive` …) so generated shadcn components work unchanged. SmartHealth additions are prefixed `--sh-`. Flutter uses the same names in camelCase inside `ShColors` (§14.3).

#### 3.2.1 Surfaces & text

| Token (CSS var) | Light | Dark | Emergency | Sunlight | Use |
|-----------------|-------|------|-----------|----------|-----|
| `--background` | `#F3F4F6` | `#0B1220` | `#000000` | `#FFFFFF` | App canvas |
| `--foreground` | `#111827` | `#F9FAFB` | `#FFFFFF` | `#000000` | Primary text |
| `--card` | `#FFFFFF` | `#111827` | `#1C1C1E` | `#FFFFFF` | Cards, bento tiles |
| `--card-foreground` | `#111827` | `#F9FAFB` | `#FFFFFF` | `#000000` | Text on cards |
| `--popover` | `#FFFFFF` | `#1A2333` | `#1C1C1E` | `#FFFFFF` | Menus, popovers |
| `--sh-surface-raised` | `#FFFFFF` | `#1A2333` | `#1C1C1E` | `#FFFFFF` | Hovered/raised cards |
| `--sh-surface-sunken` | `#F9FAFB` | `#0F172A` | `#000000` | `#F3F4F6` | Wells, table headers, input groups |
| `--muted` | `#F3F4F6` | `#1F2937` | `#1C1C1E` | `#F3F4F6` | Muted fills |
| `--muted-foreground` | `#4B5563` | `#9CA3AF` | `#FFFFFF` ¹ | `#1F2937` | Secondary text |
| `--sh-placeholder` | `#6B7280` ² | `#9CA3AF` | `#FFFFFF` ¹ | `#374151` | Input placeholder (white inputs only) |
| `--border` | `#E5E7EB` | `#243044` | `#3A3A3C` | `#000000` | Decorative dividers |
| `--input` | `#7B8494` | `#6B7280` | `#FFFFFF` | `#000000` | Input/checkbox boundary (≥ 3:1) |
| `--ring` | `#2563EB` | `#93C5FD` | `#FFD60A` | `#0040C1` | Focus ring |

¹ Emergency has **no grey text** (role-06 §6.3). Hierarchy comes from size and weight only.
² `#6B7280` is 4.83:1 on white but only **4.39:1 on `#F3F4F6`**. So it is allowed only on white surfaces (inputs, cards), never directly on the canvas.

#### 3.2.2 Brand & actions

| Token | Light | Dark | Emergency | Sunlight |
|-------|-------|------|-----------|----------|
| `--primary` | `#2563EB` | `#60A5FA` | `#FFFFFF` | `#0040C1` |
| `--primary-foreground` | `#FFFFFF` | `#0B1220` | `#000000` | `#FFFFFF` |
| `--sh-primary-hover` | `#1D4ED8` | `#93C5FD` | `#E5E5E5` | `#002E8A` |
| `--sh-primary-subtle` | `#EFF6FF` | `#172554` | `#1C1C1E` | `#E6EEFF` |
| `--sh-primary-on-subtle` | `#1D4ED8` | `#BFDBFE` | `#FFFFFF` | `#0040C1` |
| `--secondary` | `#F3F4F6` | `#1F2937` | `#1C1C1E` | `#FFFFFF` |
| `--secondary-foreground` | `#111827` | `#F9FAFB` | `#FFFFFF` | `#000000` |
| `--accent` | `#F0FDFA` | `#042F2E` | `#1C1C1E` | `#FFFFFF` |
| `--accent-foreground` | `#0F766E` | `#2DD4BF` | `#FFFFFF` | `#000000` |
| `--destructive` | `#DC2626` | `#F87171` | `#FF3B30` | `#B00020` |
| `--destructive-foreground` | `#FFFFFF` | `#0B1220` | `#000000` | `#FFFFFF` |

#### 3.2.3 Status & severity colours

Each status has three tokens: **solid** (icons, borders, solid chips), **surface** (banner background) and **on-surface** (text on the banner).

| Status | Token stem | Light solid / surface / on-surface | Dark solid / surface / on-surface | Emergency fill / text | Sunlight solid / surface / text |
|--------|-----------|-------------------------------------|------------------------------------|----------------------|---------------------------------|
| Danger | `--sh-danger` | `#DC2626` / `#FEF2F2` / `#991B1B` | `#F87171` / `#450A0A` / `#FECACA` | `#FF3B30` / `#000000` (block variant `#7F1D1D` / `#FFFFFF`) | `#B00020` / `#FFFFFF` (2 px border) / `#B00020` |
| Warning | `--sh-warning` | `#B45309` / `#FFFBEB` / `#92400E` | `#FBBF24` / `#451A03` / `#FDE68A` | `#FFD60A` / `#000000` | `#000000` on `#FFD60A` |
| Caution | `--sh-caution` | `#A16207` / `#FEFCE8` / `#854D0E` | `#FACC15` / `#422006` / `#FEF08A` | `#FFD60A` / `#000000` (outlined, not filled) | `#000000` on `#FFF7B3` |
| Success | `--sh-success` | `#15803D` / `#F0FDF4` / `#166534` | `#4ADE80` / `#052E16` / `#BBF7D0` | `#30D158` / `#000000` | `#006B2D` / `#FFFFFF` / `#006B2D` |
| Info | `--sh-info` | `#0369A1` / `#F0F9FF` / `#075985` | `#38BDF8` / `#082F49` / `#BAE6FD` | `#0A84FF` / `#FFFFFF` (≥ 24 sp bold only) | `#0040C1` / `#FFFFFF` / `#0040C1` |
| Offline | `--sh-offline` | `#B45309` / `#FFFBEB` / `#92400E` | `#FBBF24` / `#451A03` / `#FDE68A` | `#FF9F0A` / `#000000` | `#000000` on `#FFD60A` |
| AI | `--sh-ai` | `#6D28D9` / `#F5F3FF` / `#5B21B6` | `#A78BFA` / `#2E1065` / `#DDD6FE` | n/a (AI does not run inside Emergency mode) | `#5B21B6` / `#FFFFFF` / `#5B21B6` |

#### 3.2.4 Special-purpose tokens

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--sh-canvas-glow-1` | `rgba(37,99,235,0.10)` | `rgba(96,165,250,0.10)` | Radial blob, top-inline-start of the canvas (decorative) |
| `--sh-canvas-glow-2` | `rgba(13,148,136,0.08)` | `rgba(45,212,191,0.08)` | Radial blob, bottom-inline-end |
| `--sh-brand-gradient` | `linear-gradient(135deg,#2563EB,#0D9488)` | `linear-gradient(135deg,#1D4ED8,#0F766E)` | §1 restrictions apply |
| `--sh-qr-bg` | `#FFFFFF` | `#FFFFFF` | **QR codes are always black on pure white in every theme**, with a quiet zone of at least 4 modules |
| `--sh-qr-fg` | `#000000` | `#000000` | Same |
| `--sh-scrim` | `rgba(17,24,39,0.48)` | `rgba(0,0,0,0.64)` | Modal backdrop |
| `--sh-takeover-scrim` | `#7F1D1D` | `#450A0A` | AI red-flag takeover background (solid, not translucent) |

#### 3.2.5 AI Orb state colours (geometry and motion in UI-02 §6.4)

| Orb state | Core | Rim / glow | Text label colour (light / dark) |
|-----------|------|-----------|----------------------------------|
| `idle` | `#7C3AED` → `#2563EB` gradient | `rgba(124,58,237,0.35)` | `--sh-ai` |
| `listening` | `#0EA5E9` → `#14B8A6` | `rgba(14,165,233,0.45)` | `#0369A1` / `#38BDF8` |
| `thinking` | `#8B5CF6` → `#6366F1` | `rgba(139,92,246,0.45)` | `#6D28D9` / `#A78BFA` |
| `guidance` (calm answer) | `#14B8A6` → `#22C55E` | `rgba(20,184,166,0.40)` | `#0F766E` / `#2DD4BF` |
| `urgent` (triage `urgent`) | `#F59E0B` → `#EA580C` | `rgba(245,158,11,0.45)` | `#B45309` / `#FBBF24` |
| `emergency` (red flag) | `#EF4444` → `#B91C1C` | `rgba(239,68,68,0.55)` | `#991B1B` / `#FCA5A5` (and the takeover fires at once) |
| `crisis` (self-harm path, E-AI-02) | `#60A5FA` → `#5EEAD4` (soft, cool, slow) | `rgba(96,165,250,0.30)` | `#1D4ED8` / `#93C5FD` |
| `offline` / `ai_down` | `#9CA3AF` flat | none | `#4B5563` / `#9CA3AF` |

#### 3.2.6 Face-scanner state colours (rendering in UI-02 §6.1)

| Scanner state | Ring colour (Light/Dark UI) | Ring colour (Emergency) |
|---------------|-----------------------------|--------------------------|
| `searching` | `#FFFFFF` @ 70% | `#FFFFFF` |
| `aligning` (face found, not yet OK) | `#FBBF24` | `#FFD60A` |
| `aligned` / quality OK | `#2DD4BF` | `#30D158` |
| `challenge` (blink/turn/smile) | `#60A5FA` | n/a (no challenge in emergency, E-BIO-07) |
| `capturing` | `#22C55E` | `#30D158` |
| `failed_quality` | `#F59E0B` | `#FFD60A` |
| `spoof_locked` | `#EF4444` (solid lock) | `#FF3B30` |

### 3.3 Contrast verification (computed, WCAG 2.2 relative luminance)

All values below were **computed**, not estimated. Run `pnpm tokens:contrast` (script in §14.5) in CI to keep them true.

| Pair | Ratio | Target | Result |
|------|------:|--------|--------|
| Light `--foreground` on `--card` (`#111827`/`#FFFFFF`) | 17.74 | 4.5 | ✅ AAA |
| Light `--foreground` on `--background` (`#111827`/`#F3F4F6`) | 16.12 | 4.5 | ✅ AAA |
| Light `--muted-foreground` on card (`#4B5563`/`#FFFFFF`) | 7.56 | 4.5 | ✅ AAA |
| Light placeholder on white (`#6B7280`/`#FFFFFF`) | 4.83 | 4.5 | ✅ AA |
| Light placeholder on canvas (`#6B7280`/`#F3F4F6`) | 4.39 | 4.5 | ❌ **forbidden** (rule ² above) |
| Light `--input` border (`#7B8494`/`#FFFFFF`) | 3.77 | 3.0 | ✅ |
| Light primary button (`#FFFFFF`/`#2563EB`) | 5.17 | 4.5 | ✅ AA |
| Light primary hover (`#FFFFFF`/`#1D4ED8`) | 6.70 | 4.5 | ✅ |
| Light focus ring on canvas (`#2563EB`/`#F3F4F6`) | 4.70 | 3.0 | ✅ |
| Light danger button (`#FFFFFF`/`#DC2626`) | 4.83 | 4.5 | ✅ AA |
| Light danger banner text (`#991B1B`/`#FEF2F2`) | 7.60 | 4.5 | ✅ AAA |
| Light warning text (`#B45309`/`#FFFFFF`) | 5.02 | 4.5 | ✅ |
| Light warning banner text (`#92400E`/`#FFFBEB`) | 6.84 | 4.5 | ✅ |
| Light caution icon — **old** (`#CA8A04`/`#FFFFFF`) | 2.94 | 3.0 | ❌ replaced (D-UI-02) |
| Light caution icon — **new** (`#A16207`/`#FFFFFF`) | 4.92 | 3.0 | ✅ |
| Light caution banner text (`#854D0E`/`#FEFCE8`) | 6.62 | 4.5 | ✅ |
| Light success (`#15803D`/`#FFFFFF`) | 5.02 | 4.5 | ✅ |
| Light info (`#0369A1`/`#FFFFFF`) | 5.93 | 4.5 | ✅ |
| Light AI (`#6D28D9`/`#FFFFFF`) | 7.10 | 4.5 | ✅ AAA |
| Light teal text (`#0F766E`/`#FFFFFF`) | 5.47 | 4.5 | ✅ |
| Light text on glass over blue.100 (composite `#F1F7FF`) | 16.46 | 4.5 | ✅ |
| Light muted text on glass over blue.300 (composite `#D6E9FE`) | 6.10 | 4.5 | ✅ |
| Dark `--foreground` on `--background` | 17.92 | 4.5 | ✅ |
| Dark `--muted-foreground` on raised (`#9CA3AF`/`#1A2333`) | 6.21 | 4.5 | ✅ |
| Dark primary on card (`#60A5FA`/`#111827`) | 6.98 | 4.5 | ✅ |
| Dark on-primary (`#0B1220`/`#60A5FA`) | 7.36 | 4.5 | ✅ |
| Dark danger (`#F87171`/`#111827`) | 6.41 | 4.5 | ✅ |
| Dark AI (`#A78BFA`/`#111827`) | 6.52 | 4.5 | ✅ |
| Dark input border (`#6B7280`/`#111827`) | 3.67 | 3.0 | ✅ |
| Dark focus ring (`#93C5FD`/`#111827`) | 9.84 | 3.0 | ✅ |
| Emergency text (`#FFFFFF`/`#000000`) | 21.00 | 7.0 | ✅ AAA |
| Emergency danger fill (`#000000`/`#FF3B30`) | 5.92 | 4.5 (large AAA) | ✅ bold ≥ 20 sp |
| Emergency danger block (`#FFFFFF`/`#7F1D1D`) | 10.02 | 7.0 | ✅ AAA |
| Emergency danger text on black (`#FF453A`/`#000000`) | 6.16 | 4.5 | ✅ (bold ≥ 20 sp → AAA large) |
| Emergency warning (`#000000`/`#FFD60A`) | 14.88 | 7.0 | ✅ AAA |
| Emergency success (`#000000`/`#30D158`) | 10.39 | 7.0 | ✅ AAA |
| Emergency offline ribbon (`#000000`/`#FF9F0A`) | 10.22 | 7.0 | ✅ AAA |
| Emergency info (`#FFFFFF`/`#0A84FF`) | 3.65 | 3.0 large | ⚠ **≥ 24 sp bold only** |
| Emergency divider (`#3A3A3C`/`#000000`) | 1.85 | — | Decorative only; never the only separator of meaning |
| Sunlight primary (`#0040C1`/`#FFFFFF`) | 8.39 | 7.0 | ✅ AAA |
| Sunlight danger (`#B00020`/`#FFFFFF`) | 7.33 | 7.0 | ✅ AAA |
| Sunlight success (`#006B2D`/`#FFFFFF`) | 6.69 | 4.5 | ✅ AA (use bold) |
| Status badge `pending` (`#1D4ED8`/`#DBEAFE`) | 5.49 | 4.5 | ✅ |
| Status badge `partially_dispensed` (`#92400E`/`#FEF3C7`) | 6.37 | 4.5 | ✅ |
| Status badge `dispensed` (`#166534`/`#DCFCE7`) | 6.49 | 4.5 | ✅ |
| Status badge `cancelled` (`#374151`/`#E5E7EB`) | 8.33 | 4.5 | ✅ |
| Dark badge `pending` (`#BFDBFE`/`#1E3A8A`) | 7.29 | 4.5 | ✅ |
| Dark badge `partially_dispensed` (`#FDE68A`/`#78350F`) | 7.28 | 4.5 | ✅ |
| Dark badge `dispensed` (`#BBF7D0`/`#14532D`) | 7.52 | 4.5 | ✅ |
| AI takeover button (`#FFFFFF`/`#B91C1C`) | 6.47 | 4.5 | ✅ |

**Colour-blind check:** every severity also has a distinct icon **shape** (octagon, triangle, circle, i-circle, siren) and a text label, so deuteranopia/protanopia users never depend on red vs amber.

### 3.4 Where colour may and may not go

| Allowed | Forbidden |
|---------|-----------|
| Red for `contraindicated`, `anaphylaxis`, failed authenticity, spoof lock, emergency takeover, destructive confirm | Red for decoration, brand, "delete" icons in lists without confirm, marketing |
| Amber/yellow for `major`/`moderate`, offline, low-confidence | Amber for "new" or "featured" badges |
| Green for verified/authentic/dispensed/success | Green for "online" dots next to people (use teal) |
| Violet for the AI only | Violet anywhere else, so AI content is always recognisable |
| Brand gradient on splash, ID card, empty states | Gradient behind text < 18 px, on buttons, on clinical data |

---

## 4. Typography

### 4.1 Families

| Role | Family | Weights shipped | Fallback stack | Where |
|------|--------|-----------------|----------------|-------|
| Arabic display & headings | **Cairo** (variable, 200–1000) | 600, 700, 800 | `"IBM Plex Sans Arabic", "Noto Sans Arabic", system-ui` | `display*`, `h1`–`h3`, Emergency headings, blood type |
| Arabic body & UI | **IBM Plex Sans Arabic** | 400, 500, 600, 700 | `Cairo, "Noto Sans Arabic", system-ui` | Body, labels, buttons, tables |
| Latin (EN UI, numbers, units, drug names) | **Inter** (variable) | 400, 500, 600, 700, 800 | `system-ui, "Segoe UI", Roboto, sans-serif` | All Latin text **and all digits in both locales** |
| Codes | **JetBrains Mono** | 500, 700 | `ui-monospace, SFMono-Regular, Menlo, monospace` | MRN `SH-7K2M9Q4D`, `RX-2026-000123`, share codes, verification codes, audit hashes |

**Important:** IBM Plex Sans Arabic has **no 800 weight**. Anything at 800 (Emergency headings, blood-type display) must use **Cairo**.

### 4.2 Loading
- **Web (`app/[locale]/layout.tsx`):** use `next/font/google` for `Cairo({ subsets:['arabic','latin'], weight:['600','700','800'], variable:'--font-cairo', display:'swap' })`, `IBM_Plex_Sans_Arabic({ subsets:['arabic'], weight:['400','500','600','700'], variable:'--font-plex-ar' })`, `Inter({ subsets:['latin'], variable:'--font-inter' })` and `JetBrains_Mono({ subsets:['latin'], variable:'--font-mono' })`. Fonts are self-hosted at build time, so this does not conflict with the CSP in role-05 §9.
- **Flutter:** bundle the TTF/variable files in `assets/fonts/` and declare them in `pubspec.yaml`. **Never fetch fonts at runtime**, because the emergency card must render offline. If the `google_fonts` package is used for convenience, set `GoogleFonts.config.allowRuntimeFetching = false`.

### 4.3 Type scale

Web values in rem (1 rem = 16 px) and px; mobile values in logical px (dp/pt). Arabic line-height = Latin + 0.10 (tall ascenders and descenders, role-07 §3.3).

| Token | Web size | Mobile size | Weight (AR / EN) | LH Latin / Arabic | Family (AR) | Use |
|-------|----------|-------------|------------------|-------------------|-------------|-----|
| `display-2xl` | 3 rem / 48 | 40 | 800 / 700 | 1.10 / 1.25 | Cairo | Web KPI hero numbers, splash wordmark |
| `display` | 2.25 rem / 36 | 34 | 700 / 700 | 1.20 / 1.30 | Cairo | Blood type on the ID card, big KPIs |
| `h1` | 1.75 rem / 28 | 28 | 700 / 700 | 1.25 / 1.35 | Cairo | Page titles, iOS large title |
| `h2` | 1.375 rem / 22 | 22 | 700 / 600 | 1.30 / 1.40 | Cairo | Section titles |
| `h3` | 1.125 rem / 18 | 18 | 600 / 600 | 1.35 / 1.45 | Cairo | Card titles, bento tile titles |
| `body-lg` | 1.0625 rem / 17 | 17 | 400 / 400 | 1.50 / 1.65 | Plex AR | Patient reading content, AI chat bubbles, medication instructions |
| `body` | 1 rem / 16 | 16 | 400 / 400 | 1.50 / 1.65 | Plex AR | Default text |
| `body-strong` | 1 rem / 16 | 16 | 600 / 600 | 1.50 / 1.65 | Plex AR | Inline emphasis (never use italics for Arabic) |
| `body-sm` | 0.875 rem / 14 | 14 | 400 / 400 | 1.45 / 1.60 | Plex AR | Table cells, secondary text |
| `label` | 0.875 rem / 14 | 15 | 600 / 600 | 1.30 / 1.45 | Plex AR | Buttons, form labels, tabs |
| `caption` | 0.75 rem / 12 | 12 | 500 / 500 | 1.40 / 1.55 | Plex AR | Timestamps, helper text, badges. **Never for critical info** |
| `code` | 0.875 rem / 14 | 15 | 500 / 500 | 1.40 / 1.40 | JetBrains Mono | MRN, Rx no., codes |
| `code-lg` | 1.5 rem / 24 | 28 | 700 / 700 | 1.20 / 1.20 | JetBrains Mono | Share code, paper verification code, "No phone? Code K7Q-2MX" |
| `em.body` | — | 20 | 600 | — / 1.50 | Plex AR | Emergency body (minimum) |
| `em.label` | — | 18 | 700 | — / 1.40 | Plex AR | Emergency section labels («الحساسية», «فصيلة الدم») |
| `em.h` | 1.75 rem / 28 (ER desk) | 28 | 800 | — / 1.35 | **Cairo** | Emergency headings, patient name |
| `em.display` | 3 rem / 48 (ER desk) | 40 | 800 | — / 1.20 | **Cairo** (Inter for "O+") | Blood type |
| `em.button` | — | 22 | 800 | — / 1.30 | Cairo | 64 dp emergency buttons |

**Tracking (letter-spacing):** Latin `display`/`h1` use `-0.02em`; everything else `0`. **Arabic never gets letter-spacing**, because it breaks the joining between letters. Implement as `:lang(ar) { letter-spacing: 0 !important }`.

### 4.4 Numbers, units & codes (clinical safety rules)
1. **Digits are Western (0–9) by default in both locales**, rendered in **Inter** with `font-feature-settings: "tnum" 1, "lnum" 1`. A user setting may switch *non-clinical* numbers (dates, counts) to Eastern Arabic digits (٠–٩). **Doses, strengths, quantities, blood pressure, lab values and codes always stay Western** (role-05 §8), even when that setting is on.
2. A dose is always one **LTR-isolated** unit: `<bdi dir="ltr" class="num">875/125 mg</bdi>`. In Flutter: `Text.rich(TextSpan(...))` with a `WidgetSpan` wrapping `Directionality(textDirection: TextDirection.ltr, child: Text(...))`, or the Unicode isolates `⁦…⁩`.
3. Units are never abbreviated ambiguously: write `mg`, `mL` and `units`. **Never `u` or `IU`** in patient-facing text.
4. Blood type: `O+`, `AB-` always in Inter 700/800 with LTR isolation, so "+" never jumps to the wrong side in RTL.
5. Codes (`SH-7K2M9Q4D`, `RX-2026-000123`) use JetBrains Mono in groups with thin gaps for reading aloud (`K7Q-2MX`), plus a copy button.

### 4.5 Bidirectional text rules
- Mixed strings follow the pattern «خد <bdi>Augmentin 1 g</bdi> مرتين في اليوم».
- Truncation on the trailing side uses `text-overflow: ellipsis` with `dir="auto"` on user-generated text (names).
- Never truncate: drug names, allergies, doses, severity text. Wrap them instead.
- **Arabic line length:** 45–75 characters, so `max-width: 68ch` on long text. Bento tiles keep body to 3 lines max with "عرض الكل" for more (never on clinical items).

### 4.6 Large-Font mode «خط كبير»

| Level | Arabic label | Multiplier | Web | Flutter | Layout changes |
|-------|--------------|-----------:|-----|---------|----------------|
| Default | «عادي» | ×1.00 | `font-size: 100%` on `html` | `TextScaler.noScaling` (still respects OS) | — |
| Large | «كبير» | ×1.15 | `[data-font-scale=lg] { font-size: 115% }` | `TextScaler.linear(1.15)` | Mobile bento 2 cols → 1 col for tiles with > 2 text lines; tab bar labels stay; icons +4 px |
| Extra large | «كبير جداً» | ×1.30 | `[data-font-scale=xl] { font-size: 130% }` | `TextScaler.linear(1.30)` | Mobile bento → **single column**; buttons full width; tab bar shows icon + label stacked with 64 dp height; tables (web) switch to card rows below `lg` |

- In Flutter, the effective scale = `min(osScale × appScale, cap)`. Cap = **2.0** for normal screens and **1.30** for Emergency (role-06 §8). Implement with `MediaQuery.withClampedTextScaling(maxScaleFactor: …)`.
- The patient onboarding asks once: «تحب الكلام يبقى أكبر؟» with a live preview (UI-06). The choice can be changed anytime in Settings.
- Large-Font **never** shrinks touch targets and never hides an action behind "more" menus.

---

## 5. Spacing, Layout & Grids

### 5.1 Spacing scale (4-pt)

| Token | px | Typical use |
|-------|---:|-------------|
| `space-0` | 0 | — |
| `space-0.5` | 2 | Hairline nudges, icon-text optical fixes |
| `space-1` | 4 | Chip internal gap |
| `space-2` | 8 | Icon ↔ label, tight stacks |
| `space-3` | 12 | Form field label ↔ input, list row vertical padding |
| `space-4` | 16 | Card padding (mobile), page gutter (mobile), bento gap (mobile/web lg) |
| `space-5` | 20 | Card padding (web), bento gap (web xl) |
| `space-6` | 24 | Section gap, web page padding (lg) |
| `space-8` | 32 | Web page padding (xl), section gap (web) |
| `space-10` | 40 | Hero spacing |
| `space-12` | 48 | Empty-state vertical rhythm |
| `space-16` | 64 | Splash / onboarding spacing |
| `space-20` | 80 | Marketing/hero only |

These map 1:1 to Tailwind's default spacing (`p-4` = 16 px), so no custom spacing config is needed. In Flutter they are `ShSpace.s4 = 16.0` etc.

### 5.2 Web breakpoints & device classes

| Class | Width | Tailwind | Layout |
|-------|-------|----------|--------|
| Desktop XL | ≥ 1536 | `2xl` | 12 cols, content max 1440, sidebar 264 expanded |
| **Desktop (design target)** | 1440 | `xl` (1280+) | 12 cols, gutter 24, page padding 32 |
| **Laptop (design target)** | 1280 | `xl` | 12 cols, gutter 20, page padding 24, sidebar 264 (auto-collapses to 72 when the Rx builder alert panel is open) |
| Small laptop / tablet landscape | 1024–1279 | `lg` | 12 cols, gutter 16, sidebar 72 collapsed by default |
| Tablet portrait | 768–1023 | `md` | 8 cols, gutter 16; sidebar becomes a slide-over `Sheet` from the inline-start side; tables → card rows |
| Below 768 | < 768 | `sm`/base | **Web roles are not designed for phones.** Show a responsive single-column fallback with the banner «الشاشة دي معمولة للابتوب — لو عندك التطبيق استخدمه» (UI-03). The paramedic and pharmacist **mobile** flows live in the Flutter app |

### 5.3 Bento grid

| Property | Web xl (1280/1440) | Web lg | Web md | Mobile compact (< 600) | Mobile/tablet medium (600–839) | Expanded (≥ 840, iPad) |
|----------|--------------------|--------|--------|------------------------|--------------------------------|------------------------|
| Columns | 12 | 12 | 8 | **4** (2 tile columns of span 2) | 8 | 12 |
| Gap | 20 | 16 | 16 | 16 | 16 | 20 |
| Row unit (`grid-auto-rows`) | `minmax(152px, auto)` | `minmax(140px, auto)` | `minmax(132px, auto)` | square tiles: (W − 32 − 16) / 2 → **171 dp on 390 wide**, **177 dp on 402 wide** | `minmax(140, auto)` | `minmax(152, auto)` |
| Tile sizes | `S` 3×1 · `M` 4×1 · `W` 6×1 · `L` 6×2 · `XL` 8×2 · `Hero` 12×1 | same | `S` 4×1 · `W` 8×1 · `L` 8×2 | `1×1` (span 2) · `2×1` (span 4, wide) · `2×2` (span 4, hero) | same as web md | same as web xl |

**Bento composition rules**
1. One **hero tile** per dashboard (e.g. patient: Medical ID card; doctor: today's queue; pharmacist: scan action; admin: chain-integrity + KPIs).
2. Critical tiles (allergies, blocking alerts, expiring Rx) are placed **first in reading order**, which is top-inline-start: top-**right** in Arabic.
3. Maximum **7 tiles** above the fold on desktop and **5** on mobile. Everything else goes behind «شوف الكل».
4. Tiles never contain more than one primary action.
5. Tile anatomy: icon badge (40 px, `--sh-primary-subtle`) → title (`h3`) → value or summary (`display`/`body`) → footer meta (`caption`) → optional action (ghost button or chevron). Padding 20 web / 16 mobile.

### 5.4 Mobile layout (Flutter)

| Item | Spec |
|------|------|
| Design artboards | **390 × 844** (iPhone 12–15 class, primary) and **402 × 874** (iPhone 16 Pro, prototype frame); Android 360 × 800 for compact checks |
| Safe areas | **Never hard-code.** Use `SafeArea` / `MediaQuery.paddingOf(context)`. Mockup references only: 390 × 844 → top 47, bottom 34; 402 × 874 (Dynamic Island) → top 62, bottom 34 |
| Page gutter | 16 (20 on ≥ 600) |
| Window size classes | compact < 600, medium 600–839, expanded ≥ 840 (Material 3). Expanded uses `NavigationRail` + two-pane layouts |
| Thumb zone | Primary actions sit in the bottom third. On Emergency screens, call/scan buttons are always at the bottom, full width |
| Dynamic Island / status bar | Content never sits under the island. Live activity for an active emergency session and the pickup-QR countdown are **P2** (iOS Live Activities need a native extension); designed in UI-06 but not required for MVP |
| Keyboard | Forms scroll the focused field above the keyboard plus 16 dp; the primary action rides above the keyboard (`viewInsets`) |

### 5.5 RTL layout rules (extends role-07 §5)

| Element | RTL behaviour |
|---------|---------------|
| Sidebar, back button, list chevrons, progress steppers, carousels, swipe-to-go-back | **Mirror** (sidebar on the right; back points right; steppers flow right → left) |
| Media controls, clocks, check marks, camera/flash icons, QR codes, charts' time axis, phone keypad, drug names, numbers, blood type | **Do not mirror** |
| Head-turn arrows in the face scanner | **Do not mirror.** They show physical directions relative to the person's face (UI-02 §6.1) |
| Shadows and light direction | Light comes from the **top** (not from a side), so shadows never need mirroring |
| 3D tilt | Tilt follows the pointer/gyro in physical space; it is not mirrored |
| Swipe actions on list rows | Destructive swipe is revealed from the **inline-end** side in both directions |
| Code | Web: only logical utilities (`ms-`, `pe-`, `start-`, `text-start`); `rtl:rotate-180` on directional icons. Flutter: only `EdgeInsetsDirectional`, `AlignmentDirectional`, `PositionedDirectional`, `BorderRadiusDirectional` |

---

## 6. Shape: Radius & Borders

| Token | px | Web Tailwind | Flutter | Used for |
|-------|---:|--------------|---------|----------|
| `radius-xs` | 4 | `rounded-sm` (overridden) | `ShRadius.xs` | Inline code, kbd |
| `radius-sm` | 6 | `rounded-md` (overridden) | `ShRadius.sm` | Badges, small chips, checkbox |
| `radius-md` | 8 | `rounded-lg` (overridden) | `ShRadius.md` | Inputs (web), tooltips, table containers |
| `radius-lg` | 12 | `rounded-xl` | `ShRadius.lg` | **Buttons** (all), inputs (mobile), toasts |
| `radius-xl` | 16 | `rounded-2xl` | `ShRadius.xl` | **Web cards & bento tiles**, popovers, dialogs (web) |
| `radius-2xl` | 20 | `rounded-[20px]` | `ShRadius.xxl` | **Mobile cards & bento tiles**, dialogs (mobile), Medical ID card (≈ ISO ID-1 corner ratio at card width 342) |
| `radius-3xl` | 28 | `rounded-[28px]` | `ShRadius.xxxl` | Bottom-sheet top corners, full-screen takeovers' inner panels, AI composer |
| `radius-full` | 9999 | `rounded-full` | `StadiumBorder` | Pills, avatars, segmented controls, orb |

- **iOS continuous corners:** on iOS, cards, sheets and buttons use squircle-style continuous corners. In Flutter use `RoundedSuperellipseBorder` where the pinned Flutter version provides it (check at Stage 0); otherwise fall back to `RoundedRectangleBorder`. Never use `ContinuousRectangleBorder` with the same numeric radius, because its curve scale differs and corners will look too tight.
- **Borders:** 1 px `--border` for decorative card outlines (light theme cards are border + e1 shadow); 1.5 px `--input` for inputs; **2 px** for focus rings (offset 2), selected tiles and all Sunlight-theme borders; 3 px inline-start bar on severity banners and on item rows with alerts (role-05 §7.3).
- Emergency theme: no rounded corners below 12; blocks are full-bleed with 12 radius for buttons only (large tap shapes are easier to hit with gloves).

---

## 7. Depth: Elevation, Z-Order & Glass

### 7.1 Elevation stack

| Level | Name | Light shadow (CSS `box-shadow`) | Dark treatment | Flutter (Material) | Used for |
|-------|------|---------------------------------|----------------|--------------------|----------|
| e0 | flat | none | none | `elevation: 0` | Canvas, table rows, Emergency (all) |
| e1 | card | `0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)` | 1 px `--border` + surface `#111827` | `elevation 1`, `surfaceTintColor: transparent`, custom `BoxShadow` list | Cards, bento tiles at rest |
| e2 | raised | `0 4px 8px -2px rgba(16,24,40,.08), 0 2px 4px -2px rgba(16,24,40,.06)` | surface `#1A2333` + inner top highlight `inset 0 1px 0 rgba(255,255,255,.06)` | `elevation 3` | Hovered tile, dragged item, sticky Sign & Issue bar |
| e3 | floating | `0 12px 16px -4px rgba(16,24,40,.10), 0 4px 6px -2px rgba(16,24,40,.05)` | `#1A2333` + `0 12px 24px rgba(0,0,0,.45)` | `elevation 6` | Popovers, dropdowns, floating docks, tab bar |
| e4 | modal | `0 20px 24px -4px rgba(16,24,40,.10), 0 8px 8px -4px rgba(16,24,40,.04)` | `#1A2333` + `0 24px 48px rgba(0,0,0,.55)` | `elevation 8` | Dialogs, bottom sheets |
| e5 | hero 3D | `0 24px 48px -12px rgba(16,24,40,.25)` + coloured ambient `0 30px 60px -20px rgba(37,99,235,.35)` | `0 30px 60px -20px rgba(96,165,250,.25)` | custom (moves with tilt, UI-02 §6.2) | Medical ID card, Rx seal, AI orb glow |

**Shadow direction:** light always comes from above (y-offset only, never x), so nothing needs mirroring in RTL.

### 7.2 Z-index scale (web) / overlay order (Flutter)

| Layer | z (web) | Flutter mechanism | Contents |
|-------|--------:|-------------------|----------|
| base | 0 | body | Page content |
| sticky | 10 | `SliverPersistentHeader` | Patient header, table headers |
| header | 20 | `AppBar`/`CupertinoNavigationBar` | Top bar |
| sidebar | 30 | — | Sidebar (web) |
| floating | 40 | `Overlay` | Popovers, dropdowns, command palette |
| sheet | 50 | `ModalBottomSheetRoute` | Sheets, drawers |
| dialog | 60 | `DialogRoute` | Dialogs |
| toast | 70 | `ScaffoldMessenger` / overlay | Toasts (never cover the primary action) |
| offline ribbon | 80 | `Overlay` top | Offline ribbon. Always visible, including above dialogs |
| emergency takeover | 90 | `PageRoute(fullscreenDialog: true, opaque: true)` | AI red-flag takeover, spoof lock |
| re-auth / step-up | 100 | `Overlay` (above everything) | Session timeout + re-auth overlay (so drafts underneath stay mounted) |

### 7.3 Glass (backdrop blur) tokens

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--sh-glass-bg` | `rgba(255,255,255,0.62)` | `rgba(17,24,39,0.55)` | Fill |
| `--sh-glass-blur` | `20px` | `24px` | `backdrop-filter: blur() saturate(180%)` |
| `--sh-glass-border` | `rgba(255,255,255,0.55)` outer + `rgba(17,24,39,0.06)` inner hairline | `rgba(255,255,255,0.08)` | 1 px |
| `--sh-glass-highlight` | `inset 0 1px 0 rgba(255,255,255,.7)` | `inset 0 1px 0 rgba(255,255,255,.06)` | Top light edge |
| `--sh-glass-noise` | 2% monochrome noise PNG (64 × 64, tiled) | 3% | Prevents banding on gradients |
| Fallback (`@supports not (backdrop-filter: blur(1px))`, Low-Power, Tier C) | `--card` at 96% opacity | `#111827` at 96% | Automatic (UI-02 §8) |

**Glass allow-list (P10):** web top bar, mobile tab bar / navigation bar, floating action dock, bottom-sheet header strip, AI chat composer, onboarding cards over the brand gradient, and the Medical ID card sheen layer.

**Glass deny-list:** severity banners, clinical data (tables, allergy lists, medication lists), forms and inputs, dialogs that confirm clinical or destructive actions, the pickup QR, anything in Emergency or Sunlight themes, and anything placed over the camera preview (except the scanner's hint chip, which uses an opaque `rgba(0,0,0,.72)` pill instead).

**Performance limits:** at most **2 simultaneously visible glass layers** on mobile and **3** on web. Flutter `BackdropFilter` is wrapped in a `RepaintBoundary` and is only used on the tab bar, the sheet header and the composer. On Tier C devices (UI-02 §2) every glass surface falls back to opaque.

---

## 8. Iconography

| Platform | Set | Style | Sizes |
|----------|-----|-------|-------|
| Web | `lucide-react` | 1.75 px stroke (2 px at ≤ 16 px) | 16 (inline), 20 (default), 24 (nav, banners), 32 (empty states), 40 (ER desk) |
| Flutter | **Material Symbols Rounded** (variable font: weight 400, grade 0, optical size per size) | Rounded, filled for selected states | 20, 24 (default), 28 (tab bar iOS), 32, 40 (Emergency) |
| iOS chrome only | `CupertinoIcons` for system back chevron and share | — | System |

**Core icon mapping (excerpt; full list lives in `design/icons.json`):**

| Meaning | lucide | Material Symbols | Mirror in RTL? |
|---------|--------|------------------|----------------|
| Contraindicated | `OctagonX` | `dangerous` | No |
| Major | `TriangleAlert` | `warning` | No |
| Moderate | `CircleAlert` | `error` | No |
| Minor / info | `Info` | `info` | No |
| Anaphylaxis | `Siren` | `e911_emergency` | No |
| Emergency / ambulance | `Ambulance` | `ambulance` | **Yes** (vehicle faces the reading direction) |
| Prescription | `ScrollText` | `prescriptions` | No |
| Dispense / pill | `Pill` | `medication` | No |
| Verified / authentic | `ShieldCheck` | `verified_user` | No |
| Face scan | `ScanFace` | custom `face_scan` SVG (no suitable Material Symbol) | No |
| QR | `QrCode` / `ScanQrCode` | `qr_code_2` / `qr_code_scanner` | No |
| Offline | `WifiOff` | `wifi_off` | No |
| Break-glass | `ShieldAlert` | `shield_lock` | No |
| Audit log | `FileClock` | `history_edu` | No |
| AI assistant | custom orb glyph (not a robot) | custom | No |
| Back / forward | `ChevronLeft/Right` | `arrow_back_ios_new` | **Yes** |
| Morning dose | `Sunrise` | `wb_twilight` | No |
| Noon dose | `Sun` | `light_mode` | No |
| Evening dose | `Sunset` | custom `dose_evening` SVG (matches lucide `Sunset`) | No |
| Night/bedtime dose | `Moon` | `bedtime` | No |
| Call | `Phone` | `call` | No (the handset glyph is universal) |

**Rule:** never use a fingerprint icon for "identify the patient" (D-UI-09). The fingerprint glyph appears only on «أكّد إنه انت» (the user's own step-up) and only when the device actually uses Touch ID or fingerprint; on Face ID devices show the face glyph.

---

## 9. Severity, Triage & Status Systems

### 9.1 Clinical alert severity (`app.alert_severity`) + allergy

| Level | Icon | Colour token | Shape cue | AR label (Egyptian) | EN label | Blocks Sign & Issue? | Banner `role` |
|-------|------|--------------|-----------|---------------------|----------|----------------------|---------------|
| `contraindicated` | `OctagonX` | `--sh-danger` | Octagon, solid red chip | **ممنوع** | Contraindicated | Yes, until a documented override **+ TOTP re-auth** (UI-07) | `alert` |
| `major` | `TriangleAlert` | `--sh-warning` | Triangle | **خطير** | Major | Yes, until a documented override | `alert` |
| `moderate` | `CircleAlert` | `--sh-caution` | Circle | **متوسط** | Moderate | No | `status` |
| `minor` | `Info` | `--sh-info` | i-circle, collapsed line | **بسيط** | Minor | No | `status` |
| Allergy `anaphylaxis` | `Siren` | `--sh-danger` (solid chip, white text) | Siren + solid | **حساسية مفرطة (Anaphylaxis)** | Anaphylaxis | — | — |
| Allergy `severe` | `TriangleAlert` | `--sh-warning` (solid) | Triangle | **حساسية شديدة** | Severe | — | — |
| Allergy `moderate` | `CircleAlert` | `--sh-caution` (outline) | Circle | **حساسية متوسطة** | Moderate | — | — |
| Allergy `mild` | `Info` | `--sh-info` (outline) | — | **حساسية خفيفة** | Mild | — | — |
| Uncoded allergy (E-CLIN-05) | `CircleHelp` | `--sh-caution` (dashed outline) | Dashed | **حساسية مكتوبة نص — محتاجة تتكوّد** | Uncoded | Permanent moderate banner | `status` |

**Override rule note (for review):** role-05 §7.3 requires a reason + justification + responsibility checkbox for `major` and `contraindicated`, and role-05 §4.2 requires TOTP re-auth at Sign & Issue only when `auth_time` > 15 min. The brief asks for "mandatory clinical reason + biometric/PIN" for critical overrides. The proposal in this system: **`contraindicated` overrides always ask for a fresh TOTP code** (the web equivalent of PIN; doctors use the web portal, which has no device biometric in MVP), while `major` keeps the role-05 rule. This needs Security Lead sign-off because it changes the re-auth rule; it is tracked in UI-07.

### 9.2 Triage (`app.triage_level`)

| Level | Visual | Colour | AR label | EN label |
|-------|--------|--------|----------|----------|
| `emergency` | **Full-screen red takeover** (UI-02 §6.4, UI-06) | `--sh-takeover-scrim` + white | **طوارئ — اتصل بالإسعاف دلوقتي** | Emergency — call now |
| `urgent` | Amber card with clock icon | `--sh-warning` | **لازم تشوف دكتور خلال ٢٤ ساعة** | See a doctor within 24 h |
| `soon` | Blue card | `--sh-info` | **احجز مع دكتور في أقرب وقت (خلال كام يوم)** | Book soon |
| `routine` | Neutral card | `--muted` | **ميعاد عادي مع دكتور** | Routine visit |
| `self_care` | Teal card with home icon | `--accent` | **تقدر تتابع في البيت — وخلي بالك من العلامات دي** | Self-care |

### 9.3 Prescription status (`app.prescription_status`)

| Value | AR (Egyptian) | EN | Light badge (text/bg) | Icon | Dispensable? |
|-------|---------------|----|------------------------|------|--------------|
| `pending` | **قيد الصرف** | Ready to dispense | `#1D4ED8` / `#DBEAFE` | `Clock` | Yes |
| `partially_dispensed` | **اتصرف جزء منها** | Partially dispensed | `#92400E` / `#FEF3C7` | `CircleDashed` (half-filled) | Yes (remaining items) |
| `dispensed` | **اتصرفت بالكامل** | Fully dispensed | `#166534` / `#DCFCE7` | `CircleCheckBig` | No |
| `cancelled` | **اتلغت** | Cancelled | `#374151` / `#E5E7EB` | `Ban` | No |
| `expired` | **انتهت صلاحيتها** | Expired | `#374151` / `#F3F4F6` + diagonal stripes | `CalendarX` | No |

Badge morphing between these states (e.g. «قيد الصرف» → «اتصرفت بالكامل») is specified in UI-02 §5.4.

### 9.4 Prescription item status (`app.rx_item_status`)

| Value | AR | EN | Pharmacist checkbox label |
|-------|----|----|---------------------------|
| `pending` | **لسه متبقّي** | Remaining | «اصرف دلوقتي» |
| `partially_dispensed` | **اتصرف جزء — فاضل {n}** | Partially dispensed | «اصرف الباقي» |
| `dispensed` | **اتصرف** | Dispensed | (disabled, check shown) |
| `cancelled` | **اتلغى** | Cancelled | (disabled, struck through) |

### 9.5 Other enums shown in UI

| Enum | Value → AR (Egyptian) |
|------|------------------------|
| `app.license_status` | `pending` → «مستني المراجعة» · `verified` → «متوثّق» · `suspended` → «موقوف مؤقتاً» · `revoked` → «اتسحب» · `expired` → «منتهي» |
| `app.account_status` | `pending_verification` → «مستني التفعيل» · `active` → «شغّال» · `suspended` → «موقوف» · `deactivated` → «متقفل» |
| `app.grant_status` | `active` → «شغّال» · `revoked` → «اتلغى» · `expired` → «خلص» |
| `app.emergency_session_status` | `active` → «مفتوحة» · `closed` → «اتقفلت» · `expired` → «وقتها خلص» |
| `app.data_source` | `patient_reported` → «انت اللي كاتبها» (patient) / «من كلام المريض» (clinician) · `clinician_confirmed` → «متأكد منها الدكتور» · `imported` → «متسجلة من مصدر تاني» |
| `app.blood_type` | `unknown` → «مش معروفة» (never shown as blank) |
| Identify result (API) | `match` → «اتعرفنا عليه» · `possible_match` → «فيه تطابق محتمل — لازم تأكّد» · `no_match` → «مش متسجل عندنا» |
| `audit.outcome` | `success` → «تمّت» · `denied` → «اترفضت» · `error` → «حصل خطأ» |

---

## 10. Component Library: Anatomy & Tokens

### 10.1 Buttons

| Variant | Height web / mobile / emergency | Padding inline | Radius | Fill / text | States |
|---------|---------------------------------|----------------|--------|-------------|--------|
| Primary | 40 / 48 (Android) · 50 (iOS) / 64 | 16 / 20 | `lg` 12 | `--primary` / `--primary-foreground` | hover `--sh-primary-hover`; pressed scale 0.97 (UI-02 §5.2); focus 2 px ring offset 2; disabled 40% opacity **plus a visible reason under it** (P4); loading = spinner replaces the icon, label stays, width locked |
| Secondary | same | same | 12 | `--card` + 1.5 px `--input` border / `--foreground` | hover `--muted` |
| Ghost | same | 12 | 12 | transparent / `--primary` | hover `--sh-primary-subtle` |
| Destructive | same | same | 12 | `--destructive` / `--destructive-foreground` | Always opens a confirm dialog |
| Emergency call | — / — / **72** | 24 | 16 | `#30D158` / `#000000`, label `em.button`, phone icon 32 | Pressed → darkens 10%; haptic medium |
| Emergency danger | — / — / 64 | 24 | 16 | `#FF3B30` / `#000000` | — |
| Icon button | 40 / 48 / 64 | — | full | ghost | Always has an accessible label (tooltip on web) |

Label rules: verb first, sentence case in English; in Arabic use the imperative («اصرف», «ابعت», «أكّد») or noun phrases for navigation. Maximum 3 words (UI-03).

### 10.2 Inputs

| Part | Spec |
|------|------|
| Label | Always visible above the field (`label` token), never placeholder-only (role-07 §9) |
| Field | Height 40 (web) / 52 (mobile) / 64 (emergency search); radius 8 (web) / 12 (mobile); border 1.5 px `--input`; fill `--card` |
| Focus | Border `--primary` + 2 px ring `--ring` at 30% opacity outside |
| Helper | `caption`, `--muted-foreground`; replaced by the error when invalid |
| Error | Border `--sh-danger`, icon `CircleAlert` at inline-end, message in `--sh-danger-on-surface`, linked via `aria-describedby`; the field shakes **only when Reduced Motion is off and only on submit** (UI-02 §5.6) |
| Success (validated, e.g. national ID) | `CircleCheck` icon `--sh-success` at inline-end |
| Masks | National ID `____ ____ ____ __` (14 digits), MRN `SH-________`, Rx `RX-____-______`, phone `01_ ____ ____` |
| Numeric | `inputmode="numeric"`; dose/quantity steppers have −/+ buttons of 40/48 px |

### 10.3 Severity banner (`SafetyAlertBanner` / `SeverityBanner`)

```
┌─────────────────────────────────────────────────────────────┐
▌ ⛔  ممنوع — حساسية مفرطة من البنسلين                          │ ← title: h3, on-surface
▌     Augmentin فيه Amoxicillin من نفس العيلة. المريض عنده      │ ← body: body-sm
▌     تأق (Anaphylaxis) متسجل.                                   │
▌     المصدر: DDInter 2.0 · اتراجع قبل كده: د. سارة — ١ سبتمبر   │ ← caption
▌                                    (وثّق سبب التجاوز)          │ ← secondary button
└─────────────────────────────────────────────────────────────┘
  ▲ 3 px inline-start bar in severity solid colour (it appears on the right in RTL)
```
- Padding 16, radius `md` 8, background = severity surface, no glass, no shadow (e0).
- `contraindicated` and `major` use `role="alert"`; others use `role="status"`.
- Minor alerts collapse into one line: «٣ ملاحظات بسيطة ▾».

### 10.4 Cards & bento tiles
- Web: `--card`, 1 px `--border`, e1, radius 16, padding 20. Hover: e2 + translateY(-2 px) (UI-02 §5.2). The **whole tile is the link** only when it has exactly one destination; otherwise only the action is clickable.
- Mobile: radius 20, padding 16, e1 (light) / tonal (dark). Press: scale 0.98.
- **Critical tile variant:** 2 px border in the severity colour and no hover lift (critical things do not "float").

### 10.5 Chips & badges
- Height 24 (badge) / 32 (chip, web) / 36 (chip, mobile) / 44 (emergency chip). Radius full for chips, `sm` for status badges.
- Allergy chips are coloured by severity (§9.1). The anaphylaxis chip is solid red with white text and a siren icon, **always first** in the list.
- Status badges (§9.3) contain icon + label; never colour alone.

### 10.6 Dialogs, sheets & overlays
- **Dialog** (web): max-width 480 (confirm) / 640 (forms) / 880 (preview); radius 16; e4; scrim `--sh-scrim`; the primary action sits at the **inline-end** of the footer (left in RTL), and the destructive action is never the default focus.
- **Bottom sheet** (mobile): top radius 28; drag handle 36 × 5, radius full, `--border`; detents 40% / 90% (UI-02 §5.5); the sheet header strip may be glass.
- **Side sheet** (web tablet): 400 wide, from the inline-start side.
- **Takeover** (AI emergency, spoof lock, session lock): full-screen, opaque, no scrim, cannot be dismissed by tapping outside.

### 10.7 Toasts
Sonner (web) / floating SnackBar (Android) / top toast (iOS). Max 2 lines; auto-dismiss 4 s (6 s if it has an action); **never used for errors that need action** (role-07 §4) and never for clinical alerts.

### 10.8 Empty states
Illustration (120–160 px, brand palette) → title `h3` → one sentence `body` → one primary CTA. The tone is friendly and never blames the user (UI-03): e.g. «لسه مفيش روشتات — أول ما الدكتور يكتبلك روشتة هتلاقيها هنا».

### 10.9 Skeletons
Shapes match the final layout exactly (no generic bars). Fill `--muted`, shimmer per UI-02 §5.7 (static when Reduced Motion is on). Show a skeleton only if loading exceeds **300 ms**, to avoid flicker. Emergency screens never show skeletons: they show the scan progress and then the final data.

### 10.10 Data tables (web)
Header row on `--sh-surface-sunken`, `label` token, sticky; row height 52 (comfortable) / 44 (compact, admin audit); zebra off; hover `--muted`; selected `--sh-primary-subtle` + 2 px inline-start bar; numbers end-aligned in Inter tnum; dates use the Cairo timezone format (role-05 §8). Below `lg`, tables switch to card rows.

---

## 11. Signature Custom Components (shared spec; motion in UI-02)

| # | Component | Web path | Flutter path | Notes |
|---|-----------|----------|--------------|-------|
| 11.1 | **Medical ID Card 3D** | `components/three/MedicalIdCard3D.tsx` | `lib/core/visuals/medical_id_card_3d.dart` | 1.586 aspect (ISO ID-1); front = identity + critical info; back = **flat white QR**; UI-02 §6.2 |
| 11.2 | **Face Mesh Scanner** | `components/three/FaceMeshScanner.tsx` | `lib/features/biometrics/presentation/widgets/face_mesh_scanner.dart` | Same widget for enrolment, pharmacy 1:1 and emergency (emergency uses the fast-path 2D variant); UI-02 §6.1 |
| 11.3 | **Rx Authenticity Seal** | `components/three/RxSeal.tsx` | `lib/core/visuals/rx_seal.dart` | Visual state driven **only** by the verification result; UI-02 §6.3 |
| 11.4 | **Medication Card + Dose Glyphs** | `components/prescription/MedicationCard.tsx` | `lib/features/prescriptions/presentation/widgets/medication_card.dart` | Dosage-form glyph (tablet, capsule, syrup, inhaler, injection, drops, cream) + time-of-day chips with icon + text |
| 11.5 | **AI Orb** | `components/three/AiOrb.tsx` | `lib/features/assistant/presentation/widgets/ai_orb.dart` | Decorative; state is always mirrored as a text label; UI-02 §6.4 |
| 11.6 | **Status Badge (morphing)** | `components/common/StatusBadge.tsx` | `lib/core/widgets/status_badge.dart` | §9.3; UI-02 §5.4 |
| 11.7 | **Offline Ribbon** | `components/common/OfflineRibbon.tsx` | `lib/core/widgets/offline_banner.dart` (existing name in role-06) | Top, 36 px (web) / 40 dp (mobile) / 48 dp (emergency); copy «أوفلاين — آخر تحديث من {relative_time}» |
| 11.8 | **Break-Glass Banner** | `components/common/BreakGlassBanner.tsx` | `lib/features/emergency/presentation/widgets/break_glass_banner.dart` | Shows the session timer «⏱ فاضل ٥٢ دقيقة» + «الوصول ده متسجل ومتراجع» |
| 11.9 | **Step-Up / Re-auth Overlay** | `components/shell/ReauthDialog.tsx` (TOTP) | `lib/core/security/step_up_overlay.dart` | Draft underneath stays mounted (z 100) |
| 11.10 | **Countdown Ring** | `components/common/Countdown.tsx` | `lib/core/widgets/countdown.dart` | mm:ss inside a ring; switches to warning colour at 60 s (role-07) |
| 11.11 | **QR Panel** | `components/pharmacy/QrPanel.tsx` | `lib/features/prescriptions/presentation/widgets/pickup_qr_panel.dart` | Pure white, quiet zone ≥ 4 modules, max brightness on mobile, `FLAG_SECURE` |
| 11.12 | **Glass Surface** | `components/common/GlassPanel.tsx` | `lib/core/widgets/glass_surface.dart` | Enforces the allow-list via a `purpose` prop/enum; falls back to opaque on Tier C |
| 11.13 | **Bento Grid / Tile** | `components/common/BentoGrid.tsx`, `BentoTile.tsx` | `lib/core/widgets/bento_grid.dart` | §5.3 |
| 11.14 | **Dose Timeline** | `components/prescription/DoseTimeline.tsx` | `lib/features/prescriptions/presentation/widgets/dose_timeline.dart` | 24 h ring or bar with dose markers; shows **only times the patient set or the prescription states**. It never invents times (UI-02 §6.3) |

---

## 12. Component Mapping: Web ↔ Flutter (Material 3 / Cupertino)

**Adaptive strategy (P12):**
- **System chrome adapts per platform** (navigation, switches, pickers, sheets, dialogs, refresh, activity indicators, context menus) using Flutter's `.adaptive` constructors or a small `isCupertino(context)` switch.
- **Clinical and brand components are identical on all platforms** (buttons, cards, severity banners, chips, Emergency theme, ID card, scanner, seal, orb), because a doctor or paramedic must see the same thing everywhere.

| # | Concept | Web (Next.js 16 · Tailwind v4 · shadcn/ui) | Flutter Android (Material 3) | Flutter iOS (Cupertino-adaptive) | Shared spec |
|---|---------|---------------------------------------------|------------------------------|-----------------------------------|-------------|
| 1 | App shell / primary nav | shadcn `Sidebar` (264 ↔ 72) + `TopBar` (glass) | `NavigationBar` (bottom, 80 dp) | `CupertinoTabBar` (glass, 50 pt + safe area) | Max 5 destinations; labels always visible |
| 2 | Tablet nav | Collapsed sidebar | `NavigationRail` | `NavigationRail` styled flat | ≥ 600 width |
| 3 | Page header | `TopBar` + `Breadcrumb` | `SliverAppBar.large` | `CupertinoSliverNavigationBar` (large title) | Title `h1` |
| 4 | Primary button | `Button` (default) | `FilledButton` (themed) | Same `FilledButton` with ShTheme (brand, not `CupertinoButton.filled`) | §10.1 |
| 5 | Secondary button | `Button variant="outline"` | `OutlinedButton` | `OutlinedButton` | §10.1 |
| 6 | Ghost / text button | `Button variant="ghost"` | `TextButton` | `TextButton` | — |
| 7 | Destructive | `Button variant="destructive"` + `AlertDialog` | `FilledButton` (danger) + `AlertDialog.adaptive` | same + `CupertinoAlertDialog` (via `showAdaptiveDialog`) | Always confirms |
| 8 | Morphing action button | custom `MorphButton` (Framer `layout`) | custom `MorphButton` (`AnimatedContainer` + `AnimatedSwitcher`) | same | UI-02 §5.3 |
| 9 | Icon button | `Button size="icon"` + `Tooltip` | `IconButton` (+ `tooltip`) | `IconButton` | Accessible label |
| 10 | Text input | `Input` + `Label` + `FormMessage` | `TextFormField` (outlined) | `TextFormField` (outlined, same look) | §10.2 |
| 11 | Search | `Input` with `Search` icon / `Command` | `SearchAnchor` + `SearchBar` | `CupertinoSearchTextField` | Debounce 300 ms |
| 12 | Select | `Select` | `DropdownMenu` | `CupertinoPicker` in a bottom sheet for ≤ 7 options; else searchable list | — |
| 13 | Drug / ICD combobox | `Command` in `Popover` | `SearchAnchor` (full-screen on compact) | same | Brand + generic + strength + «Controlled» badge |
| 14 | Date picker | `Calendar` + `Popover` | `showDatePicker` (M3) | `CupertinoDatePicker` in a sheet | Locale `ar-EG`, week starts Saturday |
| 15 | Time picker (reminders) | `Input type="time"` styled | `showTimePicker` | `CupertinoDatePicker(mode: time)` | 12 h with «ص / م» in Arabic |
| 16 | OTP / share code | `InputOTP` | custom `OtpField` (6 boxes, autofill) | same + iOS `oneTimeCode` autofill hint | `code-lg` |
| 17 | Checkbox | `Checkbox` | `Checkbox.adaptive` | `Checkbox.adaptive` (Cupertino style) | Min hit area 48 |
| 18 | Radio | `RadioGroup` | `Radio.adaptive` | `Radio.adaptive` | Override reasons |
| 19 | Switch | `Switch` | `Switch.adaptive` | `Switch.adaptive` → `CupertinoSwitch` | Spring per UI-02 §5.2 |
| 20 | Segmented control | `ToggleGroup` | `SegmentedButton` | `CupertinoSlidingSegmentedControl` | Max 4 segments |
| 21 | Tabs | `Tabs` | `TabBar` | `CupertinoSlidingSegmentedControl` (≤ 4) / `TabBar` | — |
| 22 | Quantity stepper | custom `QuantityStepper` (−/input/+) | custom | custom | Max = remaining, default = remaining (role-05) |
| 23 | Card / bento tile | `Card` → `BentoTile` | `Card.filled` → `BentoTile` | same `BentoTile` | §10.4 |
| 24 | List row | custom `ListRow` | `ListTile` | `CupertinoListTile` inside `CupertinoListSection.insetGrouped` | 56–72 height |
| 25 | Status badge | `StatusBadge` (custom over `Badge`) | `StatusBadge` | same | §9.3 |
| 26 | Allergy / filter chip | `Badge` / `ToggleGroupItem` | `Chip` / `FilterChip` | same | §10.5 |
| 27 | Severity banner | custom `SafetyAlertBanner` (over `Alert`) | custom `SeverityBanner` | same | §10.3 |
| 28 | Inline problem | `ProblemAlert` | `ProblemView` (role-06 `problem_view.dart`) | same | Code-driven copy (UI-03) |
| 29 | Dialog | `Dialog` | `Dialog` / `AlertDialog.adaptive` | `CupertinoAlertDialog` for confirms; custom sheet for forms | §10.6 |
| 30 | Bottom sheet | `Drawer` (vaul) on md; `Sheet` on lg+ | `showModalBottomSheet(showDragHandle: true, useSafeArea: true)` | Cupertino-style sheet (`CupertinoSheetRoute` if available in the pinned Flutter version; else `showModalBottomSheet` with iOS styling) | Detents in UI-02 §5.5 |
| 31 | Action sheet / menu | `DropdownMenu` | `MenuAnchor` or list sheet | `CupertinoActionSheet` | — |
| 32 | Context menu (long-press) | `ContextMenu` | `MenuAnchor` on long-press | `CupertinoContextMenu` | Never the only path to an action |
| 33 | Toast | `Sonner` | `SnackBar` (floating) | custom top toast | §10.7 |
| 34 | Tooltip | `Tooltip` | `Tooltip` (long-press) | info `IconButton` → popover sheet | Never holds critical info |
| 35 | Popover | `Popover` | `MenuAnchor` / `OverlayPortal` | same | — |
| 36 | Data table | TanStack + `Table` | Card list (no tables on phones) | same | §10.10 |
| 37 | Progress (linear/circular) | `Progress` / spinner | `LinearProgressIndicator` / `CircularProgressIndicator.adaptive` | `CupertinoActivityIndicator` (via `.adaptive`) | — |
| 38 | Skeleton | `Skeleton` | custom `Skeleton` (ShaderMask shimmer) | same | §10.9 |
| 39 | Pull to refresh | n/a | `RefreshIndicator.adaptive` | `CupertinoSliverRefreshControl` (via `.adaptive`) | — |
| 40 | Empty state | `EmptyState` | `EmptyState` | same | §10.8 |
| 41 | Avatar | `Avatar` | `CircleAvatar` | same | Initials fallback; no patient photos |
| 42 | Stepper / wizard | custom `Stepper` (flows right → left in AR) | custom `ShStepper` | same | Onboarding, invite form |
| 43 | Timeline | `HistoryTimeline` (virtualised) | `HistoryTimeline` (`SliverList`) | same | Medical history |
| 44 | Countdown | `Countdown` | `Countdown` | same | §11.10 |
| 45 | QR render | `qrcode` → `QrPanel` | `qr_flutter` → `PickupQrPanel` | same | §11.11 |
| 46 | QR scan | `BarcodeDetector` / `@zxing/browser` → `QrScanner` | `mobile_scanner` | same | Frame overlay, torch toggle |
| 47 | Face capture | `FaceMeshScanner` (webcam, pharmacist presence) | `FaceMeshScanner` (`camera` + ML Kit) | same | UI-02 §6.1 |
| 48 | Re-auth / step-up | `ReauthDialog` (TOTP `InputOTP`) | `StepUpOverlay` → system `BiometricPrompt` | `StepUpOverlay` → system Face ID / Touch ID sheet | Copy «أكّد إنه انت» |
| 49 | Keyboard shortcut hint | `Kbd` | n/a | n/a | Web only |
| 50 | Command palette | `Command` (`Ctrl/⌘ K`) | n/a | n/a | Doctor/admin |
| 51 | Offline ribbon | `OfflineRibbon` | `OfflineBanner` | same | §11.7 |
| 52 | Glass surface | `GlassPanel` | `GlassSurface` (`BackdropFilter` + `RepaintBoundary`) | same | §7.3 |
| 53 | 3D visuals | R3F / CSS 3D (UI-02) | `CustomPainter` / `FragmentShader` / `Transform` (UI-02) | same | UI-02 §6 |

---

## 13. Accessibility Requirements (extends role-07 §9)

| Area | Requirement |
|------|-------------|
| Contrast | WCAG 2.2 **AA** everywhere; **AAA** in Emergency and Sunlight (§3.3) |
| Non-text contrast | Inputs, focus rings, chart lines and icons that carry meaning ≥ 3:1 |
| Touch targets | Web ≥ 40 px (44 on tablet layouts); mobile ≥ 48 dp (Android) / 44 pt (iOS); **Emergency ≥ 64 dp**, primary call button 72 dp; 8 dp minimum between targets |
| Focus | 2 px `--ring`, offset 2, never removed; visible in all themes; tab order follows RTL reading order; skip link «روح للمحتوى» |
| Screen readers | Every icon button has a label; severity banners use `role="alert"` (blocking) / `role="status"`; the AI orb is `aria-hidden` and its state is announced by a text label in an `aria-live="polite"` region; the 3D card exposes a plain-text summary («فصيلة الدم O موجب، حساسية مفرطة من البنسلين…») |
| Dynamic type | Up to 200% (Emergency capped at 130%) without clipping or overlap |
| Motion | `prefers-reduced-motion` / OS setting fully honoured (UI-02 §8.2); no flashing above **3 per second** (WCAG 2.3.1) anywhere, including the urgent orb and takeover |
| Gloves & stress | Emergency: no swipe-only actions, no small toggles, no long-press-only actions, no time-limited taps |
| Language | `lang="ar"`/`lang="en"` set on `<html>`; mixed spans get `lang` and `dir` |
| Haptics | Always paired with a visual change (UI-02 §7); respect the system setting |
| Colour blindness | Shape + icon + text for every status (§3.3) |
| Elderly patients | Large-Font onboarding question; tap (not swipe) for all key actions; confirm-before-irreversible; generous spacing; at most 1 new concept per screen |

---

## 14. Token Pipeline & Code

### 14.1 Source of truth
`design/tokens/tokens.json` in **W3C Design Tokens (DTCG)** format, exported from Figma Variables via Tokens Studio (role-07 §3.5). The modes are `light`, `dark`, `emergency` and `sunlight`. Changes go through a PR owned by UI/UX (ANTIGRAVITY-RULES §4 boundaries: `design/tokens/** → UI/UX`).

```json
{
  "color": {
    "primitive": {
      "blue": { "600": { "$type": "color", "$value": "#2563EB" }, "700": { "$type": "color", "$value": "#1D4ED8" } },
      "yellow": { "700": { "$type": "color", "$value": "#A16207" } },
      "slate": { "input": { "$type": "color", "$value": "#7B8494" } }
    },
    "semantic": {
      "primary": {
        "$type": "color",
        "$value": "{color.primitive.blue.600}",
        "$extensions": { "mode": { "dark": "#60A5FA", "emergency": "#FFFFFF", "sunlight": "#0040C1" } }
      },
      "caution": {
        "solid": {
          "$type": "color",
          "$value": "{color.primitive.yellow.700}",
          "$extensions": { "mode": { "dark": "#FACC15", "emergency": "#FFD60A", "sunlight": "#000000" } }
        }
      }
    }
  },
  "radius": { "lg": { "$type": "dimension", "$value": "12px" }, "2xl": { "$type": "dimension", "$value": "20px" } },
  "font": {
    "family": {
      "arabicDisplay": { "$type": "fontFamily", "$value": ["Cairo", "IBM Plex Sans Arabic", "sans-serif"] },
      "arabicBody": { "$type": "fontFamily", "$value": ["IBM Plex Sans Arabic", "Cairo", "sans-serif"] },
      "latin": { "$type": "fontFamily", "$value": ["Inter", "system-ui", "sans-serif"] }
    }
  }
}
```

Generators (`pnpm tokens:build`, Style Dictionary v4):
- `web-admin/app/tokens.css` — CSS variables per `[data-theme]`
- `mobile-app/lib/core/theme/tokens.dart` — `ShColors`, `ShSpace`, `ShRadius`, `ShType`
- `design/tokens/contrast-report.md` — §14.5

### 14.2 Web: `web-admin/app/globals.css` (Tailwind v4)

```css
@import "tailwindcss";
@import "./tokens.css"; /* generated: :root, [data-theme=dark|emergency|sunlight] */

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
@custom-variant emergency (&:where([data-theme=emergency], [data-theme=emergency] *));
@custom-variant sunlight (&:where([data-theme=sunlight], [data-theme=sunlight] *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-danger: var(--sh-danger);
  --color-danger-surface: var(--sh-danger-surface);
  --color-danger-on-surface: var(--sh-danger-on-surface);
  --color-warning: var(--sh-warning);
  --color-warning-surface: var(--sh-warning-surface);
  --color-warning-on-surface: var(--sh-warning-on-surface);
  --color-caution: var(--sh-caution);
  --color-caution-surface: var(--sh-caution-surface);
  --color-caution-on-surface: var(--sh-caution-on-surface);
  --color-success: var(--sh-success);
  --color-success-surface: var(--sh-success-surface);
  --color-info: var(--sh-info);
  --color-info-surface: var(--sh-info-surface);
  --color-ai: var(--sh-ai);
  --color-ai-surface: var(--sh-ai-surface);

  --font-sans: var(--font-plex-ar), var(--font-inter), system-ui, sans-serif;
  --font-display: var(--font-cairo), var(--font-plex-ar), system-ui, sans-serif;
  --font-latin: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-3xl: 28px;

  --shadow-e1: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08);
  --shadow-e2: 0 4px 8px -2px rgba(16,24,40,.08), 0 2px 4px -2px rgba(16,24,40,.06);
  --shadow-e3: 0 12px 16px -4px rgba(16,24,40,.10), 0 4px 6px -2px rgba(16,24,40,.05);
  --shadow-e4: 0 20px 24px -4px rgba(16,24,40,.10), 0 8px 8px -4px rgba(16,24,40,.04);
  --shadow-e5: 0 24px 48px -12px rgba(16,24,40,.25), 0 30px 60px -20px rgba(37,99,235,.35);
}

@layer base {
  html { font-size: 100%; }
  html[data-font-scale="lg"] { font-size: 115%; }
  html[data-font-scale="xl"] { font-size: 130%; }
  body { @apply bg-background text-foreground font-sans antialiased; }
  :lang(ar) { letter-spacing: 0 !important; line-height: 1.65; }
  :lang(ar) h1, :lang(ar) h2, :lang(ar) h3 { font-family: var(--font-display); }
  .num, .dose, bdi.num { font-family: var(--font-latin); font-feature-settings: "tnum" 1, "lnum" 1; }
  .code { font-family: var(--font-mono); letter-spacing: 0.02em; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  [data-theme="emergency"] *, [data-theme="sunlight"] * { backdrop-filter: none !important; }
  [data-theme="emergency"] { --shadow-e1: none; --shadow-e2: none; --shadow-e3: none; --shadow-e4: none; --shadow-e5: none; }
}

@utility glass {
  background: var(--sh-glass-bg);
  backdrop-filter: blur(var(--sh-glass-blur)) saturate(180%);
  border: 1px solid var(--sh-glass-border);
  box-shadow: var(--sh-glass-highlight);
  @supports not (backdrop-filter: blur(1px)) { background: var(--card); }
  [data-power="low"] & { backdrop-filter: none; background: var(--card); }
}
```

Generated `tokens.css` excerpt (one block per theme):

```css
:root, [data-theme="light"] {
  --background:#F3F4F6; --foreground:#111827; --card:#FFFFFF; --card-foreground:#111827;
  --popover:#FFFFFF; --muted:#F3F4F6; --muted-foreground:#4B5563; --border:#E5E7EB;
  --input:#7B8494; --ring:#2563EB; --primary:#2563EB; --primary-foreground:#FFFFFF;
  --secondary:#F3F4F6; --secondary-foreground:#111827; --accent:#F0FDFA; --accent-foreground:#0F766E;
  --destructive:#DC2626; --destructive-foreground:#FFFFFF;
  --sh-primary-hover:#1D4ED8; --sh-primary-subtle:#EFF6FF; --sh-primary-on-subtle:#1D4ED8;
  --sh-surface-raised:#FFFFFF; --sh-surface-sunken:#F9FAFB; --sh-placeholder:#6B7280;
  --sh-danger:#DC2626; --sh-danger-surface:#FEF2F2; --sh-danger-on-surface:#991B1B;
  --sh-warning:#B45309; --sh-warning-surface:#FFFBEB; --sh-warning-on-surface:#92400E;
  --sh-caution:#A16207; --sh-caution-surface:#FEFCE8; --sh-caution-on-surface:#854D0E;
  --sh-success:#15803D; --sh-success-surface:#F0FDF4; --sh-success-on-surface:#166534;
  --sh-info:#0369A1; --sh-info-surface:#F0F9FF; --sh-info-on-surface:#075985;
  --sh-offline:#B45309; --sh-offline-surface:#FFFBEB; --sh-offline-on-surface:#92400E;
  --sh-ai:#6D28D9; --sh-ai-surface:#F5F3FF; --sh-ai-on-surface:#5B21B6;
  --sh-glass-bg:rgba(255,255,255,.62); --sh-glass-blur:20px; --sh-glass-border:rgba(255,255,255,.55);
  --sh-glass-highlight:inset 0 1px 0 rgba(255,255,255,.7);
  --sh-scrim:rgba(17,24,39,.48); --sh-takeover-scrim:#7F1D1D;
  --sh-qr-bg:#FFFFFF; --sh-qr-fg:#000000;
}
[data-theme="dark"] {
  --background:#0B1220; --foreground:#F9FAFB; --card:#111827; --card-foreground:#F9FAFB;
  --popover:#1A2333; --muted:#1F2937; --muted-foreground:#9CA3AF; --border:#243044;
  --input:#6B7280; --ring:#93C5FD; --primary:#60A5FA; --primary-foreground:#0B1220;
  --secondary:#1F2937; --secondary-foreground:#F9FAFB; --accent:#042F2E; --accent-foreground:#2DD4BF;
  --destructive:#F87171; --destructive-foreground:#0B1220;
  --sh-primary-hover:#93C5FD; --sh-primary-subtle:#172554; --sh-primary-on-subtle:#BFDBFE;
  --sh-surface-raised:#1A2333; --sh-surface-sunken:#0F172A; --sh-placeholder:#9CA3AF;
  --sh-danger:#F87171; --sh-danger-surface:#450A0A; --sh-danger-on-surface:#FECACA;
  --sh-warning:#FBBF24; --sh-warning-surface:#451A03; --sh-warning-on-surface:#FDE68A;
  --sh-caution:#FACC15; --sh-caution-surface:#422006; --sh-caution-on-surface:#FEF08A;
  --sh-success:#4ADE80; --sh-success-surface:#052E16; --sh-success-on-surface:#BBF7D0;
  --sh-info:#38BDF8; --sh-info-surface:#082F49; --sh-info-on-surface:#BAE6FD;
  --sh-offline:#FBBF24; --sh-offline-surface:#451A03; --sh-offline-on-surface:#FDE68A;
  --sh-ai:#A78BFA; --sh-ai-surface:#2E1065; --sh-ai-on-surface:#DDD6FE;
  --sh-glass-bg:rgba(17,24,39,.55); --sh-glass-blur:24px; --sh-glass-border:rgba(255,255,255,.08);
  --sh-glass-highlight:inset 0 1px 0 rgba(255,255,255,.06);
  --sh-scrim:rgba(0,0,0,.64); --sh-takeover-scrim:#450A0A;
}
[data-theme="emergency"] {
  --background:#000000; --foreground:#FFFFFF; --card:#1C1C1E; --card-foreground:#FFFFFF;
  --popover:#1C1C1E; --muted:#1C1C1E; --muted-foreground:#FFFFFF; --border:#3A3A3C;
  --input:#FFFFFF; --ring:#FFD60A; --primary:#FFFFFF; --primary-foreground:#000000;
  --destructive:#FF3B30; --destructive-foreground:#000000;
  --sh-danger:#FF3B30; --sh-danger-surface:#7F1D1D; --sh-danger-on-surface:#FFFFFF;
  --sh-danger-text:#FF453A;
  --sh-warning:#FFD60A; --sh-warning-surface:#FFD60A; --sh-warning-on-surface:#000000;
  --sh-caution:#FFD60A; --sh-caution-surface:#000000; --sh-caution-on-surface:#FFD60A;
  --sh-success:#30D158; --sh-success-surface:#30D158; --sh-success-on-surface:#000000;
  --sh-info:#0A84FF; --sh-info-surface:#0A84FF; --sh-info-on-surface:#FFFFFF;
  --sh-offline:#FF9F0A; --sh-offline-surface:#FF9F0A; --sh-offline-on-surface:#000000;
  --sh-glass-bg:#1C1C1E; --sh-glass-blur:0px; --sh-glass-border:#3A3A3C; --sh-glass-highlight:none;
  --sh-scrim:rgba(0,0,0,.85); --sh-takeover-scrim:#7F1D1D;
}
[data-theme="sunlight"] {
  --background:#FFFFFF; --foreground:#000000; --card:#FFFFFF; --card-foreground:#000000;
  --popover:#FFFFFF; --muted:#F3F4F6; --muted-foreground:#1F2937; --border:#000000;
  --input:#000000; --ring:#0040C1; --primary:#0040C1; --primary-foreground:#FFFFFF;
  --destructive:#B00020; --destructive-foreground:#FFFFFF;
  --sh-danger:#B00020; --sh-danger-surface:#FFFFFF; --sh-danger-on-surface:#B00020;
  --sh-warning:#000000; --sh-warning-surface:#FFD60A; --sh-warning-on-surface:#000000;
  --sh-caution:#000000; --sh-caution-surface:#FFF7B3; --sh-caution-on-surface:#000000;
  --sh-success:#006B2D; --sh-success-surface:#FFFFFF; --sh-success-on-surface:#006B2D;
  --sh-info:#0040C1; --sh-info-surface:#FFFFFF; --sh-info-on-surface:#0040C1;
  --sh-offline:#000000; --sh-offline-surface:#FFD60A; --sh-offline-on-surface:#000000;
  --sh-glass-bg:#FFFFFF; --sh-glass-blur:0px; --sh-glass-border:#000000; --sh-glass-highlight:none;
}
```

`<html>` attributes are set in `app/[locale]/layout.tsx`: `lang`, `dir`, `data-theme` (from a cookie, so there is no theme flash on first paint), `data-font-scale`, and `data-power`. The ER desk route group forces `data-theme="sunlight"` by default.

### 14.3 Flutter: `lib/core/theme/`

```dart
// lib/core/theme/sh_colors.dart  (fields generated from tokens.json; lerp/copyWith hand-written once)
import 'package:flutter/material.dart';

@immutable
class ShColors extends ThemeExtension<ShColors> {
  const ShColors({
    required this.canvas, required this.surface, required this.surfaceRaised, required this.surfaceSunken,
    required this.foreground, required this.mutedForeground, required this.border, required this.input,
    required this.ring, required this.primary, required this.onPrimary, required this.primarySubtle,
    required this.danger, required this.dangerSurface, required this.onDangerSurface,
    required this.warning, required this.warningSurface, required this.onWarningSurface,
    required this.caution, required this.cautionSurface, required this.onCautionSurface,
    required this.success, required this.successSurface, required this.onSuccessSurface,
    required this.info, required this.infoSurface, required this.onInfoSurface,
    required this.offline, required this.offlineSurface, required this.onOfflineSurface,
    required this.ai, required this.aiSurface, required this.onAiSurface,
    required this.glassFill, required this.glassBlurSigma, required this.glassBorder,
    required this.qrBackground, required this.qrForeground, required this.takeoverScrim,
  });

  final Color canvas, surface, surfaceRaised, surfaceSunken, foreground, mutedForeground, border, input, ring;
  final Color primary, onPrimary, primarySubtle;
  final Color danger, dangerSurface, onDangerSurface, warning, warningSurface, onWarningSurface;
  final Color caution, cautionSurface, onCautionSurface, success, successSurface, onSuccessSurface;
  final Color info, infoSurface, onInfoSurface, offline, offlineSurface, onOfflineSurface;
  final Color ai, aiSurface, onAiSurface, glassFill, glassBorder, qrBackground, qrForeground, takeoverScrim;
  final double glassBlurSigma; // CSS blur(20px) ≈ sigma 10 in Flutter's ImageFilter.blur

  static const light = ShColors(
    canvas: Color(0xFFF3F4F6), surface: Color(0xFFFFFFFF), surfaceRaised: Color(0xFFFFFFFF),
    surfaceSunken: Color(0xFFF9FAFB), foreground: Color(0xFF111827), mutedForeground: Color(0xFF4B5563),
    border: Color(0xFFE5E7EB), input: Color(0xFF7B8494), ring: Color(0xFF2563EB),
    primary: Color(0xFF2563EB), onPrimary: Color(0xFFFFFFFF), primarySubtle: Color(0xFFEFF6FF),
    danger: Color(0xFFDC2626), dangerSurface: Color(0xFFFEF2F2), onDangerSurface: Color(0xFF991B1B),
    warning: Color(0xFFB45309), warningSurface: Color(0xFFFFFBEB), onWarningSurface: Color(0xFF92400E),
    caution: Color(0xFFA16207), cautionSurface: Color(0xFFFEFCE8), onCautionSurface: Color(0xFF854D0E),
    success: Color(0xFF15803D), successSurface: Color(0xFFF0FDF4), onSuccessSurface: Color(0xFF166534),
    info: Color(0xFF0369A1), infoSurface: Color(0xFFF0F9FF), onInfoSurface: Color(0xFF075985),
    offline: Color(0xFFB45309), offlineSurface: Color(0xFFFFFBEB), onOfflineSurface: Color(0xFF92400E),
    ai: Color(0xFF6D28D9), aiSurface: Color(0xFFF5F3FF), onAiSurface: Color(0xFF5B21B6),
    glassFill: Color(0x9EFFFFFF), glassBlurSigma: 10, glassBorder: Color(0x8CFFFFFF),
    qrBackground: Color(0xFFFFFFFF), qrForeground: Color(0xFF000000), takeoverScrim: Color(0xFF7F1D1D),
  );

  static const emergency = ShColors(
    canvas: Color(0xFF000000), surface: Color(0xFF1C1C1E), surfaceRaised: Color(0xFF1C1C1E),
    surfaceSunken: Color(0xFF000000), foreground: Color(0xFFFFFFFF), mutedForeground: Color(0xFFFFFFFF),
    border: Color(0xFF3A3A3C), input: Color(0xFFFFFFFF), ring: Color(0xFFFFD60A),
    primary: Color(0xFFFFFFFF), onPrimary: Color(0xFF000000), primarySubtle: Color(0xFF1C1C1E),
    danger: Color(0xFFFF3B30), dangerSurface: Color(0xFF7F1D1D), onDangerSurface: Color(0xFFFFFFFF),
    warning: Color(0xFFFFD60A), warningSurface: Color(0xFFFFD60A), onWarningSurface: Color(0xFF000000),
    caution: Color(0xFFFFD60A), cautionSurface: Color(0xFF000000), onCautionSurface: Color(0xFFFFD60A),
    success: Color(0xFF30D158), successSurface: Color(0xFF30D158), onSuccessSurface: Color(0xFF000000),
    info: Color(0xFF0A84FF), infoSurface: Color(0xFF0A84FF), onInfoSurface: Color(0xFFFFFFFF),
    offline: Color(0xFFFF9F0A), offlineSurface: Color(0xFFFF9F0A), onOfflineSurface: Color(0xFF000000),
    ai: Color(0xFFFFFFFF), aiSurface: Color(0xFF1C1C1E), onAiSurface: Color(0xFFFFFFFF),
    glassFill: Color(0xFF1C1C1E), glassBlurSigma: 0, glassBorder: Color(0xFF3A3A3C),
    qrBackground: Color(0xFFFFFFFF), qrForeground: Color(0xFF000000), takeoverScrim: Color(0xFF7F1D1D),
  );
  // `dark` and `sunlight` are generated with the same shape from tokens.json.

  @override
  ShColors copyWith({Color? primary /* …one optional param per field… */}) =>
      throw UnimplementedError('generated by tokens:build — do not hand-write');
  @override
  ShColors lerp(ThemeExtension<ShColors>? other, double t) => other is ShColors && t >= 0.5 ? other : this;
  // Deliberately a step instead of a blend: an in-between "pinkish-orange" danger colour must never be painted.
}

extension ShThemeX on BuildContext {
  ShColors get sh => Theme.of(this).extension<ShColors>()!;
}
```

```dart
// lib/core/theme/app_theme.dart
enum ShThemeId { light, dark, emergency, sunlight }

ThemeData buildTheme(ShThemeId id, Locale locale) {
  final c = switch (id) {
    ShThemeId.light => ShColors.light,
    ShThemeId.emergency => ShColors.emergency,
    // ShThemeId.dark / .sunlight → generated constants
    _ => ShColors.light,
  };
  final isAr = locale.languageCode == 'ar';
  final body = isAr ? 'IBMPlexSansArabic' : 'Inter';
  final display = isAr ? 'Cairo' : 'Inter';
  final scheme = ColorScheme(
    brightness: id == ShThemeId.dark || id == ShThemeId.emergency ? Brightness.dark : Brightness.light,
    primary: c.primary, onPrimary: c.onPrimary,
    secondary: c.primarySubtle, onSecondary: c.foreground,
    error: c.danger, onError: c.onPrimary,
    surface: c.surface, onSurface: c.foreground,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.canvas,
    fontFamily: body,
    fontFamilyFallback: const ['Cairo', 'Inter'],
    textTheme: shTextTheme(display: display, body: body, isAr: isAr, emergency: id == ShThemeId.emergency),
    extensions: [c],
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: Size.fromHeight(id == ShThemeId.emergency ? 64 : 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: TextStyle(fontFamily: body, fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.input, width: 1.5)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.input, width: 1.5)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.ring, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.danger, width: 1.5)),
    ),
    cupertinoOverrideTheme: CupertinoThemeData(
      primaryColor: c.primary,
      scaffoldBackgroundColor: c.canvas,
      textTheme: CupertinoTextThemeData(textStyle: TextStyle(fontFamily: body, color: c.foreground)),
    ),
    splashFactory: id == ShThemeId.emergency ? NoSplash.splashFactory : InkSparkle.splashFactory,
  );
}

bool isCupertino(BuildContext context) =>
    const {TargetPlatform.iOS, TargetPlatform.macOS}.contains(Theme.of(context).platform);
```

(`CupertinoThemeData` needs `import 'package:flutter/cupertino.dart';`. `InkSparkle` is Android-only visual polish; on iOS use `NoSplash` and pressed-scale instead, per UI-02 §5.2.)

### 14.4 Lint and CI guards
- **Web:** ESLint rule (custom `no-restricted-syntax` regex) bans hex literals in `components/**` and `app/**` (only `tokens.css` may contain hex); the existing logical-utility rule bans `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right` (role-05 §8).
- **Flutter:** custom lint (`custom_lint` package) bans `Color(0x` outside `lib/core/theme/**`, bans `EdgeInsets.only(left:`/`right:` and non-directional `Alignment` in `lib/features/**`.
- **Glass guard:** `GlassPanel` / `GlassSurface` require a `purpose` enum whose values match the allow-list in §7.3. There is no free-form glass.

### 14.5 Contrast CI (`scripts/tokens-contrast.mjs`)
Reads `tokens.json`, computes WCAG 2.2 relative-luminance ratios for every declared pair (the table in §3.3 is the declared list) in all four modes, and fails CI if any pair drops below its target. The output `design/tokens/contrast-report.md` is committed.

---

## 15. Definition of Done (UI-01)
- [ ] `tokens.json` contains every token in §3–§7 for all four modes; generated `tokens.css` and `tokens.dart` are committed; no hex outside the token files (lint green).
- [ ] The contrast report is green for every pair in §3.3, including the D-UI-02 caution fix.
- [ ] Fonts are bundled (Flutter) / self-hosted (web) and render offline on the emergency card.
- [ ] Every component in §12 has AR (RTL) and EN (LTR) frames in Figma with all states (default, hover/pressed, focus, disabled with reason, loading, error, empty, offline where relevant).
- [ ] Large-Font ×1.15 and ×1.30 verified on Patient Home, Rx detail, the AI chat and the Emergency Card without clipping.
- [ ] Sunlight theme verified on the ER desk in a bright room (photo evidence) and Emergency theme verified outdoors (role-06 sunlight test).
- [ ] Security Lead decision recorded for the `contraindicated` override re-auth proposal (§9.1).
- [ ] Decision log D-UI-01…D-UI-10 reviewed and merged into `docs/` by the Tech Lead (role-07 references updated).

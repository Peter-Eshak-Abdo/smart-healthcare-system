# UI-07 — Edge Cases & Failure States: UI Matrix

> **Owner:** UI/UX (M8) + QA (M8) · **Reviewers:** Security Lead (R1), Backend (R3), AI (R4)
> **Status:** Draft for team review · **Date:** 2026-11-24
> **Source of truth for behaviour:** `02-EDGE-CASES-AND-FAILURE-MODES.md` (E-* IDs). This file defines **what the user sees and does** for each case; it never changes server behaviour. Where the product brief asks for something the specs don't support yet, the row says so and §2 lists the decision needed.
> **Columns:** Trigger & detection → Platform → Surface & layout → Motion & haptics (UI-02) → Copy (UI-03 keys) → Recovery CTA → Security & audit.

---

## 0. Design rules for every failure state

1. **Fail safe for the patient** (02 principle 1): show less, never wrong. A blank field is replaced by an explicit «مش متسجل» / «مش معروف», never omitted.
2. **No silent failure** (02 principle 4): every degraded mode is visible (ribbon, banner, badge) **and** audited where 02 says so.
3. **Always offer the next step:** every error surface has exactly one primary recovery action, plus the safe alternative when one exists.
4. **Danger is calm and static:** red states never animate (no shake, no pulse loops). Only one outline pulse on first appearance for blocking clinical alerts (UI-02 §5.11).
5. **Never leak existence:** wrong patient IDs, duplicate national IDs and duplicate faces never reveal who or whether (E-PRIV-05, US-01-AC4, E-BIO-04).
6. **Emergency is Tier E:** no 3D, no transitions, haptic on result (UI-02 §8.4).

---

## 1. Matrix

### 1.1 Biometric & emergency identification

| # | Edge case (brief) | Spec ID | Trigger & detection | Platform | Surface & layout | Motion & haptics | Copy keys | Recovery CTA | Security & audit |
|---|-------------------|---------|---------------------|----------|------------------|------------------|-----------|--------------|------------------|
| B1 | **Unconscious patient not registered** | E-BIO-01, US-16-AC4 | Top-1 cosine < 0.40 or no templates → `200 {result:"no_match", fallbacks}` | Mobile M-PAR-05; ER desk W-ER-02 | Grey full-height card: title + body; 4-row unknown-patient checklist (tap-to-tick reminders, not stored); 3 stacked 64 dp buttons; temp-record button **only if §2.1 approved** | 0 ms result; `warning` haptic | `er.noMatch.title`, `er.noMatch.body`, `er.noMatch.checklist.*`, `er.noMatch.retry`, `er.noMatch.tempRecord` | Primary: «امسح كارت الطوارئ». Secondary: retry (max 3), national ID | `FACE_IDENTIFY_ATTEMPT` (result no_match, top score); **no session opened**; no image/template stored |
| B2 | **Poor lighting** | E-BIO-02 | On-device luminance < 60 / > 200 | Mobile scanners (all modes); web 2D guide | Hint chip over the camera; rear camera: torch auto-on + chip «شغّلنا الكشاف»; front camera: move-to-light hint | Chip crossfade 150 ms, max one change per 1.2 s; no haptic for hints | `scan.hint.moreLight`, `scan.hint.torchOn`, `scan.hint.backlight` | Torch toggle (64 dp in emergency); after 3 server `BIO_LOW_QUALITY` → fallbacks | None client-side; server logs `BIO_LOW_QUALITY` attempts in `biometric.attempts` |
| B3 | **Face injury / bandages / oxygen mask** | E-BIO-02 | Server hint `remove_obstruction` or repeated low quality | Mobile M-PAR-02 | Chip; emergency copy **never asks to remove medical equipment**; after 3 tries the QR + national-ID buttons are visually emphasised (white outline 3 px) | `warning` on each server failure | `scan.hint.obstruction.emergency`, `scan.retry` | «امسح كارت الطوارئ» | Same as B2; thresholds are **never lowered** to force a match (02) |
| B4 | **Glasses / mask (enrolment, pharmacy)** | E-BIO-02 | Server hint / low quality | Mobile M-PAT-12, M-PHA-06 | Chip with polite request | `warning` on failure | `scan.hint.obstruction.enrol`, `bio.tips.glasses` | Retry | — |
| B5 | **Camera blur** | E-BIO-02 | Laplacian-variance below threshold | Mobile all scanners | Chip «ثبّت الموبايل ثانية»; capture blocked until the gate is green 500 ms | — | `scan.hint.holdSteady` | Wait / manual shutter (emergency) | — |
| B6 | **Multiple faces** | E-BIO-08 | > 1 face, no dominant face → `422 BIO_MULTIPLE_FACES`; dominant → server returns `selected_face_bbox` | Mobile | Chip; when a dominant face was chosen, a thin white box confirms which face was used on the result screen | `warning` | `scan.hint.oneFace.emergency` / `.enrol` | Retry | Attempt logged |
| B7 | **Anti-spoofing (photo / video / screen)** | E-BIO-05/06, US-16-AC5, EXT-03-AC3 | `422 BIO_LIVENESS_FAILED` (PAD < 0.80 or challenge reused) | Mobile (all), web pharmacist | 1st–2nd: amber retry state (non-accusatory). 3rd in 10 min / `security_flag`: **instant red lock screen** (T-14): lock icon, message, camera stopped | Lock: 0 ms, `error` haptic; no animation on red | `scan.liveness.retry`, `scan.locked.staff`, `scan.locked.patient`, `bio.locked` | Staff: «امسح كارت الطوارئ» (emergency) / «رجوع». Patient: «جرّب بعد شوية» / support | `BIO_SPOOF_SUSPECTED` with PAD score; per-actor counter → `security_flag` + admin notification (W-ADM-09) |
| B8 | **Ambiguous / low-confidence match** | E-BIO-03, US-16-AC3 | 0.40 ≤ top-1 < 0.50 or margin < 0.08 → `possible_match` with ≤ 2 candidates (sex + age band only, token 120 s) | Mobile M-PAR-04; ER desk dialog | 90% sheet: 2 candidate cards (sex icon + age band), «ده المريض» per card, «مش حد فيهم», token countdown. Profile afterwards has a **persistent yellow band** | `warning` on result; no other motion | `er.possible.*`, `er.lowConfidence` | «مش حد فيهم» → no-match fallbacks (card QR, national ID) | `confirmed_by_operator = true`; session `low_confidence = true`, top of admin review queue (W-ADM-08) |
| B9 | **Secondary verification (brief: "Fingerprint / National ID")** | SD-01, E-BIO-14 | — | — | **Fingerprint is not offered** for identifying another person (impossible with `local_auth`). Secondary verification = **Emergency Card QR** or **National ID search** (`/v1/emergency/identify/manual`, 5/hour) | — | `er.scan.card`, `er.scan.nationalId`, `er.nationalId.onlyIfHeld` | — | Manual search logged `manual_search`; rate limited |
| B10 | **Offline in ambulance / hospital basement** | E-NET-01, EXT-04 | `connectivity_plus` none or request timeout (8 s connect / 20 s identify) | Mobile M-PAR-06 | Orange OFFLINE ribbon on every screen; scanner replaced by the card-QR scanner; result uses the profile layout + `er.offline.cardBanner`; outbox counter | 0 ms; `success`/`error` on card result | `er.offline.*`, `common.offlineRibbon` | «امسح كارت الطوارئ»; when online: «افتح الجلسة الكاملة» | `offline_card_view` queued in encrypted Hive `audit_outbox`, device-signed, flushed via `POST /v1/emergency/offline-events` |
| B11 | Card QR invalid / expired offline | EXT-04-AC2/3 | Signature fail / `exp` passed | Mobile | Invalid: red banner, content **not** shown. Expired: content shown + red banner (outdated allergy list beats none) | `error` / `warning` | `er.offline.cardInvalid`, `er.offline.cardExpired` | Scan face when online | Logged on flush |
| B12 | Connection drops mid-identify | E-NET-02 | Request error after upload | Mobile | Progress stays; auto-retry with the **same Idempotency-Key**; at 8 s the card button is highlighted | — | `scan.slowNetwork` | Card QR | Same `session_id` on retry (no duplicate sessions) |
| B13 | AI service down during identify | E-BIO-12 | `503 AI_SERVICE_UNAVAILABLE` + `fallbacks[]` | Mobile, ER desk | Scanner hidden; two 64 dp buttons fill the screen | `warning` | `scan.aiDown` | Card QR / National ID | Circuit-breaker event (server) |
| B14 | Identify rate limit | US-16-AC7 | `429 RATE_LIMITED` | Mobile | Red info card | `error` | `er.rateLimited` | Contact supervisor | Admin alert (possible abuse) |
| B15 | Patient deleted face data, then emergency | E-BIO-10 | No template → `no_match` | Mobile | Same as B1 (expected) | — | `er.noMatch.*` | Card QR | — |
| B16 | Session expired | US-17-AC3 | `410 EMERG_SESSION_EXPIRED` | Mobile M-PAR-03, ER desk | Full overlay over the profile: «وقت الجلسة خلص» | 0 ms | `er.session.expired` | «امسح تاني» | Extension once (+30 min with reason) logged |
| B17 | Contacts not shared | US-18-AC2/3, E-PRIV-02 | `403 EMERG_CONTACTS_NOT_SHARED` | Mobile | Call button replaced by a text line | — | `er.profile.noContacts` | — | — |
| B18 | Duplicate face at enrolment | E-BIO-04, EXT-03-AC5 | `409 BIO_ALREADY_ENROLLED` | Mobile M-PAT-12 | Neutral result card, no account hint | `warning` | `bio.duplicate` | «كلّم الدعم» | Admin review ticket |

### 1.2 E-prescription & pharmacy

| # | Edge case (brief) | Spec ID | Trigger & detection | Platform | Surface & layout | Motion & haptics | Copy keys | Recovery CTA | Security & audit |
|---|-------------------|---------|---------------------|----------|------------------|------------------|-----------|--------------|------------------|
| R1 | **Double-dispensing / race blocked** (already fully dispensed elsewhere) | E-RX-02, US-12-AC3/AC5 | Verify → `already_dispensed` or dispense → `409 RX_ALREADY_DISPENSED` | Web W-PHA-01r/02, mobile M-PHA-02 | Grey result header + seal `alreadyDispensed`: «اتصرفت بالكامل يوم {date} في {pharmacy}» with **timestamp and pharmacy status** | Crossfade 150 ms; `warning` | `rx.alreadyDispensed` | «امسح روشتة تانية» | Server row locks + CHECK; attempt audited |
| R2 | Race on a partial remainder | E-RX-02 | `409 RX_QUANTITY_EXCEEDED` | Web, mobile | Table/sheet rows refresh; changed cells flash once (1200 ms amber fade); banner on top | `warning` | `dispense.race` | Review → «اصرف» again | Same |
| R3 | Lease held by another pharmacy | US-12-AC6 | `409 RX_LEASE_HELD` | Web, mobile | Amber `LeaseBanner` with «كمّل برضه» (confirm dialog) | — | `dispense.lease.held`, `dispense.lease.proceed` | Proceed anyway | Informational only; correctness from locks |
| R4 | Double click / app restart | E-RX-03, E-NET-04 | Same/different idempotency key | Web, mobile | Button locks on first press; `dispense.confirming`; key persisted until a definitive response | MorphButton loading | `dispense.confirming` | — | Same key → same result |
| R5 | **Partial dispensing** (2 of 3 in stock) | E-RX-01, US-12-AC2 | Pharmacist sets an item to 0 / «مش متوفر عندي» | Web W-PHA-02, mobile M-PHA-03 | Per-item toggles «اتصرف» / «لسه متبقّي»; steppers max = remaining; footer note with remaining balance and expiry; primary «اصرف ٢ من ٣» | Success: badge morph «قيد الصرف» → «اتصرف جزء منها»; `success` | `dispense.itemDispense`, `dispense.itemRemaining`, `dispense.partialNote`, `dispense.successPartial`, `rx.status.partially_dispensed` | — | `RX_DISPENSED` per dispensation; patient app shows `rx.remainingAnywhere` |
| R6 | Controlled drug partial rule | E-RX-13 | Server `409 VALIDATION_FAILED (controlled_partial_rule)` | Web, mobile | Inline rule note on the item + blocked stepper | `error` | `dispense.controlledRule` | — | — |
| R7 | **Drug–drug interaction (moderate)** | EXT-01, E-CLIN-07 | Check returns `moderate` | Web W-DOC-07 | Yellow collapsible banner in the safety panel; yellow dot on the row; **non-blocking** | Height expand 200 ms | `alert.drugDrug.*`, `alert.severity.moderate` | — | Stored as alert (no override needed) |
| R8 | **Drug–drug interaction (major)** | EXT-01-AC1 | `major` | Web | Orange banner, **blocks** Sign & Issue until override; row bar orange; one outline pulse on first appearance | Pulse once 600 ms | `alert.drugDrug.*`, `rx.overrideRequired` | «وثّق سبب التجاوز» → override dialog | `ALERT_OVERRIDDEN` (severity, rule ID, no free text in the log) |
| R9 | **Drug–allergy conflict (critical / contraindicated)** | EXT-02-AC1, E-CLIN-01 | `contraindicated` `drug_allergy` | Web | Red banner + red row outline; **blocks**; override dialog (reason radio + justification ≥ 15 chars/3 words + responsibility checkbox) **+ TOTP re-auth for contraindicated** (brief: "biometric/PIN"; web has no device biometric in MVP → TOTP; pending §2.2) | Pulse once; dialog T-09 | `alert.drugAllergy.*`, `override.*`, `override.contraindicatedReauth` | Save override → re-auth → banner collapses to «اتوثّق» | Override stored on `clinical_alerts`; `ALERT_OVERRIDDEN`; pharmacist sees `rx.verify.overrideNote` |
| R10 | Cross-reactivity (cephalosporin vs penicillin) | EXT-02-AC2 | `moderate` | Web | Yellow banner | — | `alert.crossReactivity.title` | — | — |
| R11 | Override without reason / junk text | E-CLIN-02 | Client validation; server `422 RX_ALERT_OVERRIDE_REQUIRED` | Web | Save disabled with counter; server rejection highlights the alert again | — | `override.justificationTooShort` | — | — |
| R12 | New alert at issue time (allergy added meanwhile) | E-CLIN-03, US-08-AC4 | `422 RX_ALERT_OVERRIDE_REQUIRED` with new keys | Web | New banner pinned at the top with a "new" tag; bar re-blocks; focus moves to it | Pulse once | `signIssue.serverNewAlert` | Document override | Server authoritative |
| R13 | Safety engine unavailable | E-CLIN-04, EXT-01-AC4 | `checks_status = unavailable` | Web | Grey banner + attestation checkbox (blocking until ticked) | — | `rx.checkUnavailable`, `rx.manualReviewAttest` | Tick attestation | `SAFETY_CHECK_BYPASSED`; pharmacist sees `rx.verify.checkBypassed`; later re-check notifies the prescriber |
| R14 | Uncoded allergy | E-CLIN-05, EXT-02-AC4 | Allergy `other` text | Web | Permanent moderate banner on every Rx for that patient; «كوّدها» CTA in the profile | — | `alert.uncodedAllergy` | Code it | — |
| R15 | Drug not in catalogue | E-CLIN-06 | No search result | Web | Combobox empty state + «اطلب إضافته» | — | `rxb.notInCatalog` | Request drug (admin queue) | `app.drug_requests` |
| R16 | **Expired prescription** | E-RX-07 | Verify `409 RX_EXPIRED` / `expired` | Web, mobile; patient app | Pharmacist: grey header + seal `expired`, dispense **not offered**. Patient: card greyed with stripes, no pickup button | Crossfade; `warning` | `rx.verify.expired`, `rx.status.expired` | Patient: «احجز مع دكتورك» (hint) | Audited verify |
| R17 | **Cancelled prescription** | E-RX-08, US-03-AC5 | `RX_CANCELLED` / status `cancelled` | Web, mobile | Grey seal band «اتلغت»; reason category shown to patient | `warning` | `rx.verify.cancelled`, `rx.cancelledReason.*` | — | `RX_CANCELLED` |
| R18 | Cancel vs dispense race | E-RX-08 | Whichever commits first | Web | Doctor: `rx.cancel.remainingOnly` or 409 already dispensed; pharmacist: cancelled result | — | `rx.cancel.*` | — | — |
| R19 | **Forged / altered prescription** | E-RX-05/06, US-10-AC2 | Local signature fail or `RX_SIGNATURE_INVALID` (incl. `payload_mismatch`) | Web, mobile | **Full-page red takeover**, static cracked seal, big «ماتصرفهاش» | 0 ms; `error` | `rx.doNotDispense`, `rx.doNotDispenseBody` | «بلّغ عن الروشتة» | `RX_VERIFY_FAILED (reason)`; 3 forged/hour/pharmacy → admin alert; payload mismatch = critical security alert |
| R20 | **Revoked prescriber licence** | E-LIC-02, US-10-AC3 | `prescriber_invalid` | Web, mobile | Red header, seal `prescriberInvalid`; no dispense | `error` | `rx.verify.prescriberInvalid` | — | Patient notified `notif.rxPrescriberInvalid` |
| R21 | Suspended prescriber (after issue) | E-LIC-02 | Valid + suspension after `issued_at` | Web, mobile | Green + amber info banner | `success` | `rx.verify.prescriberSuspendedInfo` | Continue | — |
| R22 | **Revoked / suspended doctor or pharmacist (own account)** | E-LIC-01/03/04, US-21-AC2 | `403 LICENSE_NOT_VALID` / `ACCOUNT_SUSPENDED` within ≤ 30 s | Web, mobile | **Account locked screen**: centred card, illustration, status-specific body, only «كلّم الإدارة» + «خروج». Drafts are discarded locally after the user acknowledges | 0 ms | `lock.license.*`, `lock.suspended.*`, `lock.contactAdmin` | Contact admin (mailto, no PHI) | Session epoch bump; refresh tokens revoked |
| R23 | Licence pending / expiring | US-21-AC1, E-LIC-04 | `pending` / reminders 30/7/1 days | Web | Pending: lock card. Expiring: amber banner in the TopBar | — | `lock.license.pending`, `license.reminder` | — | — |
| R24 | Pickup token expired / reused | US-03-AC4, E-RX-09 | `401 PICKUP_TOKEN_INVALID` / local countdown 0 | Mobile (patient), pharmacist | Patient: QR blurs + new-code button. Pharmacist: amber «اطلب كود جديد» | `warning` | `pickup.expired`, `pickup.new`, `err.pickup.invalid` | New code (step-up) | Single-use token consumed on dispense |
| R25 | Patient has no phone | E-RX-10 | Manual path | Web, mobile | Rx + code → presence (SMS / face) | — | `verify.manual.*`, `presence.*` | — | `verification_method` recorded |
| R26 | Pharmacy offline | E-NET-03, SD-06 | No connection | Web, mobile | Ribbon; authenticity works; Dispense disabled with the reason under it | — | `pharmacy.offline`, `dispense.offlineDisabled` | Reconnect | No offline dispensing by design |
| R27 | Verification context expired (15 min) | US-11-AC3 | Ring 0 / `403` | Web, mobile | Overlay on the dispense table | — | `dispense.contextExpired` | «امسح تاني» | — |

### 1.3 AI medical assistant

| # | Edge case (brief) | Spec ID | Trigger & detection | Platform | Surface & layout | Motion & haptics | Copy keys | Recovery CTA | Security & audit |
|---|-------------------|---------|---------------------|----------|------------------|------------------|-----------|--------------|------------------|
| A1 | **Red-flag urgent symptoms** (chest pain, stroke, severe breathing) | E-AI-01, US-15-AC1/2 | Deterministic rules **before** the LLM; or LLM says emergency (union, never downgrade) | Mobile M-PAT-14E | **Full-screen red takeover** (#7F1D1D, white): title, body, 72 dp «اتصل بالإسعاف ١٢٣», nearest ER, notify family, while-waiting advice; close locked 5 s | **0 ms** (T-13), `error` haptic once, no orb/3D | `emergency.takeover.*`, `emergency.callNow`, `emergency.nearestEr`, `emergency.notifyFamily`, `emergency.whileWaiting`, `emergency.closeLocked` | Call 123 (`tel:{EMERGENCY_PHONE_NUMBER}`) | `ASSISTANT_RED_FLAG` with rule ID, **no message text** |
| A2 | Self-harm / suicide disclosure | E-AI-02, US-15-AC3 | Crisis rule | Mobile M-PAT-14C | Calm full screen (blue/teal), supportive text, crisis line from `ref.crisis_resources`, 123, trusted person | Slow or static, **no haptic** | `crisis.*` | «كلّم خط الدعم النفسي» | Rule ID only; generative output off unless the user continues |
| A3 | Urgent (24 h) | E-AI-10 | Triage `urgent` | Mobile | Amber card in the chat + specialty chip; orb `urgent` | Orb transition `spring.orb` | `triage.urgent` | «شوف دكاترة {specialty}» (P2 directory) | — |
| A4 | **Vague / incomplete symptoms** | US-14-AC3 | Assistant asks clarifying questions (≤ 3) | Mobile | Quick-reply **chip groups** under the last card: since / severity / where / fever; tapping sends the chip text | Chips stagger in 30 ms | `assistant.clarify.intro`, `assistant.chip.*` | Tap a chip or type | — |
| A5 | **Mandatory non-diagnosis guardrail** | US-13-AC1/3, E-AI-03 | Always | Mobile | **Permanent, non-dismissible** banner at the top of the chat (info style, 2 lines max); every guidance card ends with the specialty, never a diagnosis | — | `assistant.disclaimer` | — | Validator blocks diagnosis/dose text (server) |
| A6 | Hallucination blocked twice | E-AI-03 | Validator fails twice | Mobile | Safe template card + rule-based specialty | — | (server template) + `assistant.specialty` | — | Validator event |
| A7 | **AI service down / timeout** | E-AI-07, US-13-AC4 | `503` / `504` / 6 s timeout + 1 retry | Mobile | Inline card `assistant.unavailable`; orb static grey; [«اختار التخصص بنفسك»] → specialty directory sheet; the red-flag engine still runs | Orb freezes (no loop) | `assistant.unavailable`, `assistant.fallback.*`, `assistant.state` (unavailable label) | Manual specialty directory | — |
| A8 | Prompt injection / drug seeking | E-AI-04 | Validator / refusal template | Mobile | Normal assistant card with refusal text | — | `assistant.drugSeeking` | — | — |
| A9 | Off-topic / abusive | E-AI-05 | 5 abusive messages | Mobile | Composer disabled with reason; banner | — | `assistant.offTopic`, `assistant.closed` | Wait 1 h | — |
| A10 | PII typed into chat | E-AI-06 | Scrubber (server) | Mobile | Input hint warns in advance | — | `assistant.inputHint` | — | Scrubbed before provider call |
| A11 | Minor account | E-AI-09, US-01-AC7 | `is_minor` | Mobile | Tab shows an info screen instead of the chat | — | `assistant.minor` | — | — |
| A12 | Asks about own meds | E-AI-08 | — | Mobile | Card with the general answer + suggestion | — | `assistant.ownRecord` | — | — |

### 1.4 Security, privacy & general UX

| # | Edge case (brief) | Spec ID | Trigger & detection | Platform | Surface & layout | Motion & haptics | Copy keys | Recovery CTA | Security & audit |
|---|-------------------|---------|---------------------|----------|------------------|------------------|-----------|--------------|------------------|
| S1 | **RBAC denied: paramedic tries non-emergency data** | US-17-AC5, GC-2 | No route exists in the app; a crafted call → `403 RBAC_FORBIDDEN` | Mobile | No UI path. If reached (deep link): full-screen card | — | `err.rbac` | «رجوع» | `ACCESS_DENIED` |
| S2 | **Doctor opens a patient without a grant** | US-06-AC2, US-09-AC3, E-PRIV-05 | `403 ACCESS_GRANT_REQUIRED` or `404` (guessed UUID) | Web | Redirect to search with toast; guessed IDs → generic 404 page (never "exists but forbidden") | — | `err.grant`, `err.notFound`, `doctor.search.noResults` | «افتح ملف بكود» | `ACCESS_DENIED`; 404 prevents enumeration |
| S3 | **Doctor "break-glass" (brief)** | — (not in MVP) | — | — | **Doctors have no break-glass in the current specs.** Emergency access is the paramedic/ER-desk flow (hospital ER staff use the `paramedic` role on the ER console). `grant_type = admin_override` exists in 00-INDEX but has no defined flow. See §2.3 | — | — | — | — |
| S4 | Grant revoked during a doctor session | US-20-AC3, E-PRIV-03 | Next request `403 ACCESS_GRANT_REQUIRED` | Web | Redirect to search + toast | — | `grant.revokedRedirect` | — | `ACCESS_REVOKED` |
| S5 | **Break-glass audit notification to patient** | US-17-AC4, EXT-06 | Emergency profile read | Mobile M-PAT-16 | Push (service + time only) → detail screen: who, when, method, exact data viewed, review notice, «مكنتش في طوارئ؟ بلّغنا» | — | `breakGlass.*`, `notif.breakGlass` | Report | `EMERGENCY_PROFILE_READ`; report → support ticket + audit event |
| S6 | **Session timeout mid-form** | role-05 §4.3, E-NET-06 | Idle 15 min (doctor/pharmacist), 10 min (admin); token expiry | Web; mobile staff | 60 s warning dialog → overlay at z 100 over the **still-mounted page** with `ReauthDialog` (TOTP web / Face ID mobile staff) and «اللي كتبته محفوظ» | Overlay fade 250 ms | `session.warning`, `session.stay`, `reauth.*` | Re-auth → continue exactly where they were | Rx draft persisted only as drug IDs + patient ID in `sessionStorage`; restore prompt next login (`draft.restore`) |
| S7 | Refresh token reuse / revoked everywhere | E-AUTH-02, US-19-AC4 | `401 AUTH_SESSION_REVOKED` | Web, mobile | Login screen with an explanation banner | — | `session.revoked` | Log in | Session family revoked |
| S8 | Device lost / biometrics changed | E-AUTH-03/04 | Revoked device / key invalidated | Mobile | Step-up fails → re-register flow (password + OTP) | `warning` | `stepUp.keyChanged`, `settings.revokeDevice` | Re-register | `session_epoch++` |
| S9 | No device biometrics | E-AUTH-05 | `local_auth` reports none | Mobile | Patients: device PIN prompt; staff: TOTP instead | — | `stepUp.noBiometrics`, `stepUp.staffNeedsBiometric` | — | — |
| S10 | Credential stuffing | E-AUTH-07 | 3+ failures | Web, mobile | CAPTCHA + throttle countdown | — | `login.throttled`, `login.captcha` | Wait | IP throttling |
| S11 | Concurrent edit of an encounter | E-REC-03 | `409 CONFLICT_VERSION` | Web | Diff dialog (theirs/yours) | — | `encounter.conflict` | «أعد تعديلي» | — |
| S12 | Restricted record + safety check | E-PRIV-07, US-20-AC2 | Alert involves a restricted med | Web | Alert text names "an active medication from a restricted record" | — | `rxb.alerts.restrictedMed`, `privacy.restricted` | — | Record not displayed |
| S13 | Admin self-action / two-person rule | US-21-AC3, E-LIC-06 | Own account / admin creation | Web | Disabled menu items with tooltip; pending-approval badge | — | `admin.users.selfAction`, `admin.users.pendingApproval` | Ask another admin | Audited before/after |
| S14 | Audit chain broken | EXT-05-AC3, E-OPS-02 | Nightly job mismatch | Web | Red chain badge + page banner with event #N | — | `admin.audit.chainBroken` | Open event | Critical alert |
| S15 | Account deletion | E-PRIV-06 | User request | Mobile | ⚖ explanation sheet, step-up, typed confirmation | — | `settings.deleteAccountBody` | — | Templates/chat/contacts deleted; records retained |

### 1.5 Standard states for every screen (brief §4)

| State | Rule | Web | Mobile | Copy |
|-------|------|-----|--------|------|
| **First-time onboarding** | Patient: M-PAT-01 → 03 (+ text size first). Staff: MFA enrolment then a 3-card "what's here" tour (dismissible, never on Emergency screens) | W-AUTH-02 + tour | M-PAT-01/03; paramedic M-PAR-01 | `onb.*`, `mfa.enroll.*` |
| **Skeleton loaders** | After 300 ms; shapes match the final layout; shimmer static in RM; **never** on Emergency screens | `Skeleton` | `Skeleton` (ShaderMask) | — |
| **Empty states** | Illustration + one sentence + one CTA; no blame | §10.8 | §10.8 | `history.empty.*`, `rx.empty.*`, `contacts.empty.*`, `access.empty`, `doctor.empty.*` |
| **Validation errors** | Inline after blur; border + icon + message; summary banner on submit for long forms; focus first invalid | `FormMessage` | `TextFormField` error | `err.validation` + field messages |
| **Large-Font accessibility** | ×1.15 / ×1.30 reflow; no truncation of clinical text; targets never shrink | `data-font-scale` | `TextScaler` + reflow | `settings.textSize`, `onb.fontSize.*` |
| **High-contrast Sunlight / ER mode** | Sunlight theme (light AAA) and Emergency theme (black AAA) | `data-theme=sunlight` (ER desk default) | Emergency theme auto in paramedic mode; Sunlight toggle on the emergency card | `settings.theme.sunlight`, `card.outdoorMode` |
| **Offline** | Ribbon + cached copy or offline empty state; network-only actions disabled with reasons | `OfflineRibbon` | `OfflineBanner` | `common.offlineRibbon` |
| **Error (server)** | `ProblemView` with code-driven copy + request ID for 500 | `ProblemAlert` | `ProblemView` | §3.18 of UI-03 |

---

## 2. Decisions & Scope Changes Needed (team / Security Lead)

### 2.1 Temporary ER intake record for an unregistered unconscious patient (brief B1) — **scope change**
- **Current spec:** E-ID-05 marks this **out of scope for v1 (Could)**; a `no_match` opens no session.
- **Brief asks:** "instant fallback flow: create temporary ER intake record".
- **Proposal (only if approved):**
  - New table `app.er_intake_records` (needs a PR to `00-INDEX.md` §5.3 first, reviewed by the Security Lead and DB Engineer, per ANTIGRAVITY-RULES): `id`, `temp_label` («مجهول #3»), `facility_id`, `created_by`, `created_at`, `sex_observed`, `age_band_estimated`, `arrival_method`, `status` (`open`, `merged`, `closed`), `merged_patient_id`. **No face image, no template.**
  - New endpoints (03 contract change): `POST /v1/emergency/intake`, `POST /v1/admin/intake/{id}/merge` (two-person rule, audited).
  - UI: «افتح ملف طوارئ مؤقت» on M-PAR-05/W-ER-02 → a 3-field sheet (sex observed, estimated age band, note-free) → card on the ER board «مجهول #3 — اعتبر تاريخه الطبي مش معروف». Admin merge screen later.
- **Until approved:** the button is hidden behind `FEATURE_ER_INTAKE=false`; UI-04 F-E2 marks it as a dashed (pending) branch.

### 2.2 Re-auth for overriding a `contraindicated` alert
Brief: "mandatory clinical reason + biometric/PIN". Specs: TOTP re-auth only when `auth_time` > 15 min. **Proposal:** always ask for TOTP on `contraindicated` overrides (web has no device biometric in MVP). Needs Security Lead approval and a backend change (`AUTH_STEP_UP_REQUIRED` with `detail: reauth_totp` on that path).

### 2.3 Doctor break-glass
Not in MVP. Options: (a) keep as is (recommended for the graduation scope: ER doctors use the ER console with the paramedic role); (b) design an `admin_override` grant flow (patient notified, mandatory reason, 24 h, reviewed). Needs Tech Lead decision.

### 2.4 Web face mesh (MediaPipe) CSP
UI-02 §3: default is the 2D guide on web; MediaPipe needs `'wasm-unsafe-eval'` on pharmacy routes. Security Lead decision.

### 2.5 Passkeys on web login
Designed (W-AUTH-01) and hidden behind a flag. Security Lead decision.

### 2.6 iOS Live Activities, lock-screen widget, proxy pickup
Designed as P2 (UI-04 §3.4, UI-06 M-PAT-08). Need native extensions; Mobile lead decision.

### 2.7 Fingerprint as secondary verification (brief)
**Rejected by spec (SD-01, E-BIO-14).** Replaced with Emergency Card QR + National ID search (B9). Listed here so nobody re-adds it.

---

## 3. QA Mapping

Each row above becomes at least one test named after its spec ID (ANTIGRAVITY core rule): widget/golden tests for every surface (mobile), Playwright tests for every web surface (with `reducedMotion: 'reduce'` variants), and manual tests for camera/haptics/sunlight. The row number (B1, R9, A1 …) is added to the test description for traceability, e.g. `E-BIO-03 [B8] possible match shows only sex and age band`.

## 4. Definition of Done (UI-07)
- [ ] Every row has Figma frames (AR + EN) and its copy keys exist in UI-03.
- [ ] Every row is covered by a test that references its spec ID.
- [ ] Decisions §2.1–§2.7 recorded (approved / rejected) in the decision log before Stage 5.

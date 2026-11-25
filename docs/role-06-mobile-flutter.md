# Role 06 — Mobile Engineer (Flutter · Dart · Riverpod)

**Owner:** M7 · **Users:** Patients (primary), Paramedics (Emergency mode), Pharmacists (Pharmacy mode)
**Contracts:** `03` · **Design:** `role-07` · **Security:** `role-01 §5.3` (device-bound step-up), `§11.2 P16`

---

## 1. Responsibilities
1. One Flutter app with three role-based modes chosen by `GET /v1/me` after login: **Patient**, **Emergency (paramedic)**, **Pharmacy (pharmacist)**.
2. Camera face capture with on-device quality gating and active-liveness prompts.
3. Device-bound biometric step-up (`local_auth` + hardware key) and device registration.
4. Emergency High-Contrast mode, offline emergency card (patient side) and offline card verification (paramedic side).
5. Patient AI chatbot UI with red-flag emergency takeover.
6. Pharmacist QR and biometric dispensing flow.
7. Arabic RTL + English, accessibility, secure local storage.

## 2. Stack (pin versions at Stage 0 and record them in `pubspec.lock`)

| Concern | Package |
|---------|---------|
| State / DI | `flutter_riverpod` + `riverpod_annotation`/`riverpod_generator` |
| Routing | `go_router` (redirects driven by an auth/role provider) |
| HTTP | `dio` (+ interceptors) |
| Models | `freezed` + `json_serializable` (or generated from OpenAPI, see 03 §15) |
| Auth | `supabase_flutter` (**Auth only**: sign-in, OTP, TOTP MFA, refresh) |
| Device biometrics | `local_auth` |
| Hardware-backed key | A Keystore/Secure-Enclave signing plugin with biometric gating (e.g. `biometric_signature`; verify maintenance at Stage 0), else a small platform channel (`android/…/DeviceKeyPlugin.kt`, `ios/…/DeviceKeyPlugin.swift`) |
| Secure storage | `flutter_secure_storage` (Keychain / EncryptedSharedPreferences) |
| Local cache | `hive_ce` + `hive_ce_flutter` (maintained Hive fork) with `HiveAesCipher` |
| Camera | `camera` |
| On-device face analysis | `google_mlkit_face_detection` (classification + landmarks + head Euler angles) |
| QR scan / render | `mobile_scanner` / `qr_flutter` |
| Crypto (offline JWS verify) | `cryptography` (Ed25519) |
| Connectivity | `connectivity_plus` |
| Calls | `url_launcher` (`tel:` links) |
| Image compression | `flutter_image_compress` |
| i18n | `flutter_localizations` + `intl` (ARB files) |
| Screenshot protection | `FLAG_SECURE` via platform channel / `screen_protector` |
| Testing | `flutter_test`, `mocktail`, `integration_test`, `patrol` (optional, for native dialogs) |

## 3. Architecture: Feature-first Clean Architecture

```text
mobile-app/
├── pubspec.yaml
├── analysis_options.yaml              # very_good_analysis or flutter_lints + custom rules
├── l10n.yaml   lib/l10n/{app_ar.arb, app_en.arb}
├── android/  ios/                     # FLAG_SECURE, cleartext disabled, camera/biometric permissions
└── lib/
    ├── main.dart                      # bootstrap(env) → ProviderScope(child: App())
    ├── bootstrap.dart                 # Supabase.initialize, Hive init (encrypted), error zones
    ├── app.dart                       # MaterialApp.router, theme, locale, directionality
    ├── core/
    │   ├── config/ env.dart           # --dart-define: API_BASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, EMERGENCY_PHONE
    │   ├── network/
    │   │   ├── dio_provider.dart
    │   │   ├── interceptors/ { auth_interceptor.dart, request_id_interceptor.dart,
    │   │   │                   client_header_interceptor.dart, problem_interceptor.dart, idempotency.dart }
    │   │   └── api_exception.dart     # ProblemDetails → sealed ApiException (code-driven)
    │   ├── security/
    │   │   ├── device_key_service.dart      # create/sign with biometric-bound key
    │   │   ├── step_up_service.dart         # challenge → local_auth → sign → step_up_token
    │   │   ├── secure_screen.dart           # FLAG_SECURE toggling
    │   │   └── jws_verifier.dart            # Ed25519 JWS verify against cached JWKS
    │   ├── storage/ { secure_store.dart, hive_boxes.dart }
    │   ├── connectivity/ connectivity_provider.dart
    │   ├── router/ app_router.dart          # role-based shells & guards
    │   ├── theme/ { app_theme.dart, emergency_theme.dart, tokens.dart }   # from role-07 tokens
    │   └── widgets/ { problem_view.dart, offline_banner.dart, countdown.dart, primary_button.dart }
    └── features/
        ├── auth/            { data/, domain/, presentation/ (login, otp, mfa, device_registration) }
        ├── onboarding/      { … national ID, DOB, sex, blood type, consents }
        ├── home/            # patient home
        ├── medical_history/
        ├── prescriptions/   # list, detail, pickup token QR
        ├── critical_info/
        ├── emergency_contacts/
        ├── emergency_card/  # patient: fetch/cache/show card; lock-screen quick action
        ├── biometrics/      # face enrolment (consent → challenge → capture → result)
        ├── access_control/  # share codes, grants, access log
        ├── assistant/       # chatbot
        ├── emergency/       # paramedic mode: scan, results, profile, contacts, offline QR
        ├── pharmacy/        # pharmacist mode: scan, verify, presence, dispense
        └── settings/        # language, security (devices, logout-all), about
```

Each feature contains:
```text
feature_x/
├── data/
│   ├── feature_x_api.dart           # dio calls, DTOs (freezed) ↔ JSON
│   └── feature_x_repository_impl.dart
├── domain/
│   ├── entities/                    # pure Dart
│   ├── feature_x_repository.dart    # abstract
│   └── usecases/                    # one class per action (optional for trivial features)
└── presentation/
    ├── providers/                   # @riverpod controllers (AsyncNotifier)
    ├── screens/
    └── widgets/
```

Rules: presentation → domain ← data. Widgets never call `dio` directly. Errors cross layers as a sealed `ApiException` or `Failure`, never raw `DioException`.

## 4. Routing & Modes

```dart
final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authStateProvider);          // signedOut | needsOtp | needsMfa | needsOnboarding | ready(me)
  return GoRouter(
    refreshListenable: auth.listenable,
    redirect: (ctx, state) => switch (auth.value) {
      SignedOut() => state.matchedLocation.startsWith('/auth') || state.matchedLocation == '/card' ? null : '/auth/login',
      NeedsMfa() => '/auth/mfa',
      NeedsOnboarding() => '/onboarding',
      Ready(:final me) => guardByRole(me.role, state.matchedLocation),   // /p/*, /er/*, /rx/*
      _ => null,
    },
    routes: [
      GoRoute(path: '/card', builder: (_, __) => const OfflineEmergencyCardScreen()),  // no login needed (own card)
      ShellRoute(builder: patientShell, routes: [/* /p/home, /p/history, /p/prescriptions, /p/assistant, … */]),
      ShellRoute(builder: emergencyShell, routes: [/* /er/scan, /er/profile/:sid, /er/contacts/:sid, /er/offline */]),
      ShellRoute(builder: pharmacyShell, routes: [/* /rx/scan, /rx/verify, /rx/dispense/:id */]),
    ],
  );
});
```

Staff roles (paramedic, pharmacist) require TOTP MFA (`aal2`) at login. A doctor or admin who logs into the app sees a "Please use the web portal" screen.

## 5. Networking

```dart
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._supabase);
  final SupabaseClient _supabase;
  @override
  Future<void> onRequest(RequestOptions o, RequestInterceptorHandler h) async {
    var session = _supabase.auth.currentSession;
    if (session != null && session.isExpired) session = (await _supabase.auth.refreshSession()).session;
    if (session != null) o.headers['Authorization'] = 'Bearer ${session.accessToken}';
    o.headers['X-Device-Id'] = await DeviceId.get();
    h.next(o);
  }
  @override
  Future<void> onError(DioException e, ErrorInterceptorHandler h) async {
    if (e.response?.statusCode == 401 && e.requestOptions.extra['retried'] != true) {
      final refreshed = await _supabase.auth.refreshSession().then((r) => r.session).catchError((_) => null);
      if (refreshed != null) {
        final req = e.requestOptions..extra['retried'] = true
          ..headers['Authorization'] = 'Bearer ${refreshed.accessToken}';
        return h.resolve(await Dio().fetch(req));
      }
      await _supabase.auth.signOut();
    }
    h.next(e);
  }
}
```

- Timeouts: connect 8 s, receive 15 s (20 s for `/emergency/identify`).
- `ProblemInterceptor` converts `application/problem+json` into `ApiException(code, status, detail, errors)`.
- `Idempotency-Key`: requests built through `IdempotentCall(scope)` persist the key in memory (and in `flutter_secure_storage` for dispense, E-NET-04) until a definitive response.

## 6. Implementation Details

### 6.1 Camera face capture (enrolment, pharmacy 1:1, emergency identify)

**Pipeline on device:**
1. `CameraController` (front camera for enrolment/self-verify; **rear** camera by default in Emergency mode with a flip button), `ResolutionPreset.high`, `ImageFormatGroup.nv21` (Android) / `bgra8888` (iOS).
2. Stream frames to `FaceDetector(options: FaceDetectorOptions(enableClassification: true, enableLandmarks: true, performanceMode: FaceDetectorMode.fast, minFaceSize: 0.25))`, throttled to one frame every 150 ms.
3. **Quality gate** (role-04 §4.4 and E-BIO-02): exactly one face; box ≥ 25% of frame width; |headEulerAngleY| ≤ 30°, |headEulerAngleX| ≤ 25° (neutral frames); average luminance from the Y plane in [60, 200]. Show the live hint chip; auto-enable the torch when luminance < 60 (rear camera).
4. **Active challenge** (enrolment/pharmacy): `GET /v1/biometric/challenge` → sequence, e.g. `["blink","turn_left"]`. For each step, show an animated instruction and wait for the ML Kit signal:
   - `blink`: `leftEyeOpenProbability` and `rightEyeOpenProbability` < 0.2, then > 0.7 within 1.5 s
   - `turn_left`/`turn_right`: `headEulerAngleY` beyond ±20° (sign per platform, mirrored for the front camera)
   - `smile`: `smilingProbability` > 0.8

   Capture a still (`takePicture()`) at the neutral start and at each action peak → 3–5 frames.
5. **Emergency identify:** no challenge. Capture a burst of 3 stills 300 ms apart once the quality gate is green for 500 ms (auto-capture), or on a manual shutter tap.
6. Compress each frame with `flutter_image_compress`: longest side 640 px (identify) / 800 px (enrol), JPEG q=80, ≤ 200/300 KB. Strip EXIF.
7. Send multipart with `client_signals` (`blink_detected`, `yaw_deltas`, `capture_ms`). Delete temp files immediately after upload (`File.delete()` in `finally`).

**Permissions UX:** request camera permission in context with a rationale screen. If denied → explain and link to settings. In Emergency mode, show the QR and manual-search alternatives right away.

### 6.2 Fingerprint / `local_auth` + device-bound key (step-up)

```dart
class StepUpService {
  Future<String> obtain(StepUpPurpose purpose) async {
    final deviceId = await DeviceId.get();
    final ch = await _api.challenge(deviceId: deviceId, purpose: purpose);            // nonce (60 s)
    final message = utf8.encode('SH-STEPUP-v1\u0000') + base64.decode(ch.nonceB64)
        + utf8.encode('\u0000${purpose.wire}\u0000$deviceId');
    // Biometric prompt is shown BY THE KEYSTORE when the private key is used (userAuthenticationRequired).
    final signature = await _deviceKey.sign(message,
        promptTitle: l10n.stepUpTitle, promptSubtitle: l10n.stepUpReason(purpose));    // throws on cancel/lockout
    final res = await _api.verify(challengeId: ch.challengeId, signatureB64: base64.encode(signature));
    return res.stepUpToken;                                                              // 5 min
  }
}
```

- **Device registration** (after first login + OTP): `deviceKey.createIfAbsent(alias: 'sh_device_key', biometricOnly: role != patient, invalidateOnEnrollment: true)` → `POST /v1/auth/devices` with the SPKI public key.
- **Fallback** (E-AUTH-05): if the device has no biometrics, patients may use the device credential (PIN/pattern). `local_auth` with `biometricOnly: false` gates a key that allows device credentials. Staff must have biometrics or re-enter TOTP.
- **Key invalidated** (new fingerprint enrolled, E-AUTH-04): catch `KeyPermanentlyInvalidatedException` (Android) / `errSecItemNotFound` (iOS) → re-register the device after password + OTP.
- **Never** describe this to users as "fingerprint identification". The UI copy is "Confirm it's you".

### 6.3 Emergency High-Contrast Mode

- Activated automatically in paramedic mode. Patients can trigger it from the "Emergency card" quick action.
- `emergency_theme.dart`: background `#000000`, primary text `#FFFFFF`, danger blocks `#FF3B30` on black with white text (contrast ≥ 7:1), warning `#FFD60A` on black. Minimum font 20 sp (body), 28 sp (headings), 40 sp (blood type). Bold weight. No light-grey text.
- Layout: one column, no scroll needed for the critical block on a 6" screen. Order: **Allergies (anaphylaxis first)** → **Blood type** → **Chronic conditions** → **Current meds** → big **Call contact** button → session timer.
- Touch targets ≥ 64 dp; primary action buttons sit at the bottom (thumb zone). Works with gloves (no small toggles, no swipe-only actions).
- Keep the screen on (`wakelock_plus`) while an emergency session is open. Haptic feedback on scan success/failure.
- Low-confidence session → persistent yellow top banner "Low-confidence identification: verify identity when possible".

### 6.4 Offline emergency card (Hive) & offline verification

**Patient side:**
1. On app start (online) and after any change to critical info or contacts (US-05-AC5), call `GET /v1/patients/me/emergency-card`. Store `{card_jws, expires_at, fetched_at}` in the Hive box `emergency_card` (encrypted with a 256-bit key from `flutter_secure_storage`).
2. **Quick access without login:** a home-screen quick action / app shortcut "Emergency card" (`quick_actions`) and a route `/card` that renders the cached card (decoded from the JWS, no network). It shows the QR (`qr_payload`) for paramedics plus human-readable critical info in high contrast. **Only** the patient's own card is shown, and nothing else from the app is reachable without login.
3. Expired card → still shown with a red banner (EXT-04-AC3).

**Paramedic side:**
1. Cache `GET /v1/.well-known/emergency-card-jwks.json` in Hive (box `jwks`) and refresh every 24 h when online.
2. Offline scan: `mobile_scanner` → `SHEC1.` payload → `JwsVerifier.verifyEd25519(jws, jwks)` → render the claims in the Emergency layout with an orange "OFFLINE CARD — issued <iat>" banner.
3. Queue the audit event in the Hive box `audit_outbox` (encrypted): `{event_id, type:"offline_card_view", card_mrn, card_iat, occurred_at, device_signature}`. The device signature uses the device key **without** a biometric prompt (a separate non-auth-gated key, alias `sh_audit_key`). On reconnect → `POST /v1/emergency/offline-events`, then delete on 202.
4. Online again with the card still on screen → offer "Open full live session" (`POST /v1/emergency/identify/card`).

Hive boxes, all encrypted: `emergency_card` (patient), `jwks` (public keys, not secret but integrity-relevant), `audit_outbox`, `rx_cache` (patient's own active prescriptions for offline viewing, E-NET-05). **Never** cache other patients' data on staff devices.

### 6.5 Patient AI chatbot UI
- **Entry:** consent screen (first time) → session creation. A persistent disclaimer banner at the top (not dismissible).
- **Message list:** user bubbles; assistant cards show `reply.text`, collapsible "Self-care" and "Warning signs" lists, a specialty chip ("Suggested: Neurology — المخ والأعصاب") and follow-up question chips (tap to send).
- **Triage visual:** `self_care`/`routine` neutral; `soon` blue; `urgent` amber card "See a doctor within 24 hours"; `emergency` → **full-screen takeover** (red, cannot be dismissed for 5 s) with a giant "Call 123" button (`tel:123` via `url_launcher`) and "Share my location with family" (opens an SMS composer to emergency contacts; no automatic sending). Crisis responses (`RF-SUICIDE-01`) use a calmer full-screen design with supportive text and resources.
- **Input:** max 2,000 chars, hint "Don't include names or ID numbers". Send is disabled while a reply is pending; a typing indicator shows. Network failure → retry with the same `client_message_id`.
- Delete session (swipe or menu) → `DELETE /v1/assistant/sessions/{id}`.
- Screens with chat content use `FLAG_SECURE`.

### 6.6 Patient prescriptions & pickup QR
- List with tabs Active/Past and status badges. Detail shows items with remaining quantities.
- **Show at pharmacy:** `StepUpService.obtain(pickupToken)` → `POST …/pickup-tokens` (with `X-Step-Up-Token`) → full-screen QR with max brightness (`screen_brightness`), 10-min countdown, blur on expiry + "Generate new code". `FLAG_SECURE` on (prevents screenshots, E-RX-09). Below the QR: the Rx number and the "No phone? Use code" hint.

### 6.7 Pharmacist mode: QR / biometric dispensing flow

```
/rx/scan ──QR──► local JWS check (cached rx-jwks) ──bad──► RED "Do NOT dispense"
    │                     │ok
    │                     ▼
    │         POST /pharmacy/prescriptions/verify (pickup_token) ──► /rx/verify (result screen)
    └─"No phone"─► Rx number + code ─► Presence: [SMS OTP] or [Face 1:1 (front camera, challenge)] ─► verify
/rx/verify (valid) ─► Lease ─► /rx/dispense/:id (table with qty steppers) ─► Dispense (idempotent) ─► Success
```

- The pharmacist **step-up** (`purpose=dispense`) is requested once per verification context (biometric prompt on the pharmacist's own device), then dispense.
- The quantity stepper defaults to remaining and has a max = remaining. Substitution opens a bottom sheet listing equivalent drugs (same ingredients/strength from `/v1/ref/drugs?equivalent_to=`).
- Offline: verification shows "Authentic", and Dispense is disabled with an explanation (SD-06).
- On `RX_QUANTITY_EXCEEDED` → refresh and highlight changed rows.

### 6.8 Paramedic Emergency Scan flow

```
/er/scan (rear camera, auto-capture) ─► POST /emergency/identify
   ├─ match ─► /er/profile/:sid (High-Contrast) ─► [Contacts] /er/contacts/:sid ─► tel:
   ├─ possible_match ─► candidate cards (sex + age band) ─► "Confirm this is the patient" ─► profile (yellow banner)
   ├─ no_match ─► Unknown-history checklist + [Retry] [Scan card QR] [Search by national ID]
   ├─ 422 BIO_* ─► hint + retry (3×) then alternatives
   └─ 503 / offline ─► [Scan card QR] big button (offline-capable)
```

Before scanning: a reason picker (`unconscious` default) and an optional incident ref, remembered for the shift. Location is attached only if permission was granted (no prompt during the emergency itself; ask at shift start).

## 7. Mobile Security Checklist
- `FLAG_SECURE` on: pickup QR, emergency card, emergency profile/contacts, chat, medical history, critical info. iOS: blur overlay on app-switcher snapshot (`AppLifecycleState.inactive`).
- Release builds: `--obfuscate --split-debug-info=build/symbols`; R8 enabled; no `print` (lint `avoid_print`); `kReleaseMode` disables verbose logging. dio's log interceptor is **debug only** and redacts headers/bodies.
- `android:usesCleartextTraffic="false"`, `android:allowBackup="false"`, iOS ATS default.
- Secrets: none in the app. The Supabase publishable key and API URL are public by design.
- Optional (P2): Play Integrity / App Attest header for the backend to log device integrity.
- Root/jailbreak: warn only (don't block patients; medical access must not be denied).

## 8. Localisation & Accessibility
- ARB files for `ar` (default) and `en`. `MaterialApp` with `supportedLocales`. Directionality follows the locale. Use `EdgeInsetsDirectional`, `AlignmentDirectional`, `PositionedDirectional` only (lint ban on non-directional variants in `lib/features/**`).
- Fonts: Cairo / IBM Plex Sans Arabic for Arabic, Inter for Latin (role-07). Numerals: Western by default; drug doses always Western.
- Semantics labels on all icons and buttons. TalkBack/VoiceOver tested on the emergency card and pickup QR screens. Respect text scale up to 200% without overflow (except the Emergency theme, which is already large and caps at 130%).

## 9. Testing

| Level | What |
|-------|------|
| Unit | Step-up message format (golden bytes), JWS verifier (valid/tampered/expired/unknown kid), quality-gate function, triage → UI mapping, problem → exception mapping |
| Widget | Emergency profile ordering (anaphylaxis first), offline banner, pickup QR countdown/blur, chat emergency takeover |
| Integration (`integration_test`) | Login → onboarding → enrol face (mock camera images) → pickup token; paramedic scan with mocked API (match / possible / no match / offline QR); pharmacist partial dispense |
| Device matrix (manual) | Low-end Android (2 GB RAM), mid Android (e.g. Oppo A-series), iPhone (if available); sunlight test for the emergency theme; gloves test |

## 10. Handoff Contracts

| To | You provide | You need |
|----|-------------|----------|
| AI | Real-device capture samples (team members, consented) for calibration | Capture spec (frames, size, signals) |
| Backend | Device key format (SPKI DER, ES256), step-up message format, offline event format | Endpoints, examples, staging |
| UI/UX | Screens on device in AR/EN for review | Material 3 tokens + emergency theme specs |
| Security | APK for MobSF, screenshots of FLAG_SECURE behaviour | Review |

## 11. Definition of Done (Role 06)
- [ ] Patient flows US-01…US-05, US-03 pickup QR with step-up, EXT-03 enrolment, EXT-04 card (incl. quick access without login).
- [ ] Paramedic flows US-16…US-18 incl. possible/no match, offline QR, outbox flush.
- [ ] Pharmacist flow US-10…US-12 incl. SMS/face presence, partial dispense, offline disable.
- [ ] Assistant UI with emergency/crisis takeover verified against the red-flag fixtures.
- [ ] `flutter analyze` clean; unit/widget/integration tests green; release build obfuscated.
- [ ] RTL/LTR complete; accessibility checks on key screens; Emergency theme passes the sunlight test.

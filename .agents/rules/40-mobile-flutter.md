---
trigger: glob
globs: "mobile-app/**/*.dart, mobile-app/**/*.arb, mobile-app/pubspec.yaml"
description: Flutter app conventions (patient, paramedic, pharmacist modes)
---
# Flutter conventions
- Feature-first clean architecture: features/<f>/{data,domain,presentation}. presentation → domain ← data.
  Widgets never call dio; providers call repositories/use cases.
- Riverpod with code generation (@riverpod). No global singletons except via providers. No setState for server data.
- Models: freezed + json_serializable; JSON keys snake_case via @JsonKey / fieldRename.
- Errors: map ProblemDetails → sealed ApiException in core/network; UI switches on `code`.
- Use EdgeInsetsDirectional/AlignmentDirectional/PositionedDirectional only (RTL). All strings from ARB (ar + en).
- Security: FLAG_SECURE on screens listed in docs/role-06 §7; secrets never in code; Hive boxes always encrypted
  (key from flutter_secure_storage); never cache other patients' data on staff devices; delete captured images after upload.
- Firebase SDK is used for Auth ONLY (`firebase_auth`). All medical data flows through the backend REST API (`ApiClient`).
- Cross-platform: all native plugins (`camera`, `mobile_scanner`, `local_auth`, `wakelock_plus`, `screen_brightness`, `flutter_image_compress`) MUST route through `core/platform/platform_services.dart` so Android, iOS, Web, Windows, macOS, and Linux compile and degrade gracefully.
- local_auth/device key is for the user's OWN step-up; never present it as identifying another person.
- Emergency theme rules (docs/role-07 §3.1): ≥ 20 sp body, ≥ 64 dp targets, no light grey text.
- Lints: flutter analyze clean; avoid_print; prefer_const; no `dynamic` in domain/presentation.

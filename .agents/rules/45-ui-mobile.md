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

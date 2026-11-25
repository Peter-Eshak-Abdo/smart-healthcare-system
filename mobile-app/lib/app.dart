import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/providers/app_providers.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/emergency_card/presentation/offline_emergency_card_screen.dart';
import 'features/paramedic/presentation/er_profile_screen.dart';
import 'features/paramedic/presentation/er_scan_screen.dart';
import 'features/patient/presentation/face_enrollment_screen.dart';
import 'features/patient/presentation/patient_onboarding_screen.dart';
import 'features/patient/presentation/patient_shell.dart';
import 'features/pharmacist/presentation/rx_dispense_screen.dart';
import 'features/pharmacist/presentation/rx_scan_screen.dart';
import 'l10n/app_localizations.dart';

final routerProvider = Provider<GoRouter>((Ref ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) =>
            const LoginScreen(),
      ),
      GoRoute(
        path: '/card',
        builder: (BuildContext context, GoRouterState state) =>
            const OfflineEmergencyCardScreen(),
      ),
      GoRoute(
        path: '/p/onboarding',
        builder: (BuildContext context, GoRouterState state) =>
            const PatientOnboardingScreen(),
      ),
      GoRoute(
        path: '/p/home',
        builder: (BuildContext context, GoRouterState state) =>
            const PatientShell(initialTab: 0),
      ),
      GoRoute(
        path: '/p/history',
        builder: (BuildContext context, GoRouterState state) =>
            const PatientShell(initialTab: 1),
      ),
      GoRoute(
        path: '/p/assistant',
        builder: (BuildContext context, GoRouterState state) =>
            const PatientShell(initialTab: 2),
      ),
      GoRoute(
        path: '/p/profile',
        builder: (BuildContext context, GoRouterState state) =>
            const PatientShell(initialTab: 3),
      ),
      GoRoute(
        path: '/p/face-enroll',
        builder: (BuildContext context, GoRouterState state) =>
            const FaceEnrollmentScreen(),
      ),
      GoRoute(
        path: '/er/scan',
        builder: (BuildContext context, GoRouterState state) =>
            const ErScanScreen(),
      ),
      GoRoute(
        path: '/er/profile/:sessionId',
        builder: (BuildContext context, GoRouterState state) => ErProfileScreen(
          sessionId: state.pathParameters['sessionId'] ?? '',
        ),
      ),
      GoRoute(
        path: '/rx/scan',
        builder: (BuildContext context, GoRouterState state) =>
            const RxScanScreen(),
      ),
      GoRoute(
        path: '/rx/dispense/:id',
        builder: (BuildContext context, GoRouterState state) =>
            RxDispenseScreen(
          prescriptionId: state.pathParameters['id'] ?? '',
          verificationId: state.uri.queryParameters['vid'] ?? '',
        ),
      ),
    ],
  );
});

class SmartHealthApp extends ConsumerStatefulWidget {
  const SmartHealthApp({super.key});

  @override
  ConsumerState<SmartHealthApp> createState() => _SmartHealthAppState();
}

class _SmartHealthAppState extends ConsumerState<SmartHealthApp>
    with WidgetsBindingObserver {
  bool _privacyBlur = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final bool blurred =
        state == AppLifecycleState.inactive || state == AppLifecycleState.paused;
    if (blurred != _privacyBlur) {
      setState(() => _privacyBlur = blurred);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Locale locale = ref.watch(localeProvider);
    final ShThemeMode themeMode = ref.watch(themeModeProvider);
    final bool largeFont = ref.watch(largeFontProvider);
    final GoRouter router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'SmartHealth',
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: AppTheme.build(themeMode, largeFont: largeFont),
      routerConfig: router,
      builder: (BuildContext ctx, Widget? child) {
        final Widget content = LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            if (constraints.maxWidth <= 960 || child == null) {
              return child ?? const SizedBox.shrink();
            }
            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 960),
                child: child,
              ),
            );
          },
        );
        if (!_privacyBlur) {
          return content;
        }
        return Stack(
          children: <Widget>[
            content,
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                child: ColoredBox(
                  color: Colors.black.withValues(alpha: 0.45),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

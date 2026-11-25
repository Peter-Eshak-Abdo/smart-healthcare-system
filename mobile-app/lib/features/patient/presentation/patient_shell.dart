import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/firebase_config.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import 'ai_assistant_screen.dart';
import 'emergency_contacts_screen.dart';
import 'patient_history_screen.dart';
import 'patient_home_screen.dart';

class PatientShell extends ConsumerStatefulWidget {
  const PatientShell({super.key, required this.initialTab});

  final int initialTab;

  @override
  ConsumerState<PatientShell> createState() => _PatientShellState();
}

class _PatientShellState extends ConsumerState<PatientShell> {
  late int _index = widget.initialTab;

  Future<void> _signOut() async {
    await ref.read(encryptedStorageProvider).wipeAllOnSignOut();
    await FirebaseConfig.signOut();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final Locale locale = ref.watch(localeProvider);
    final ShThemeMode themeMode = ref.watch(themeModeProvider);

    const List<Widget> pages = <Widget>[
      PatientHomeScreen(),
      PatientHistoryScreen(),
      AiAssistantScreen(),
      EmergencyContactsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: <Widget>[
          IconButton(
            tooltip: 'Theme',
            onPressed: () {
              ref.read(themeModeProvider.notifier).state =
                  themeMode == ShThemeMode.light
                      ? ShThemeMode.dark
                      : ShThemeMode.light;
            },
            icon: Icon(
              themeMode == ShThemeMode.dark
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined,
            ),
          ),
          TextButton(
            onPressed: () {
              ref.read(localeProvider.notifier).state =
                  locale.languageCode == 'ar'
                      ? const Locale('en')
                      : const Locale('ar');
            },
            child: Text(l10n.navCommonLanguage),
          ),
          IconButton(
            onPressed: _signOut,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (int next) {
          setState(() => _index = next);
        },
        destinations: <NavigationDestination>[
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: l10n.tabHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.history_edu_outlined),
            selectedIcon: const Icon(Icons.history_edu),
            label: l10n.tabHistory,
          ),
          NavigationDestination(
            icon: const Icon(Icons.auto_awesome_outlined),
            selectedIcon: const Icon(Icons.auto_awesome),
            label: l10n.tabAssistant,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: l10n.tabProfile,
          ),
        ],
      ),
    );
  }
}

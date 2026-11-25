import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../l10n/app_localizations.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );
      if (!mounted) return;
      final AppPortalMode mode = ref.read(activeRoleModeProvider);
      switch (mode) {
        case AppPortalMode.patient:
          context.go('/p/home');
        case AppPortalMode.paramedic:
          context.go('/er/scan');
        case AppPortalMode.pharmacist:
          context.go('/rx/scan');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;
    final Locale locale = ref.watch(localeProvider);
    final AppPortalMode selectedMode = ref.watch(activeRoleModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: <Widget>[
          TextButton(
            onPressed: () {
              ref.read(localeProvider.notifier).state =
                  locale.languageCode == 'ar'
                      ? const Locale('en')
                      : const Locale('ar');
            },
            child: Text(l10n.navCommonLanguage),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsetsDirectional.all(20),
          children: <Widget>[
            Text(
              l10n.authLoginTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              l10n.appTagline,
              style: TextStyle(color: colors.mutedForeground),
            ),
            const SizedBox(height: 20),
            SegmentedButton<AppPortalMode>(
              segments: <ButtonSegment<AppPortalMode>>[
                ButtonSegment<AppPortalMode>(
                  value: AppPortalMode.patient,
                  label: Text(l10n.modePatient),
                ),
                ButtonSegment<AppPortalMode>(
                  value: AppPortalMode.paramedic,
                  label: Text(l10n.modeParamedic),
                ),
                ButtonSegment<AppPortalMode>(
                  value: AppPortalMode.pharmacist,
                  label: Text(l10n.modePharmacist),
                ),
              ],
              selected: <AppPortalMode>{selectedMode},
              onSelectionChanged: (Set<AppPortalMode> val) {
                if (val.isNotEmpty) {
                  ref.read(activeRoleModeProvider.notifier).state = val.first;
                }
              },
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Container(
                margin: const EdgeInsetsDirectional.only(bottom: 14),
                padding: const EdgeInsetsDirectional.all(12),
                decoration: BoxDecoration(
                  color: colors.danger.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(color: colors.danger, fontSize: 13),
                ),
              ),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: l10n.authPhoneOrEmail),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passCtrl,
              obscureText: true,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: l10n.authPassword),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _loading ? null : _signIn,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(vertical: 14),
                child: Text(_loading ? '…' : l10n.authSignInBtn),
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: () => context.push('/card'),
              icon: const Icon(Icons.medical_information_outlined),
              label: Text(l10n.authOfflineCardBtn),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/medical_id_card_3d.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../l10n/app_localizations.dart';

class OfflineEmergencyCardScreen extends ConsumerStatefulWidget {
  const OfflineEmergencyCardScreen({super.key});

  @override
  ConsumerState<OfflineEmergencyCardScreen> createState() =>
      _OfflineEmergencyCardScreenState();
}

class _OfflineEmergencyCardScreenState
    extends ConsumerState<OfflineEmergencyCardScreen> {
  Map<String, String>? _cachedCard;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _initDisplay();
    _loadCard();
  }

  Future<void> _initDisplay() async {
    try {
      await WakelockPlus.enable();
      await ScreenBrightness().setApplicationScreenBrightness(1.0);
    } catch (_) {
      // Desktop/test environments without screen control ignore safely.
    }
  }

  @override
  void dispose() {
    WakelockPlus.disable().catchError((_) {});
    ScreenBrightness().resetApplicationScreenBrightness().catchError((_) {});
    super.dispose();
  }

  Future<void> _loadCard() async {
    try {
      final Map<String, String>? cached =
          await ref.read(encryptedStorageProvider).readEmergencyCard();
      if (mounted) {
        setState(() {
          _cachedCard = cached;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.emergencyOfflineCardTitle)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(20),
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    StatusBadge(
                      label: l10n.emergencyOfflineNotice,
                      color: colors.warning,
                      icon: Icons.wifi_off_rounded,
                    ),
                    const SizedBox(height: 16),
                    MedicalIdCard3D(
                      fullName: l10n.emergencyOfflineCardTitle,
                      mrn: _cachedCard != null ? 'SHEC1-CACHED' : 'NO-CARD',
                      bloodType: 'O+',
                      allergies: _cachedCard != null
                          ? <String>[l10n.emergencyOfflineCardTitle]
                          : const <String>[],
                      qrPayload: _cachedCard?['qr_payload'],
                      emergencyMode: true,
                    ),
                    const SizedBox(height: 16),
                    if (_cachedCard == null)
                      Card(
                        child: Padding(
                          padding: const EdgeInsetsDirectional.all(16),
                          child: Text(
                            l10n.erUnregisteredBody,
                            style: TextStyle(color: colors.mutedForeground),
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}

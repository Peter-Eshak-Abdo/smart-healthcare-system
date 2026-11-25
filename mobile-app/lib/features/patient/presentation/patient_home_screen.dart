import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/medical_id_card_3d.dart';
import '../../../core/widgets/sh_bdi.dart';
import '../../../l10n/app_localizations.dart';
import '../data/patient_repository.dart';

class PatientHomeScreen extends ConsumerStatefulWidget {
  const PatientHomeScreen({super.key});

  @override
  ConsumerState<PatientHomeScreen> createState() => _PatientHomeScreenState();
}

class _PatientHomeScreenState extends ConsumerState<PatientHomeScreen> {
  Map<String, Object?>? _me;
  Map<String, Object?>? _critical;
  Map<String, Object?>? _card;
  List<Map<String, Object?>> _grants = const <Map<String, Object?>>[];
  List<Map<String, Object?>> _prescriptions = const <Map<String, Object?>>[];
  String? _activeShareCode;
  bool _loading = true;

  PatientRepository get _repo => PatientRepository(
        api: ref.read(apiClientProvider),
        encryptedStorage: ref.read(encryptedStorageProvider),
      );

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final List<Map<String, Object?>> results = await Future.wait(<Future<Map<String, Object?>>>[
        _repo.getMe(),
        _repo.getCriticalInfo(),
        _repo.syncEmergencyCard(),
        _repo.listGrants(),
        _repo.listPrescriptions(),
      ]);
      if (!mounted) return;
      final Object? rawGrants = results[3]['data'];
      final Object? rawRx = results[4]['data'];
      setState(() {
        _me = results[0];
        _critical = results[1];
        _card = results[2];
        _grants = rawGrants is List
            ? rawGrants.whereType<Map<Object?, Object?>>().map(
                  (Map<Object?, Object?> m) => m.map(
                    (Object? k, Object? v) =>
                        MapEntry<String, Object?>(k.toString(), v),
                  ),
                ).toList()
            : const <Map<String, Object?>>[];
        _prescriptions = rawRx is List
            ? rawRx.whereType<Map<Object?, Object?>>().map(
                  (Map<Object?, Object?> m) => m.map(
                    (Object? k, Object? v) =>
                        MapEntry<String, Object?>(k.toString(), v),
                  ),
                ).toList()
            : const <Map<String, Object?>>[];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generateShareCode() async {
    await HapticService.medium();
    final Map<String, Object?> res = await _repo.generateShareCode();
    if (!mounted) return;
    setState(() => _activeShareCode = res['code']?.toString());
  }

  Future<void> _showPickupQr(String rxId, String rxNumber) async {
    await HapticService.light();
    final Map<String, Object?> token = await _repo.generatePickupToken(rxId);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      builder: (BuildContext ctx) {
        return Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              ShBdi(
                rxNumber,
                style: Theme.of(ctx).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsetsDirectional.all(12),
                color: Colors.white,
                child: QrImageView(
                  data: token['qr_payload']?.toString() ?? '',
                  size: 190,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    final String fullName = _me?['full_name']?.toString() ?? l10n.appName;
    final Object? patientRaw = _me?['patient'];
    final String mrn = patientRaw is Map<Object?, Object?>
        ? (patientRaw['mrn']?.toString() ?? 'SH-EG-000000')
        : 'SH-EG-000000';
    final Object? btRaw = _critical?['blood_type'];
    final String bloodType = btRaw is Map<Object?, Object?>
        ? (btRaw['value']?.toString() ?? 'unknown')
        : 'unknown';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsetsDirectional.all(16),
        children: <Widget>[
          MedicalIdCard3D(
            fullName: fullName,
            mrn: mrn,
            bloodType: bloodType,
            allergies: const <String>[],
            qrPayload: _card?['qr_payload']?.toString(),
          ),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: Icon(Icons.face_retouching_natural, color: colors.primary),
              title: Text(l10n.patientFaceBanner),
              trailing: TextButton(
                onPressed: () => context.push('/p/face-enroll'),
                child: Text(l10n.patientFaceEnrolCta),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsetsDirectional.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  FilledButton.icon(
                    onPressed: _generateShareCode,
                    icon: const Icon(Icons.qr_code_2),
                    label: Text(l10n.patientGenerateCode),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.patientCodeValidity,
                    style: TextStyle(fontSize: 12, color: colors.mutedForeground),
                  ),
                  if (_activeShareCode != null) ...<Widget>[
                    const SizedBox(height: 12),
                    Center(
                      child: ShBdi(
                        _activeShareCode!,
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 6,
                          color: colors.primary,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading) const Center(child: CircularProgressIndicator()),
          Text(
            l10n.patientActiveRx,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          for (final Map<String, Object?> rx in _prescriptions)
            Card(
              margin: const EdgeInsetsDirectional.only(bottom: 10),
              child: ListTile(
                title: ShBdi(rx['rx_number']?.toString() ?? ''),
                subtitle: Text(rx['status']?.toString() ?? ''),
                trailing: TextButton(
                  onPressed: () => _showPickupQr(
                    rx['id']?.toString() ?? '',
                    rx['rx_number']?.toString() ?? '',
                  ),
                  child: Text(l10n.patientShowQr),
                ),
              ),
            ),
          for (final Map<String, Object?> g in _grants)
            Card(
              margin: const EdgeInsetsDirectional.only(bottom: 8),
              child: ListTile(
                title: Text(
                  (g['practitioner'] as Map<Object?, Object?>?)?['name']
                          ?.toString() ??
                      'Doctor',
                ),
                subtitle: Text(g['scope']?.toString() ?? ''),
                trailing: TextButton(
                  onPressed: () async {
                    await _repo.revokeGrant(g['id']?.toString() ?? '');
                    await _load();
                  },
                  child: Text(
                    l10n.patientRevokeGrant,
                    style: TextStyle(color: colors.danger),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

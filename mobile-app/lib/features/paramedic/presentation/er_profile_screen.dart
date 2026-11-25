import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/medical_id_card_3d.dart';
import '../../../core/widgets/sh_bdi.dart';
import '../../../l10n/app_localizations.dart';

class ErProfileScreen extends ConsumerStatefulWidget {
  const ErProfileScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<ErProfileScreen> createState() => _ErProfileScreenState();
}

class _ErProfileScreenState extends ConsumerState<ErProfileScreen> {
  Map<String, Object?>? _profile;
  List<Map<String, Object?>> _contacts = const <Map<String, Object?>>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final Map<String, Object?> p = await ref
          .read(apiClientProvider)
          .getJson('/v1/emergency/sessions/${widget.sessionId}/profile');
      List<Map<String, Object?>> contacts = const <Map<String, Object?>>[];
      if (p['has_shared_contacts'] == true) {
        final Map<String, Object?> c = await ref
            .read(apiClientProvider)
            .getJson('/v1/emergency/sessions/${widget.sessionId}/contacts');
        final Object? raw = c['data'];
        if (raw is List) {
          contacts = raw
              .whereType<Map<Object?, Object?>>()
              .map(
                (Map<Object?, Object?> m) => m.map(
                  (Object? k, Object? v) =>
                      MapEntry<String, Object?>(k.toString(), v),
                ),
              )
              .toList();
        }
      }
      if (mounted) {
        setState(() {
          _profile = p;
          _contacts = contacts;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _extend() async {
    await ref.read(apiClientProvider).postJson(
      '/v1/emergency/sessions/${widget.sessionId}/extend',
      body: const <String, Object?>{'reason': 'Ongoing ER care'},
    );
    await _load();
  }

  Future<void> _close() async {
    await ref
        .read(apiClientProvider)
        .postJson('/v1/emergency/sessions/${widget.sessionId}/close');
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;
    final Object? patientRaw = _profile?['patient'];
    final String name = patientRaw is Map<Object?, Object?>
        ? (patientRaw['full_name']?.toString() ?? 'Patient')
        : 'Patient';
    final String mrnLast4 = patientRaw is Map<Object?, Object?>
        ? (patientRaw['mrn_last4']?.toString() ?? '----')
        : '----';
    final Object? btRaw = _profile?['blood_type'];
    final String bt = btRaw is Map<Object?, Object?>
        ? (btRaw['value']?.toString() ?? 'unknown')
        : 'unknown';

    final Object? allergiesRaw = _profile?['allergies'];
    final List<String> allergies = allergiesRaw is List
        ? allergiesRaw
            .whereType<Map<Object?, Object?>>()
            .map((Map<Object?, Object?> a) =>
                '${a['name'] ?? ''} (${a['severity'] ?? ''})')
            .toList()
        : const <String>[];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.modeParamedic)),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsetsDirectional.all(16),
                children: <Widget>[
                  MedicalIdCard3D(
                    fullName: name,
                    mrn: 'SH-••••$mrnLast4',
                    bloodType: bt,
                    allergies: allergies,
                    emergencyMode: true,
                  ),
                  const SizedBox(height: 16),
                  for (final Map<String, Object?> c in _contacts)
                    Card(
                      child: ListTile(
                        title: Text(c['full_name']?.toString() ?? ''),
                        subtitle: ShBdi(c['phone']?.toString() ?? ''),
                        trailing: IconButton(
                          icon: Icon(Icons.call, color: colors.success),
                          onPressed: () => launchUrl(
                            Uri(
                              scheme: 'tel',
                              path: c['phone']?.toString() ?? '',
                            ),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _extend,
                          child: Text(l10n.erExtendSession),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: colors.danger,
                          ),
                          onPressed: _close,
                          child: Text(l10n.erCloseSession),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

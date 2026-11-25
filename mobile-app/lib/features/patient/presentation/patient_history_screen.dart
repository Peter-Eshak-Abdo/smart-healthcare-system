import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/sh_bdi.dart';
import '../../../l10n/app_localizations.dart';
import '../data/patient_repository.dart';

class PatientHistoryScreen extends ConsumerStatefulWidget {
  const PatientHistoryScreen({super.key});

  @override
  ConsumerState<PatientHistoryScreen> createState() =>
      _PatientHistoryScreenState();
}

class _PatientHistoryScreenState extends ConsumerState<PatientHistoryScreen> {
  String _filter = 'all';
  List<Map<String, Object?>> _items = const <Map<String, Object?>>[];
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
    setState(() => _loading = true);
    try {
      final Map<String, Object?> res =
          await _repo.getMedicalHistory(type: _filter);
      final Object? raw = res['data'];
      if (mounted) {
        setState(() {
          _items = raw is List
              ? raw
                  .whereType<Map<Object?, Object?>>()
                  .map(
                    (Map<Object?, Object?> m) => m.map(
                      (Object? k, Object? v) =>
                          MapEntry<String, Object?>(k.toString(), v),
                    ),
                  )
                  .toList()
              : const <Map<String, Object?>>[];
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
    final List<MapEntry<String, String>> filters = <MapEntry<String, String>>[
      MapEntry<String, String>('all', l10n.patientHistoryAll),
      MapEntry<String, String>('visits', l10n.patientHistoryVisits),
      MapEntry<String, String>('diagnoses', l10n.patientHistoryDiagnoses),
      MapEntry<String, String>('medications', l10n.patientHistoryMeds),
    ];

    return Column(
      children: <Widget>[
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsetsDirectional.all(12),
          child: Row(
            children: filters
                .map(
                  (MapEntry<String, String> f) => Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ChoiceChip(
                      label: Text(f.value),
                      selected: _filter == f.key,
                      onSelected: (_) {
                        setState(() => _filter = f.key);
                        _load();
                      },
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsetsDirectional.all(12),
                  itemCount: _items.length,
                  itemBuilder: (BuildContext ctx, int idx) {
                    final Map<String, Object?> item = _items[idx];
                    final String id = item['id']?.toString() ?? '';
                    final bool restricted =
                        item['visibility']?.toString() == 'restricted';
                    final Object? doctorRaw = item['doctor'];
                    final String docName = doctorRaw is Map<Object?, Object?>
                        ? (doctorRaw['name']?.toString() ?? 'Doctor')
                        : 'Encounter';

                    return Card(
                      margin: const EdgeInsetsDirectional.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              docName,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            ShBdi(item['started_at']?.toString() ?? ''),
                            if (id.isNotEmpty)
                              SwitchListTile(
                                contentPadding: EdgeInsetsDirectional.zero,
                                title: Text(l10n.patientRestrictedToggle),
                                value: restricted,
                                onChanged: (bool next) async {
                                  await _repo.setEncounterVisibility(
                                    id,
                                    next ? 'restricted' : 'normal',
                                  );
                                  await _load();
                                },
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

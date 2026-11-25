import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/sh_bdi.dart';
import '../../../l10n/app_localizations.dart';
import '../data/patient_repository.dart';

class EmergencyContactsScreen extends ConsumerStatefulWidget {
  const EmergencyContactsScreen({super.key});

  @override
  ConsumerState<EmergencyContactsScreen> createState() =>
      _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState
    extends ConsumerState<EmergencyContactsScreen> {
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  List<Map<String, Object?>> _contacts = const <Map<String, Object?>>[];

  PatientRepository get _repo => PatientRepository(
        api: ref.read(apiClientProvider),
        encryptedStorage: ref.read(encryptedStorageProvider),
      );

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final Map<String, Object?> res = await _repo.listEmergencyContacts();
      final Object? raw = res['data'];
      if (mounted) {
        setState(() {
          _contacts = raw is List
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
        });
      }
    } catch (_) {}
  }

  Future<void> _add() async {
    if (_nameCtrl.text.trim().isEmpty || _phoneCtrl.text.trim().isEmpty) return;
    await _repo.addEmergencyContact(
      fullName: _nameCtrl.text.trim(),
      relationship: 'family',
      phone: _phoneCtrl.text.trim(),
      priority: _contacts.length + 1,
    );
    _nameCtrl.clear();
    _phoneCtrl.clear();
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    return ListView(
      padding: const EdgeInsetsDirectional.all(16),
      children: <Widget>[
        SwitchListTile(
          title: Text(l10n.patientLargeFont),
          value: ref.watch(largeFontProvider),
          onChanged: (bool val) =>
              ref.read(largeFontProvider.notifier).state = val,
        ),
        const Divider(),
        Text(
          l10n.patientEmergencyContacts,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(hintText: 'Name'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _phoneCtrl,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(hintText: '+2010...'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(onPressed: _add, icon: const Icon(Icons.add)),
          ],
        ),
        const SizedBox(height: 14),
        for (final Map<String, Object?> c in _contacts)
          Card(
            child: ListTile(
              title: Text(c['full_name']?.toString() ?? ''),
              subtitle: ShBdi(c['phone']?.toString() ?? ''),
              trailing: IconButton(
                icon: Icon(Icons.delete_outline, color: colors.danger),
                onPressed: () async {
                  await _repo.deleteEmergencyContact(c['id']?.toString() ?? '');
                  await _load();
                },
              ),
            ),
          ),
      ],
    );
  }
}

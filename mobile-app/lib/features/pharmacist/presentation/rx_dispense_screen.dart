import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/sh_bdi.dart';
import '../../../l10n/app_localizations.dart';

class RxDispenseScreen extends ConsumerStatefulWidget {
  const RxDispenseScreen({
    super.key,
    required this.prescriptionId,
    required this.verificationId,
  });

  final String prescriptionId;
  final String verificationId;

  @override
  ConsumerState<RxDispenseScreen> createState() => _RxDispenseScreenState();
}

class _RxDispenseScreenState extends ConsumerState<RxDispenseScreen> {
  Map<String, Object?>? _detail;
  final Map<String, double> _quantities = <String, double>{};
  bool _counselling = false;
  bool _offline = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _checkConnectivity();
    _load();
  }

  Future<void> _checkConnectivity() async {
    final List<ConnectivityResult> results =
        await Connectivity().checkConnectivity();
    if (mounted) {
      setState(() => _offline = results.contains(ConnectivityResult.none));
    }
  }

  Future<void> _load() async {
    final Map<String, Object?> res = await ref.read(apiClientProvider).getJson(
      '/v1/pharmacy/prescriptions/${widget.prescriptionId}',
      query: <String, Object?>{'verification_id': widget.verificationId},
    );
    final Object? rx = res['prescription'];
    if (rx is Map<Object?, Object?>) {
      final Object? itemsRaw = rx['items'];
      if (itemsRaw is List) {
        for (final Object? item in itemsRaw) {
          if (item is Map<Object?, Object?>) {
            final String id = item['id']?.toString() ?? '';
            final num rem = (item['quantity_remaining'] as num?) ?? 0;
            _quantities[id] = rem.toDouble();
          }
        }
      }
    }
    if (mounted) setState(() => _detail = res);
  }

  Future<void> _dispense() async {
    if (_offline || _submitting || _detail == null) return;
    setState(() => _submitting = true);
    try {
      final Map<String, Object?>? rx =
          _detail!['prescription'] as Map<String, Object?>?;
      final int version = (rx?['version'] as int?) ?? 1;
      final List<Map<String, Object?>> items = _quantities.entries
          .where((MapEntry<String, double> e) => e.value > 0)
          .map(
            (MapEntry<String, double> e) => <String, Object?>{
              'prescription_item_id': e.key,
              'quantity': e.value,
            },
          )
          .toList();

      await ref.read(apiClientProvider).postJson(
        '/v1/pharmacy/prescriptions/${widget.prescriptionId}/dispensations',
        idempotencyKey: 'dispense-${DateTime.now().microsecondsSinceEpoch}',
        body: <String, Object?>{
          'verification_id': widget.verificationId,
          'expected_version': version,
          'items': items,
          'counselling_given': _counselling,
        },
      );
      await HapticService.medium();
      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;
    final Object? rxRaw = _detail?['prescription'];
    final List<Object?> items = rxRaw is Map<Object?, Object?> && rxRaw['items'] is List
        ? rxRaw['items'] as List<Object?>
        : const <Object?>[];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.rxDispenseBtn)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsetsDirectional.all(16),
          children: <Widget>[
            if (_offline)
              Card(
                color: colors.warning.withValues(alpha: 0.16),
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(12),
                  child: Text(l10n.rxOfflineWarn),
                ),
              ),
            for (final Object? item in items)
              if (item is Map<Object?, Object?>)
                Card(
                  margin: const EdgeInsetsDirectional.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        ShBdi(
                          (item['drug'] as Map<Object?, Object?>?)?['brand_name']
                                  ?.toString() ??
                              '',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Slider(
                          value: _quantities[item['id']?.toString() ?? ''] ?? 0,
                          min: 0,
                          max: ((item['quantity_remaining'] as num?) ?? 1)
                              .toDouble(),
                          onChanged: (double v) {
                            setState(() {
                              _quantities[item['id']?.toString() ?? ''] =
                                  v.roundToDouble();
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            CheckboxListTile(
              title: const Text('Patient counselling provided'),
              value: _counselling,
              onChanged: (bool? v) => setState(() => _counselling = v ?? false),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _offline || _submitting ? null : _dispense,
              child: Text(l10n.rxDispenseBtn),
            ),
          ],
        ),
      ),
    );
  }
}

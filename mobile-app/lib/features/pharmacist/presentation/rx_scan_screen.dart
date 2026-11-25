import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../l10n/app_localizations.dart';

class RxScanScreen extends ConsumerStatefulWidget {
  const RxScanScreen({super.key});

  @override
  ConsumerState<RxScanScreen> createState() => _RxScanScreenState();
}

class _RxScanScreenState extends ConsumerState<RxScanScreen> {
  final TextEditingController _rxCtrl = TextEditingController();
  final TextEditingController _codeCtrl = TextEditingController();
  bool _tamperBlocked = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _rxCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<String?> _activeFacilityId() async {
    final Map<String, Object?> me =
        await ref.read(apiClientProvider).getJson('/v1/me');
    final Object? pr = me['practitioner'];
    if (pr is Map<Object?, Object?>) {
      if (pr['active_facility_id'] != null) {
        return pr['active_facility_id'].toString();
      }
      final Object? fac = pr['facilities'];
      if (fac is List && fac.isNotEmpty && fac.first is Map<Object?, Object?>) {
        return (fac.first as Map<Object?, Object?>)['id']?.toString();
      }
    }
    return null;
  }

  Future<void> _verifyPickupToken(String token) async {
    if (_busy || !token.startsWith('SH1.')) return;
    setState(() {
      _busy = true;
      _tamperBlocked = false;
      _error = null;
    });
    try {
      final String? pharmacyId = await _activeFacilityId();
      if (pharmacyId == null) return;
      final Map<String, Object?> res =
          await ref.read(apiClientProvider).postJson(
        '/v1/pharmacy/prescriptions/verify',
        body: <String, Object?>{
          'mode': 'pickup_token',
          'pickup_token': token,
          'pharmacy_id': pharmacyId,
        },
      );
      final String vid = res['verification_id']?.toString() ?? '';
      final Object? rx = res['prescription'];
      final String rxId = rx is Map<Object?, Object?>
          ? (rx['id']?.toString() ?? '')
          : '';
      if (mounted && rxId.isNotEmpty) {
        await context.push('/rx/dispense/$rxId?vid=$vid');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _tamperBlocked = e.isSignatureInvalid;
        _error = e.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.modePharmacist)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsetsDirectional.all(16),
          children: <Widget>[
            if (_tamperBlocked)
              Card(
                color: colors.danger,
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(16),
                  child: Text(
                    l10n.rxTamperBlock,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            if (_error != null && !_tamperBlocked)
              Text(_error!, style: TextStyle(color: colors.danger)),
            Text(
              l10n.rxVerifyScan,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 240,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: MobileScanner(
                  onDetect: (BarcodeCapture capture) {
                    final String? val = capture.barcodes.firstOrNull?.rawValue;
                    if (val != null) _verifyPickupToken(val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(l10n.rxManualTitle),
            const SizedBox(height: 8),
            TextField(
              controller: _rxCtrl,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(hintText: 'SH1. token or RX-...'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _codeCtrl,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(hintText: 'Paper code (optional)'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy
                  ? null
                  : () => _verifyPickupToken(_rxCtrl.text.trim()),
              child: Text(l10n.rxDispenseBtn),
            ),
          ],
        ),
      ),
    );
  }
}

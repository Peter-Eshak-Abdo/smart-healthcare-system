import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/platform/platform_services.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/face_mesh_scanner.dart';
import '../../../l10n/app_localizations.dart';

class ErScanScreen extends ConsumerStatefulWidget {
  const ErScanScreen({super.key});

  @override
  ConsumerState<ErScanScreen> createState() => _ErScanScreenState();
}

class _ErScanScreenState extends ConsumerState<ErScanScreen> {
  String _mode = 'face';
  String _reason = 'unconscious';
  CameraController? _camera;
  final TextEditingController _nidCtrl = TextEditingController();
  List<Map<String, Object?>> _candidates = const <Map<String, Object?>>[];
  bool _unregisteredFallback = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    PlatformServices.enableEmergencyDisplay();
    _initCamera();
  }

  Future<void> _initCamera() async {
    if (!PlatformServices.supportsCamera) return;
    try {
      final List<CameraDescription> cameras = await availableCameras();
      final CameraController ctrl = CameraController(
        cameras.first,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await ctrl.initialize();
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() => _camera = ctrl);
    } catch (_) {}
  }

  @override
  void dispose() {
    _camera?.dispose();
    _nidCtrl.dispose();
    PlatformServices.disableEmergencyDisplay();
    super.dispose();
  }

  Future<void> _identifyFace() async {
    final CameraController? cam = _camera;
    if (cam == null || !cam.value.isInitialized || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _candidates = const <Map<String, Object?>>[];
      _unregisteredFallback = false;
    });
    try {
      final XFile shot = await cam.takePicture();
      final Uint8List raw = await shot.readAsBytes();
      final Uint8List jpg =
          await PlatformServices.compressJpegSafely(raw, quality: 82);
      final FormData fd = FormData()
        ..fields.add(MapEntry<String, String>('reason_code', _reason))
        ..files.add(
          MapEntry<String, MultipartFile>(
            'frames',
            MultipartFile.fromBytes(jpg, filename: 'er_face.jpg'),
          ),
        );

      final Map<String, Object?> res = await ref.read(apiClientProvider).postMultipart(
            '/v1/emergency/identify',
            formData: fd,
            idempotencyKey: 'er-${DateTime.now().microsecondsSinceEpoch}',
          );
      _handleIdentifyResponse(res);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _identifyCardQr(String qrPayload) async {
    if (_busy || !qrPayload.startsWith('SHEC1.')) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final Map<String, Object?> res = await ref.read(apiClientProvider).postJson(
            '/v1/emergency/identify/card',
            body: <String, Object?>{
              'card_qr_payload': qrPayload,
              'reason_code': _reason,
            },
          );
      _handleIdentifyResponse(res);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _identifyNationalId() async {
    if (_busy || _nidCtrl.text.trim().isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final Map<String, Object?> res = await ref.read(apiClientProvider).postJson(
            '/v1/emergency/identify/manual',
            body: <String, Object?>{
              'id_document_type': 'national_id',
              'id_document_number': _nidCtrl.text.trim(),
              'reason_code': _reason,
            },
          );
      _handleIdentifyResponse(res);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _handleIdentifyResponse(Map<String, Object?> res) {
    final String result = res['result']?.toString() ?? 'no_match';
    if (result == 'match') {
      HapticService.heavy();
      final Object? sessionRaw = res['session'];
      final String sessionId = sessionRaw is Map<Object?, Object?>
          ? (sessionRaw['id']?.toString() ?? '')
          : '';
      if (sessionId.isNotEmpty && mounted) {
        context.push('/er/profile/$sessionId');
      }
      return;
    }
    if (result == 'possible_match') {
      final Object? raw = res['candidates'];
      setState(() {
        _candidates = raw is List
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
      return;
    }
    setState(() => _unregisteredFallback = true);
  }

  Future<void> _confirmCandidate(String token) async {
    final Map<String, Object?> res = await ref.read(apiClientProvider).postJson(
          '/v1/emergency/identify/confirm',
          body: <String, Object?>{
            'candidate_token': token,
            'reason_code': _reason,
          },
        );
    _handleIdentifyResponse(res);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.modeParamedic)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsetsDirectional.all(16),
          children: <Widget>[
            SegmentedButton<String>(
              segments: <ButtonSegment<String>>[
                ButtonSegment<String>(value: 'face', label: Text(l10n.erModeFace)),
                ButtonSegment<String>(value: 'qr', label: Text(l10n.erModeQr)),
                ButtonSegment<String>(value: 'id', label: Text(l10n.erModeId)),
              ],
              selected: <String>{_mode},
              onSelectionChanged: (Set<String> s) =>
                  setState(() => _mode = s.first),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _reason,
              items: const <String>[
                'unconscious',
                'unable_to_communicate',
                'altered_mental_status',
                'language_barrier',
                'other',
              ]
                  .map(
                    (String r) =>
                        DropdownMenuItem<String>(value: r, child: Text(r)),
                  )
                  .toList(),
              onChanged: (String? v) =>
                  setState(() => _reason = v ?? 'unconscious'),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: 12),
                child: Text(_error!, style: TextStyle(color: colors.danger)),
              ),
            if (_mode == 'face') ...<Widget>[
              Center(
                child: FaceMeshScanner(
                  hint: PlatformServices.supportsCamera
                      ? l10n.erModeFace
                      : l10n.platformCameraUnavailable,
                  emergency: true,
                ),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _busy || _camera == null ? null : _identifyFace,
                child: Text(l10n.erScanButton),
              ),
            ] else if (_mode == 'qr')
              if (PlatformServices.supportsQrScanner)
                SizedBox(
                  height: 280,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: MobileScanner(
                      onDetect: (BarcodeCapture capture) {
                        final String? val = capture.barcodes.firstOrNull?.rawValue;
                        if (val != null) _identifyCardQr(val);
                      },
                    ),
                  ),
                )
              else
                Card(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(16),
                    child: Text(
                      l10n.platformScannerUnavailable,
                      style: TextStyle(color: colors.mutedForeground),
                    ),
                  ),
                )
            else ...<Widget>[
              TextField(
                controller: _nidCtrl,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(labelText: l10n.erModeId),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy ? null : _identifyNationalId,
                child: Text(l10n.erScanButton),
              ),
            ],
            if (_candidates.isNotEmpty) ...<Widget>[
              const SizedBox(height: 16),
              for (final Map<String, Object?> c in _candidates)
                Card(
                  child: ListTile(
                    title: Text('${c['sex']} · ${c['age_band']}'),
                    trailing: FilledButton(
                      onPressed: () =>
                          _confirmCandidate(c['candidate_token']?.toString() ?? ''),
                      child: const Text('Select'),
                    ),
                  ),
                ),
            ],
            if (_unregisteredFallback)
              Card(
                color: colors.warning.withValues(alpha: 0.16),
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        l10n.erUnregisteredTitle,
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: colors.warning,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(l10n.erUnregisteredBody),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

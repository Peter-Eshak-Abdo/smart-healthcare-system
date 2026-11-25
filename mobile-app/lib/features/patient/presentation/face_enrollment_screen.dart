import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/platform/platform_services.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/theme/sh_colors.dart';
import '../../../core/widgets/face_mesh_scanner.dart';
import '../../../l10n/app_localizations.dart';
import '../data/patient_repository.dart';

class FaceEnrollmentScreen extends ConsumerStatefulWidget {
  const FaceEnrollmentScreen({super.key});

  @override
  ConsumerState<FaceEnrollmentScreen> createState() =>
      _FaceEnrollmentScreenState();
}

class _FaceEnrollmentScreenState extends ConsumerState<FaceEnrollmentScreen> {
  CameraController? _camera;
  bool _capturing = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    if (!PlatformServices.supportsCamera) return;
    try {
      final List<CameraDescription> cameras = await availableCameras();
      final CameraDescription front = cameras.firstWhere(
        (CameraDescription c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final CameraController ctrl = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await ctrl.initialize();
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() => _camera = ctrl);
    } catch (_) {
      if (mounted) {
        setState(() => _status = 'Camera unavailable on this device.');
      }
    }
  }

  @override
  void dispose() {
    _camera?.dispose();
    super.dispose();
  }

  Future<void> _captureAndEnroll() async {
    final CameraController? cam = _camera;
    if (cam == null || !cam.value.isInitialized || _capturing) return;
    setState(() {
      _capturing = true;
      _status = null;
    });

    try {
      final List<List<int>> frames = <List<int>>[];
      for (int i = 0; i < 3; i++) {
        final XFile raw = await cam.takePicture();
        final Uint8List bytes = await raw.readAsBytes();
        final Uint8List compressed =
            await PlatformServices.compressJpegSafely(bytes, quality: 82);
        frames.add(compressed);
      }

      final PatientRepository repo = PatientRepository(
        api: ref.read(apiClientProvider),
        encryptedStorage: ref.read(encryptedStorageProvider),
      );
      await repo.enrollFaceFrames(
        jpegFrames: frames,
        idempotencyKey: 'enroll-${DateTime.now().microsecondsSinceEpoch}',
      );
      await HapticService.medium();
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) setState(() => _status = e.toString());
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ShColors colors = context.shColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.patientFaceEnrolCta)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(20),
          child: Column(
            children: <Widget>[
              Expanded(
                child: Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: <Widget>[
                      if (_camera != null && _camera!.value.isInitialized)
                        ClipOval(
                          child: SizedBox(
                            width: 240,
                            height: 240,
                            child: CameraPreview(_camera!),
                          ),
                        ),
                      FaceMeshScanner(hint: l10n.patientFaceHint),
                    ],
                  ),
                ),
              ),
              if (!PlatformServices.supportsCamera)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: 12),
                  child: Text(
                    l10n.platformCameraUnavailable,
                    style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (_status != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: 12),
                  child: Text(
                    _status!,
                    style: TextStyle(color: colors.danger, fontSize: 13),
                  ),
                ),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _capturing || _camera == null ? null : _captureAndEnroll,
                  child: Text(_capturing ? '…' : l10n.patientFaceEnrolCta),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

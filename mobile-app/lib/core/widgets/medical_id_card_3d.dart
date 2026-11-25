import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../theme/motion_tokens.dart';
import '../theme/sh_colors.dart';
import 'sh_bdi.dart';

class MedicalIdCard3D extends StatefulWidget {
  const MedicalIdCard3D({
    super.key,
    required this.fullName,
    required this.mrn,
    required this.bloodType,
    required this.allergies,
    this.qrPayload,
    this.emergencyMode = false,
  });

  final String fullName;
  final String mrn;
  final String bloodType;
  final List<String> allergies;
  final String? qrPayload;
  final bool emergencyMode;

  @override
  State<MedicalIdCard3D> createState() => _MedicalIdCard3DState();
}

class _MedicalIdCard3DState extends State<MedicalIdCard3D> {
  double _rotX = 0;
  double _rotY = 0;

  @override
  Widget build(BuildContext context) {
    final ShColors colors = context.shColors;
    final bool reduced =
        MotionTokens.shouldReduceMotion(context, emergency: widget.emergencyMode);

    final Widget card = Container(
      padding: const EdgeInsetsDirectional.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: widget.emergencyMode ? colors.danger : colors.primary,
          width: widget.emergencyMode ? 2 : 1,
        ),
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: <Color>[
            widget.emergencyMode ? colors.card : colors.primary,
            widget.emergencyMode
                ? colors.background
                : colors.primary.withValues(alpha: 0.85),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      widget.fullName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: widget.emergencyMode
                                ? colors.foreground
                                : colors.primaryForeground,
                          ),
                    ),
                    const SizedBox(height: 4),
                    ShBdi(
                      widget.mrn,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w700,
                        color: (widget.emergencyMode
                                ? colors.foreground
                                : colors.primaryForeground)
                            .withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: colors.danger,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: ShBdi(
                  widget.bloodType,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Expanded(
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: widget.allergies.isEmpty
                      ? <Widget>[
                          Text(
                            'No known allergies',
                            style: TextStyle(
                              fontSize: 12,
                              color: widget.emergencyMode
                                  ? colors.mutedForeground
                                  : colors.primaryForeground,
                            ),
                          ),
                        ]
                      : widget.allergies
                          .map(
                            (String a) => Container(
                              padding: const EdgeInsetsDirectional.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: colors.danger.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                a,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: widget.emergencyMode
                                      ? colors.foreground
                                      : Colors.white,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                ),
              ),
              if (widget.qrPayload != null && widget.qrPayload!.isNotEmpty)
                Container(
                  padding: const EdgeInsetsDirectional.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: QrImageView(
                    data: widget.qrPayload!,
                    version: QrVersions.auto,
                    size: 72,
                    backgroundColor: Colors.white,
                  ),
                ),
            ],
          ),
        ],
      ),
    );

    if (reduced) return card;

    return GestureDetector(
      onPanUpdate: (DragUpdateDetails details) {
        setState(() {
          _rotY = (_rotY + details.delta.dx * 0.008).clamp(-0.22, 0.22);
          _rotX = (_rotX - details.delta.dy * 0.008).clamp(-0.18, 0.18);
        });
      },
      onPanEnd: (_) => setState(() {
        _rotX = 0;
        _rotY = 0;
      }),
      child: AnimatedContainer(
        duration: MotionTokens.fast,
        curve: MotionTokens.springCurve,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.001)
          ..rotateX(_rotX)
          ..rotateY(_rotY),
        transformAlignment: Alignment.center,
        child: card,
      ),
    );
  }
}

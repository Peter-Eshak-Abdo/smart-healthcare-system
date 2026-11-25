import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/motion_tokens.dart';
import '../theme/sh_colors.dart';

class FaceMeshScanner extends StatefulWidget {
  const FaceMeshScanner({
    super.key,
    required this.hint,
    this.emergency = false,
  });

  final String hint;
  final bool emergency;

  @override
  State<FaceMeshScanner> createState() => _FaceMeshScannerState();
}

class _FaceMeshScannerState extends State<FaceMeshScanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ShColors colors = context.shColors;
    final bool reduced =
        MotionTokens.shouldReduceMotion(context, emergency: widget.emergency);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SizedBox(
          width: 220,
          height: 220,
          child: AnimatedBuilder(
            animation: _ctrl,
            builder: (BuildContext context, _) {
              return CustomPaint(
                painter: _FaceMeshPainter(
                  progress: reduced ? 0.5 : _ctrl.value,
                  ringColor:
                      widget.emergency ? colors.danger : colors.primary,
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Text(
          widget.hint,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: colors.foreground,
          ),
        ),
      ],
    );
  }
}

class _FaceMeshPainter extends CustomPainter {
  _FaceMeshPainter({required this.progress, required this.ringColor});

  final double progress;
  final Color ringColor;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double radius = size.width * 0.42;

    final Paint ringPaint = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawCircle(center, radius, ringPaint);

    final Paint meshPaint = Paint()
      ..color = ringColor.withValues(alpha: 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    const int rings = 3;
    const int segments = 12;
    for (int r = 1; r <= rings; r++) {
      final double rad = radius * (r / (rings + 0.3));
      final Path path = Path();
      for (int s = 0; s <= segments; s++) {
        final double angle =
            (s / segments) * math.pi * 2 + progress * math.pi * 0.25;
        final Offset pt = Offset(
          center.dx + math.cos(angle) * rad * 0.85,
          center.dy + math.sin(angle) * rad,
        );
        if (s == 0) {
          path.moveTo(pt.dx, pt.dy);
        } else {
          path.lineTo(pt.dx, pt.dy);
        }
      }
      canvas.drawPath(path, meshPaint);
    }

    final double sweepY =
        center.dy - radius + (math.sin(progress * math.pi * 2) * 0.5 + 0.5) * radius * 2;
    final Paint scanLine = Paint()
      ..color = ringColor.withValues(alpha: 0.85)
      ..strokeWidth = 2;
    canvas.drawLine(
      Offset(center.dx - radius * 0.75, sweepY),
      Offset(center.dx + radius * 0.75, sweepY),
      scanLine,
    );
  }

  @override
  bool shouldRepaint(covariant _FaceMeshPainter old) =>
      old.progress != progress || old.ringColor != ringColor;
}

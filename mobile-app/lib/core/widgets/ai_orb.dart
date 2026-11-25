import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/motion_tokens.dart';
import '../theme/sh_colors.dart';

enum AiOrbState { idle, thinking, emergency }

class AiOrb extends StatefulWidget {
  const AiOrb({
    super.key,
    this.state = AiOrbState.idle,
    this.size = 76,
  });

  final AiOrbState state;
  final double size;

  @override
  State<AiOrb> createState() => _AiOrbState();
}

class _AiOrbState extends State<AiOrb> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
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
    final bool reduced = MotionTokens.shouldReduceMotion(
      context,
      emergency: widget.state == AiOrbState.emergency,
    );
    final Color core = switch (widget.state) {
      AiOrbState.emergency => colors.danger,
      AiOrbState.thinking => colors.info,
      AiOrbState.idle => colors.ai,
    };

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (BuildContext context, _) {
          return CustomPaint(
            painter: _AiOrbPainter(
              t: reduced ? 0.35 : _ctrl.value,
              color: core,
            ),
          );
        },
      ),
    );
  }
}

class _AiOrbPainter extends CustomPainter {
  _AiOrbPainter({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset c = Offset(size.width / 2, size.height / 2);
    final double baseR = size.width * 0.32;
    final double pulse = math.sin(t * math.pi * 2) * 0.1 + 1.0;

    final Paint outerGlow = Paint()
      ..color = color.withValues(alpha: 0.22)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawCircle(c, baseR * 1.45 * pulse, outerGlow);

    final Paint middle = Paint()
      ..color = color.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2;
    canvas.drawCircle(c, baseR * 1.18, middle);

    final Paint inner = Paint()
      ..shader = RadialGradient(
        colors: <Color>[Colors.white.withValues(alpha: 0.9), color],
      ).createShader(Rect.fromCircle(center: c, radius: baseR));
    canvas.drawCircle(c, baseR * pulse, inner);
  }

  @override
  bool shouldRepaint(covariant _AiOrbPainter old) =>
      old.t != t || old.color != color;
}

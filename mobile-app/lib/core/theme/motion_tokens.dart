import 'package:flutter/widgets.dart';

class MotionTokens {
  const MotionTokens._();

  static const Duration fast = Duration(milliseconds: 160);
  static const Duration normal = Duration(milliseconds: 280);
  static const Duration slow = Duration(milliseconds: 420);
  static const Curve springCurve = Curves.easeOutCubic;

  /// Reduced motion when OS accessibility disables animations or in Emergency Mode.
  static bool shouldReduceMotion(BuildContext context, {bool emergency = false}) {
    if (emergency) return true;
    final MediaQueryData? mq = MediaQuery.maybeOf(context);
    return mq?.disableAnimations ?? false;
  }
}

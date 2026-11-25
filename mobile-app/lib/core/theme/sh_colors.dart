import 'package:flutter/material.dart';

/// Semantic colors matching design/tokens/tokens.json across Light, Dark,
/// Emergency (Tier E WCAG AAA), and Sunlight (Outdoor High-Contrast) modes.
@immutable
class ShColors extends ThemeExtension<ShColors> {
  const ShColors({
    required this.background,
    required this.foreground,
    required this.card,
    required this.primary,
    required this.primaryForeground,
    required this.danger,
    required this.warning,
    required this.caution,
    required this.success,
    required this.info,
    required this.ai,
    required this.border,
    required this.mutedForeground,
  });

  final Color background;
  final Color foreground;
  final Color card;
  final Color primary;
  final Color primaryForeground;
  final Color danger;
  final Color warning;
  final Color caution;
  final Color success;
  final Color info;
  final Color ai;
  final Color border;
  final Color mutedForeground;

  static const light = ShColors(
    background: Color(0xFFF3F4F6),
    foreground: Color(0xFF111827),
    card: Color(0xFFFFFFFF),
    primary: Color(0xFF2563EB),
    primaryForeground: Color(0xFFFFFFFF),
    danger: Color(0xFFDC2626),
    warning: Color(0xFFB45309),
    caution: Color(0xFFA16207),
    success: Color(0xFF15803D),
    info: Color(0xFF0369A1),
    ai: Color(0xFF6D28D9),
    border: Color(0xFFE5E7EB),
    mutedForeground: Color(0xFF4B5563),
  );

  static const dark = ShColors(
    background: Color(0xFF0B1220),
    foreground: Color(0xFFF9FAFB),
    card: Color(0xFF111827),
    primary: Color(0xFF60A5FA),
    primaryForeground: Color(0xFF0B1220),
    danger: Color(0xFFF87171),
    warning: Color(0xFFFBBF24),
    caution: Color(0xFFFACC15),
    success: Color(0xFF4ADE80),
    info: Color(0xFF38BDF8),
    ai: Color(0xFFA78BFA),
    border: Color(0xFF1F2937),
    mutedForeground: Color(0xFF9CA3AF),
  );

  static const emergency = ShColors(
    background: Color(0xFF000000),
    foreground: Color(0xFFFFFFFF),
    card: Color(0xFF1C1C1E),
    primary: Color(0xFFFFFFFF),
    primaryForeground: Color(0xFF000000),
    danger: Color(0xFFFF3B30),
    warning: Color(0xFFFFD60A),
    caution: Color(0xFFFFD60A),
    success: Color(0xFF30D158),
    info: Color(0xFF0A84FF),
    ai: Color(0xFFFFFFFF),
    border: Color(0xFFFFFFFF),
    mutedForeground: Color(0xFFD1D5DB),
  );

  static const sunlight = ShColors(
    background: Color(0xFFFFFFFF),
    foreground: Color(0xFF000000),
    card: Color(0xFFFFFFFF),
    primary: Color(0xFF0040C1),
    primaryForeground: Color(0xFFFFFFFF),
    danger: Color(0xFFB00020),
    warning: Color(0xFF000000),
    caution: Color(0xFF000000),
    success: Color(0xFF006B2D),
    info: Color(0xFF0040C1),
    ai: Color(0xFF5B21B6),
    border: Color(0xFF000000),
    mutedForeground: Color(0xFF1F2937),
  );

  @override
  ShColors copyWith({
    Color? background,
    Color? foreground,
    Color? card,
    Color? primary,
    Color? primaryForeground,
    Color? danger,
    Color? warning,
    Color? caution,
    Color? success,
    Color? info,
    Color? ai,
    Color? border,
    Color? mutedForeground,
  }) {
    return ShColors(
      background: background ?? this.background,
      foreground: foreground ?? this.foreground,
      card: card ?? this.card,
      primary: primary ?? this.primary,
      primaryForeground: primaryForeground ?? this.primaryForeground,
      danger: danger ?? this.danger,
      warning: warning ?? this.warning,
      caution: caution ?? this.caution,
      success: success ?? this.success,
      info: info ?? this.info,
      ai: ai ?? this.ai,
      border: border ?? this.border,
      mutedForeground: mutedForeground ?? this.mutedForeground,
    );
  }

  @override
  ShColors lerp(covariant ThemeExtension<ShColors>? other, double t) {
    if (other is! ShColors) return this;
    return ShColors(
      background: Color.lerp(background, other.background, t)!,
      foreground: Color.lerp(foreground, other.foreground, t)!,
      card: Color.lerp(card, other.card, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryForeground:
          Color.lerp(primaryForeground, other.primaryForeground, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      caution: Color.lerp(caution, other.caution, t)!,
      success: Color.lerp(success, other.success, t)!,
      info: Color.lerp(info, other.info, t)!,
      ai: Color.lerp(ai, other.ai, t)!,
      border: Color.lerp(border, other.border, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
    );
  }
}

extension ShColorsContext on BuildContext {
  ShColors get shColors =>
      Theme.of(this).extension<ShColors>() ?? ShColors.light;
}

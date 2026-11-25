import 'package:flutter/material.dart';

import 'sh_colors.dart';

enum ShThemeMode { light, dark, emergency, sunlight }

class AppTheme {
  const AppTheme._();

  static ThemeData build(ShThemeMode mode, {bool largeFont = false}) {
    final ShColors palette = switch (mode) {
      ShThemeMode.light => ShColors.light,
      ShThemeMode.dark => ShColors.dark,
      ShThemeMode.emergency => ShColors.emergency,
      ShThemeMode.sunlight => ShColors.sunlight,
    };

    final Brightness brightness = switch (mode) {
      ShThemeMode.light || ShThemeMode.sunlight => Brightness.light,
      ShThemeMode.dark || ShThemeMode.emergency => Brightness.dark,
    };

    final double bodySize = largeFont ? 18 : 15;
    final double titleSize = largeFont ? 24 : 20;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: palette.background,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: palette.primary,
        onPrimary: palette.primaryForeground,
        secondary: palette.ai,
        onSecondary: palette.primaryForeground,
        error: palette.danger,
        onError: palette.primaryForeground,
        surface: palette.card,
        onSurface: palette.foreground,
      ),
      cardTheme: CardThemeData(
        color: palette.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: palette.border,
            width: mode == ShThemeMode.emergency || mode == ShThemeMode.sunlight
                ? 2
                : 1,
          ),
        ),
      ),
      textTheme: TextTheme(
        titleLarge: TextStyle(
          fontSize: titleSize,
          fontWeight: FontWeight.w700,
          color: palette.foreground,
        ),
        bodyMedium: TextStyle(
          fontSize: bodySize,
          height: 1.45,
          color: palette.foreground,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: palette.border),
        ),
      ),
      extensions: <ThemeExtension<Object?>>[palette],
    );
  }
}

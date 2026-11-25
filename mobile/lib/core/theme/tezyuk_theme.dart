import 'package:flutter/material.dart';

import 'tezyuk_colors.dart';

ThemeData buildTezyukTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: TezyukColors.primary,
    brightness: Brightness.light,
    primary: TezyukColors.primary,
    onPrimary: TezyukColors.onPrimary,
    primaryContainer: TezyukColors.primaryContainer,
    secondary: TezyukColors.secondary,
    onSecondary: TezyukColors.onSecondary,
    secondaryContainer: TezyukColors.secondaryContainer,
    error: TezyukColors.error,
    errorContainer: TezyukColors.errorContainer,
    surface: TezyukColors.surfaceBright,
    onSurface: TezyukColors.onSurface,
    onSurfaceVariant: TezyukColors.onSurfaceVariant,
    outline: TezyukColors.outline,
    outlineVariant: TezyukColors.outlineVariant,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: TezyukColors.background,
    dividerColor: TezyukColors.outlineVariant,
    appBarTheme: const AppBarTheme(
      backgroundColor: TezyukColors.background,
      foregroundColor: TezyukColors.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: TezyukColors.onSurface,
        letterSpacing: -0.1,
      ),
    ),
    cardTheme: CardThemeData(
      color: TezyukColors.surfaceBright,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: TezyukColors.outlineVariant),
      ),
      margin: EdgeInsets.zero,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: TezyukColors.secondaryContainer,
      selectedColor: TezyukColors.primary,
      labelStyle: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: TezyukColors.onSurface,
      ),
      side: const BorderSide(color: TezyukColors.outlineVariant),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: TezyukColors.primary,
        foregroundColor: TezyukColors.onPrimary,
        minimumSize: const Size(44, 44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: TezyukColors.primary,
        minimumSize: const Size(44, 44),
        side: const BorderSide(color: TezyukColors.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: TezyukColors.primary,
      foregroundColor: Colors.white,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: TezyukColors.surfaceBright,
      selectedItemColor: TezyukColors.primary,
      unselectedItemColor: TezyukColors.outline,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
  );
}

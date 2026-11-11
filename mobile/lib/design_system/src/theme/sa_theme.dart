import 'package:flutter/material.dart';
import '../tokens/sa_colors.dart';
import '../tokens/sa_type.dart';
import '../tokens/sa_space.dart';
import '../catalog/sa_catalog.dart';

/// Token + katalog asosida to'liq Material tema yig'adi.
///
///   MaterialApp(
///     theme: SaTheme.light(catalog),
///     darkTheme: SaTheme.dark(catalog),
///     ...
///   )
class SaTheme {
  const SaTheme._();

  static ThemeData light([SaCatalog? catalog]) {
    final c = (catalog ?? SaCatalog.fallback()).resolve();
    return _build(Brightness.light, c);
  }

  static ThemeData dark([SaCatalog? catalog]) {
    final c = (catalog ?? SaCatalog.fallback()).resolve();
    return _build(Brightness.dark, c);
  }

  static ThemeData _build(Brightness brightness, SaResolvedColors c) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.salesBlue,
      onPrimary: Colors.white,
      secondary: c.brightSky,
      onSecondary: SaColors.navy,
      surface: dark ? SaColors.surfaceDark : SaColors.surfaceLight,
      onSurface: dark ? SaColors.inkDark : SaColors.inkLight,
      error: const Color(0xFFE0574B),
      onError: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: const AppBarTheme(centerTitle: false, elevation: 0),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SaRadius.card),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(64, 48),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaRadius.control),
          ),
        ),
      ),
    );
  }
}

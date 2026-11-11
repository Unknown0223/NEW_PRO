import 'package:flutter/material.dart';

import '../../design_system/design_system.dart';
import 'app_colors.dart';
import 'app_typography.dart';

/// Ilova temasi — Sa katalog + AppColors bridj.
class AppTheme {
  AppTheme._();

  static SaCatalog? _catalog;

  static SaCatalog get catalog => _catalog ?? SaCatalog.fallback();

  static Future<void> loadCatalog() async {
    _catalog = await SaCatalog.loadBundled();
  }

  static ThemeData get lightTheme => SaTheme.light(catalog).copyWith(
        scaffoldBackgroundColor: AppColors.background,
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            // Screen slide — Motion Lab «screen» (yumshoq kirish)
            TargetPlatform.android: ZoomPageTransitionsBuilder(),
            TargetPlatform.iOS: ZoomPageTransitionsBuilder(),
            TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          },
        ),
        appBarTheme: const AppBarTheme(
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          backgroundColor: Colors.transparent,
          foregroundColor: AppColors.textTitle,
          toolbarHeight: 79,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surfaceVariant,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          hintStyle:
              AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled),
          labelStyle:
              AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        dividerTheme:
            const DividerThemeData(color: AppColors.borderLight, thickness: 1),
        snackBarTheme:
            const SnackBarThemeData(behavior: SnackBarBehavior.floating),
        drawerTheme: const DrawerThemeData(backgroundColor: AppColors.background),
      );

  static ThemeData get darkTheme => SaTheme.dark(catalog).copyWith(
        scaffoldBackgroundColor: SaColors.surfaceDark,
        appBarTheme: const AppBarTheme(
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          backgroundColor: Colors.transparent,
          foregroundColor: SaColors.inkDark,
          toolbarHeight: 79,
        ),
        snackBarTheme:
            const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      );
}

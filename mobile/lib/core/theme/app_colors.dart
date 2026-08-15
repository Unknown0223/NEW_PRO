import 'package:flutter/material.dart';

/// Agent 2.0 UI (develop-flutter-mobile-frontend shablon) rang palitrasi.
class AppColors {
  AppColors._();

  // Canvas
  static const Color background = Color(0xFFEDF3F7);
  static const Color surface = Colors.white;
  static const Color surfaceMuted = Color(0xFFF1F4F8);
  static const Color surfaceVariant = Color(0xFFEDF2F6);
  static const Color surfaceReport = Color(0xFFF3F6F9);
  static const Color surfaceNested = Color(0xFFF0F4F8);

  // Brand / primary (shablon #07958f)
  static const Color primary = Color(0xFF07958F);
  static const Color primaryLight = Color(0xFF3AB8B1);
  static const Color primaryDark = Color(0xFF064C4C);
  static const Color primarySoft = Color(0xFFE8F6F5);
  static const Color primaryGradientStart = Color(0xFF12C86F);
  static const Color primaryGradientEnd = Color(0xFF079BD4);

  // Text
  static const Color textPrimary = Color(0xFF13202B);
  static const Color textTitle = Color(0xFF111C28);
  static const Color textHeadline = Color(0xFF172330);
  static const Color textMenu = Color(0xFF26323D);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDisabled = Color(0xFFCBD5E1);

  // Status
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  // Role accents (agent = shablon primary)
  static const Color agentAccent = primary;
  static const Color expeditorAccent = Color(0xFFF97316);
  static const Color supervisorAccent = Color(0xFF6366F1);

  // UI chrome
  static const Color border = Color(0xFFE2E8F0);
  static const Color divider = Color(0xFFF1F5F9);
  static const Color borderLight = Color(0xFFEDF3F7);
  static const Color toastDark = Color(0xFF1A232C);
  static const Color mapWater = Color(0xFF84D3EF);
  static const Color mapPin = Color(0xFF078A83);
  static const Color shadow = Color(0x1A000000);
  static const Color topBarShadow = Color(0x12CBD5E1);

  static const Color successSoft = Color(0xFFEAFBEF);
  static const Color warningSoft = Color(0xFFFFF7ED);

  static List<BoxShadow> get fabShadow => [
        BoxShadow(
          color: primary.withValues(alpha: 0.36),
          blurRadius: 28,
          offset: const Offset(0, 12),
        ),
      ];

  // Teal aliases (eski kod bilan moslik)
  static const Color teal800 = Color(0xFF115E59);
  static const Color teal700 = Color(0xFF0F766E);
  static const Color teal600 = Color(0xFF0D9488);

  // Bonus / Discount (shablon #29 — BONUS & DISCOUNT LADDER)
  static const Color bonusBg = Color(0xFFFEF9C3);
  static const Color bonusBg2 = Color(0xFFFEF08A);
  static const Color bonusInk = Color(0xFF854D0E);
  static const Color bonusAccent = Color(0xFFCA8A04);

  static const Color discBg = Color(0xFFFFEDD5);
  static const Color discBg2 = Color(0xFFFED7AA);
  static const Color discInk = Color(0xFF7C2D12);
  static const Color discAccent = Color(0xFFEA580C);
}

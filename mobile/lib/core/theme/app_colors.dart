import 'package:flutter/material.dart';

import '../../design_system/design_system.dart';

/// Agent 2.0 UI rang palitrasi.
/// Yangi tokenlar: [SaColors] / [SaCompat] (`mobile/lib/design_system`).
/// Eski `AppColors.*` nomlari saqlanadi — ekranlar bosqichma-bosqich Sa* ga o‘tadi.
class AppColors {
  AppColors._();

  /// Dizayn-sistem versiyasi (shablon Flutter kit).
  static const String designSystemVersion = saDesignSystemVersion;

  // Canvas — SaColors.surfaceLight bridj
  static const Color background = Color(0xFFF7F9FA);
  static const Color surface = Colors.white;
  static const Color surfaceMuted = Color(0xFFF1F4F8);
  static const Color surfaceVariant = Color(0xFFEDF2F6);
  static const Color surfaceReport = Color(0xFFF3F6F9);
  static const Color surfaceNested = Color(0xFFF0F4F8);

  // Brand / primary — Agent Iris (prototip accent) + Sales Arena blue
  static const Color primary = Color(0xFF5548F0);
  static const Color primaryLight = Color(0xFFA79BFF);
  static const Color primaryDark = Color(0xFF14223F);
  static const Color primarySoft = Color(0xFFEEEBFF);
  static const Color primaryGradientStart = Color(0xFF6A5BFF);
  static const Color primaryGradientEnd = Color(0xFF3B2BD9);

  /// Yangi shablon accent (SaColors) — tezkor panel / yangi ekranlar.
  static Color get saAgent => SaColors.agent;
  static Color get saExpeditor => SaColors.expeditor;
  static Color get saSupervisor => SaColors.supervisor;
  static Color get saCashier => SaColors.cashier;
  static Color get saNavy => SaColors.navy;
  static Color get saSalesBlue => SaColors.salesBlue;

  // Text — Sa navy / ink
  static const Color textPrimary = Color(0xFF14223F);
  static const Color textTitle = Color(0xFF14223F);
  static const Color textHeadline = Color(0xFF14223F);
  static const Color textMenu = Color(0xFF14223F);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDisabled = Color(0xFFCBD5E1);

  // Status
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  // Role accents — prototip design.ts
  static const Color agentAccent = Color(0xFF5548F0);
  static const Color expeditorAccent = Color(0xFF4ADE80);
  static const Color supervisorAccent = Color(0xFF0369A1);
  static const Color cashierAccent = Color(0xFFC026D3);

  static Color roleAccent(SaRole role) => SaColors.roleAccent(role);

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

  // KPI oylik hisobot (Screen 35) — qorong‘i hero
  static const Color darkSurface = Color(0xFF0B2538);
  static const Color darkSurface2 = Color(0xFF0F4544);
  static const Color kpiChartGreen = Color(0xFF86EFAC);

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

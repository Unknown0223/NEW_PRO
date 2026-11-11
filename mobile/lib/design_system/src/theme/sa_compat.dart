import 'package:flutter/material.dart';
import '../tokens/sa_colors.dart';

/// Eski rang nomlarini yangi tokenlarga o'giruvchi adapter.
///
/// Ekranni ko'chirishda eski nomni topib yangisiga almashtiring:
///   AppColors.primary   ->  SaCompat.color('primary')
///   AppColors.background -> SaCompat.color('background')
/// Jadvalni to'liq ko'rish uchun: MIGRATION_MAP (saytda).
class SaCompat {
  const SaCompat._();

  static const Map<String, Color> _map = {
    'primary': SaColors.salesBlue,
    'primaryLight': SaColors.brightSky,
    'primaryDark': SaColors.navy,
    'background': SaColors.surfaceLight,
    'surface': SaColors.cardLight,
    'textPrimary': SaColors.inkLight,
    'textSecondary': Color(0xFF677386),
    'textMuted': Color(0xFF8A93A1),
    'border': Color(0xFFE2E8EF),
    'error': Color(0xFFE0574B),
    'success': Color(0xFF22B573),
    'warning': Color(0xFFE0A023),
    'agentAccent': SaColors.agent,
    'expeditorAccent': SaColors.expeditor,
    'supervisorAccent': SaColors.supervisor,
    'cashierAccent': SaColors.cashier,
  };

  /// Noma'lum nom kelsa kulrang qaytaradi — hech qachon crash bermaydi.
  static Color color(String legacyName, {Color fallback = Colors.grey}) {
    return _map[legacyName] ?? fallback;
  }

  static bool has(String legacyName) => _map.containsKey(legacyName);
}

/// Bosqichma-bosqich o'tish bayrog'i.
/// Bitta ekranni yangilab bo'lgach uni yoqing, hammasi tayyor bo'lgach
/// eski fayllarni o'chiring.
class SaFlags {
  SaFlags._();

  /// true bo'lsa yangi tema ishlaydi, false bo'lsa eski.
  static final ValueNotifier<bool> useNewTheme = ValueNotifier<bool>(true);

  /// Faqat katalog v2 dan keyingi ekranlar uchun.
  static final ValueNotifier<bool> useCatalogV2 = ValueNotifier<bool>(false);
}

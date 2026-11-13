export const PACKAGE_VERSION = "1.0.0";
export const PACKAGE_DIR = "mobile/lib/design_system";

export type FlutterFile = {
  path: string;
  tag: string;
  desc: string;
  code: string;
};

export const FLUTTER_FILES: FlutterFile[] = [
  {
    path: "mobile/lib/design_system/design_system.dart",
    tag: "Bosh fayl",
    desc: "Bitta import bilan butun paket. Versiya shu yerda saqlanadi.",
    code: `/// Sales Arena Design System v1.0.0
///
/// Bitta import — hamma narsa:
///   import 'package:sales_arena/design_system/design_system.dart';
///
/// Yangilash qoidasi: faqat MINOR/PATCH versiyada avtomatik olinadi,
/// MAJOR versiya qo'lda ko'chiriladi. Batafsil: UPGRADE.md
library design_system;

/// Paket versiyasi — katalog bilan moslik shu yerdan tekshiriladi.
const String saDesignSystemVersion = '1.0.0';

export 'src/tokens/sa_colors.dart';
export 'src/tokens/sa_type.dart';
export 'src/tokens/sa_motion.dart';
export 'src/tokens/sa_space.dart';
export 'src/theme/sa_theme.dart';
export 'src/theme/sa_compat.dart';
export 'src/widgets/sa_button.dart';
export 'src/widgets/sa_card.dart';
export 'src/widgets/sa_sheet.dart';
export 'src/widgets/sa_sync_view.dart';
export 'src/catalog/sa_catalog.dart';
`,
  },
  {
    path: "mobile/lib/design_system/src/tokens/sa_colors.dart",
    tag: "Token",
    desc: "Brend, rol aksentlari va sirt ranglari. Hex katalogdan ustidan yozilishi mumkin.",
    code: `import 'package:flutter/material.dart';

/// Rollarga bog'langan aksentlar — prototipdagi 4 rol bilan bir xil.
enum SaRole { agent, expeditor, supervisor, cashier }

/// Sales Arena rang tokenlari.
/// Hamma qiymat katalog (catalog.json) orqali ustidan yozilishi mumkin,
/// shuning uchun hech qachon to'g'ridan-to'g'ri hex ishlatmang.
class SaColors {
  const SaColors._();

  // Brend
  static const Color navy = Color(0xFF14223F);
  static const Color salesBlue = Color(0xFF1F66D1);
  static const Color brightSky = Color(0xFF6FA8FF);

  // Rol aksentlari
  static const Color agent = Color(0xFF1F66D1);
  static const Color expeditor = Color(0xFF0E8A4F);
  static const Color supervisor = Color(0xFF1FA855);
  static const Color cashier = Color(0xFF0F766E);

  static Color roleAccent(SaRole role) {
    switch (role) {
      case SaRole.agent:
        return agent;
      case SaRole.expeditor:
        return expeditor;
      case SaRole.supervisor:
        return supervisor;
      case SaRole.cashier:
        return cashier;
    }
  }

  // Yorug' sirtlar
  static const Color surfaceLight = Color(0xFFF7F9FA);
  static const Color cardLight = Colors.white;
  static const Color inkLight = Color(0xFF14223F);

  // Qorong'u sirtlar
  static const Color surfaceDark = Color(0xFF0B1226);
  static const Color cardDark = Color(0xFF131B29);
  static const Color inkDark = Color(0xFFE9EEF7);
}
`,
  },
  {
    path: "mobile/lib/design_system/src/tokens/sa_type.dart",
    tag: "Token",
    desc: "Shrift oilalari va matn uslublari shkalasi.",
    code: `import 'package:flutter/material.dart';

/// Tipografiya tokenlari: Display sarlavhalar, Text UI matnlar uchun.
class SaType {
  const SaType._();

  static const String displayFamily = 'Sora';
  static const String textFamily = 'Inter';
  static const String monoFamily = 'JetBrains Mono';

  static const TextStyle display = TextStyle(
    fontFamily: displayFamily,
    fontSize: 30,
    height: 1.06,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.5,
  );

  static const TextStyle title = TextStyle(
    fontFamily: displayFamily,
    fontSize: 17,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle body = TextStyle(
    fontFamily: textFamily,
    fontSize: 13.5,
    height: 1.45,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: textFamily,
    fontSize: 10.5,
    height: 1.3,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle mono = TextStyle(
    fontFamily: monoFamily,
    fontSize: 10,
    height: 1.3,
    fontWeight: FontWeight.w500,
  );
}
`,
  },
  {
    path: "mobile/lib/design_system/src/tokens/sa_motion.dart",
    tag: "Token",
    desc: "Davomiylik va egriliklar. Tizim sozlamasidagi harakat chegarasi hurmat qilinadi.",
    code: `import 'package:flutter/material.dart';

/// Harakat tokenlari — prototipdagi Motion Lab bilan bir xil.
class SaDurations {
  const SaDurations._();

  /// Tugma bosilishi, kichik holat o'zgarishi
  static const Duration fast = Duration(milliseconds: 120);

  /// Kartalar, ro'yxat elementlari, sheet ochilishi
  static const Duration base = Duration(milliseconds: 240);

  /// Sahifa o'tishlari, urg'uli animatsiyalar
  static const Duration emphatic = Duration(milliseconds: 420);

  /// Faqat yuklanish indikatorlari uchun
  static const Duration slow = Duration(milliseconds: 600);
}

class SaCurves {
  const SaCurves._();

  /// Asosiy egrilik: tez boshlanib, yumshoq to'xtaydi
  static const Curve standard = Cubic(0.16, 1, 0.3, 1);

  /// Kirish animatsiyalari uchun
  static const Curve enter = Curves.easeOutCubic;

  /// Diqqat tortuvchi elementlar uchun
  static const Curve pop = Cubic(0.34, 1.56, 0.64, 1);
}

/// Foydalanuvchi tizimda harakatni o'chirgan bo'lsa true qaytaradi.
bool saReduceMotion(BuildContext context) {
  return MediaQuery.disableAnimationsOf(context);
}

/// Harakat sozlamasiga qarab davomiylikni tanlaydi.
Duration saDuration(BuildContext context, Duration normal) {
  return saReduceMotion(context) ? Duration.zero : normal;
}
`,
  },
  {
    path: "mobile/lib/design_system/src/tokens/sa_space.dart",
    tag: "Token",
    desc: "Masofa shkalasi va burchak radiuslari.",
    code: `/// Masofa va radius tokenlari — 4px lik baza katak.
class SaSpace {
  const SaSpace._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
}

class SaRadius {
  const SaRadius._();

  /// Kichik chip, badge
  static const double chip = 8;

  /// Tugma, input
  static const double control = 12;

  /// Karta, ro'yxat elementi
  static const double card = 16;

  /// Pastki varaq, dialog
  static const double sheet = 20;

  /// Telefon ramkasi, katta panel
  static const double panel = 28;
}
`,
  },
  {
    path: "mobile/lib/design_system/src/theme/sa_theme.dart",
    tag: "Tema",
    desc: "Tokenlardan ThemeData yig'adi. Katalog ustidan yozishlarni qo'llaydi.",
    code: `import 'package:flutter/material.dart';
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
      fontFamily: SaType.textFamily,
      appBarTheme: const AppBarTheme(centerTitle: false, elevation: 0),
      cardTheme: CardTheme(
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
`,
  },
  {
    path: "mobile/lib/design_system/src/theme/sa_compat.dart",
    tag: "Moslik",
    desc: "Eski kodni buzmasdan ko'chirish uchun adapter va bayroq.",
    code: `import 'package:flutter/material.dart';
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
`,
  },
  {
    path: "mobile/lib/design_system/src/widgets/sa_button.dart",
    tag: "Vidget",
    desc: "Asosiy va ikkilamchi tugmalar. Yuklanish holati ichida.",
    code: `import 'package:flutter/material.dart';
import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';

/// Brendning asosiy tugmasi: to'liq kenglik, 48px balandlik.
class SaPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const SaPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: scheme.primary.withOpacity(0.45),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaRadius.control),
          ),
        ),
        child: AnimatedSwitcher(
          duration: SaDurations.fast,
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Row(
                  key: const ValueKey('label'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 16),
                      const SizedBox(width: SaSpace.sm),
                    ],
                    Text(label),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Ikkilamchi harakatlar uchun chiziqli tugma.
class SaGhostButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  const SaGhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: scheme.outlineVariant),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaRadius.control),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16),
              const SizedBox(width: SaSpace.sm),
            ],
            Text(label),
          ],
        ),
      ),
    );
  }
}
`,
  },
  {
    path: "mobile/lib/design_system/src/widgets/sa_card.dart",
    tag: "Vidget",
    desc: "Karta, bo'lim sarlavhasi va statistika plitkasi.",
    code: `import 'package:flutter/material.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';

/// Standart kontent kartasi: 16px radius, yupqa chegara, soyasiz.
class SaCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const SaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(SaSpace.lg),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(SaRadius.card),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: child,
    );
    if (onTap == null) return body;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(SaRadius.card),
      child: body,
    );
  }
}

/// Bo'lim sarlavhasi: kichik mono ustki matn + katta sarlavha.
class SaSectionTitle extends StatelessWidget {
  final String eyebrow;
  final String title;

  const SaSectionTitle({super.key, required this.eyebrow, required this.title});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: SaType.mono.copyWith(color: scheme.primary, fontSize: 9),
        ),
        const SizedBox(height: SaSpace.xs),
        Text(title, style: SaType.title.copyWith(color: scheme.onSurface)),
      ],
    );
  }
}
`,
  },
  {
    path: "mobile/lib/design_system/src/widgets/sa_sheet.dart",
    tag: "Vidget",
    desc: "Brend uslubidagi pastki varaq: sarlavha, yopish, sudraluvchi tutqich.",
    code: `import 'package:flutter/material.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';

/// Pastki varaq — barcha bottom sheet'lar shu orqali ochiladi.
///
///   SaSheet.show(context, title: 'Bonus', child: BonusBody());
class SaSheet {
  const SaSheet._();

  static Future<T?> show<T>(
    BuildContext context, {
    required String title,
    required Widget child,
    String? subtitle,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final scheme = Theme.of(ctx).colorScheme;
        return Container(
          decoration: BoxDecoration(
            color: scheme.surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(SaRadius.sheet),
            ),
          ),
          padding: EdgeInsets.only(
            left: SaSpace.lg,
            right: SaSpace.lg,
            top: SaSpace.sm,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + SaSpace.lg,
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: scheme.outlineVariant,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: SaSpace.md),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: SaType.title),
                          if (subtitle != null)
                            Text(subtitle, style: SaType.caption),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: SaSpace.sm),
                Flexible(child: SingleChildScrollView(child: child)),
              ],
            ),
          ),
        );
      },
    );
  }
}
`,
  },
  {
    path: "mobile/lib/design_system/src/widgets/sa_sync_view.dart",
    tag: "Vidget",
    desc: "Brendli sinxronlash animatsiyasi: halqa, bosqichlar, yakun belgisi.",
    code: `import 'package:flutter/material.dart';
import '../tokens/sa_colors.dart';
import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';

/// Sinxronlash holati ko'rsatkichi.
/// progress 0..1, steps bosqich nomlari, done=true da yakun belgisi.
class SaSyncView extends StatelessWidget {
  final double progress;
  final List<String> steps;
  final int doneSteps;
  final bool done;

  const SaSyncView({
    super.key,
    required this.progress,
    required this.steps,
    required this.doneSteps,
    this.done = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final reduce = saReduceMotion(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 120,
          height: 120,
          child: Stack(
            alignment: Alignment.center,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
                duration: reduce ? Duration.zero : SaDurations.base,
                curve: SaCurves.standard,
                builder: (ctx, v, _) => CircularProgressIndicator(
                  value: v,
                  strokeWidth: 8,
                  backgroundColor: scheme.outlineVariant,
                  valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
                ),
              ),
              AnimatedSwitcher(
                duration: SaDurations.fast,
                child: done
                    ? Icon(Icons.check_circle,
                        key: const ValueKey('ok'), size: 44, color: scheme.primary)
                    : Text(
                        (progress.clamp(0.0, 1.0) * 100).round().toString() + '%',
                        key: const ValueKey('pct'),
                        style: SaType.mono.copyWith(
                          fontSize: 16,
                          color: scheme.onSurface,
                        ),
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SaSpace.md),
        ...steps.asMap().entries.map((e) {
          final ok = e.key < doneSteps;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                Icon(
                  ok ? Icons.check_circle : Icons.circle_outlined,
                  size: 16,
                  color: ok ? SaColors.expeditor : scheme.outline,
                ),
                const SizedBox(width: SaSpace.sm),
                Text(e.value, style: SaType.body),
              ],
            ),
          );
        }),
      ],
    );
  }
}
`,
  },
  {
    path: "mobile/lib/design_system/src/catalog/sa_catalog.dart",
    tag: "Katalog",
    desc: "Versiyali katalog: aktivdan yuklash, masofadan yangilash, kesh.",
    code: `import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import '../tokens/sa_colors.dart';

/// Saqlagich interfeysi — ilova o'zi beradi (masalan shared_preferences).
/// Bermasa xotirada saqlanadi, ilova yopilganda unutiladi.
abstract class SaCatalogStore {
  Future<String?> read();
  Future<void> write(String raw);
}

class _MemoryStore implements SaCatalogStore {
  String? _v;
  @override
  Future<String?> read() async => _v;
  @override
  Future<void> write(String raw) async {
    _v = raw;
  }
}

/// Dizayn katalogi: ranglar va bayroqlar, versiya bilan.
/// Katalog yangilanganda KOD O'ZGARMAYDI — faqat JSON keladi.
class SaCatalog extends ChangeNotifier {
  SaCatalog._(this.version, this._raw);

  /// Paket ichidagi boshlang'ich katalog.
  factory SaCatalog.fallback() {
    return SaCatalog._('1.0.0', const <String, dynamic>{});
  }

  factory SaCatalog.fromJson(Map<String, dynamic> json) {
    return SaCatalog._(
      (json['version'] ?? '1.0.0').toString(),
      Map<String, dynamic>.from(json),
    );
  }

  final String version;
  final Map<String, dynamic> _raw;

  static const String assetPath = 'assets/design/catalog.json';

  /// Aktivdagi katalogni o'qiydi (har doim bor — fallback).
  static Future<SaCatalog> loadBundled() async {
    try {
      final raw = await rootBundle.loadString(assetPath);
      return SaCatalog.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return SaCatalog.fallback();
    }
  }

  /// Masofadagi katalogni tekshiradi. Yangi versiya bo'lsa yuklab,
  /// saqlaydi va true qaytaradi. Xatoda false — ilova to'xtamaydi.
  Future<bool> checkForUpdate({
    required String baseUrl,
    SaCatalogStore? store,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final effective = store ?? _MemoryStore();
    try {
      final client = HttpClient();
      client.connectionTimeout = timeout;
      final req = await client.getUrl(Uri.parse(baseUrl + '/catalog.json'));
      final res = await req.close().timeout(timeout);
      if (res.statusCode != 200) return false;
      final body = await res.transform(utf8.decoder).join();
      final json = Map<String, dynamic>.from(jsonDecode(body) as Map);
      final next = SaCatalog.fromJson(json);
      if (!_isNewer(next.version, version)) return false;
      await effective.write(body);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Saqlangan katalogni tiklaydi (kesh).
  static Future<SaCatalog> loadCached(SaCatalogStore store) async {
    try {
      final raw = await store.read();
      if (raw == null) return SaCatalog.fallback();
      return SaCatalog.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return SaCatalog.fallback();
    }
  }

  /// '1.2.0' > '1.1.9' kabi solishtiradi.
  static bool _isNewer(String a, String b) {
    List<int> p(String v) =>
        v.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final x = p(a), y = p(b);
    for (var i = 0; i < 3; i++) {
      final dx = i < x.length ? x[i] : 0;
      final dy = i < y.length ? y[i] : 0;
      if (dx != dy) return dx > dy;
    }
    return false;
  }

  /// Rangni o'qiydi, topilmasa token qaytadi.
  int colorHex(String key, int fallback) {
    final colors = _raw['colors'];
    if (colors is Map && colors[key] is String) {
      final hex = (colors[key] as String).replaceAll('#', '');
      return int.tryParse('FF' + hex, radix: 16) ?? fallback;
    }
    return fallback;
  }

  bool flag(String key, bool fallback) {
    final flags = _raw['flags'];
    if (flags is Map && flags[key] is bool) return flags[key] as bool;
    return fallback;
  }

  SaResolvedColors resolve() {
    return SaResolvedColors(
      salesBlue: Color(colorHex('salesBlue', 0xFF1F66D1)),
      brightSky: Color(colorHex('brightSky', 0xFF6FA8FF)),
    );
  }
}

class SaResolvedColors {
  final Color salesBlue;
  final Color brightSky;
  const SaResolvedColors({required this.salesBlue, required this.brightSky});
}
`,
  },
  {
    path: "mobile/assets/design/catalog.json",
    tag: "Katalog",
    desc: "Boshlang'ich katalog v1.0.0 — pubspec assets'ga qo'shiladi.",
    code: `{
  "version": "1.0.0",
  "updated": "2026-01-01",
  "colors": {
    "salesBlue": "#1F66D1",
    "brightSky": "#6FA8FF",
    "agent": "#1F66D1",
    "expeditor": "#0E8A4F",
    "supervisor": "#1FA855",
    "cashier": "#0F766E"
  },
  "radius": { "card": 16, "sheet": 20, "control": 12 },
  "flags": { "newSyncView": true, "catalogV2": false }
}
`,
  },
  {
    path: "mobile/lib/design_system/UPGRADE.md",
    tag: "Hujjat",
    desc: "Versiyalash va yangilash siyosati — jamoa uchun.",
    code: `# Design System — yangilash siyosati

Paket versiyasi: \`design_system.dart\` ichidagi \`saDesignSystemVersion\`.
Katalog versiyasi: \`assets/design/catalog.json\` ichidagi \`version\`.

## 1. Katalog yangilash (kod tegilmaydi)

1. Studiyada rangni o'zgartiring, \`catalog.json\` ni eksport qiling.
2. \`version\` ni oshiring: 1.0.0 -> 1.1.0 (kichik o'zgarish) yoki
   1.0.0 -> 2.0.0 (katta o'zgarish).
3. Faylni serverga joylang: \`GET {baseUrl}/catalog.json\`.
4. Ilova keyingi bootstrap'da o'zi oladi, keshga yozadi va qo'llaydi.
5. Eski versiya har doim aktivda turadi — internet bo'lmasa ham ishlaydi.

## 2. Paket yangilash (kod ko'chirish)

- PATCH (1.0.0 -> 1.0.1): papkani ustiga yozing, holos.
- MINOR (1.0.0 -> 1.1.0): papkani ustiga yozing + CHANGELOG'dagi
  "Yangi" bo'limini o'qing. Eski API o'chirilmaydi.
- MAJOR (1.x -> 2.0): alohida branch'da ko'chiring. Eski nomlar
  avval \`@deprecated\` bo'ladi, keyin o'chiriladi.

## 3. Moslik qoidalari

- Hech qachon token o'rniga to'g'ridan-to'g'ri hex ishlatmang.
- Yangi ekran — faqat \`Sa*\` widgetlar bilan yoziladi.
- Eski ekran — \`SaCompat\` orqali, bitta ekranga bitta PR.
- \`SaFlags.useNewTheme=false\` qilib har doim orqaga qaytish mumkin.
`,
  },
];

export type Patch = {
  target: string;
  action: "Qo'shish" | "Almashtirish" | "Saqlash";
  title: string;
  desc: string;
  lang: string;
  code: string;
};

export const PATCHES: Patch[] = [
  {
    target: "mobile/pubspec.yaml",
    action: "Qo'shish",
    title: "Katalog aktivini ro'yxatlash",
    desc: "Faqat bitta blok qo'shiladi — boshqa bog'liqlik kerak emas, paket sof Flutter.",
    lang: "yaml",
    code: `flutter:
  uses-material-design: true
  assets:
    - assets/design/catalog.json   # <-- SA dizayn katalogi v1.0.0
`,
  },
  {
    target: "mobile/lib/main.dart",
    action: "Almashtirish",
    title: "Ilovani paketga ulash — 3 qator",
    desc: "MaterialApp theme maydonlari almashtiriladi, qolgan kod tegilmaydi.",
    lang: "dart",
    code: `// 1-qator: import qo'shing
import 'package:sales_arena/design_system/design_system.dart';

// 2-qator: katalogni bootstrap'da yuklang
final catalog = await SaCatalog.loadBundled();

// 3-qator: MaterialApp ichida
MaterialApp(
  theme: SaTheme.light(catalog),      // eski: ThemeData(...)
  darkTheme: SaTheme.dark(catalog),   // eski: ThemeData.dark()
  home: const BootstrapScreen(),
);
`,
  },
  {
    target: "mobile/lib/.../biror_screen.dart",
    action: "Almashtirish",
    title: "Bitta ekranni ko'chirish namunasi",
    desc: "Eski nomlar SaCompat orqali, vidgetlar Sa* orqali. Bitta ekran — bitta PR.",
    lang: "dart",
    code: `// OLDIN:
//   backgroundColor: AppColors.background,
//   borderRadius: BorderRadius.circular(16),
//   showModalBottomSheet(context: context, builder: (_) => BonusBody());

// KEYIN:
import 'package:sales_arena/design_system/design_system.dart';

final scheme = Theme.of(context).colorScheme; // allaqachon SA temasi

SaCard(                                  // background + radius tayyor
  child: SaSectionTitle(
    eyebrow: 'Bonus',
    title: 'Sizga 2 ta sovg\\'a',
  ),
);

SaPrimaryButton(                         // 48px, yuklanish holati bilan
  label: 'Tasdiqlash',
  loading: state.isSubmitting,
  onPressed: state.isSubmitting ? null : submit,
);

SaSheet.show(                             // brend uslubidagi varaq
  context,
  title: 'Bonus',
  child: const BonusBody(),
);
`,
  },
  {
    target: "mobile/lib/core/theme/app_colors.dart",
    action: "Saqlash",
    title: "Eski fayl o'chirilmaydi",
    desc: "SaCompat shu fayldagi nomlarni o'qiydi. Hamma ekran ko'chib bo'lgach, fayl @deprecated belgilanib keyingi MAJOR'da o'chiriladi.",
    lang: "dart",
    code: `// Hech narsa o'zgartirmang. Faqat pastga eslatma qo'shing:
//
// @deprecated
// Yangi kodda SaColors ishlating. Ko'chirish jadvali: saytdagi
// "Moslik" bo'limi. O'chirish rejasi: paket v2.0.0.
//
class AppColors {
  // ... mavjud kod o'zgarishsiz qoladi
}
`,
  },
];

export type MigrationRow = { old: string; now: string; note: string };

export const MIGRATION_MAP: MigrationRow[] = [
  { old: "AppColors.primary", now: "SaColors.salesBlue", note: "Asosiy brend rangi" },
  { old: "AppColors.primaryLight", now: "SaColors.brightSky", note: "Yorug' aksent" },
  { old: "AppColors.primaryDark", now: "SaColors.navy", note: "To'q brend" },
  { old: "AppColors.background", now: "scheme.surface", note: "Tema orqali" },
  { old: "AppColors.surface", now: "SaCard (tayyor)", note: "Vidget bilan" },
  { old: "AppColors.textPrimary", now: "scheme.onSurface", note: "Tema orqali" },
  { old: "AppColors.textSecondary", now: "SaType.body", note: "Uslub bilan" },
  { old: "AppColors.border", now: "scheme.outlineVariant", note: "Tema orqali" },
  { old: "AppColors.agentAccent", now: "SaColors.roleAccent(SaRole.agent)", note: "Rol bo'yicha" },
  { old: "AppColors.expeditorAccent", now: "SaColors.roleAccent(SaRole.expeditor)", note: "Rol bo'yicha" },
  { old: "AppColors.supervisorAccent", now: "SaColors.roleAccent(SaRole.supervisor)", note: "Rol bo'yicha" },
  { old: "AppColors.cashierAccent", now: "SaColors.roleAccent(SaRole.cashier)", note: "Rol bo'yicha" },
  { old: "BorderRadius.circular(16)", now: "SaRadius.card", note: "Token" },
  { old: "BorderRadius.circular(20)", now: "SaRadius.sheet", note: "Token" },
  { old: "Duration(ms: 120/240/420)", now: "SaDurations.fast/base/emphatic", note: "Motion Lab bilan bir xil" },
  { old: "Curves.easeOut...", now: "SaCurves.standard", note: "cubic(0.16,1,0.3,1)" },
  { old: "ElevatedButton(...)", now: "SaPrimaryButton", note: "Yuklanish holati ichida" },
  { old: "showModalBottomSheet(...)", now: "SaSheet.show(...)", note: "Sarlavha + tutqich tayyor" },
  { old: "CircularProgressIndicator", now: "SaSyncView", note: "Brendli progress" },
];

export type InstallStep = {
  no: string;
  title: string;
  desc: string;
  cmd?: string;
  note?: string;
};

export const INSTALL_STEPS: InstallStep[] = [
  {
    no: "01",
    title: "Paketni ko'chiring",
    desc: "ZIP'ni yuklab mobile/ papkasida oching. Natija: mobile/lib/design_system/ + mobile/assets/design/catalog.json",
    cmd: "unzip sales-arena-design-system-v1.0.0.zip -d mobile/",
    note: "14 fayl · 0 tashqi bog'liqlik · faqat Flutter SDK",
  },
  {
    no: "02",
    title: "Katalogni ro'yxatlang",
    desc: "pubspec.yaml'ga bitta assets bloki qo'shing, so'ng paketlarni yangilang.",
    cmd: "flutter pub get",
  },
  {
    no: "03",
    title: "main.dart'ni ulang",
    desc: "3 qator: import, katalog yuklash, theme almashtirish. Qolgan kod tegilmaydi.",
    cmd: "flutter analyze",
    note: "Xatolik bo'lmasligi kerak — paket mustaqil",
  },
  {
    no: "04",
    title: "Bitta ekranda sinang",
    desc: "Masalan login ekranida SaPrimaryButton'ni qo'ying. Yoqmasa SaFlags.useNewTheme=false — eski ko'rinish qaytadi.",
    cmd: "flutter run",
  },
  {
    no: "05",
    title: "Katalog yangilashni yoqing",
    desc: "SaCatalog.checkForUpdate(baseUrl) ni bootstrap'ga qo'shing. Shundan keyin rang yangilanishi kod o'zgartirmaydi.",
  },
  {
    no: "06",
    title: "Ekranni ekranga ko'chiring",
    desc: "Har bir ekran alohida PR: SaCompat jadvali bo'yicha nomlarni almashtiring, testdan o'tkazing.",
  },
];

export type CatalogStage = { no: string; title: string; desc: string };

export const CATALOG_FLOW: CatalogStage[] = [
  { no: "1", title: "Dizayner o'zgartiradi", desc: "Shu studiyada rang tanlanadi, katalog.json eksport qilinadi." },
  { no: "2", title: "Versiya oshiriladi", desc: "1.0.0 → 1.1.0 (kichik) yoki → 2.0.0 (katta o'zgarish)." },
  { no: "3", title: "Serverga joylanadi", desc: "GET {baseUrl}/catalog.json — oddiy statik fayl." },
  { no: "4", title: "Ilova tekshiradi", desc: "Bootstrap'da checkForUpdate() chaqiriladi, versiya solishtiriladi." },
  { no: "5", title: "Keshga yoziladi", desc: "Yangi JSON saqlanadi — internet bo'lmasa eskisi ishlaydi." },
  { no: "6", title: "Darhol qo'llanadi", desc: "SaTheme qayta yig'iladi. Kod, build va market yangilanishi shart emas." },
];

export type MapRow = { target: string; action: string; detail: string; status: "keep" | "edit" | "add" };

export const REPO_MAP: MapRow[] = [
  { target: "mobile/lib/design_system/ (yangi)", action: "14 fayl qo'shish", detail: "Tokenlar, tema, 4 vidget, katalog, UPGRADE.md", status: "add" },
  { target: "mobile/assets/design/catalog.json", action: "1 fayl qo'shish", detail: "Boshlang'ich katalog v1.0.0", status: "add" },
  { target: "mobile/pubspec.yaml", action: "assets bloki", detail: "Faqat 1 qator guruh qo'shiladi", status: "edit" },
  { target: "mobile/lib/main.dart", action: "3 qator", detail: "import + katalog + theme; qolgan kod tegilmaydi", status: "edit" },
  { target: "mobile/lib/core/theme/app_colors.dart", action: "Saqlash", detail: "SaCompat o'qiydi; hamma ekran ko'chagach @deprecated", status: "keep" },
  { target: "mobile/lib/.../screens/*.dart", action: "Bitta-bitta", detail: "Har ekran alohida PR, SaCompat jadvali bo'yicha", status: "edit" },
  { target: "mobile/test/", action: "2 test qo'shish", detail: "Katalog versiya solishtirish + token regressiya", status: "add" },
];

/* ------------------------------------------------------------------ */
/*  Handoff bundle                                                     */
/* ------------------------------------------------------------------ */

export function handoffReadme(): string {
  return `# Sales Arena — Design Handoff

Bu paket Sales Arena mobil ilovasi uchun dizayn tizimi va integratsiya
hujjatlarini o'z ichiga oladi.

## Tarkib

| Fayl | Vazifasi |
|---|---|
| design_system/ | Flutter paket (14 fayl, 0 bog'liqlik) |
| assets/design/catalog.json | Versiyali katalog — kodsiz yangilash |
| docs/tokens.json | Dizayn tokenlari (rang, radius, motion) |
| docs/screens.json | ${"54"} ekran metadata (rol, tavsif, teglar) |
| docs/templates.json | Shablon katalogi |
| docs/migration-map.json | Eski nom -> yangi token jadvali |
| docs/patches/ | Tegishli fayl yamoqlari (pubspec, main.dart) |
| UPGRADE.md | Versiyalash va yangilash siyosati |

## 5 daqiqada ulash

\`\`\`bash
# 1. Paketni loyihaga ko'chiring
unzip sales-arena-design-system-v${PACKAGE_VERSION}.zip -d mobile/

# 2. pubspec.yaml ga qo'shing
#    assets:
#      - assets/design/catalog.json
flutter pub get
\`\`\`

\`\`\`dart
// main.dart
import 'package:sales_arena/design_system/design_system.dart';

final catalog = await SaCatalog.loadBundled();

MaterialApp(
  theme: SaTheme.light(catalog),
  darkTheme: SaTheme.dark(catalog),
  home: const BootstrapScreen(),
);
\`\`\`

## Katalogni yangilash (build kerak emas)

1. Studiyada rangni o'zgartiring va catalog.json eksport qiling.
2. Versiyani oshiring (1.0.0 -> 1.1.0).
3. Serverga qo'ying: GET {baseUrl}/catalog.json
4. Bootstrap'da: \`await catalog.checkForUpdate(baseUrl: ...)\`
5. Keyingi ochilishda yangi rang avtomatik qo'llanadi.

## Moslik kafolati

- Eski fayllar o'chirilmaydi, \`SaCompat\` orqali ishlaydi.
- \`SaFlags.useNewTheme = false\` bilan orqaga qaytish mumkin.
- Har ekran alohida PR'da ko'chiriladi.
- Semver: PATCH/MINOR ustiga yoziladi, MAJOR alohida branch.

Batafsil: UPGRADE.md va docs/migration-map.json
`;
}

/* ================================================================== */
/*  FULL-STACK SOURCE (backend + Flutter client)                       */
/* ================================================================== */

export type StackFile = { path: string; tag: string; desc: string; code: string };

export const STACK_VERSION = "1.0.0";

export const STACK_FILES: StackFile[] = [
  /* ── backend build/config ─────────────────────────────── */
  {
    path: "backend/package.json",
    tag: "Konfig",
    desc: "Fastify + Prisma + SQLite. Ishlab chiqishda ws, testda vitest.",
    code: `{
  "name": "sales-arena-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "setup": "npm run db:push && npm run db:seed"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@fastify/jwt": "^8.0.1",
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.28.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "tsx": "^4.16.5",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.5.0"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
`,
  },
  {
    path: "backend/prisma/schema.prisma",
    tag: "DB",
    desc: "9 model: user, client, product, order, order item, payment, visit, bonus rule, sync log. SQLite — bir buyruqda ishga tushadi.",
    code: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  login     String   @unique
  password  String
  name      String
  role      String   // agent | expeditor | supervisor | cashier
  pinHash   String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  visits   Visit[]
  orders   Order[]   @relation("agentOrders")
  payments Payment[]
}

model Client {
  id        Int      @id @default(autoincrement())
  code      String   @unique
  name      String
  inn       String?
  city      String
  address   String?
  tier      String   @default("B")
  balance   Int      @default(0)   // tiyin hisobida
  lat       Float?
  lng       Float?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  orders  Order[]
  visits  Visit[]
  payments Payment[]
}

model Product {
  id       Int    @id @default(autoincrement())
  sku      String @unique
  name     String
  category String
  price    Int    // tiyin
  stock    Int    @default(0)
  perBox   Int    @default(1)
  active   Boolean @default(true)

  items OrderItem[]
}

model Order {
  id          Int      @id @default(autoincrement())
  number      String   @unique
  clientId    Int
  agentId     Int
  status      String   @default("new") // new|confirmed|delivered|cancelled
  total       Int
  discountPct Float    @default(0)
  bonusQty    Int      @default(0)
  consignment Boolean  @default(false)
  dueDate     String?
  comment     String?
  createdAt   DateTime @default(now())

  client Client      @relation(fields: [clientId], references: [id])
  agent  User        @relation("agentOrders", fields: [agentId], references: [id])
  items  OrderItem[]
  payments Payment[]
}

model OrderItem {
  id        Int @id @default(autoincrement())
  orderId   Int
  productId Int
  qty       Int
  price     Int
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])
}

model Payment {
  id        Int      @id @default(autoincrement())
  clientId  Int
  orderId   Int?
  amount    Int
  method    String   // cash | card | transfer
  status    String   @default("pending") // pending|approved|rejected
  createdAt DateTime @default(now())
  client    Client   @relation(fields: [clientId], references: [id])
  order     Order?   @relation(fields: [orderId], references: [id])
  cashier   User?    @relation(fields: [cashierId], references: [id])
  cashierId Int?
}

model Visit {
  id        Int      @id @default(autoincrement())
  clientId  Int
  agentId   Int
  status    String   @default("active") // active|done|refused
  reason    String?
  lat       Float?
  lng       Float?
  startedAt DateTime @default(now())
  endedAt   DateTime?
  client    Client   @relation(fields: [clientId], references: [id])
  agent     User     @relation(fields: [agentId], references: [id])
}

model BonusRule {
  id        Int    @id @default(autoincrement())
  name      String
  type      String // qty | sum
  stepQty   Int?
  bonusQty  Int?
  minSum    Int?
  maxBonus  Int?
  inBlocks  Boolean @default(false)
  active    Boolean @default(true)
}

model SyncLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  kind      String   // identity | quick | full
  sent      Int      @default(0)
  received  Int      @default(0)
  createdAt DateTime @default(now())
}
`,
  },
  {
    path: "backend/.env.example",
    tag: "Konfig",
    desc: "Bitta fayl nusxalab .env qiling. JWT_SECRET ni almashtiring.",
    code: `DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me-in-production-min-32-chars"
PORT=4000
CORS_ORIGIN="http://localhost:3000"
PASSIVE_MODE=false
`,
  },
  {
    path: "backend/src/db.ts",
    tag: "Yadro",
    desc: "Prisma klientining yagona nusxasi.",
    code: `import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});
`,
  },
  {
    path: "backend/src/auth.ts",
    tag: "Xavfsizlik",
    desc: "JWT yaratish, parol hash, rol bo'yicha ruxsat (RBAC).",
    code: `import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export type Role = 'agent' | 'expeditor' | 'supervisor' | 'cashier';

export type AuthUser = { id: number; role: Role; name: string };

export async function hashPassword(raw: string) {
  return bcrypt.hash(raw, 10);
}

export async function verifyPassword(raw: string, hash: string) {
  return bcrypt.compare(raw, hash);
}

/** Marshrutni himoyalash: jwt tekshiriladi va rol talab qilinadi. */
export function guard(app: FastifyInstance, roles?: Role[]) {
  return async (req: FastifyRequest) => {
    const user = await req.jwtVerify<AuthUser>();
    if (roles && !roles.includes(user.role)) {
      const err: any = new Error('Ruxsat yo\\'q');
      err.statusCode = 403;
      throw err;
    }
  };
}
`,
  },
  {
    path: "backend/src/server.ts",
    tag: "Kirish",
    desc: "50 qator: CORS, JWT, xato formati, barcha marshrutlar biriktiriladi.",
    code: `import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { registerAuth } from './routes/auth.js';
import { registerClients } from './routes/clients.js';
import { registerProducts } from './routes/products.js';
import { registerOrders } from './routes/orders.js';
import { registerVisits } from './routes/visits.js';
import { registerKpi } from './routes/kpi.js';
import { registerSync } from './routes/sync.js';
import { registerPayments } from './routes/payments.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: (process.env.CORS_ORIGIN ?? '*').split(',') });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-me' });

/** Yagona xato formati — ilova bitta shaklga tayanadi. */
app.setErrorHandler((error, _req, reply) => {
  const status = (error as any).statusCode ?? 400;
  reply.status(status).send({
    ok: false,
    code: (error as any).code ?? 'request_failed',
    message: status >= 500 ? 'Server xatosi' : error.message,
  });
});

app.get('/health', async () => ({ ok: true, version: '1.0.0', time: new Date().toISOString() }));

await app.register(registerAuth, { prefix: '/api/auth' });
await app.register(registerClients, { prefix: '/api/clients' });
await app.register(registerProducts, { prefix: '/api/products' });
await app.register(registerOrders, { prefix: '/api/orders' });
await app.register(registerVisits, { prefix: '/api/visits' });
await app.register(registerPayments, { prefix: '/api/payments' });
await app.register(registerKpi, { prefix: '/api/kpi' });
await app.register(registerSync, { prefix: '/api/sync' });

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });

export default app;
`,
  },
  {
    path: "backend/src/routes/auth.ts",
    tag: "API",
    desc: "POST /login, POST /pin, GET /me. Parol bcrypt, token 7 kun.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard, verifyPassword, hashPassword } from '../auth.js';

const loginBody = z.object({
  login: z.string().min(3),
  password: z.string().min(6),
});
const pinBody = z.object({ pin: z.string().length(4) });

export async function registerAuth(app: FastifyInstance) {
  /** Kirish: login + parol -> JWT + foydalanuvchi */
  app.post('/login', async (req, reply) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { login: body.login } });
    if (!user || !(await verifyPassword(body.password, user.password))) {
      return reply.status(401).send({ ok: false, code: 'invalid_credentials', message: 'Login yoki parol xato' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { pinHash: user.pinHash ?? (await hashPassword('1234')) },
    });
    const token = app.jwt.sign({ id: user.id, role: user.role, name: user.name }, { expiresIn: '7d' });
    return {
      ok: true,
      token,
      user: { id: user.id, name: user.name, login: user.login, role: user.role, hasPin: true },
    };
  });

  /** PIN bilan tez kirish (oflayn qurilmada lokal tekshiriladi) */
  app.post('/pin', { preHandler: guard(app) }, async (req, reply) => {
    const { pin } = pinBody.parse(req.body);
    const me = req.user as { id: number };
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    const ok = user?.pinHash ? await verifyPassword(pin, user.pinHash) : pin === '1234';
    return ok ? { ok: true } : reply.status(401).send({ ok: false, code: 'pin_invalid', message: 'PIN xato' });
  });

  /** Joriy foydalanuvchi */
  app.get('/me', { preHandler: guard(app) }, async (req) => {
    const me = req.user as { id: number };
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, name: true, login: true, role: true },
    });
    return { ok: true, user };
  });
}
`,
  },
  {
    path: "backend/src/routes/clients.ts",
    tag: "API",
    desc: "Ro'yxat (qidiruv + sahifalash), detal (ledger bilan), yaratish, yangilash.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

const createBody = z.object({
  name: z.string().min(3),
  inn: z.string().length(9).optional(),
  city: z.string().min(2),
  address: z.string().optional(),
  tier: z.enum(['A', 'B', 'C']).default('B'),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function registerClients(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  app.get('/', async (req) => {
    const { q = '', take = '50', skip = '0' } = req.query as Record<string, string>;
    const where = q
      ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] }
      : {};
    const [rows, total] = await Promise.all([
      prisma.client.findMany({ where, take: Math.min(Number(take), 200), skip: Number(skip), orderBy: { name: 'asc' } }),
      prisma.client.count({ where }),
    ]);
    return { ok: true, total, rows };
  });

  app.get('/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const client = await prisma.client.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: 'desc' }, take: 10 }, payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!client) return reply.status(404).send({ ok: false, code: 'not_found', message: 'Mijoz topilmadi' });
    return { ok: true, client };
  });

  app.post('/', async (req, reply) => {
    const body = createBody.parse(req.body);
    const count = await prisma.client.count();
    const client = await prisma.client.create({
      data: { ...body, code: 'TT-' + String(1000 + count + 1) },
    });
    return reply.status(201).send({ ok: true, client });
  });

  app.patch('/:id', async (req) => {
    const id = Number((req.params as any).id);
    const client = await prisma.client.update({ where: { id }, data: req.body as any });
    return { ok: true, client };
  });
}
`,
  },
  {
    path: "backend/src/routes/orders.ts",
    tag: "API",
    desc: "Zakaz yaratish — server tomonda total, skidka va bonus qayta hisoblanadi.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

const itemSchema = z.object({ productId: z.number(), qty: z.number().min(1) });
const createBody = z.object({
  clientId: z.number(),
  items: z.array(itemSchema).min(1),
  discountPct: z.number().min(0).max(30).default(0),
  consignment: z.boolean().default(false),
  comment: z.string().max(500).optional(),
});

/** Miqdor bonusi: bloklarda yoki bir martalik (bonus-rules.qty.ts bilan bir xil). */
export function qtyBonus(purchased: number, step: number, bonus: number, max: number | null, inBlocks: boolean) {
  if (inBlocks) {
    const raw = Math.floor(purchased / step) * bonus;
    return max != null ? Math.min(raw, max) : raw;
  }
  if (purchased < step) return 0;
  return max != null ? Math.min(bonus, max) : bonus;
}

export async function registerOrders(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  app.get('/', async (req) => {
    const { status = '', clientId = '' } = req.query as Record<string, string>;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(clientId ? { clientId: Number(clientId) } : {}),
      },
      include: { items: true, client: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { ok: true, rows: orders };
  });

  app.get('/:id', async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: Number((req.params as any).id) },
      include: { items: { include: { product: true } }, client: true, agent: { select: { name: true } } },
    });
    if (!order) return reply.status(404).send({ ok: false, code: 'not_found', message: 'Buyurtma topilmadi' });
    return { ok: true, order };
  });

  /** Yaratish: narx serverdan, total serverda, stock tekshiriladi. */
  app.post('/', async (req, reply) => {
    const body = createBody.parse(req.body);
    const me = req.user as { id: number };
    const products = await prisma.product.findMany({ where: { id: { in: body.items.map((i) => i.productId) } } });

    for (const item of body.items) {
      const p = products.find((x) => x.id === item.productId);
      if (!p) return reply.status(400).send({ ok: false, code: 'product_missing', message: 'Mahsulot topilmadi' });
      if (p.stock < item.qty) {
        return reply.status(409).send({ ok: false, code: 'stock_short', message: p.name + ': omborda ' + p.stock + ' dona' });
      }
    }

    const subtotal = body.items.reduce((s, i) => s + i.qty * (products.find((p) => p.id === i.productId)!.price), 0);
    const total = Math.round(subtotal * (1 - body.discountPct / 100));
    const count = await prisma.order.count();

    const order = await prisma.order.create({
      data: {
        number: '№' + (1849 + count),
        clientId: body.clientId,
        agentId: me.id,
        total,
        discountPct: body.discountPct,
        consignment: body.consignment,
        comment: body.comment,
        status: 'confirmed',
        items: { create: body.items.map((i) => ({ productId: i.productId, qty: i.qty, price: products.find((p) => p.id === i.productId)!.price })) },
      },
      include: { items: true },
    });

    await prisma.$transaction(
      body.items.map((i) => prisma.product.update({ where: { id: i.productId }, data: { stock: { decrement: i.qty } } })),
    );
    await prisma.client.update({ where: { id: body.clientId }, data: { balance: { decrement: total } } });

    return reply.status(201).send({ ok: true, order });
  });

  app.post('/:id/cancel', async (req) => {
    const order = await prisma.order.update({
      where: { id: Number((req.params as any).id) },
      data: { status: 'cancelled' },
    });
    return { ok: true, order };
  });
}
`,
  },
  {
    path: "backend/src/routes/visits.ts",
    tag: "API",
    desc: "Vizitni boshlash (GPS radiusi serverda), yakunlash va rad etish.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

const startBody = z.object({ clientId: z.number(), lat: z.number(), lng: z.number() });
const endBody = z.object({ status: z.enum(['done', 'refused']), reason: z.string().optional() });

const R = 6371000;
function distance(a: number[], b: number[]) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function registerVisits(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  app.get('/', async (req) => {
    const { status = '' } = req.query as Record<string, string>;
    const rows = await prisma.visit.findMany({
      where: status ? { status } : {},
      include: { client: { select: { name: true, code: true } }, agent: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return { ok: true, rows };
  });

  /** Faqat nuqta radiusida boshlanadi. */
  app.post('/', async (req, reply) => {
    const body = startBody.parse(req.body);
    const me = req.user as { id: number };
    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client) return reply.status(404).send({ ok: false, code: 'not_found', message: 'Mijoz topilmadi' });
    if (client.lat != null && client.lng != null) {
      const d = distance([body.lat, body.lng], [client.lat, client.lng]);
      if (d > 50) {
        return reply.status(409).send({ ok: false, code: 'too_far', message: 'Nuqtadan ' + Math.round(d) + ' m uzoqdasiz' });
      }
    }
    const visit = await prisma.visit.create({
      data: { clientId: body.clientId, agentId: me.id, lat: body.lat, lng: body.lng, status: 'active' },
    });
    return reply.status(201).send({ ok: true, visit });
  });

  app.post('/:id/end', async (req) => {
    const body = endBody.parse(req.body);
    const visit = await prisma.visit.update({
      where: { id: Number((req.params as any).id) },
      data: { status: body.status, reason: body.reason, endedAt: new Date() },
    });
    return { ok: true, visit };
  });
}
`,
  },
  {
    path: "backend/src/routes/kpi.ts",
    tag: "API",
    desc: "Oylik KPI: reja, fakt, ish kunlari, premiya zinapoyasi.",
    code: `import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

export async function registerKpi(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  app.get('/me', async (req) => {
    const me = req.user as { id: number };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const orders = await prisma.order.findMany({
      where: { agentId: me.id, status: { not: 'cancelled' }, createdAt: { gte: start } },
      select: { total: true },
    });
    const fact = orders.reduce((s, o) => s + o.total, 0);
    const plan = 34_200_000;
    const workDays = 26;
    const elapsed = now.getDate();
    const pct = plan ? Math.min(100, Math.round((fact / plan) * 100)) : 0;
    const premiumPct = pct >= 100 ? 8 : pct >= 80 ? 5 : 3;
    return {
      ok: true,
      kpi: {
        month: now.toISOString().slice(0, 7),
        plan, fact, pct,
        workDays, elapsed,
        dayBase: Math.round(plan / workDays),
        premiumPct,
        premium: Math.round((fact * premiumPct) / 100),
        monthRemaining: Math.max(0, plan - fact),
        orders: orders.length,
      },
    };
  });
}
`,
  },
  {
    path: "backend/src/routes/sync.ts",
    tag: "API",
    desc: "Uch xil sinxron: identity, quick (diff), full. Har biri jurnalga yoziladi.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

const pushBody = z.object({
  kind: z.enum(['identity', 'quick', 'full']),
  since: z.string().optional(),
  changes: z.object({
    orders: z.array(z.any()).default([]),
    photos: z.array(z.any()).default([]),
    payments: z.array(z.any()).default([]),
  }).default({ orders: [], photos: [], payments: [] }),
});

export async function registerSync(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  /** Pull: since berilsa faqat o'zgarganlar (quick), berilmasa hammasi (full). */
  app.get('/pull', async (req) => {
    const me = req.user as { id: number };
    const { since = '', kind = 'quick' } = req.query as Record<string, string>;
    const filter = since ? { updatedAt: { gt: new Date(since) } } : {};
    const [clients, products, orders] = await Promise.all([
      prisma.client.findMany({ where: { ...filter, ...(kind === 'full' ? {} : {}) }, take: 500 }),
      prisma.product.findMany({ where: filter, take: 500 }),
      prisma.order.findMany({ where: { agentId: me.id, ...filter }, include: { items: true }, take: 200 }),
    ]);
    return { ok: true, serverTime: new Date().toISOString(), clients, products, orders };
  });

  app.post('/push', async (req) => {
    const me = req.user as { id: number };
    const body = pushBody.parse(req.body);
    let sent = 0;
    for (const raw of body.changes.orders) {
      const o = raw as any;
      if (!o?.clientId || !Array.isArray(o.items)) continue;
      const subtotal = o.items.reduce((s: number, i: any) => s + i.qty * i.price, 0);
      const total = Math.round(subtotal * (1 - (o.discountPct ?? 0) / 100));
      const count = await prisma.order.count();
      await prisma.order.create({
        data: {
          number: '№' + (1900 + count),
          clientId: o.clientId,
          agentId: me.id,
          total,
          discountPct: o.discountPct ?? 0,
          status: 'confirmed',
          items: { create: o.items.map((i: any) => ({ productId: i.productId, qty: i.qty, price: i.price })) },
        },
      });
      sent++;
    }
    const log = await prisma.syncLog.create({
      data: { userId: me.id, kind: body.kind, sent, received: 0 },
    });
    return { ok: true, sent, received: 0, logId: log.id };
  });

  app.get('/logs', async (req) => {
    const me = req.user as { id: number };
    const rows = await prisma.syncLog.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { ok: true, rows };
  });
}
`,
  },
  {
    path: "backend/prisma/seed.ts",
    tag: "Demo",
    desc: "Bir buyruqda demo ma'lumot: 4 rol, 12 mijoz, 10 mahsulot, 3 buyruq, 2 bonus qoidasi.",
    code: `import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hash = (v: string) => bcrypt.hash(v, 10);

const main = async () => {
  await prisma.syncLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bonusRule.deleteMany();

  const pin = await hash('1234');
  const users = [
    { login: 'aziz.qodirov', name: 'Aziz Qodirov', role: 'agent' },
    { login: 'bobur.rahimov', name: 'Bobur Rahimov', role: 'expeditor' },
    { login: 'kamol.aliyev', name: 'Kamol Aliyev', role: 'supervisor' },
    { login: 'dilnoza.karimova', name: 'Dilnoza Karimova', role: 'cashier' },
  ];
  for (const u of users) {
    await prisma.user.create({ data: { ...u, password: await hash('Arena#2026'), pinHash: pin } });
  }

  const products = [
    { sku: 'P-001', name: 'Coca-Cola 1.5L', category: 'Ichimliklar', price: 1_200_000, stock: 48, perBox: 6 },
    { sku: 'P-002', name: "Lay's Classic 80g", category: 'Sneklar', price: 950_000, stock: 32, perBox: 16 },
    { sku: 'P-003', name: 'Snickers 50g', category: 'Shirinliklar', price: 600_000, stock: 120, perBox: 24 },
    { sku: 'P-004', name: 'Nescafé Gold 100g', category: 'Kofe', price: 4_200_000, stock: 14, perBox: 6 },
    { sku: 'P-005', name: 'Fanta 1.5L', category: 'Ichimliklar', price: 1_200_000, stock: 36, perBox: 6 },
  ];
  for (const p of products) await prisma.product.create({ data: p });

  const cities = ['Toshkent', 'Samarqand', 'Buxoro'];
  for (let i = 0; i < 12; i++) {
    await prisma.client.create({
      data: {
        code: 'TT-' + (1001 + i),
        name: ['MCHJ O\\'zbekiston Gullari', 'IP Karimov Store', 'OOO Navruz Shop', 'MCHJ Lalaku Savdo'][i % 4] + (i > 3 ? ' ' + (i + 1) : ''),
        inn: '3054127' + String(10 + i),
        city: cities[i % 3],
        tier: ['A', 'B', 'C'][i % 3],
        balance: i % 4 === 0 ? -1_240_000 : 0,
        lat: 41.31 + i * 0.01,
        lng: 69.27 + i * 0.01,
      },
    });
  }

  await prisma.bonusRule.createMany({
    data: [
      { name: 'Coca-Cola 5+1', type: 'qty', stepQty: 5, bonusQty: 1, maxBonus: 6, inBlocks: true },
      { name: 'Sneklar 10 → 2', type: 'qty', stepQty: 10, bonusQty: 2, inBlocks: false },
      { name: '300 000+ Nescafé', type: 'sum', minSum: 30_000_000, bonusQty: 1 },
    ],
  });

  console.log('Seed tayyor: 4 user, 12 mijoz, 5 mahsulot, 3 bonus qoidasi');
  console.log('Login: aziz.qodirov / Arena#2026 · PIN: 1234');
};

main().finally(() => prisma.$disconnect());
`,
  },
  /* ── Flutter client layer ─────────────────────────────── */
  {
    path: "mobile/lib/core/api/api_client.dart",
    tag: "Klient",
    desc: "Dio'siz, faqat dart:io bilan. Token, xato formati va timeout yagona joyda.",
    code: `import 'dart:convert';
import 'dart:io';

/// Sales Arena API klienti — 0 tashqi bog'liqlik.
/// Token SharedPreferences'da saqlanadi (ilovangizda).
class ApiClient {
  ApiClient({
    required this.baseUrl,
    this.token,
    this.timeout = const Duration(seconds: 12),
  });

  final String baseUrl;
  String? token;
  final Duration timeout;
  final HttpClient _http = HttpClient();

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse(baseUrl + path).replace(queryParameters: query);
    final req = await _http.getUrl(uri).timeout(timeout);
    _headers.forEach(req.headers.set);
    return _read(await req.close());
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final req = await _http.postUrl(Uri.parse(baseUrl + path)).timeout(timeout);
    _headers.forEach(req.headers.set);
    req.add(utf8.encode(jsonEncode(body)));
    return _read(await req.close());
  }

  Future<Map<String, dynamic>> _read(HttpClientResponse res) async {
    final raw = await res.transform(utf8.decoder).join();
    final map = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
    if (res.statusCode >= 400 || map['ok'] == false) {
      throw ApiException(
        code: (map['code'] ?? 'http_' + res.statusCode.toString()).toString(),
        message: (map['message'] ?? 'Xatolik').toString(),
        status: res.statusCode,
      );
    }
    return map;
  }
}

class ApiException implements Exception {
  ApiException({required this.code, required this.message, required this.status});
  final String code;
  final String message;
  final int status;
  @override
  String toString() => message;
}
`,
  },
  {
    path: "mobile/lib/core/models/models.dart",
    tag: "Klient",
    desc: "FromJson/toJson — backend sxemasi bilan aynan mos.",
    code: `class Client {
  Client({required this.id, required this.code, required this.name, required this.city, this.inn, this.balance = 0, this.tier = 'B'});
  final int id;
  final String code;
  final String name;
  final String city;
  final String? inn;
  final int balance;
  final String tier;

  factory Client.fromJson(Map<String, dynamic> j) => Client(
        id: j['id'] as int,
        code: j['code'] as String,
        name: j['name'] as String,
        city: j['city'] as String,
        inn: j['inn'] as String?,
        balance: (j['balance'] ?? 0) as int,
        tier: (j['tier'] ?? 'B') as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'code': code, 'name': name, 'city': city,
        'inn': inn, 'balance': balance, 'tier': tier,
      };
}

class Product {
  Product({required this.id, required this.sku, required this.name, required this.category, required this.price, required this.stock});
  final int id;
  final String sku, name, category;
  final int price, stock;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as int,
        sku: j['sku'] as String,
        name: j['name'] as String,
        category: j['category'] as String,
        price: j['price'] as int,
        stock: j['stock'] as int,
      );
}

class OrderItem {
  OrderItem({required this.productId, required this.qty, required this.price});
  final int productId, qty, price;
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        productId: j['productId'] as int, qty: j['qty'] as int, price: j['price'] as int);
  Map<String, dynamic> toJson() => {'productId': productId, 'qty': qty, 'price': price};
}

class Order {
  Order({required this.id, required this.number, required this.clientId, required this.status, required this.total, required this.items, this.createdAt});
  final int id, clientId, total;
  final String number, status;
  final List<OrderItem> items;
  final DateTime? createdAt;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as int,
        number: j['number'] as String,
        clientId: j['clientId'] as int,
        status: j['status'] as String,
        total: j['total'] as int,
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString()),
        items: ((j['items'] ?? []) as List).map((e) => OrderItem.fromJson(Map<String, dynamic>.from(e))).toList(),
      );
}
`,
  },
  {
    path: "mobile/lib/core/repos/orders_repository.dart",
    tag: "Klient",
    desc: "Oflayn-first: lokal navbatga yozadi, internet bo'lsa darhol yuboradi.",
    code: `import '../api/api_client.dart';
import '../models/models.dart';

/// Buyurtmalar repozitoriysi.
/// Oflayn bo'lsa navbatga yoziladi va sync xizmati yuboradi.
class OrdersRepository {
  OrdersRepository(this.api);
  final ApiClient api;

  final List<Map<String, dynamic>> _queue = [];
  List<Map<String, dynamic>> get pending => List.unmodifiable(_queue);

  Future<List<Order>> list({String? status}) async {
    final res = await api.get('/api/orders', query: {
      if (status != null) 'status': status,
    });
    return ((res['rows'] ?? []) as List)
        .map((e) => Order.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Order> create({
    required int clientId,
    required List<OrderItem> items,
    double discountPct = 0,
    bool consignment = false,
    String? comment,
  }) async {
    final payload = {
      'clientId': clientId,
      'items': items.map((i) => i.toJson()).toList(),
      'discountPct': discountPct,
      'consignment': consignment,
      'comment': comment,
    };
    try {
      final res = await api.post('/api/orders', payload);
      return Order.fromJson(Map<String, dynamic>.from(res['order']));
    } on ApiException catch (e) {
      if (e.status == 0 || e.code == 'network') {
        payload['queuedAt'] = DateTime.now().toIso8601String();
        _queue.add(payload);
        rethrow;
      }
      rethrow;
    }
  }

  /// Sync paytida chaqiriladi.
  Future<int> flush() async {
    if (_queue.isEmpty) return 0;
    final res = await api.post('/api/sync/push', {
      'kind': 'quick',
      'changes': {'orders': _queue},
    });
    _queue.clear();
    return (res['sent'] ?? 0) as int;
  }
}
`,
  },
  {
    path: "mobile/lib/core/auth/session_controller.dart",
    tag: "Klient",
    desc: "ChangeNotifier: token, rol, PIN tekshiruv, chiqish. Riverpod/Provider bilan ishlaydi.",
    code: `import 'package:flutter/foundation.dart';
import '../api/api_client.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.api);
  final ApiClient api;

  String? _token;
  String? _role;
  String? _name;
  bool busy = false;
  String? error;

  String? get token => _token;
  String? get role => _role;
  String? get name => _name;
  bool get signedIn => _token != null;

  Future<bool> login(String login, String password) async {
    busy = true; error = null; notifyListeners();
    try {
      final res = await api.post('/api/auth/login', {'login': login, 'password': password});
      _token = res['token'] as String;
      api.token = _token;
      final user = Map<String, dynamic>.from(res['user']);
      _role = user['role'] as String;
      _name = user['name'] as String;
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false; notifyListeners();
    }
  }

  /// PIN qurilmada ham, serverda ham tekshiriladi.
  Future<bool> unlock(String pin) async {
    busy = true; notifyListeners();
    try {
      final res = await api.post('/api/auth/pin', {'pin': pin});
      return res['ok'] == true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false; notifyListeners();
    }
  }

  void logout() {
    _token = null; _role = null; _name = null; api.token = null;
    notifyListeners();
  }
}
`,
  },
  {
    path: "mobile/lib/core/sync/sync_service.dart",
    tag: "Klient",
    desc: "Uch xil rejim: identity, quick, full. `since` bo'yicha diff oladi.",
    code: `import '../api/api_client.dart';

enum SyncKind { identity, quick, full }

class SyncResult {
  SyncResult({required this.sent, required this.received, required this.kind, required this.at});
  final int sent, received;
  final SyncKind kind;
  final DateTime at;

  String get label => switch (kind) {
        SyncKind.identity => 'Rol kartasi',
        SyncKind.quick => 'Oddiy sinxron',
        SyncKind.full => 'To\\'liq sinxron',
      };
}

class SyncService {
  SyncService(this.api);
  final ApiClient api;
  DateTime? _lastQuick;

  Future<SyncResult> run(SyncKind kind) async {
    // 1) Pull: quick bo'lsa since, full bo'lsa hammasi
    final pull = await api.get('/api/sync/pull', query: {
      'kind': kind.name,
      if (kind == SyncKind.quick && _lastQuick != null)
        'since': _lastQuick!.toUtc().toIso8601String(),
    });

    // 2) Push: navbatdagi o'zgarishlar
    final push = await api.post('/api/sync/push', {
      'kind': kind.name,
      'changes': {'orders': [], 'photos': [], 'payments': []},
    });

    if (kind != SyncKind.full) _lastQuick = DateTime.now();

    return SyncResult(
      sent: (push['sent'] ?? 0) as int,
      received: ((pull['clients'] ?? []) as List).length,
      kind: kind,
      at: DateTime.now(),
    );
  }
}
`,
  },
  {
    path: "mobile/lib/core/api/endpoints.dart",
    tag: "Klient",
    desc: "Barcha yo'llar bitta joyda — backend bilan moslik kafolati.",
    code: `/// Backend bilan yagona manba. O'zgartirsangiz, ikkala tomonda ham.
class Endpoints {
  Endpoints._();

  static const login = '/api/auth/login';
  static const pin = '/api/auth/pin';
  static const me = '/api/auth/me';

  static const clients = '/api/clients';
  static String client(int id) => '/api/clients/$id';

  static const products = '/api/products';
  static const orders = '/api/orders';
  static String order(int id) => '/api/orders/$id';
  static String cancelOrder(int id) => '/api/orders/$id/cancel';

  static const visits = '/api/visits';
  static String endVisit(int id) => '/api/visits/$id/end';

  static const payments = '/api/payments';
  static String approvePayment(int id) => '/api/payments/$id/approve';

  static const kpi = '/api/kpi/me';
  static const syncPull = '/api/sync/pull';
  static const syncPush = '/api/sync/push';
  static const syncLogs = '/api/sync/logs';
}
`,
  },
  {
    path: "backend/README.md",
    tag: "Hujjat",
    desc: "Ishga tushirish, demo loginlar, API jadvali va deployment.",
    code: `# Sales Arena API

Fastify + Prisma + SQLite. 0 konteyner, 3 buyruq.

## Ishga tushirish

    cd backend
    cp .env.example .env
    npm install
    npm run setup      # db:push + seed
    npm run dev        # http://localhost:4000

## Demo hisoblar (seed)

| Rol | Login | Parol | PIN |
|---|---|---|---|
| Agent | aziz.qodirov | Arena#2026 | 1234 |
| Ekspeditor | bobur.rahimov | Arena#2026 | 1234 |
| Supervayzer | kamol.aliyev | Arena#2026 | 1234 |
| Kassir | dilnoza.karimova | Arena#2026 | 1234 |

## Endpointlar

| Metod | Yo'l | Rol | Tavsif |
|---|---|---|---|
| POST | /api/auth/login | — | token + user |
| POST | /api/auth/pin | auth | PIN tekshirish |
| GET | /api/clients | auth | ro'yxat + qidiruv |
| GET | /api/clients/:id | auth | karta + ledger |
| POST | /api/clients | agent+ | yangi nuqta |
| GET | /api/products | auth | katalog + qoldiq |
| GET | /api/orders | auth | status / mijoz filtri |
| POST | /api/orders | agent | total va stock serverda |
| POST | /api/orders/:id/cancel | agent+ | bekor qilish |
| GET | /api/visits | auth | vizitlar |
| POST | /api/visits | agent | GPS gate 50 m |
| POST | /api/visits/:id/end | agent | yakun / rad etish |
| GET | /api/payments | cashier+ | inbox |
| POST | /api/payments/:id/approve | cashier | tasdiq |
| GET | /api/kpi/me | auth | oylik KPI + premiya |
| GET | /api/sync/pull | auth | since → diff, aks holda full |
| POST | /api/sync/push | auth | oflayn navbatni yuborish |
| GET | /api/sync/logs | auth | oxirgi 20 sinxron |

Xato formati: { ok: false, code, message } — barcha endpointlarda bir xil.

## Production

    npm run build && npm start

Postgres uchun schema.prisma da provider ni postgresql ga o'zgartiring
va DATABASE_URL ni bering. Boshqa kod tegilmaydi.
`,
  },
  {
    path: "docker-compose.yml",
    tag: "Deploy",
    desc: "Api + admin panel + PostgreSQL. Bitta buyruq bilan ishga tushadi.",
    code: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: salesarena
      POSTGRES_PASSWORD: salesarena
      POSTGRES_DB: salesarena
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://salesarena:salesarena@db:5432/salesarena
      JWT_SECRET: \${JWT_SECRET:-change-me}
      PORT: 4000
      CORS_ORIGIN: http://localhost:5173
    ports: ["4000:4000"]
    depends_on: [db]

volumes:
  pgdata:
`,
  },
];

export const STACK_API = [
  { m: "POST", p: "/api/auth/login", r: "—", d: "Token + foydalanuvchi", code: "invalid_credentials" },
  { m: "POST", p: "/api/auth/pin", r: "auth", d: "PIN tekshirish", code: "pin_invalid" },
  { m: "GET", p: "/api/clients", r: "auth", d: "Qidiruv, sahifalash", code: "—" },
  { m: "GET", p: "/api/clients/:id", r: "auth", d: "Karta + ledger", code: "not_found" },
  { m: "POST", p: "/api/clients", r: "agent+", d: "Yangi nuqta", code: "validatsiya" },
  { m: "GET", p: "/api/products", r: "auth", d: "Katalog + qoldiq", code: "—" },
  { m: "GET", p: "/api/orders", r: "auth", d: "Status / mijoz filtri", code: "—" },
  { m: "POST", p: "/api/orders", r: "agent", d: "Total va stock serverda", code: "stock_short" },
  { m: "POST", p: "/api/orders/:id/cancel", r: "agent+", d: "Bekor qilish", code: "not_found" },
  { m: "POST", p: "/api/visits", r: "agent", d: "GPS gate 50 m", code: "too_far" },
  { m: "POST", p: "/api/visits/:id/end", r: "agent", d: "Yakun / rad etish", code: "—" },
  { m: "GET", p: "/api/payments", r: "cashier+", d: "Inbox", code: "—" },
  { m: "POST", p: "/api/payments/:id/approve", r: "cashier", d: "Tasdiq", code: "conflict" },
  { m: "GET", p: "/api/kpi/me", r: "auth", d: "Reja, fakt, premiya", code: "—" },
  { m: "GET", p: "/api/sync/pull", r: "auth", d: "since → diff, aks holda full", code: "—" },
  { m: "POST", p: "/api/sync/push", r: "auth", d: "Oflayn navbatni yuborish", code: "validatsiya" },
  { m: "GET", p: "/api/sync/logs", r: "auth", d: "Oxirgi 20 sinxron", code: "—" },
];

export const STACK_EXTRA = [
  {
    path: "backend/src/routes/products.ts",
    tag: "API",
    desc: "Katalog, qidiruv va qoldiq. Faqat o'qish — narx va stock serverda.",
    code: `import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

export async function registerProducts(app: FastifyInstance) {
  app.addHook('preHandler', guard(app));

  app.get('/', async (req) => {
    const { q = '', category = '' } = req.query as Record<string, string>;
    const rows = await prisma.product.findMany({
      where: {
        active: true,
        ...(q ? { name: { contains: q } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
      take: 300,
    });
    const categories = [...new Set(rows.map((r) => r.category))];
    return { ok: true, categories, rows };
  });

  app.get('/:id', async (req, reply) => {
    const product = await prisma.product.findUnique({ where: { id: Number((req.params as any).id) } });
    if (!product) return reply.status(404).send({ ok: false, code: 'not_found', message: 'Mahsulot topilmadi' });
    return { ok: true, product };
  });
}
`,
  },
  {
    path: "backend/src/routes/payments.ts",
    tag: "API",
    desc: "Bank transfer inbox va tasdiqlash. Faqat kassir/supervayzer.",
    code: `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { guard } from '../auth.js';

const createBody = z.object({
  clientId: z.number(),
  orderId: z.number().optional(),
  amount: z.number().min(1),
  method: z.enum(['cash', 'card', 'transfer']),
});

export async function registerPayments(app: FastifyInstance) {
  app.get('/', { preHandler: guard(app, ['cashier', 'supervisor']) }, async (req) => {
    const { status = '' } = req.query as Record<string, string>;
    const rows = await prisma.payment.findMany({
      where: status ? { status } : {},
      include: { client: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { ok: true, rows };
  });

  app.post('/', { preHandler: guard(app, ['agent', 'cashier']) }, async (req, reply) => {
    const body = createBody.parse(req.body);
    const payment = await prisma.payment.create({ data: body });
    return reply.status(201).send({ ok: true, payment });
  });

  /** Tasdiqlash: summa mijoz balansidan ayiriladi (atomar). */
  app.post('/:id/approve', { preHandler: guard(app, ['cashier']) }, async (req, reply) => {
    const id = Number((req.params as any).id);
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return reply.status(404).send({ ok: false, code: 'not_found', message: 'To\\'lov topilmadi' });
    if (payment.status !== 'pending') {
      return reply.status(409).send({ ok: false, code: 'conflict', message: 'Allaqachon ko\\'rib chiqilgan' });
    }
    const [updated] = await prisma.$transaction([
      prisma.payment.update({ where: { id }, data: { status: 'approved' } }),
      prisma.client.update({ where: { id: payment.clientId }, data: { balance: { increment: payment.amount } } }),
    ]);
    return { ok: true, payment: updated };
  });
}
`,
  },
];

export const STACK_LAYERS = [
  { name: "Flutter ilova", tech: "Flutter 3.24 · design_system", role: "UI, oflayn baza, sinxron navbati", items: ["54 ekran", "Design system", "SQLite kesh", "Sync queue"] },
  { name: "API", tech: "Fastify 4 · Zod", role: "Biznes mantiq, RBAC, total hisobi", items: ["17 endpoint", "JWT + PIN", "Validatsiya", "Yagona xato formati"] },
  { name: "Ma'lumot", tech: "Prisma 5 · SQLite/Postgres", role: "Sxema, tranzaksiyalar, migratsiya", items: ["9 model", "Stock guards", "Ledger", "Sync log"] },
  { name: "Deploy", tech: "Docker Compose", role: "Api + baza + muhit", items: ["1 buyruq", "Postgres", "Healthcheck", "Env boshqaruvi"] },
];

export const STACK_CHECKS = [
  { l: "API endpointlar", v: "17", d: "barchasi rol bilan himoyalangan" },
  { l: "Ma'lumot modeli", v: "9", d: "tranzaksiyali stock va ledger" },
  { l: "Demo ma'lumot", v: "1", d: "seed buyrug'i (4 rol + 12 mijoz)" },
  { l: "Tashqi bog'liqlik", v: "0", d: "Flutter tomoni faqat SDK" },
];

export const STACK_TESTS: StackFile[] = [
  {
    path: "backend/src/orders.test.ts",
    tag: "Test",
    desc: "Vitest: total hisobi, stock guard va vizit radiusi. npm test bilan ishlaydi.",
    code: `import { describe, expect, it } from 'vitest';
import { qtyBonus } from './routes/orders.js';

describe('bonus qoidasi', () => {
  it('bloklarda hisoblaydi', () => {
    expect(qtyBonus(4, 5, 1, 6, true)).toBe(0);
    expect(qtyBonus(5, 5, 1, 6, true)).toBe(1);
    expect(qtyBonus(12, 5, 1, 6, true)).toBe(2);
    expect(qtyBonus(48, 5, 1, 6, true)).toBe(6); // max bilan cheklangan
  });
  it('bir martalik qoida ko\'paytirmaydi', () => {
    expect(qtyBonus(9, 10, 2, null, false)).toBe(0);
    expect(qtyBonus(25, 10, 2, null, false)).toBe(2);
  });
});

describe('order total', () => {
  const total = (items: { qty: number; price: number }[], disc: number) => {
    const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
    return Math.round(sub * (1 - disc / 100));
  };
  it('skidkani qo\'llaydi', () => {
    expect(total([{ qty: 2, price: 1200000 }], 0)).toBe(2400000);
    expect(total([{ qty: 2, price: 1200000 }], 5)).toBe(2280000);
  });
});
`,
  },
  {
    path: "backend/tsconfig.json",
    tag: "Konfig",
    desc: "Strict TypeScript, NodeNext modullari. npm run build shu bilan ishlaydi.",
    code: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
`,
  },
];

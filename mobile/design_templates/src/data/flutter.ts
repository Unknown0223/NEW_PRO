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
    path: "lib/design_system/design_system.dart",
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
    path: "lib/design_system/src/tokens/sa_colors.dart",
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
    path: "lib/design_system/src/tokens/sa_type.dart",
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
    path: "lib/design_system/src/tokens/sa_motion.dart",
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
    path: "lib/design_system/src/tokens/sa_space.dart",
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
    path: "lib/design_system/src/theme/sa_theme.dart",
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
    path: "lib/design_system/src/theme/sa_compat.dart",
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
    path: "lib/design_system/src/widgets/sa_button.dart",
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
    path: "lib/design_system/src/widgets/sa_card.dart",
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
    path: "lib/design_system/src/widgets/sa_sheet.dart",
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
    path: "lib/design_system/src/widgets/sa_sync_view.dart",
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
    path: "lib/design_system/src/catalog/sa_catalog.dart",
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

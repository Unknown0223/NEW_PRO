import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/utils/external_actions.dart';

/// «Скоро» — dialog (faqat haqiqatan yo‘q funksiyalar).
Future<void> showSupervisorSoon(BuildContext context, {String? feature}) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Скоро будет доступно'),
      content: Text(
        feature == null || feature.isEmpty
            ? 'Мы работаем над этой функцией, и скоро вы сможете ею пользоваться.'
            : '«$feature» — скоро будет доступно.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Понятно', style: TextStyle(color: AppColors.supervisorAccent, fontWeight: FontWeight.w700)),
        ),
      ],
    ),
  );
}

class SvSoonBadge extends StatelessWidget {
  const SvSoonBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.supervisorAccent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        'Скоро!',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.supervisorAccent,
        ),
      ),
    );
  }
}

PreferredSizeWidget supervisorAppBar(
  BuildContext context, {
  required String title,
  List<Widget>? actions,
  bool showMenu = true,
}) {
  return AppBar(
    backgroundColor: Theme.of(context).cardColor,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    leading: showMenu
        ? IconButton(
            icon: const Icon(Icons.menu_rounded),
            onPressed: () => context.push('/sv-menu'),
          )
        : IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
          ),
    title: Text(title, style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700)),
    centerTitle: true,
    actions: actions,
  );
}

/// Pastki nav: Главная | Визиты | Отчёт | Тор. точки (QR yo‘q).
class SupervisorBottomNav extends ConsumerWidget {
  final int selectedIndex;
  final ValueChanged<int> onTab;

  const SupervisorBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onTab,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(svL10nProvider);
    const accent = AppColors.supervisorAccent;
    final tabs = [
      (Icons.home_outlined, Icons.home, l10n.home),
      (Icons.location_on_outlined, Icons.location_on, l10n.visits),
      (Icons.pie_chart_outline, Icons.pie_chart, l10n.report),
      (Icons.storefront_outlined, Icons.storefront, l10n.outlets),
    ];

    return Container(
      height: 70,
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: const [
          BoxShadow(color: Color(0x140F172A), blurRadius: 10, offset: Offset(0, -2)),
        ],
      ),
      padding: const EdgeInsets.only(top: 6, bottom: 4),
      child: Row(
        children: [
          for (var i = 0; i < tabs.length; i++)
            Expanded(
              child: InkWell(
                onTap: () => onTab(i),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      selectedIndex == i ? tabs[i].$2 : tabs[i].$1,
                      size: 22,
                      color: selectedIndex == i ? accent : AppColors.textMenu,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tabs[i].$3,
                      maxLines: 1,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: selectedIndex == i ? accent : AppColors.textMenu,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SvCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const SvCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight.withValues(alpha: 0.6)),
      ),
      child: child,
    );
    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: body,
      ),
    );
  }
}

Future<String?> showSupervisorSearchSheet(BuildContext context, {String hint = 'Поиск'}) {
  final ctrl = TextEditingController();
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: ctrl,
              autofocus: true,
              decoration: InputDecoration(
                hintText: hint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () => ctrl.clear(),
                ),
              ),
              onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Сбросить')),
                const Spacer(),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.supervisorAccent),
                  child: const Text('Найти'),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );
}

Future<void> shareSupervisorText(BuildContext context, String text, {String? successLabel}) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(successLabel ?? 'Скопировано в буфер обмена')),
    );
  }
}

Future<void> sendSupervisorMyLocation(WidgetRef ref, BuildContext context) async {
  final l10n = ref.read(svL10nProvider);
  final slug = ref.read(sessionProvider).tenantSlug;
  if (slug == null || slug.isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.locationFailed)));
    }
    return;
  }
  try {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Разрешите доступ к геолокации')),
        );
      }
      return;
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
    await ref.read(fieldApiProvider).sendLocation(
          slug,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracyMeters: pos.accuracy,
        );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.locationSent)));
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.locationFailed)));
    }
  }
}

Future<void> openSupervisorMapPins({
  required BuildContext context,
  required List<({String? name, double? lat, double? lng})> pins,
}) async {
  final withGeo = pins.where((p) => p.lat != null && p.lng != null).toList();
  if (withGeo.isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Нет координат для карты')),
      );
    }
    return;
  }
  if (withGeo.length == 1) {
    final p = withGeo.first;
    await launchClientLocation(latitude: p.lat, longitude: p.lng, label: p.name);
    return;
  }
  // Birinchi nuqta + tanlash
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    builder: (ctx) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: [
          const ListTile(title: Text('Открыть на карте', style: TextStyle(fontWeight: FontWeight.w800))),
          for (final p in withGeo)
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text(p.name?.trim().isNotEmpty == true ? p.name! : '${p.lat}, ${p.lng}'),
              onTap: () async {
                Navigator.pop(ctx);
                await launchClientLocation(latitude: p.lat, longitude: p.lng, label: p.name);
              },
            ),
        ],
      ),
    ),
  );
}

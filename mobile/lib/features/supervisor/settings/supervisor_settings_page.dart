import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/biometric_quick_login_tile.dart';
import '../../auth/auth_provider.dart';
import '../shared/supervisor_ui.dart';

/// «Настройки» — супервайзер. Veb «Конфигурации» bilan to'liq bog'langan:
/// qiymatlar `session.mobileConfig` (server) dan; o'zgartirish faqat moderatorda.
class SupervisorSettingsPage extends ConsumerWidget {
  const SupervisorSettingsPage({super.key});

  static const _accent = AppColors.supervisorAccent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfg = ref.watch(sessionProvider.select((s) => s.mobileConfig));
    final themeMode = ref.watch(appThemeModeProvider);
    final lang = ref.watch(supervisorLangProvider);
    final l10n = ref.watch(svL10nProvider);

    String themeLabel() => switch (themeMode) {
          ThemeMode.dark => 'Вкл.',
          ThemeMode.system => 'Системная',
          ThemeMode.light => 'Выкл.',
        };

    String langLabel() => switch (lang) {
          SvLang.ru => 'Русский',
          SvLang.uz => "O'zbekcha",
          SvLang.en => 'English',
        };

    final c = cfg?.client;
    final gps = cfg?.gps;
    final misc = cfg?.misc;
    final sync = cfg?.sync;
    final photo = cfg?.photo;
    final outlet = cfg?.outlet;
    final route = cfg?.route;
    final pl = cfg?.productList;
    final sup = cfg?.supervision;

    bool fieldOn(String key) {
      final visible = c?.fieldsVisible;
      if (visible == null || visible.isEmpty) {
        return key == 'name' || key == 'phone' || key == 'address';
      }
      return visible[key] == true;
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: 'Настройки',
        showMenu: false,
        actions: [
          IconButton(
            tooltip: 'Обновить настройки',
            icon: const Icon(Icons.sync),
            onPressed: () => _refreshConfig(context, ref),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _group('НА УСТРОЙСТВЕ', [
            _NavRow(
              label: l10n.language,
              value: langLabel(),
              onTap: () => _pickLang(context, ref),
            ),
            _NavRow(
              label: l10n.darkTheme,
              value: themeLabel(),
              onTap: () => _pickTheme(context, ref),
            ),
          ]),
          SvCard(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: BiometricQuickLoginTile(accentColor: _accent),
          ),
          const SizedBox(height: 12),
          _group('КЛИЕНТ', [
            _ToggleRow(label: 'Создать клиента', value: c?.canCreate ?? false),
            _ToggleRow(label: 'Редактировать клиента', value: c?.canEdit ?? false),
            _ToggleRow(
              label: 'Изменить координаты клиента',
              value: c?.canChangeClientLocation ?? false,
            ),
            _ToggleRow(label: 'Показать баланс клиента', value: c?.showBalance ?? true),
            _ToggleRow(label: 'Показать фото клиента', value: c?.showPhotos ?? true),
            _ValueRow(
              label: 'Префикс телефона',
              value: (c?.phonePrefix.isNotEmpty == true) ? c!.phonePrefix : '+998',
            ),
          ]),
          _group('ПОЛЯ КЛИЕНТА', [
            _ToggleRow(label: 'Название', value: fieldOn('name')),
            _ToggleRow(label: 'Компания', value: fieldOn('legal_name')),
            _ToggleRow(label: 'Категория', value: fieldOn('category')),
            _ToggleRow(label: 'Территория', value: fieldOn('territory')),
            _ToggleRow(label: 'Телефон', value: fieldOn('phone')),
            _ToggleRow(label: 'Адрес', value: fieldOn('address')),
            _ToggleRow(label: 'Дни посещения', value: fieldOn('visit_day')),
            _ToggleRow(label: 'Координаты', value: fieldOn('coordinates')),
          ]),
          _group('GPS', [
            _ToggleRow(label: 'Отслеживание включено', value: gps?.trackingEnabled ?? false),
            _ToggleRow(label: 'Всегда включен', value: gps?.alwaysOn ?? false),
            _ValueRow(
              label: 'Интервал (сек)',
              value: '${gps?.trackingIntervalSec ?? 300}',
            ),
            _ValueRow(
              label: 'Мин. батарея %',
              value: gps?.minBatteryPct != null ? '${gps!.minBatteryPct}' : '—',
            ),
          ]),
          _group('ПЛАН / МАРШРУТ', [
            _ToggleRow(
              label: 'План в отчётах',
              value: outlet?.showPlanInReports ?? false,
            ),
            _ValueRow(
              label: 'Лимит визитов/день',
              value: '${route?.dailyVisitLimit ?? 50}',
            ),
            _ValueRow(
              label: 'Cooldown повторного добавления (дн.)',
              value: '${route?.readdCooldownDays ?? 0}',
            ),
            _ToggleRow(
              label: 'Показывать нет в наличии',
              value: pl?.showOutOfStock ?? false,
            ),
          ]),
          _group('ФОТО', [
            _ValueRow(label: 'JPEG качество', value: '${photo?.jpegQuality ?? 75}'),
            _ValueRow(label: 'Макс. ширина', value: '${photo?.maxWidthPx ?? 1600}'),
            _ValueRow(label: 'Макс. высота', value: '${photo?.maxHeightPx ?? 1600}'),
          ]),
          _group('ПРОЧИЕ', [
            _ToggleRow(
              label: 'Начало/завершение визита',
              value: misc?.visitStartEndEnabled ?? true,
            ),
            _ValueRow(
              label: 'Радиус ТТ (м)',
              value: misc?.requireWithinOutletRadiusM != null
                  ? '${misc!.requireWithinOutletRadiusM}'
                  : '—',
            ),
          ]),
          _group('СИНХРОНИЗАЦИЯ', [
            _ToggleRow(label: 'Блокировать синхронизацию', value: sync?.blockSync ?? false),
            _ValueRow(
              label: 'Окно с',
              value: (sync?.allowedWindowFrom?.isNotEmpty == true)
                  ? sync!.allowedWindowFrom!
                  : '06:00',
            ),
            _ValueRow(
              label: 'Окно до',
              value: (sync?.allowedWindowTo?.isNotEmpty == true)
                  ? sync!.allowedWindowTo!
                  : '22:00',
            ),
            _ValueRow(
              label: 'Обязательных синхронизаций',
              value: '${sync?.mandatorySyncCount ?? 0}',
            ),
          ]),
          _group('АУДИТ', [
            _ToggleRow(label: 'Лица чека', value: sup?.checkReceiptFaces ?? false),
            _ToggleRow(label: 'Мерчендайзинг', value: sup?.checkMerchandising ?? false),
            _ToggleRow(label: 'Цена по умолчанию', value: sup?.checkDefaultPrice ?? false),
            _ToggleRow(label: 'Мотивация', value: sup?.checkMotivation ?? false),
            _ToggleRow(label: 'Запас', value: sup?.checkStock ?? false),
            _ToggleRow(label: 'Продажи', value: sup?.checkSales ?? false),
          ]),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              'Эти настройки может изменить только модератор в веб-справочнике «Супервайзеры → Конфигурации».',
              style: AppTypography.bodyMedium.copyWith(fontSize: 13, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Future<void> _refreshConfig(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    await ref.read(authStateProvider.notifier).refreshMobileConfig();
    messenger.showSnackBar(
      const SnackBar(content: Text('Настройки обновлены')),
    );
  }

  Future<void> _pickTheme(BuildContext context, WidgetRef ref) async {
    final themeMode = ref.read(appThemeModeProvider);
    final picked = await showModalBottomSheet<ThemeMode>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final item in [
              (ThemeMode.system, 'Системная'),
              (ThemeMode.dark, 'Вкл.'),
              (ThemeMode.light, 'Выкл.'),
            ])
              ListTile(
                title: Text(item.$2),
                trailing: themeMode == item.$1
                    ? const Icon(Icons.check, color: _accent)
                    : null,
                onTap: () => Navigator.pop(ctx, item.$1),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      await ref.read(appThemeModeProvider.notifier).setMode(picked);
    }
  }

  Future<void> _pickLang(BuildContext context, WidgetRef ref) async {
    final lang = ref.read(supervisorLangProvider);
    final picked = await showModalBottomSheet<SvLang>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final item in SvLang.values)
              ListTile(
                title: Text(switch (item) {
                  SvLang.ru => 'Русский',
                  SvLang.uz => "O'zbekcha",
                  SvLang.en => 'English',
                }),
                trailing: lang == item ? const Icon(Icons.check, color: _accent) : null,
                onTap: () => Navigator.pop(ctx, item),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      await ref.read(supervisorLangProvider.notifier).setLang(picked);
    }
  }

  Widget _group(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SvCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: AppColors.textMuted,
                ),
              ),
            ),
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) const Divider(height: 1),
              rows[i],
            ],
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;

  const _ToggleRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
            IgnorePointer(
              child: Switch.adaptive(
                value: value,
                activeThumbColor: SupervisorSettingsPage._accent,
                onChanged: (_) {},
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueRow extends StatelessWidget {
  final String label;
  final String value;

  const _ValueRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
            Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _NavRow({required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 52,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
                Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

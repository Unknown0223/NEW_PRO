import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/auth_provider.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

/// CACTUS uslubidagi profil/menyu — ishlaydigan funksiyalar ulangan.
class SupervisorMenuPage extends ConsumerWidget {
  const SupervisorMenuPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final l10n = ref.watch(svL10nProvider);
    final themeMode = ref.watch(appThemeModeProvider);
    final lang = ref.watch(supervisorLangProvider);
    final user = session.user;
    final name = (user?.name ?? 'Супервайзер').trim();
    final server = session.tenantName?.trim().isNotEmpty == true
        ? session.tenantName!
        : 'Сервер: ${session.tenantSlug ?? '—'}';
    const accent = AppColors.supervisorAccent;

    String themeLabel() => switch (themeMode) {
          ThemeMode.dark => 'Вкл.',
          ThemeMode.system => 'Системная',
          ThemeMode.light => 'Выкл.',
        };

    Widget tile({
      required IconData icon,
      required String title,
      String? subtitle,
      bool soon = false,
      Color? titleColor,
      VoidCallback? onTap,
    }) {
      return ListTile(
        leading: Icon(icon, color: titleColor ?? AppColors.textMenu),
        title: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: titleColor ?? AppColors.textPrimary,
                ),
              ),
            ),
            if (soon) const SvSoonBadge(),
          ],
        ),
        subtitle: subtitle == null ? null : Text(subtitle, style: AppTypography.caption),
        trailing: soon ? null : const Icon(Icons.chevron_right, color: AppColors.textMuted),
        onTap: soon ? () => showSupervisorSoon(context, feature: title) : onTap,
      );
    }

    Future<void> pickTheme() async {
      final picked = await showModalBottomSheet<ThemeMode>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Системная'),
                trailing: themeMode == ThemeMode.system ? const Icon(Icons.check, color: accent) : null,
                onTap: () => Navigator.pop(ctx, ThemeMode.system),
              ),
              ListTile(
                title: const Text('Вкл.'),
                trailing: themeMode == ThemeMode.dark ? const Icon(Icons.check, color: accent) : null,
                onTap: () => Navigator.pop(ctx, ThemeMode.dark),
              ),
              ListTile(
                title: const Text('Выкл.'),
                trailing: themeMode == ThemeMode.light ? const Icon(Icons.check, color: accent) : null,
                onTap: () => Navigator.pop(ctx, ThemeMode.light),
              ),
            ],
          ),
        ),
      );
      if (picked != null) {
        await ref.read(appThemeModeProvider.notifier).setMode(picked);
      }
    }

    Future<void> pickLang() async {
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
                  trailing: lang == item ? const Icon(Icons.check, color: accent) : null,
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

    Future<void> shareProfile() async {
      final text = [
        name,
        server,
        'Роль: supervisor',
        'Sales Arena',
      ].join('\n');
      await shareSupervisorText(context, text, successLabel: l10n.copied);
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(context, title: '', showMenu: false, actions: [
        IconButton(
          icon: const Icon(Icons.edit_outlined),
          onPressed: () => context.push('/profile'),
        ),
      ]),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          const SizedBox(height: 8),
          Column(
            children: [
              CircleAvatar(
                radius: 36,
                backgroundColor: accent.withValues(alpha: 0.12),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'S',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: accent),
                ),
              ),
              const SizedBox(height: 12),
              Text(name, textAlign: TextAlign.center, style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(server, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
            ],
          ),
          const SizedBox(height: 16),
          Builder(
            builder: (_) {
              final policy = SupervisorConfigPolicy(session.mobileConfig);
              return SvCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    tile(
                      icon: Icons.add_business_outlined,
                      title: 'Добавить торговую точку',
                      subtitle: policy.canCreateClient
                          ? null
                          : 'Запрещено в конфигурации',
                      soon: policy.canCreateClient,
                      onTap: policy.canCreateClient
                          ? null
                          : () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Создание ТТ отключено в веб-конфигурации супервайзера',
                                  ),
                                ),
                              );
                            },
                    ),
                    const Divider(height: 1),
                    tile(
                      icon: Icons.store_mall_directory_outlined,
                      title: 'База клиентов',
                      subtitle: policy.canEditClient
                          ? 'Только клиенты ваших агентов'
                          : 'Редактирование отключено',
                      onTap: () => context.push('/sv-clients'),
                    ),
                    const Divider(height: 1),
                    tile(
                      icon: Icons.notifications_outlined,
                      title: 'Уведомления',
                      subtitle: 'Изменения координат от других SVR',
                      onTap: () => context.push('/sv-notifications'),
                    ),
                    const Divider(height: 1),
                    tile(
                      icon: Icons.task_alt_outlined,
                      title: 'Задачи',
                      soon: true,
                    ),
                    const Divider(height: 1),
                    tile(
                      icon: Icons.gps_fixed,
                      title: l10n.gpsMonitoring,
                      onTap: () => context.push('/sv-gps'),
                    ),
                    const Divider(height: 1),
                    tile(
                      icon: Icons.share_location_outlined,
                      title: l10n.sendLocation,
                      onTap: () => sendSupervisorMyLocation(ref, context),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          SvCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                tile(
                  icon: Icons.insights_outlined,
                  title: 'KPI',
                  onTap: () => context.push('/sv-kpi'),
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.route_outlined,
                  title: 'Дневной план',
                  onTap: () => context.push('/sv-kpi/route'),
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.people_outline,
                  title: l10n.agents,
                  onTap: () => context.push('/agents'),
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.dashboard_outlined,
                  title: 'Дашборд',
                  onTap: () => context.push('/dashboard'),
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.share_outlined,
                  title: l10n.share,
                  onTap: shareProfile,
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.settings_outlined,
                  title: 'Настройки',
                  onTap: () => context.push('/sv-settings'),
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.dark_mode_outlined,
                  title: l10n.darkTheme,
                  subtitle: themeLabel(),
                  onTap: pickTheme,
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.language,
                  title: l10n.language,
                  subtitle: ref.read(supervisorLangProvider.notifier).label,
                  onTap: pickLang,
                ),
                const Divider(height: 1),
                tile(
                  icon: Icons.sync,
                  title: 'Синхронизация',
                  onTap: () async {
                    final ok = (await ref.read(authStateProvider.notifier).resync()).ok;
                    ref.invalidate(supervisorSummaryProvider);
                    ref.invalidate(supervisorVisitsProvider('today'));
                    ref.invalidate(supervisorAgentLocationsProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(ok ? 'Синхронизировано' : 'Ошибка')),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SvCard(
            padding: EdgeInsets.zero,
            child: tile(
              icon: Icons.logout,
              title: l10n.logout,
              titleColor: AppColors.error,
              onTap: () async => ref.read(authStateProvider.notifier).logout(),
            ),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text('Супервайзер', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ),
        ],
      ),
    );
  }
}

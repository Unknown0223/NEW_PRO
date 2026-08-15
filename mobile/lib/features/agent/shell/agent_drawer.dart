import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/app/app_build_info.dart';
import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../../../core/update/app_update_info.dart';
import 'agent_display_title.dart';
import 'agent_menu_config.dart';
import '../warehouse/warehouse_stock_providers.dart';

/// Menyu ekrani — salec-agent-mobile-ui-design shablon.
class AgentDrawer extends ConsumerStatefulWidget {
  const AgentDrawer({super.key});

  @override
  ConsumerState<AgentDrawer> createState() => _AgentDrawerState();
}

class _AgentDrawerState extends ConsumerState<AgentDrawer> {
  bool _checkingUpdate = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).refreshMobileConfig();
      ref.read(authStateProvider.notifier).refreshAgentIdentity();
    });
  }

  void _soonSnack() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Скоро будет доступно')),
    );
  }

  Future<void> _onCheckUpdate() async {
    if (_checkingUpdate) return;
    setState(() => _checkingUpdate = true);
    try {
      final result = await ref.read(authStateProvider.notifier).checkForAppUpdateManual();
      if (!mounted) return;
      switch (result) {
        case AppUpdateUpToDate(:final currentVersion):
          showAgentToast(
            context,
            S.appUpdateAlreadyLatest(currentVersion),
            accentColor: AppColors.success,
          );
        case AppUpdateOffered():
          Navigator.pop(context);
        case AppUpdateCheckFailed(:final message):
          showAgentToast(context, message, accentColor: AppColors.error);
      }
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final config = session.mobileConfig;
    final menu = agentMenuItems(config);

    final agentName = (user?.name ?? '').trim();
    final agentCode = user?.code?.trim();
    final tenantLabel = session.tenantName?.trim().isNotEmpty == true
        ? session.tenantName!
        : 'Сервер: ${session.tenantSlug ?? "-"}';

    void go(String path) {
      Navigator.pop(context);
      if (path.isEmpty) return;
      final loc = GoRouterState.of(context).matchedLocation;
      if (loc == path) {
        ref.read(agentRouteReselectProvider.notifier).state = path;
      }
      context.go(path);
    }

    return Drawer(
      backgroundColor: AppColors.background,
      width: MediaQuery.sizeOf(context).width,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  AgentIconButton(icon: Icons.arrow_back, onPressed: () => Navigator.pop(context)),
                  AgentIconButton(icon: Icons.edit_outlined, onPressed: () => go('/profile')),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      AgentMenuAvatar(name: agentName, code: agentCode),
                      const SizedBox(width: 14),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width - 40 - 62 - 14,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                              if (agentCode != null && agentCode.isNotEmpty)
                                Text(
                                  agentCode,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                    color: AppColors.textTitle,
                                  ),
                                ),
                              Text(
                                agentName.isEmpty ? 'Агент' : agentName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  height: 1.25,
                                  color: AppColors.textTitle,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                tenantLabel,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodyMedium.copyWith(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                        const AgentRoleBadge(label: 'Агент'),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: _soonSnack,
                          icon: const Icon(Icons.add_rounded, size: 14),
                          label: const Text(
                            'Добавить аккаунт',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 36),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            foregroundColor: AppColors.primaryDark,
                            side: const BorderSide(color: AppColors.primary),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 14),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                children: [
                  AgentSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (var i = 0; i < menu.length; i++)
                          AgentMenuTile(
                            icon: _iconFor(menu[i].label),
                            label: menu[i].label,
                            badge: menu[i].soon ? 'скоро' : null,
                            showDivider: i > 0,
                            onTap: menu[i].soon ? _soonSnack : () => go(menu[i].route),
                          ),
                        AgentMenuTile(
                          icon: Icons.system_update_outlined,
                          label: _checkingUpdate ? S.appUpdateChecking : S.checkAppUpdate,
                          iconColor: AppColors.info,
                          loading: _checkingUpdate,
                          onTap: _checkingUpdate ? null : _onCheckUpdate,
                        ),
                        AgentMenuTile(
                          icon: Icons.logout,
                          label: 'Выйти',
                          destructive: true,
                          onTap: () async {
                            Navigator.pop(context);
                            await ref.read(authStateProvider.notifier).logout();
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                children: [
                  Image.asset(
                    'assets/brand/header_logo.png',
                    height: 28,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    errorBuilder: (_, __, ___) => Text(
                      S.appName,
                      textAlign: TextAlign.center,
                      style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  FutureBuilder<String>(
                    future: AppBuildInfo.versionWithBuild(),
                    builder: (context, snap) {
                      final v = snap.data ?? '…';
                      return Text(
                        'v$v',
                        textAlign: TextAlign.center,
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.textMuted,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String label) {
    if (label.contains('Главная')) return Icons.home_outlined;
    if (label.contains('торговую')) return Icons.add_business_outlined;
    if (label.contains('Заказы')) return Icons.shopping_cart_outlined;
    if (label.contains('обмен') || label.contains('Almashinuv')) return Icons.swap_horiz_outlined;
    if (label.contains('полки') || label.contains('Polkadan')) return Icons.undo_outlined;
    if (label == 'KPI') return Icons.insights_outlined;
    if (label.contains('Дневной план') || label.contains('Диагностика')) {
      return Icons.calendar_view_day_outlined;
    }
    if (label.contains('Отчёт')) return Icons.bar_chart_outlined;
    if (label.contains('Торговые точки') || label == 'Тор. точки') {
      return Icons.storefront_outlined;
    }
    if (label.contains('Зарплата')) return Icons.payments_outlined;
    if (label.contains('Должники по')) return Icons.person_outline;
    if (label.contains('Должники')) return Icons.people_outline;
    if (label.contains('складе')) return Icons.inventory_2_outlined;
    if (label.contains('Черновик')) return Icons.drafts_outlined;
    if (label.contains('Задачи')) return Icons.task_alt_outlined;
    if (label.contains('локация')) return Icons.my_location_outlined;
    if (label.contains('Табель') || label.contains('jadval')) return Icons.assignment_outlined;
    if (label.contains('Настройки')) return Icons.settings_outlined;
    return Icons.chevron_right;
  }
}

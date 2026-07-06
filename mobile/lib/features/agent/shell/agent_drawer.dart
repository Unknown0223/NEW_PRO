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
import 'agent_display_title.dart';
import 'agent_menu_config.dart';
import '../warehouse/warehouse_stock_providers.dart';

/// Menyu ekrani (shablon MenuScreen) — develop-flutter-mobile-frontend.
class AgentDrawer extends ConsumerStatefulWidget {
  const AgentDrawer({super.key});

  @override
  ConsumerState<AgentDrawer> createState() => _AgentDrawerState();
}

class _AgentDrawerState extends ConsumerState<AgentDrawer> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).refreshMobileConfig();
      ref.read(authStateProvider.notifier).refreshAgentIdentity();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final config = session.mobileConfig;
    final menu = agentMenuItems(config);

    final agentName = (user?.name ?? '').trim();
    final agentCode = user?.code?.trim();

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
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      AgentIconButton(icon: Icons.arrow_back, onPressed: () => Navigator.pop(context)),
                      AgentIconButton(icon: Icons.edit_outlined, onPressed: () => go('/profile')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const AgentMenuAvatar(),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Column(
                      children: [
                        if (agentCode != null && agentCode.isNotEmpty)
                          Text(
                            agentCode,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                              color: AppColors.textTitle,
                            ),
                          ),
                        if (agentCode != null && agentCode.isNotEmpty) const SizedBox(height: 4),
                        Text(
                          agentName.isEmpty ? 'Агент' : agentName,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: agentCode != null && agentCode.isNotEmpty ? 16 : 20,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                            color: AppColors.textTitle,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    session.tenantName?.trim().isNotEmpty == true
                        ? session.tenantName!
                        : 'Сервер: ${session.tenantSlug ?? "-"}',
                    style: AppTypography.bodyMedium.copyWith(fontSize: 16, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  const AgentRoleBadge(label: 'Агент'),
                  const SizedBox(height: 16),
                  Material(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Добавление аккаунта — скоро')),
                        );
                      },
                      child: const SizedBox(
                        height: 46,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add, color: AppColors.primary, size: 24),
                            SizedBox(width: 8),
                            Text(
                              'Добавить аккаунт',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
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
                            badge: menu[i].soon ? 'Скоро!' : null,
                            showDivider: i > 0,
                            onTap: menu[i].soon ? () {} : () => go(menu[i].route),
                          ),
                        AgentMenuTile(
                          icon: Icons.system_update_outlined,
                          label: S.checkAppUpdate,
                          onTap: () async {
                            Navigator.pop(context);
                            await ref.read(authStateProvider.notifier).checkForAppUpdate();
                          },
                        ),
                        AgentMenuTile(
                          icon: Icons.logout,
                          label: 'Выйти',
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
              child: FutureBuilder<String>(
                future: AppBuildInfo.versionWithBuild(),
                builder: (context, snap) {
                  final v = snap.data ?? '…';
                  return Text(
                    'SALEC $v',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted, fontSize: 14),
                  );
                },
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
    if (label == 'KPI') return Icons.insights_outlined;
    if (label.contains('Зарплата')) return Icons.payments_outlined;
    if (label.contains('Диагностика')) return Icons.medical_services_outlined;
    if (label.contains('Должники по')) return Icons.person_outline;
    if (label.contains('Должники')) return Icons.people_outline;
    if (label.contains('складе')) return Icons.inventory_2_outlined;
    if (label.contains('Черновик')) return Icons.drafts_outlined;
    if (label.contains('Задачи')) return Icons.task_alt_outlined;
    if (label.contains('локация')) return Icons.my_location_outlined;
    if (label.contains('Настройки')) return Icons.settings_outlined;
    return Icons.chevron_right;
  }
}

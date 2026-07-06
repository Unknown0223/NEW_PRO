import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../config/expeditor_config_enforcement.dart';

/// Ekspeditor menyu / profil ekrani (shablon MenuScreen — orange accent).
class ExpeditorDrawer extends ConsumerStatefulWidget {
  const ExpeditorDrawer({super.key});

  @override
  ConsumerState<ExpeditorDrawer> createState() => _ExpeditorDrawerState();
}

class _ExpeditorDrawerState extends ConsumerState<ExpeditorDrawer> {
  String _version = '';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((p) {
      if (mounted) setState(() => _version = p.version);
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final policy = ExpeditorConfigPolicy.fromMobileConfig(session.mobileConfig);
    final name = (user?.name ?? '').trim();

    void go(String path, {bool push = true}) {
      Navigator.pop(context);
      if (path.isEmpty) return;
      if (push) {
        context.push(path);
      } else {
        context.go(path);
      }
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
                      AgentIconButton(
                          icon: Icons.arrow_back,
                          onPressed: () => Navigator.pop(context),),
                      AgentIconButton(
                          icon: Icons.edit_outlined,
                          onPressed: () => go('/profile'),),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const CircleAvatar(
                    radius: 44,
                    backgroundColor: AppColors.surfaceVariant,
                    child: Icon(Icons.person,
                        size: 52, color: AppColors.textMuted,),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    name.isEmpty ? 'Экспедитор' : name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                        color: AppColors.textTitle,),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Сервер: ${session.tenantSlug ?? "-"}',
                    style: AppTypography.bodyMedium
                        .copyWith(fontSize: 16, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 16),
                  Material(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Добавление аккаунта — скоро'),),
                        );
                      },
                      child: const SizedBox(
                        height: 46,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add,
                                color: AppColors.expeditorAccent, size: 24,),
                            SizedBox(width: 8),
                            Text(
                              'Добавить аккаунт',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.expeditorAccent,),
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
                        AgentMenuTile(
                          icon: Icons.home_outlined,
                          label: 'Главная',
                          showDivider: false,
                          onTap: () => go('/home', push: false),
                        ),
                        AgentMenuTile(
                          icon: Icons.add_location_alt_outlined,
                          label: 'Дополнительные визиты',
                          onTap: () => go('/visits', push: false),
                        ),
                        if (policy.paymentsEnabled)
                          AgentMenuTile(
                            icon: Icons.payments_outlined,
                            label: 'Изменение оплаты',
                            onTap: () => go('/payments'),
                          ),
                        AgentMenuTile(
                          icon: Icons.assignment_return_outlined,
                          label: policy.allowReturnFromShelf
                              ? 'Возврат с полки по заказу'
                              : 'Возврат / догрузка',
                          onTap: () => go(policy.allowReturnFromShelf
                              ? '/exp-return-by-order'
                              : '/returns',),
                        ),
                        AgentMenuTile(
                          icon: Icons.fact_check_outlined,
                          label: 'Мои возвраты',
                          onTap: () => go('/my-returns'),
                        ),
                        AgentMenuTile(
                          icon: Icons.inventory_2_outlined,
                          label: 'Остаток в машине',
                          onTap: () => go('/deliveries', push: false),
                        ),
                        AgentMenuTile(
                          icon: Icons.history_toggle_off_outlined,
                          label: 'Незавершённые заказы',
                          onTap: () => go('/exp-unfinished'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  AgentSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        AgentMenuTile(
                          icon: Icons.share_outlined,
                          label: 'Поделиться',
                          badge: 'Скоро!',
                          showDivider: false,
                          onTap: () {},
                        ),
                        AgentMenuTile(
                          icon: Icons.settings_outlined,
                          label: 'Настройки',
                          onTap: () => go('/exp-settings'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  AgentSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () async {
                        Navigator.pop(context);
                        await ref.read(authStateProvider.notifier).logout();
                      },
                      child: const SizedBox(
                        height: 52,
                        child: Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Row(
                            children: [
                              Icon(Icons.logout,
                                  color: AppColors.error, size: 22,),
                              SizedBox(width: 12),
                              Text(
                                'Выйти из аккаунта',
                                style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.error,),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_version.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  _version,
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted, fontSize: 14),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

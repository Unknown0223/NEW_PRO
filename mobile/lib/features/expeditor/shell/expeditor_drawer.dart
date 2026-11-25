import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/app_product.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../config/expeditor_config_enforcement.dart';
import '../settings/expeditor_profile_shortcuts.dart';
import '../shared/tezyuk_expeditor_chrome.dart';

/// Ekspeditor menyu yo‘nalishlari — bir-biriga o‘tish tekshiruvi.
const expeditorMenuRoutes = <String>[
  '/home',
  '/visits',
  '/payments',
  '/exp-return-by-order',
  '/returns',
  '/my-returns',
  '/exp-queue',
  '/exp-share',
  '/deliveries',
  '/exp-unfinished',
  '/attendance',
  '/exp-settings',
  '/profile',
];

/// Ekspeditor menyu / profil ekrani (shablon MenuScreen — green brand accent).
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

    void go(String path, {bool push = false}) {
      if (path.isEmpty) {
        Navigator.pop(context);
        return;
      }
      final router = GoRouter.of(context);
      Navigator.pop(context);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (push) {
          router.push(path);
        } else {
          router.go(path);
        }
      });
    }

    return Drawer(
      backgroundColor: expeditorPageBackground(),
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
                    name.isEmpty
                        ? expeditorLabel('Экспедитор', 'Ekspeditor')
                        : name,
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
                    expeditorLabel(
                      'Сервер: ${session.tenantSlug ?? "-"}',
                      'Server: ${session.tenantSlug ?? "-"}',
                    ),
                    style: AppTypography.bodyMedium
                        .copyWith(fontSize: 16, color: AppColors.textMuted),
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
                          label: expeditorLabel('Главная', 'Bosh sahifa'),
                          showDivider: false,
                          onTap: () => go('/home'),
                        ),
                        AgentMenuTile(
                          icon: Icons.add_location_alt_outlined,
                          label: expeditorLabel(
                            'Дополнительные визиты',
                            'Qo\'shimcha tashriflar',
                          ),
                          onTap: () => go('/visits'),
                        ),
                        if (policy.paymentsEnabled)
                          AgentMenuTile(
                            icon: Icons.payments_outlined,
                            label: expeditorLabel(
                              'Изменение оплаты',
                              'To\'lovlar',
                            ),
                            onTap: () => go('/payments'),
                          ),
                        AgentMenuTile(
                          icon: Icons.assignment_return_outlined,
                          label: policy.allowReturnFromShelf
                              ? expeditorLabel(
                                  'Возврат с полки по заказу',
                                  'Buyurtma bo\'yicha javondan qaytarish',
                                )
                              : expeditorLabel(
                                  'Возврат / догрузка',
                                  'Qaytarish / qo\'shimcha yuk',
                                ),
                          onTap: () => go(policy.allowReturnFromShelf
                              ? '/exp-return-by-order'
                              : '/returns',),
                        ),
                        AgentMenuTile(
                          icon: Icons.fact_check_outlined,
                          label: expeditorLabel('Мои возвраты', 'Mening qaytarishlarim'),
                          onTap: () => go('/my-returns'),
                        ),
                        if (isTezyukProduct)
                          AgentMenuTile(
                            icon: Icons.local_shipping_outlined,
                            label: 'Yetkazish navbati',
                            onTap: () => go('/exp-queue'),
                          ),
                        AgentMenuTile(
                          icon: Icons.inventory_2_outlined,
                          label: isTezyukProduct ? 'Qoldiq' : 'Остаток в машине',
                          onTap: () => go('/deliveries'),
                        ),
                        AgentMenuTile(
                          icon: Icons.history_toggle_off_outlined,
                          label: expeditorLabel(
                            'Незавершённые заказы',
                            'Tugallanmagan buyurtmalar',
                          ),
                          onTap: () => go('/exp-unfinished'),
                        ),
                        AgentMenuTile(
                          icon: Icons.fingerprint,
                          label: expeditorLabel(
                            'Отметка посещаемости (Приход / Уход)',
                            'Davomat (kirish / chiqish)',
                          ),
                          onTap: () => go('/attendance', push: true),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  AgentSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        if (isTezyukProduct)
                          Builder(builder: (_) {
                            final share = ulashishShortcutWave1();
                            return AgentMenuTile(
                              icon: Icons.share_outlined,
                              label: share.label,
                              badge: share.badge,
                              showDivider: false,
                              onTap: share.enabled ? () => go('/exp-share') : null,
                            );
                          },),
                        AgentMenuTile(
                          icon: Icons.settings_outlined,
                          label: expeditorLabel('Настройки', 'Sozlamalar'),
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
                      child: SizedBox(
                        height: 52,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Row(
                            children: [
                              Icon(
                                Icons.logout,
                                color: isTezyukProduct
                                    ? TezyukColors.error
                                    : AppColors.error,
                                size: 22,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                expeditorLabel(
                                  'Выйти из аккаунта',
                                  'Hisobdan chiqish',
                                ),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: isTezyukProduct
                                      ? TezyukColors.error
                                      : AppColors.error,
                                ),
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

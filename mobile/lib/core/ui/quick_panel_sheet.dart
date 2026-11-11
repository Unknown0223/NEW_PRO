import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/design_system.dart';
import '../prefs/quick_panel_prefs.dart';
import '../prefs/quick_panel_provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'agent_ui.dart';

IconData quickPanelIcon(String key) {
  switch (key) {
    case 'home':
      return Icons.home_outlined;
    case 'place':
      return Icons.place_outlined;
    case 'storefront':
      return Icons.storefront_outlined;
    case 'receipt_long':
      return Icons.receipt_long_outlined;
    case 'add_shopping_cart':
      return Icons.add_shopping_cart_outlined;
    case 'insights':
      return Icons.insights_outlined;
    case 'route':
      return Icons.route_outlined;
    case 'bar_chart':
      return Icons.bar_chart_outlined;
    case 'account_balance_wallet':
      return Icons.account_balance_wallet_outlined;
    case 'request_quote':
      return Icons.request_quote_outlined;
    case 'inventory_2':
      return Icons.inventory_2_outlined;
    case 'draft':
      return Icons.drafts_outlined;
    case 'task_alt':
      return Icons.task_alt_outlined;
    case 'map':
      return Icons.map_outlined;
    case 'calendar_month':
      return Icons.calendar_month_outlined;
    case 'face':
      return Icons.face_outlined;
    case 'card_giftcard':
      return Icons.card_giftcard_outlined;
    case 'search':
      return Icons.search;
    case 'notifications':
      return Icons.notifications_outlined;
    case 'settings':
      return Icons.settings_outlined;
    case 'person':
      return Icons.person_outline;
    case 'local_shipping':
      return Icons.local_shipping_outlined;
    case 'payments':
      return Icons.payments_outlined;
    case 'groups':
      return Icons.groups_outlined;
    case 'my_location':
      return Icons.my_location_outlined;
    case 'inbox':
      return Icons.inbox_outlined;
    case 'add_business':
      return Icons.add_business_outlined;
    default:
      return Icons.chevron_right;
  }
}

/// Shablon GlobalChrome «Tezkor o'tish» paneli (o‘ng sheet).
Future<void> showQuickPanelSheet(BuildContext context) {
  // Modal ichida GoRouterState.of(context) topilmasligi mumkin — oldindan oling.
  final loc = GoRouterState.of(context).matchedLocation;
  final router = GoRouter.of(context);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _QuickPanelSheet(currentLoc: loc, router: router),
  );
}

class _QuickPanelSheet extends ConsumerWidget {
  final String currentLoc;
  final GoRouter router;

  const _QuickPanelSheet({required this.currentLoc, required this.router});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(quickPanelItemsProvider);
    final items = async.valueOrNull ?? const <QuickPanelItem>[];
    final loc = currentLoc;

    return SaPopIn(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.72,
        ),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Быстрый переход',
                            style: AppTypography.headlineMedium.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textTitle,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Разделы можно настроить в Настройках',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    AgentIconButton(
                      icon: Icons.settings_outlined,
                      onPressed: () {
                        Navigator.of(context).pop();
                        // pop tugagach push — aks holda route yutiladi.
                        Future<void>.microtask(
                          () => router.push('/settings/quick'),
                        );
                      },
                    ),
                    AgentIconButton(
                      icon: Icons.close,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.divider),
              if (async.isLoading && items.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) {
                      final item = items[i];
                      final active = loc == item.route ||
                          (item.route != '/home' &&
                              loc.startsWith(item.route));
                      // Sheet ochilganda N ta SaEnter ANR xavfi — faqat press.
                      return SaPressable(
                          onTap: () {
                            Navigator.of(context).pop();
                            router.go(item.route);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: active
                                  ? AppColors.primary.withValues(alpha: 0.08)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: active
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  quickPanelIcon(item.icon),
                                  size: 20,
                                  color: active
                                      ? AppColors.primary
                                      : AppColors.textSecondary,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    item.label,
                                    style: AppTypography.bodyMedium.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                const Icon(
                                  Icons.chevron_right,
                                  size: 18,
                                  color: AppColors.textMuted,
                                ),
                              ],
                            ),
                          ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// AppBar uchun tezkor tugma.
class QuickPanelAction extends StatelessWidget {
  const QuickPanelAction({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Быстрое меню',
      button: true,
      child: AgentIconButton(
        icon: Icons.grid_view_rounded,
        onPressed: () => showQuickPanelSheet(context),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/clients/agent_client_balance.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/format/money_display.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../auth/auth_provider.dart';
import '../orders/order_draft_provider.dart';
import '../orders/order_draft_ui.dart';
import 'clients_list_provider.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../../../core/ui/client_photo_thumb.dart';

/// Mijozlar ro‘yxati — vizitlar va qidiruv uchun (kun + filtr bilan).
class AgentClientsOutletList extends ConsumerWidget {
  final bool visitsMode;

  const AgentClientsOutletList({super.key, this.visitsMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clientsAsync = ref.watch(filteredClientsProvider);
    final allCount = ref.watch(clientsListProvider).valueOrNull?.length ?? 0;
    final weekdayTab = ref.watch(effectiveWeekdayTabProvider);

    return AgentDayTabSlideView(
      child: clientsAsync.when(
      data: (clients) {
        if (clients.isEmpty) {
          final hasCatalog = allCount > 0 && weekdayTab > 0;
          return AgentEmptyState.fill(
            message: visitsMode
                ? (hasCatalog ? S.emptyVisitHasClientsHint : S.emptyVisitPoints)
                : S.emptyOutlets,
            action: hasCatalog
                ? FilledButton(
                    onPressed: () => ref.read(outletWeekdayTabProvider.notifier).state = 0,
                    child: Text('${S.emptyVisitOpenAll} ($allCount)'),
                  )
                : null,
          );
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            // clientsListProvider ni invalidate qilish filteredClientsProvider ni
            // avtomatik qayta hisoblaydi (chunki u clientsListProvider.future ni watch qiladi).
            // Ikkalasini bir vaqtda invalidate qilish 2-3 marta qayta renderga olib keladi (flickering).
            ref.invalidate(clientsListProvider);
            if (visitsMode) ref.invalidate(clientAgentLedgerBalancesProvider);
          },
          child: Builder(
            builder: (context) {
              final showBalance =
                  ref.watch(sessionProvider).mobileConfig?.client.showBalance ?? true;
              final agentBalances =
                  ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
              final drafts = ref.watch(orderDraftsProvider).valueOrNull;
              final visitedIds = visitsMode
                  ? ref.watch(visitedTodayClientIdsProvider).valueOrNull
                  : null;
              return ListView.builder(
                padding: EdgeInsets.fromLTRB(12, 12, 12, visitsMode ? 88 : 24),
                itemCount: clients.length,
                itemBuilder: (_, i) {
                  final c = clients[i];
                  final id = (c['id'] as num?)?.toInt();
                  final balanceAmount = showBalance
                      ? clientAgentLedgerBalance(agentBalances, id)
                      : null;
                  final hasDraft = id != null && drafts?[id] != null;
                  final visited =
                      id != null && (visitedIds?.contains(id) ?? false);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ClientListTile(
                      client: c,
                      visitsMode: visitsMode,
                      balanceAmount: balanceAmount,
                      hasDraft: hasDraft,
                      visited: visited,
                      onTap: id != null ? () => context.push('/clients/$id') : null,
                    ),
                  );
                },
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (e, _) => AgentErrorPanel(
        error: e,
        onRetry: () {
          ref.invalidate(clientsListProvider);
        },
        onLogin: () {
          ref.read(authStateProvider.notifier).sessionExpired();
          context.go('/login');
        },
      ),
    ),
    );
  }
}

class _ClientListTile extends StatelessWidget {
  final Map<String, dynamic> client;
  final bool visitsMode;
  final double? balanceAmount;
  final bool hasDraft;
  final bool visited;
  final VoidCallback? onTap;

  const _ClientListTile({
    required this.client,
    required this.visitsMode,
    this.balanceAmount,
    this.hasDraft = false,
    this.visited = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = client['name']?.toString() ?? '';
    final code = client['client_code']?.toString().trim() ?? '';
    final phone = client['phone']?.toString() ?? '';
    final category = client['category']?.toString() ?? '';
    final visitDays = formatClientVisitDaysDisplay(client);
    final debt = balanceAmount != null ? formatClientBalanceAmount(balanceAmount!) : '';
    final debtColor =
        balanceAmount != null ? colorForClientBalance(balanceAmount!) : AppColors.textPrimary;

    if (visitsMode) {
      return AgentVisitOutletCard(
        name: name,
        code: code.isNotEmpty ? code : (phone.isNotEmpty ? phone : '—'),
        grade: category.isNotEmpty ? category : 'B',
        visitDays: visitDays,
        photoUrl: firstClientPhotoUrl(client),
        balanceAmount: balanceAmount,
        hasDraft: hasDraft,
        visited: visited,
        onTap: onTap,
      );
    }

    return AgentOutletCard(
      name: name,
      subtitle: code.isNotEmpty ? code : (phone.isNotEmpty ? phone : '—'),
      grade: category.isNotEmpty ? category : 'B',
      photoUrl: firstClientPhotoUrl(client),
      trailing: debt,
      headerTrailing: hasDraft ? const OrderDraftListBadge() : null,
      trailingColor: debtColor,
      onTap: onTap,
    );
  }
}

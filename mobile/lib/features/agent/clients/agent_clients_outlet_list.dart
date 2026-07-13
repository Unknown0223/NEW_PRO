import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/clients/agent_client_balance.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../auth/auth_provider.dart';
import '../orders/order_draft_provider.dart';
import '../orders/order_draft_ui.dart';
import 'clients_list_provider.dart';
import '../../../core/ui/agent_visit_ui.dart';

/// Mijozlar ro‘yxati — vizitlar va qidiruv uchun (kun + filtr bilan).
class AgentClientsOutletList extends ConsumerWidget {
  final bool visitsMode;

  const AgentClientsOutletList({super.key, this.visitsMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clientsAsync = ref.watch(filteredClientsProvider);

    return AgentDayTabSlideView(
      child: clientsAsync.when(
      data: (clients) {
        if (clients.isEmpty) {
          return AgentEmptyState.fill(
            message: visitsMode ? S.emptyVisitPoints : S.emptyOutlets,
          );
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(clientsListProvider);
            ref.invalidate(filteredClientsProvider);
            if (visitsMode) ref.invalidate(clientAgentLedgerBalancesProvider);
          },
          child: ListView.builder(
            padding: EdgeInsets.fromLTRB(12, 12, 12, visitsMode ? 88 : 24),
            itemCount: clients.length,
            itemBuilder: (_, i) {
              final c = clients[i];
              final id = c['id'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ClientListTile(
                  client: c,
                  visitsMode: visitsMode,
                  onTap: id != null ? () => context.push('/clients/$id') : null,
                ),
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
          ref.invalidate(filteredClientsProvider);
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

class _ClientListTile extends ConsumerWidget {
  final Map<String, dynamic> client;
  final bool visitsMode;
  final VoidCallback? onTap;

  const _ClientListTile({
    required this.client,
    required this.visitsMode,
    this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = client['name']?.toString() ?? '';
    final code = client['client_code']?.toString().trim() ?? '';
    final phone = client['phone']?.toString() ?? '';
    final category = client['category']?.toString() ?? '';
    final clientId = (client['id'] as num?)?.toInt();
    final showBalance = ref.watch(sessionProvider).mobileConfig?.client.showBalance ?? true;
    final agentBalances = visitsMode
        ? ref.watch(clientAgentLedgerBalancesProvider).valueOrNull
        : ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
    final balanceAmount = showBalance
        ? clientAgentLedgerBalance(agentBalances, clientId)
        : null;
    final debt = showBalance ? formatClientBalanceAmount(balanceAmount ?? 0) : '';
    final debtColor = showBalance ? colorForClientBalance(balanceAmount ?? 0) : AppColors.textPrimary;

    final drafts = ref.watch(orderDraftsProvider).valueOrNull;
    final draft = clientId != null && drafts != null ? drafts[clientId] : null;
    final visitedIds = visitsMode ? ref.watch(visitedTodayClientIdsProvider).valueOrNull : null;
    final visited = clientId != null && (visitedIds?.contains(clientId) ?? false);

    if (visitsMode) {
      return AgentVisitOutletCard(
        name: name,
        code: code.isNotEmpty ? code : (phone.isNotEmpty ? phone : '—'),
        grade: category.isNotEmpty ? category : 'B',
        balanceAmount: balanceAmount,
        hasDraft: draft != null,
        visited: visited,
        onTap: onTap,
      );
    }

    return AgentOutletCard(
      name: name,
      subtitle: code.isNotEmpty ? code : (phone.isNotEmpty ? phone : '—'),
      grade: category.isNotEmpty ? category : 'B',
      trailing: showBalance ? debt : '',
      headerTrailing: draft != null
          ? OrderDraftHeaderBadge(
              draft: draft,
              onExpired: () => ref.invalidate(orderDraftsProvider),
            )
          : null,
      trailingColor: debtColor,
      onTap: onTap,
    );
  }
}

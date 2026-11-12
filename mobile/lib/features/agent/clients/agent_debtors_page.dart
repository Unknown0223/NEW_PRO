import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../design_system/design_system.dart';
import '../../auth/auth_provider.dart';
import '../shell/agent_app_bar.dart';
import '../orders/order_create_models.dart' show formatMoneyUz;

final debtorsProvider = FutureProvider<List<DebtorClient>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(mobileApiProvider).getDebtors(slug);
});

class AgentDebtorsPage extends ConsumerWidget {
  const AgentDebtorsPage({super.key});

  String _formatBalance(double v) => formatMoneyUz(v);

  String? _formatOverdue(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final dt = DateTime.tryParse(raw);
    if (dt == null) return null;
    return DateFormat('dd.MM.yyyy').format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final debtorsAsync = ref.watch(debtorsProvider);
    final ledger = ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;

    double shownBalance(DebtorClient c) {
      if (ledger == null) return c.balance;
      return ledger[c.id] ?? 0;
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Должники',
        useShellDrawer: true,
        showBack: true,
        actions: [
          AgentIconButton(icon: Icons.search, onPressed: () => context.push('/search?from=/debtors')),
        ],
      ),
      body: debtorsAsync.when(
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                ref.invalidate(debtorsProvider);
                ref.invalidate(clientAgentLedgerBalancesProvider);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.45,
                    child: AgentEmptyState.fill(message: S.emptyDebtors),
                  ),
                ],
              ),
            );
          }
          final visible = rows.where((c) => shownBalance(c) < -0.01).toList();
          final total = visible.fold<double>(0, (s, c) => s + shownBalance(c).abs());
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(debtorsProvider);
              ref.invalidate(clientAgentLedgerBalancesProvider);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
              children: [
                SaEnter(
                  preset: SaMotionPreset.rise,
                  child: AgentBalanceBanner(
                    label: 'Общий долг:',
                    value: formatMoneyUz(total),
                  ),
                ),
                SaEnter(
                  delay: SaStaggerDelay.of(1),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8, left: 4, top: 4),
                    child: Text(
                      'Найдено: ${visible.length}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                    ),
                  ),
                ),
                for (var i = 0; i < visible.length; i++)
                  SaEnter(
                    delay: SaStaggerDelay.of(2 + i),
                    preset: SaMotionPreset.rise,
                    child: Builder(
                      builder: (context) {
                        final c = visible[i];
                        final balance = shownBalance(c);
                        return AgentDebtorCard(
                          name: c.name,
                          photoUrl: c.photoUrl,
                          balance: _formatBalance(balance),
                          balanceAmount: balance,
                          overdue: _formatOverdue(c.overdueAt),
                          openingDebt: c.openingDebt > 0.01 ? _formatBalance(c.openingDebt) : null,
                          debtCollectionOnly: c.debtCollectionOnly,
                          onTap: () => context.push('/clients/${c.id}'),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => AgentErrorPanel(
          error: e,
          onRetry: () => ref.invalidate(debtorsProvider),
          onLogin: () {
            ref.read(authStateProvider.notifier).sessionExpired();
            context.go('/login');
          },
        ),
      ),
    );
  }
}

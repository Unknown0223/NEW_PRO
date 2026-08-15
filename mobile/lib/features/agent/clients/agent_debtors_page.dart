import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
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

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Должники',
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
              onRefresh: () async => ref.invalidate(debtorsProvider),
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
          final total = rows.fold<double>(0, (s, c) => s + c.balance.abs());
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(debtorsProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                AgentBalanceBanner(
                  label: 'Общий долг:',
                  value: formatMoneyUz(total),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8, left: 4, top: 4),
                  child: Text(
                    'Найдено: ${rows.length}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                ),
                for (final c in rows)
                  AgentDebtorCard(
                    name: c.name,
                    balance: _formatBalance(c.balance),
                    balanceAmount: c.balance,
                    overdue: _formatOverdue(c.overdueAt),
                    legacyDebt: c.legacyDebt > 0.01 ? _formatBalance(c.legacyDebt) : null,
                    currentDebt: c.currentDebt > 0.01 ? _formatBalance(c.currentDebt) : null,
                    debtCollectionOnly: c.debtCollectionOnly,
                    onTap: () => context.push('/clients/${c.id}'),
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

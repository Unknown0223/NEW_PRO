import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/format/money_display.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneyUz;
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';
import '../shell/expeditor_drawer.dart';

class ExpeditorDebtorsPage extends ConsumerWidget {
  const ExpeditorDebtorsPage({super.key});

  /// Срок + просрочка (server-anchored vaqt bo'yicha).
  String? _overdue(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final dt = DateTime.tryParse(raw);
    if (dt == null) return null;
    final days = serverNowUtc().difference(dt.toUtc()).inDays;
    final fmt = DateFormat('dd.MM.yyyy').format(workRegionNow(dt));
    if (days > 0) return '$fmt  Просрочено $days дн';
    return fmt;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.watch(sessionProvider).mobileConfig,);
    final debtors = ref.watch(expeditorDebtorsProvider);

    if (!policy.acceptPaymentFromDebtors && !policy.acceptPaymentOnDelivery) {
      return Scaffold(
        appBar: AppBar(title: const Text('Должники')),
        body: const Center(child: Text('Оплата отключена в конфигурации')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: const Text('Должники'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
        ],
      ),
      body: debtors.when(
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: AppColors.expeditorAccent,
              onRefresh: () async => ref.invalidate(expeditorDebtorsProvider),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.5,
                    child: AgentEmptyState.fill(message: 'Пока здесь пусто'),
                  ),
                ],
              ),
            );
          }
          final total = rows.fold<double>(
              0, (s, r) => s + ((r['balance'] as num?)?.toDouble() ?? 0).abs(),);
          return RefreshIndicator(
            color: AppColors.expeditorAccent,
            onRefresh: () async => ref.invalidate(expeditorDebtorsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              itemCount: rows.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                if (i == 0) {
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Общий баланс:',
                            style: AppTypography.bodyMedium
                                .copyWith(color: AppColors.textSecondary),),
                        Text('-${formatMoneyUz(total)} So\'m',
                            style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppColors.error,),),
                      ],
                    ),
                  );
                }
                final c = rows[i - 1];
                final clientId = c['id'] as int?;
                final bal = (c['balance'] as num?)?.toDouble() ?? 0;
                return _DebtorCard(
                  name: c['name']?.toString() ?? '—',
                  address: c['address']?.toString(),
                  balance: bal,
                  overdue: _overdue(c['overdue_at']?.toString()),
                  onTap: clientId == null
                      ? null
                      : () => context.push(
                            '/exp-debtor-client/$clientId',
                            extra: Map<String, dynamic>.from(c),
                          ),
                  onBalanceTap: clientId == null
                      ? null
                      : () => showBalanceByAgentSheet(
                            context,
                            clientId: clientId,
                            fallbackTotal: bal,
                          ),
                );
              },
            ),
          );
        },
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
      ),
    );
  }
}

class _DebtorCard extends StatelessWidget {
  final String name;
  final String? address;
  final double balance;
  final String? overdue;
  final VoidCallback? onTap;
  final VoidCallback? onBalanceTap;

  const _DebtorCard({
    required this.name,
    required this.address,
    required this.balance,
    required this.overdue,
    required this.onTap,
    required this.onBalanceTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDebt = balance < -0.01;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.storefront_outlined,
                        color: AppColors.textSecondary,),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textHeadline,),),
                        if (address != null && address!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(address!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.textMuted),),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: onBalanceTap,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Text('Баланс:',
                          style: AppTypography.bodyMedium
                              .copyWith(color: AppColors.textMuted),),
                      const Spacer(),
                      Text("${formatMoneyUz(balance)} So'm",
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: colorForClientBalance(balance),
                          ),),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down,
                          size: 18, color: AppColors.textMuted,),
                    ],
                  ),
                ),
              ),
              if (overdue != null) ...[
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text('Срок:',
                        style: AppTypography.bodyMedium
                            .copyWith(color: AppColors.textMuted),),
                    const Spacer(),
                    _OverdueText(overdue!),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Sana qora, «Просрочено N дн» — qizil ko'rsatiladi.
class _OverdueText extends StatelessWidget {
  final String raw;
  const _OverdueText(this.raw);

  @override
  Widget build(BuildContext context) {
    final idx = raw.indexOf('Просрочено');
    if (idx < 0) {
      return Text(raw,
          style: const TextStyle(
              fontWeight: FontWeight.w700, color: AppColors.textHeadline,),);
    }
    final datePart = raw.substring(0, idx).trim();
    final overduePart = raw.substring(idx).trim();
    return Text.rich(TextSpan(
      text: '$datePart ',
      style: const TextStyle(
          fontWeight: FontWeight.w700, color: AppColors.textHeadline,),
      children: [
        TextSpan(
          text: overduePart,
          style: const TextStyle(
              fontWeight: FontWeight.w600, color: AppColors.error,),
        ),
      ],
    ),);
  }
}

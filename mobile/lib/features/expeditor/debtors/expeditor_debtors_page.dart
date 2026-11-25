import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/app_product.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/format/money_display.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneyUz;
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';
import '../shared/tezyuk_expeditor_chrome.dart';
import '../shell/expeditor_drawer.dart';

class ExpeditorDebtorsPage extends ConsumerWidget {
  const ExpeditorDebtorsPage({super.key});

  /// Sрок + просрочka (server-anchored vaqt bo'yicha).
  String? _overdue(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final dt = DateTime.tryParse(raw);
    if (dt == null) return null;
    final days = serverNowUtc().difference(dt.toUtc()).inDays;
    final fmt = DateFormat('dd.MM.yyyy').format(workRegionNow(dt));
    if (days > 0) {
      return isTezyukProduct
          ? '$fmt  Muddati o\'tgan $days kun'
          : '$fmt  Просрочено $days дн';
    }
    return fmt;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.watch(sessionProvider).mobileConfig,);
    final debtors = ref.watch(expeditorDebtorsProvider);
    final accent = expeditorChromeAccent();
    final title = expeditorLabel('Должники', 'Qarzdorlar');

    if (!policy.acceptPaymentFromDebtors && !policy.acceptPaymentOnDelivery) {
      return Scaffold(
        backgroundColor: expeditorPageBackground(),
        drawer: const ExpeditorDrawer(),
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: Text(
            expeditorLabel(
              'Оплата отключена в конфигурации',
              'To\'lov konfiguratsiyada o\'chirilgan',
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: expeditorPageBackground(),
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
        ],
      ),
      body: debtors.when(
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: accent,
              onRefresh: () async => ref.invalidate(expeditorDebtorsProvider),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.5,
                    child: AgentEmptyState.fill(
                      message: expeditorLabel(
                        'Пока здесь пусто',
                        'Hozircha bo\'sh',
                      ),
                    ),
                  ),
                ],
              ),
            );
          }
          final total = rows.fold<double>(
              0, (s, r) => s + ((r['balance'] as num?)?.toDouble() ?? 0).abs(),);
          return RefreshIndicator(
            color: accent,
            onRefresh: () async => ref.invalidate(expeditorDebtorsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              itemCount: rows.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                if (i == 0) {
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: expeditorListCardDecoration(radius: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          expeditorLabel('Общий баланс:', 'Umumiy balans:'),
                          style: AppTypography.bodyMedium.copyWith(
                            color: isTezyukProduct
                                ? TezyukColors.onSurfaceVariant
                                : AppColors.textSecondary,
                          ),
                        ),
                        Text(
                          '-${formatMoneyUz(total)} So\'m',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: isTezyukProduct
                                ? TezyukColors.error
                                : AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                final c = rows[i - 1];
                final clientId = c['id'] as int?;
                final bal = (c['balance'] as num?)?.toDouble() ?? 0;
                final opening = (c['opening_debt'] as num?)?.toDouble() ?? 0;
                final fromOps = bal.abs() - opening;
                return _DebtorCard(
                  name: c['name']?.toString() ?? '—',
                  address: c['address']?.toString(),
                  balance: bal,
                  openingDebt: opening > 0.01 ? opening : null,
                  enteredDebt: opening > 0.01 && fromOps > 0.01 ? fromOps : null,
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
        loading: () => Center(child: CircularProgressIndicator(color: accent)),
        error: (e, _) => Center(
          child: Text(
            expeditorLabel('Ошибка: $e', 'Xato: $e'),
          ),
        ),
      ),
    );
  }
}

class _DebtorCard extends StatelessWidget {
  final String name;
  final String? address;
  final double balance;
  final double? openingDebt;
  final double? enteredDebt;
  final String? overdue;
  final VoidCallback? onTap;
  final VoidCallback? onBalanceTap;

  const _DebtorCard({
    required this.name,
    required this.address,
    required this.balance,
    this.openingDebt,
    this.enteredDebt,
    required this.overdue,
    required this.onTap,
    required this.onBalanceTap,
  });

  @override
  Widget build(BuildContext context) {
    final avatarBg = isTezyukProduct
        ? TezyukColors.surfaceContainer
        : AppColors.surfaceVariant;
    final muted = isTezyukProduct
        ? TezyukColors.onSurfaceVariant
        : AppColors.textMuted;
    final headline = isTezyukProduct
        ? TezyukColors.onSurface
        : AppColors.textHeadline;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: expeditorListCardDecoration(),
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
                        color: avatarBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.storefront_outlined,
                        color: muted,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: headline,
                            ),
                          ),
                          if (address != null && address!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              address!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption.copyWith(color: muted),
                            ),
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
                        Text(
                          expeditorLabel('Баланс:', 'Balans:'),
                          style: AppTypography.bodyMedium.copyWith(color: muted),
                        ),
                        const Spacer(),
                        Text(
                          "${formatMoneyUz(balance)} So'm",
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: colorForClientBalance(balance),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(Icons.keyboard_arrow_down, size: 18, color: muted),
                      ],
                    ),
                  ),
                ),
                if (openingDebt != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        expeditorLabel(
                          'Начальный баланс:',
                          'Boshlang\'ich balans:',
                        ),
                        style:
                            AppTypography.bodyMedium.copyWith(color: muted),
                      ),
                      const Spacer(),
                      Text(
                        formatMoneyUz(openingDebt!),
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ],
                if (enteredDebt != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        expeditorLabel('Из операций:', 'Operatsiyalardan:'),
                        style:
                            AppTypography.bodyMedium.copyWith(color: muted),
                      ),
                      const Spacer(),
                      Text(
                        formatMoneyUz(enteredDebt!),
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ],
                if (overdue != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        expeditorLabel('Срок:', 'Muddat:'),
                        style:
                            AppTypography.bodyMedium.copyWith(color: muted),
                      ),
                      const Spacer(),
                      _OverdueText(overdue!),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Sana qora, muddat o'tgan qismi — qizil.
class _OverdueText extends StatelessWidget {
  final String raw;
  const _OverdueText(this.raw);

  @override
  Widget build(BuildContext context) {
    final marker = raw.contains('Muddati o\'tgan')
        ? 'Muddati o\'tgan'
        : 'Просрочено';
    final idx = raw.indexOf(marker);
    final headline = isTezyukProduct
        ? TezyukColors.onSurface
        : AppColors.textHeadline;
    final errorColor =
        isTezyukProduct ? TezyukColors.error : AppColors.error;
    if (idx < 0) {
      return Text(
        raw,
        style: TextStyle(fontWeight: FontWeight.w700, color: headline),
      );
    }
    final datePart = raw.substring(0, idx).trim();
    final overduePart = raw.substring(idx).trim();
    return Text.rich(
      TextSpan(
        text: '$datePart ',
        style: TextStyle(fontWeight: FontWeight.w700, color: headline),
        children: [
          TextSpan(
            text: overduePart,
            style: TextStyle(fontWeight: FontWeight.w600, color: errorColor),
          ),
        ],
      ),
    );
  }
}
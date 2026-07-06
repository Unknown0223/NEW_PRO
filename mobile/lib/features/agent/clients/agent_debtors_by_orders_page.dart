import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../auth/auth_provider.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/orders/order_status_labels.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../orders/order_create_models.dart';
import '../shell/agent_app_bar.dart';

final orderDebtsByOrdersProvider = FutureProvider<OrderDebtsListResult>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) {
    return OrderDebtsListResult(data: [], total: 0, totalRemainder: 0, currency: 'UZS');
  }
  return ref.read(mobileApiProvider).getOrderDebts(slug, limit: 100);
});

final orderDebtDetailProvider = FutureProvider.family<AgentOrderHistoryRow, int>((ref, orderId) async {
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) throw StateError('tenant');
  return ref.read(mobileApiProvider).getOrderDetail(slug, orderId);
});

/// Должники по закazам — ochiq qarzli buyurtmalar + ichki jadval.
class AgentDebtorsByOrdersPage extends ConsumerStatefulWidget {
  const AgentDebtorsByOrdersPage({super.key});

  @override
  ConsumerState<AgentDebtorsByOrdersPage> createState() => _AgentDebtorsByOrdersPageState();
}

class _AgentDebtorsByOrdersPageState extends ConsumerState<AgentDebtorsByOrdersPage> {
  int? _expandedOrderId;

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw.substring(0, raw.length.clamp(0, 10));
    return DateFormat('dd.MM.yyyy').format(dt.toLocal());
  }

  String _formatQty(double v) {
    if (v == v.roundToDouble()) return v.round().toString();
    return v.toStringAsFixed(1);
  }

  List<AgentOrderLineRow> _lineRows(Iterable<AgentOrderHistoryItem> items) {
    return items
        .map(
          (it) => AgentOrderLineRow(
            name: it.productName.isNotEmpty ? it.productName : '—',
            qty: _formatQty(it.qty),
            price: it.isBonus ? '—' : formatMoneyUz(it.price),
            isBonus: it.isBonus,
          ),
        )
        .toList();
  }

  String _orderTitle(OrderDebtRow row) => 'Заказ №${row.orderNumber.isNotEmpty ? row.orderNumber : row.orderId}';

  String _orderTitleFromDetail(AgentOrderHistoryRow o) {
    final n = o.number?.trim();
    final num = (n != null && n.isNotEmpty) ? n : '${o.id}';
    return 'Заказ №$num';
  }

  String _formatBonusSummary(AgentOrderHistoryRow o) {
    if (o.bonusSum > 0) return formatMoneyUz(o.bonusSum);
    if (o.bonusQty > 0) return _formatQty(o.bonusQty);
    return '0';
  }

  @override
  Widget build(BuildContext context) {
    final debtsAsync = ref.watch(orderDebtsByOrdersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Должники по заказам',
        showBack: true,
        actions: [
          AgentIconButton(
            icon: Icons.search,
            onPressed: () => context.push('/search?from=/debtors-by-orders'),
          ),
        ],
      ),
      body: debtsAsync.when(
        data: (result) {
          if (result.data.isEmpty) {
            return RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async => ref.invalidate(orderDebtsByOrdersProvider),
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
          final total = result.totalRemainder > 0
              ? result.totalRemainder
              : result.data.fold<double>(0, (s, r) => s + r.remainder);

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(orderDebtsByOrdersProvider);
              if (_expandedOrderId != null) {
                ref.invalidate(orderDebtDetailProvider(_expandedOrderId!));
              }
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                AgentSurfaceCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Общие долги:',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                      ),
                      Text(
                        formatDebtMoney(total, currency: result.currency),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.error),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 8, bottom: 8, left: 4),
                  child: Text(
                    'Найдено: ${result.data.length}',
                    style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                ),
                for (final row in result.data)
                  _OrderDebtCard(
                    row: row,
                    currency: result.currency,
                    expanded: _expandedOrderId == row.orderId,
                    detailAsync: _expandedOrderId == row.orderId
                        ? ref.watch(orderDebtDetailProvider(row.orderId))
                        : null,
                    onTap: () => setState(() {
                      _expandedOrderId = _expandedOrderId == row.orderId ? null : row.orderId;
                    }),
                    formatDate: _formatDate,
                    statusChip: orderStatusChip(row.orderStatus),
                    orderTitle: _orderTitle(row),
                    lineRows: _lineRows,
                    orderTitleFromDetail: _orderTitleFromDetail,
                    formatBonusSummary: _formatBonusSummary,
                    formatQty: _formatQty,
                    statusChipFromDetail: (o) => orderStatusChip(o.status, orderType: o.orderType),
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => AgentErrorPanel(
          error: e,
          onRetry: () => ref.invalidate(orderDebtsByOrdersProvider),
          onLogin: () {
            ref.read(authStateProvider.notifier).sessionExpired();
            context.go('/login');
          },
        ),
      ),
    );
  }
}

class _OrderDebtCard extends StatelessWidget {
  final OrderDebtRow row;
  final String currency;
  final bool expanded;
  final AsyncValue<AgentOrderHistoryRow>? detailAsync;
  final VoidCallback onTap;
  final String Function(String?) formatDate;
  final AgentStatusChip statusChip;
  final String orderTitle;
  final List<AgentOrderLineRow> Function(Iterable<AgentOrderHistoryItem>) lineRows;
  final String Function(AgentOrderHistoryRow) orderTitleFromDetail;
  final String Function(AgentOrderHistoryRow) formatBonusSummary;
  final String Function(double) formatQty;
  final AgentStatusChip Function(AgentOrderHistoryRow) statusChipFromDetail;

  const _OrderDebtCard({
    required this.row,
    required this.currency,
    required this.expanded,
    required this.detailAsync,
    required this.onTap,
    required this.formatDate,
    required this.statusChip,
    required this.orderTitle,
    required this.lineRows,
    required this.orderTitleFromDetail,
    required this.formatBonusSummary,
    required this.formatQty,
    required this.statusChipFromDetail,
  });

  @override
  Widget build(BuildContext context) {
    if (!expanded || detailAsync == null) {
      return AgentOrderCard(
        title: orderTitle,
        statusChip: statusChip,
        client: row.clientName.isNotEmpty ? row.clientName : '—',
        date: formatDate(row.shippedAt),
        bonus: '0',
        volume: '—',
        count: '—',
        amount: '—',
        debt: formatDebtMoney(row.remainder, currency: currency),
        showDebtHeader: true,
        expanded: false,
        onTap: onTap,
      );
    }

    return detailAsync!.when(
      loading: () => AgentOrderCard(
        title: orderTitle,
        statusChip: statusChip,
        client: row.clientName,
        date: formatDate(row.shippedAt),
        bonus: '0',
        volume: '—',
        count: '—',
        amount: formatMoneyUz(row.totalSum, currency: currency),
        debt: formatDebtMoney(row.remainder, currency: currency),
        showDebtHeader: true,
        expanded: true,
        onTap: onTap,
        detailLines: const [],
        bonusLines: const [],
      ),
      error: (_, __) => AgentOrderCard(
        title: orderTitle,
        statusChip: statusChip,
        client: row.clientName,
        date: formatDate(row.shippedAt),
        bonus: '0',
        volume: '—',
        count: '—',
        amount: formatMoneyUz(row.totalSum, currency: currency),
        debt: formatDebtMoney(row.remainder, currency: currency),
        showDebtHeader: true,
        expanded: true,
        onTap: onTap,
      ),
      data: (o) => AgentOrderCard(
        title: orderTitleFromDetail(o),
        statusChip: statusChipFromDetail(o),
        client: o.clientName.isNotEmpty ? o.clientName : row.clientName,
        date: formatDate(o.createdAt ?? row.shippedAt),
        bonus: formatBonusSummary(o),
        discount: o.discountSum > 0 ? formatMoneyUz(o.discountSum) : null,
        volume: o.volumeM3 != null && o.volumeM3! > 0 ? o.volumeM3!.toStringAsFixed(2) : '—',
        count: formatQty(o.qty),
        amount: formatMoneyUz(o.totalSum, currency: currency),
        debt: formatDebtMoney(row.remainder, currency: currency),
        showDebtHeader: true,
        expanded: true,
        detailLines: lineRows(o.items.where((it) => !it.isBonus)),
        bonusLines: lineRows(o.items.where((it) => it.isBonus)),
        onTap: onTap,
      ),
    );
  }
}

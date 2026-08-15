import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/orders/order_status_labels.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../auth/auth_provider.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../../core/sync/sync_engine.dart';
import '../shell/agent_app_bar.dart';
import 'held_order_model.dart' show formatHeldCountdown;
import 'held_orders_provider.dart';
import '../orders/order_create_models.dart' show formatMoneyUz, formatDebtMoney;
import 'order_draft_list.dart';
import 'order_draft_provider.dart';
import 'orders_providers.dart';

class AgentOrdersPage extends ConsumerStatefulWidget {
  const AgentOrdersPage({super.key});

  @override
  ConsumerState<AgentOrdersPage> createState() => _AgentOrdersPageState();
}

class _AgentOrdersPageState extends ConsumerState<AgentOrdersPage> {
  int? _expandedOrderId;

  DateTime _dateFromKey(String key) {
    final parts = key.split('-');
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]) ?? DateTime.now().year;
      final m = int.tryParse(parts[1]) ?? DateTime.now().month;
      final d = int.tryParse(parts[2]) ?? DateTime.now().day;
      return DateTime(y, m, d);
    }
    final now = workRegionNow();
    return DateTime(now.year, now.month, now.day);
  }

  Future<void> _pickDate() async {
    final selectedDate = _dateFromKey(ref.read(ordersHistoryDateProvider));
    final picked = await showDatePicker(
      context: context,
      initialDate: selectedDate,
      firstDate: DateTime(2020),
      lastDate: workRegionNow(),
    );
    if (picked == null) return;
    ref.read(ordersHistoryDateProvider.notifier).state = ordersHistoryDateKey(picked);
    setState(() => _expandedOrderId = null);
  }

  void _selectToday() {
    final now = workRegionNow();
    ref.read(ordersHistoryDateProvider.notifier).state =
        ordersHistoryDateKey(DateTime(now.year, now.month, now.day));
    setState(() => _expandedOrderId = null);
  }

  Future<void> _refresh() async {
    final se = ref.read(syncEngineProvider);
    if (se != null) {
      await se.syncDelta(entityType: 'orders');
    } else {
      await ref.read(authStateProvider.notifier).resync();
    }
    ref.invalidate(ordersListProvider);
    ref.invalidate(pendingCountProvider);
    ref.invalidate(heldOrdersProvider);
    ref.invalidate(orderDraftsProvider);
    ref.invalidate(orderDraftListProvider);
    ref.invalidate(orderDebtsByOrdersProvider);
    if (_expandedOrderId != null) {
      ref.invalidate(orderHistoryDetailProvider(_expandedOrderId!));
    }
    invalidateSyncedData(ref.invalidate);
  }

  String _agentSubtitle(SessionState session) {
    final u = session.user;
    if (u == null) return '';
    final code = u.code?.trim();
    if (code != null && code.isNotEmpty) return '${u.name} · $code';
    return u.name;
  }

  double _dayDebt(List<AgentOrderHistoryRow> orders, OrderDebtsListResult? debts) {
    if (debts == null || debts.data.isEmpty) return 0;
    final ids = orders.map((o) => o.id).toSet();
    return debts.data
        .where((d) => ids.contains(d.orderId))
        .fold<double>(0, (s, d) => s + d.remainder);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(heldOrderSchedulerProvider);
    final session = ref.watch(sessionProvider);
    final canCreate = session.permissions.canCreateOrders;
    final ordersAsync = ref.watch(ordersListProvider);
    final debtsAsync = ref.watch(orderDebtsByOrdersProvider);
    final heldAsync = ref.watch(heldOrdersProvider);
    final pendingAsync = ref.watch(pendingCountProvider);
    final heldCount = heldAsync.valueOrNull?.length ?? 0;
    final pendingCount = (pendingAsync.valueOrNull ?? 0) + heldCount;
    final dateKey = ref.watch(ordersHistoryDateProvider);
    final selectedDate = _dateFromKey(dateKey);
    final dateLabel = DateFormat('dd.MM.yyyy').format(selectedDate);
    final isToday = dateKey == ordersHistoryDateKey(workRegionNow());
    final heldOrders = heldAsync.valueOrNull ?? const [];
    final draftsAsync = ref.watch(orderDraftListProvider);
    final draftCount = draftsAsync.valueOrNull?.length ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Мои заказы',
        showBack: true,
        belowTitle: _agentSubtitle(session).isNotEmpty
            ? Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Text(
                  _agentSubtitle(session),
                  style: AppTypography.caption.copyWith(color: AppColors.textMuted, fontWeight: FontWeight.w600),
                ),
              )
            : null,
        actions: [
          if (pendingCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$pendingCount офлайн',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.warning),
                  ),
                ),
              ),
            ),
          AgentIconButton(icon: Icons.search, onPressed: () => context.push('/search?from=/orders')),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    isToday ? 'Сегодня · $dateLabel' : dateLabel,
                    style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (!isToday)
                  TextButton(onPressed: _selectToday, child: const Text('Сегодня')),
                IconButton(
                  icon: const Icon(Icons.calendar_today_outlined),
                  tooltip: 'Выбрать дату',
                  onPressed: _pickDate,
                ),
              ],
            ),
          ),
          Expanded(
            child: ordersAsync.when(
              data: (orders) {
                final debts = debtsAsync.valueOrNull;
                final totalSum = orders.fold<double>(0, (s, o) => s + o.totalSum);
                final inProgress = orders.where((o) {
                  final st = o.status.toLowerCase();
                  return !st.contains('deliver') && !st.contains('достав') && !st.contains('cancel');
                }).length;
                final dayDebt = _dayDebt(orders, debts);
                final debtLabel = dayDebt > 0 ? formatMoneyUz(dayDebt) : '0';

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                    children: [
                      GestureDetector(
                        onTap: _pickDate,
                        child: AgentOrdersHeroCard(
                          totalSum: formatMoneyUz(totalSum + heldOrders.fold(0.0, (s, h) => s + h.estimatedTotal)),
                          totalCount: orders.length + heldOrders.length,
                          inProgressCount: inProgress + heldOrders.length,
                          debtLabel: debtLabel,
                        ),
                      ),
                      for (final h in heldOrders)
                        AgentHeldOrderCard(
                          clientName: h.clientName,
                          countdown: formatHeldCountdown(h.remaining()),
                          sumLabel: formatMoneyUz(h.estimatedTotal),
                          itemCount: h.itemCount,
                          onTap: () => context.push('/orders/create?held_id=${h.id}'),
                        ),
                      const OrderDraftListSection(
                        padding: EdgeInsets.only(bottom: 10),
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                      ),
                      if (orders.isEmpty && heldOrders.isEmpty && draftCount == 0)
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.22,
                          child: AgentEmptyState.fill(
                            message: 'Нет заказов за $dateLabel',
                            action: canCreate
                                ? AgentPrimaryButton(
                                    label: 'Новый заказ',
                                    height: 48,
                                    onPressed: () => context.push('/orders/create'),
                                  )
                                : null,
                          ),
                        )
                      else
                        for (final o in orders) _orderCard(o, debts),
                    ],
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, _) => AgentErrorPanel(
                error: e,
                onRetry: _refresh,
                onLogin: () {
                  ref.read(authStateProvider.notifier).sessionExpired();
                  context.go('/login');
                },
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              onPressed: () => context.push('/orders/create'),
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _orderCard(AgentOrderHistoryRow o, OrderDebtsListResult? debts) {
    final expanded = _expandedOrderId == o.id;
    final chip = orderStatusChip(o.status, orderType: o.orderType);
    final debtRow = debts?.data.where((d) => d.orderId == o.id).firstOrNull;
    final debtLabel = debtRow != null && debtRow.remainder > 0
        ? formatDebtMoney(debtRow.remainder, currency: debts?.currency ?? 'UZS')
        : null;

    if (!expanded) {
      return AgentOrderCard(
        title: _orderTitle(o),
        statusChip: chip,
        client: o.clientName.isNotEmpty ? o.clientName : '—',
        date: _formatOrderDate(o.createdAt),
        bonus: _formatBonusSummary(o),
        volume: o.volumeM3 != null && o.volumeM3! > 0 ? o.volumeM3!.toStringAsFixed(2) : '—',
        count: _formatQty(o.qty),
        amount: _formatAmount(o),
        debt: debtLabel,
        expanded: false,
        onTap: () => setState(() => _expandedOrderId = o.id),
      );
    }

    final detailAsync = ref.watch(orderHistoryDetailProvider(o.id));
    return detailAsync.when(
      loading: () => AgentOrderCard(
        title: _orderTitle(o),
        statusChip: chip,
        client: o.clientName,
        date: _formatOrderDate(o.createdAt),
        bonus: _formatBonusSummary(o),
        volume: '—',
        count: _formatQty(o.qty),
        amount: _formatAmount(o),
        debt: debtLabel,
        expanded: true,
        onTap: () => setState(() => _expandedOrderId = null),
      ),
      error: (_, __) => _orderCardFromRow(o, chip, debtLabel, expanded: true),
      data: (detail) => _orderCardFromRow(detail, orderStatusChip(detail.status, orderType: detail.orderType), debtLabel, expanded: true),
    );
  }

  Widget _orderCardFromRow(
    AgentOrderHistoryRow o,
    AgentStatusChip chip,
    String? debtLabel, {
    required bool expanded,
  }) {
    return AgentOrderCard(
      title: _orderTitle(o),
      statusChip: chip,
      client: o.clientName.isNotEmpty ? o.clientName : '—',
      date: _formatOrderDate(o.createdAt),
      bonus: _formatBonusSummary(o),
      discount: o.discountSum > 0 ? formatMoneyUz(o.discountSum) : null,
      volume: o.volumeM3 != null && o.volumeM3! > 0 ? o.volumeM3!.toStringAsFixed(2) : '—',
      count: _formatQty(o.qty),
      amount: _formatAmount(o),
      debt: debtLabel,
      expanded: expanded,
      detailLines: _lineRows(o.items.where((it) => !it.isBonus)),
      bonusLines: _lineRows(o.items.where((it) => it.isBonus)),
      onTap: () => setState(() {
        _expandedOrderId = _expandedOrderId == o.id ? null : o.id;
      }),
    );
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

  String _orderTitle(AgentOrderHistoryRow o) {
    final n = o.number?.trim();
    final num = (n != null && n.isNotEmpty) ? n : '${o.id}';
    switch (o.orderType) {
      case 'return':
        return 'Возврат №$num';
      case 'return_by_order':
        return 'Возврат по заказу №$num';
      case 'exchange':
        return 'Обмен №$num';
      case 'partial_return':
        return 'Частичный возврат №$num';
      default:
        return 'Заказ №$num';
    }
  }

  String _formatAmount(AgentOrderHistoryRow o) {
    final prefix = _isReturnType(o.orderType) ? '−' : '';
    return '$prefix${formatMoneyUz(o.totalSum)}';
  }

  bool _isReturnType(String orderType) =>
      orderType == 'return' || orderType == 'return_by_order' || orderType == 'partial_return';

  String _formatOrderDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final wr = toWorkRegionFromIso(raw);
    if (wr == null) return raw.substring(0, raw.length.clamp(0, 10));
    return DateFormat('dd.MM.yyyy HH:mm').format(wr);
  }

  String _formatBonusSummary(AgentOrderHistoryRow o) {
    if (o.bonusSum > 0) return formatMoneyUz(o.bonusSum);
    if (o.bonusQty > 0) return _formatQty(o.bonusQty);
    return '0';
  }

  String _formatQty(double v) {
    if (v == v.roundToDouble()) return v.round().toString();
    return v.toStringAsFixed(1);
  }
}

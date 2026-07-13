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
import 'order_create_models.dart';
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
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  Future<void> _pickDate() async {
    final selectedDate = _dateFromKey(ref.read(ordersHistoryDateProvider));
    final picked = await showDatePicker(
      context: context,
      initialDate: selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
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
    invalidateSyncedData(ref.invalidate);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final canCreate = session.permissions.canCreateOrders;
    final ordersAsync = ref.watch(ordersListProvider);
    final pendingAsync = ref.watch(pendingCountProvider);
    final pendingCount = pendingAsync.valueOrNull ?? 0;
    final dateKey = ref.watch(ordersHistoryDateProvider);
    final selectedDate = _dateFromKey(dateKey);
    final dateLabel = DateFormat('dd.MM.yyyy').format(selectedDate);
    final isToday = dateKey == ordersHistoryDateKey(workRegionNow());

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'История заказов',
        showBack: true,
        actions: [
          if (pendingCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                  child: Text('$pendingCount офлайн', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.warning)),
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
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: Material(
                    color: AppColors.surfaceReport,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: _pickDate,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.teal700),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Дата заказа', style: AppTypography.caption.copyWith(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                                  Text(dateLabel, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.teal700)),
                                ],
                              ),
                            ),
                            const Icon(Icons.expand_more, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (!isToday) ...[
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: _selectToday,
                    child: const Text('Сегодня', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: ordersAsync.when(
              data: (orders) {
                if (orders.isEmpty) {
                  return RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _refresh,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.45,
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
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8, left: 4),
                        child: Text(
                          'Найдено: ${orders.length}',
                          style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                        ),
                      ),
                      for (final o in orders)
                        AgentOrderCard(
                          title: _orderTitle(o),
                          statusChip: orderStatusChip(o.status, orderType: o.orderType),
                          client: o.clientName.isNotEmpty ? o.clientName : '—',
                          date: _formatOrderDate(o.createdAt),
                          bonus: _formatBonusSummary(o),
                          discount: o.discountSum > 0 ? formatMoneyUz(o.discountSum) : null,
                          volume: o.volumeM3 != null && o.volumeM3! > 0 ? o.volumeM3!.toStringAsFixed(2) : '—',
                          count: _formatQty(o.qty),
                          amount: _formatAmount(o),
                          expanded: _expandedOrderId == o.id,
                          detailLines: _lineRows(o.items.where((it) => !it.isBonus)),
                          bonusLines: _lineRows(o.items.where((it) => it.isBonus)),
                          onTap: () => setState(() {
                            _expandedOrderId = _expandedOrderId == o.id ? null : o.id;
                          }),
                        ),
                    ],
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, _) => Center(child: Text('Ошибка: $e', textAlign: TextAlign.center)),
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
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw.substring(0, raw.length.clamp(0, 10));
    return DateFormat('dd.MM.yyyy').format(dt.toLocal());
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

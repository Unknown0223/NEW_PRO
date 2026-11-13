import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../design_system/design_system.dart';
import '../../auth/auth_provider.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../../core/sync/sync_engine.dart';
import '../shell/agent_app_bar.dart';
import 'held_order_model.dart' show HeldOrder, formatHeldCountdown;
import 'held_orders_provider.dart';
import 'held_order_sync_sheet.dart';
import '../orders/order_create_models.dart' show formatMoneyUz;
import 'order_draft_list.dart';
import 'order_draft_provider.dart';
import 'orders_providers.dart';

/// Shablon `ExtraScreens.OrdersScreen` — filter chip + ixcham kartalar.
class AgentOrdersPage extends ConsumerStatefulWidget {
  const AgentOrdersPage({super.key});

  @override
  ConsumerState<AgentOrdersPage> createState() => _AgentOrdersPageState();
}

enum _OrderFilter { all, yangi, tasdiqlangan, yolda, yetkazildi }

class _AgentOrdersPageState extends ConsumerState<AgentOrdersPage> {
  _OrderFilter _filter = _OrderFilter.all;

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
    ref.read(ordersHistoryDateProvider.notifier).state =
        ordersHistoryDateKey(picked);
  }

  void _selectToday() {
    final now = workRegionNow();
    ref.read(ordersHistoryDateProvider.notifier).state =
        ordersHistoryDateKey(DateTime(now.year, now.month, now.day));
  }

  void _resetFilters() {
    _selectToday();
    setState(() => _filter = _OrderFilter.all);
    ref.invalidate(ordersListProvider);
    ref.invalidate(heldOrdersProvider);
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
    invalidateSyncedData(ref.invalidate);
  }

  String _uzStatus(String status) {
    switch (status.trim().toLowerCase()) {
      case 'new':
        return 'Yangi';
      case 'confirmed':
        return 'Tasdiqlangan';
      case 'picking':
      case 'delivering':
        return "Yo'lda";
      case 'delivered':
        return 'Yetkazildi';
      case 'cancelled':
      case 'returned':
        return 'Bekor';
      default:
        return status.isEmpty ? '—' : status;
    }
  }

  Color _uzStatusColor(String status) {
    switch (status.trim().toLowerCase()) {
      case 'new':
        return const Color(0xFFE0A023);
      case 'confirmed':
        return const Color(0xFF3E9BFF);
      case 'picking':
      case 'delivering':
        return const Color(0xFF8B5CF6);
      case 'delivered':
        return const Color(0xFF22B573);
      default:
        return const Color(0xFF94A3B8);
    }
  }

  bool _matchesFilter(AgentOrderHistoryRow o) {
    final s = o.status.trim().toLowerCase();
    switch (_filter) {
      case _OrderFilter.all:
        return true;
      case _OrderFilter.yangi:
        return s == 'new';
      case _OrderFilter.tasdiqlangan:
        return s == 'confirmed';
      case _OrderFilter.yolda:
        return s == 'picking' || s == 'delivering';
      case _OrderFilter.yetkazildi:
        return s == 'delivered';
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(heldOrderSchedulerProvider);
    ref.watch(heldOrderTickProvider);
    final session = ref.watch(sessionProvider);
    final canCreate = session.permissions.canCreateOrders;
    final ordersAsync = ref.watch(ordersListProvider);
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
        title: 'Mening buyurtmalarim',
        useShellDrawer: true,
        showBack: false,
        showQuickPanel: true,
        belowTitle: ordersAsync.maybeWhen(
          data: (orders) {
            final sum = orders.fold<double>(0, (s, o) => s + o.totalSum);
            final n = orders.length + heldOrders.length;
            return Text(
              '${isToday ? 'Bugun' : dateLabel} · $n ta · ${formatMoneyUz(sum)} so\'m',
              style: AppTypography.caption.copyWith(
                color: AppColors.textMuted,
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            );
          },
          orElse: () => Text(
            isToday ? 'Bugun · $dateLabel' : dateLabel,
            style: AppTypography.caption.copyWith(
              color: AppColors.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        actions: [
          if (pendingCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$pendingCount oflayn',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.warning,
                    ),
                  ),
                ),
              ),
            ),
          SaPressable(
            pressedScale: 0.9,
            borderRadius: BorderRadius.circular(10),
            onTap: canCreate ? () => context.push('/orders/create') : null,
            child: Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.edit_outlined, size: 16),
            ),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    isToday ? 'Bugun · $dateLabel' : dateLabel,
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                SaPressable(
                  onTap: _resetFilters,
                  child: Text(
                    'Reset',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: isToday ? AppColors.textMuted : AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SaPressable(
                  pressedScale: 0.9,
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(Icons.calendar_today_outlined, size: 15),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              children: [
                for (final f in _OrderFilter.values) ...[
                  _FilterChip(
                    label: switch (f) {
                      _OrderFilter.all => 'Barchasi',
                      _OrderFilter.yangi => 'Yangi',
                      _OrderFilter.tasdiqlangan => 'Tasdiqlangan',
                      _OrderFilter.yolda => "Yo'lda",
                      _OrderFilter.yetkazildi => 'Yetkazildi',
                    },
                    selected: _filter == f,
                    onTap: () => setState(() => _filter = f),
                  ),
                  const SizedBox(width: 6),
                ],
              ],
            ),
          ),
          Expanded(
            child: ordersAsync.when(
              data: (orders) {
                final filtered = orders.where(_matchesFilter).toList();
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
                    children: [
                      if (heldOrders.isNotEmpty &&
                          _filter == _OrderFilter.all) ...[
                        SaEnter(
                          preset: SaMotionPreset.rise,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Kutish oynasi (${heldOrders.length})',
                              style: AppTypography.bodySmall
                                  .copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                        ),
                        for (var hi = 0; hi < heldOrders.length; hi++)
                          SaEnter(
                            delay: SaStaggerDelay.of(1 + hi),
                            preset: SaMotionPreset.rise,
                            child: _heldCard(heldOrders[hi]),
                          ),
                      ],
                      if (_filter == _OrderFilter.all)
                        const OrderDraftListSection(
                          padding: EdgeInsets.only(bottom: 10),
                          shrinkWrap: true,
                          physics: NeverScrollableScrollPhysics(),
                        ),
                      if (filtered.isEmpty &&
                          (heldOrders.isEmpty ||
                              _filter != _OrderFilter.all) &&
                          (draftCount == 0 || _filter != _OrderFilter.all))
                        SaEnter(
                          preset: SaMotionPreset.rise,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 48),
                            child: Text(
                              _filter == _OrderFilter.all
                                  ? 'Buyurtma yo\'q · $dateLabel'
                                  : 'Bu holatda buyurtma yo\'q',
                              textAlign: TextAlign.center,
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        )
                      else
                        for (var oi = 0; oi < filtered.length; oi++)
                          SaEnter(
                            delay: SaStaggerDelay.of(2 + oi),
                            preset: SaMotionPreset.rise,
                            child: _templateOrderCard(filtered[oi]),
                          ),
                    ],
                  ),
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
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
          if (canCreate)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: SaPressable(
                  pressedScale: 0.97,
                  onTap: () => context.push('/orders/create'),
                  borderRadius: BorderRadius.circular(11),
                  child: Container(
                    width: double.infinity,
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(11),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF6A5BFF), Color(0xFF5548F0)],
                      ),
                    ),
                    child: const Text(
                      '+ Yangi buyurtma',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _heldCard(HeldOrder h) {
    return AgentHeldOrderCard(
      clientName: h.clientName,
      countdown: formatHeldCountdown(h.remaining()),
      sumLabel: formatMoneyUz(h.estimatedTotal),
      itemCount: h.itemCount,
      onTap: () async {
        final delayMin =
            ref.read(sessionProvider).mobileConfig?.sync.postOrderDelayMinutes ??
                h.submitAt.difference(h.createdAt).inMinutes.clamp(1, 59);
        final action = await showHeldOrderSyncSheet(
          context,
          order: h,
          delayMinutes: delayMin,
        );
        if (!mounted) return;
        if (action == HeldOrderSyncAction.edit) {
          context.push('/orders/create?held_id=${h.id}');
        } else if (action == HeldOrderSyncAction.goHome) {
          context.go('/home');
        } else if (action == HeldOrderSyncAction.sent) {
          showAgentToast(
            context,
            'Buyurtma yuborildi',
            accentColor: AppColors.success,
          );
        }
      },
      onCancel: () async {
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Buyurtmani bekor qilish?'),
            content: const Text(
              'Buyurtma serverga yuborilmaydi va qurilmadan o\'chiriladi.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text("Yo'q"),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Ha, bekor'),
              ),
            ],
          ),
        );
        if (ok != true) return;
        await ref.read(heldOrderSchedulerProvider).cancelHeldOrder(h.id);
        if (mounted) {
          showAgentToast(
            context,
            'Buyurtma bekor qilindi',
            accentColor: AppColors.warning,
          );
        }
      },
    );
  }

  Widget _templateOrderCard(AgentOrderHistoryRow o) {
    final st = _uzStatus(o.status);
    final tone = _uzStatusColor(o.status);
    final n = o.number?.trim();
    final no = (n != null && n.isNotEmpty) ? n : '${o.id}';
    final qty = o.qty == o.qty.roundToDouble()
        ? o.qty.round().toString()
        : o.qty.toStringAsFixed(1);

    return SaPressable(
      pressedScale: 0.99,
      onTap: () => context.push('/orders/detail/${o.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  '№$no',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    st.toUpperCase(),
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: tone,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              o.clientName.isNotEmpty ? o.clientName : '—',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodySmall.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  _formatOrderDate(o.createdAt),
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textMuted,
                    fontSize: 10,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '$qty pozitsiya',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textMuted,
                    fontSize: 10,
                  ),
                ),
                const Spacer(),
                Text(
                  '${formatMoneyUz(o.totalSum)} so\'m',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatOrderDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final wr = toWorkRegionFromIso(raw);
    if (wr == null) return raw.substring(0, raw.length.clamp(0, 10));
    final now = workRegionNow();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(wr.year, wr.month, wr.day);
    final time = DateFormat('HH:mm').format(wr);
    if (day == today) return 'Bugun $time';
    if (day == today.subtract(const Duration(days: 1))) return 'Kecha $time';
    return DateFormat('d MMM HH:mm').format(wr);
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SaPressable(
      pressedScale: 0.96,
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.textMuted,
          ),
        ),
      ),
    );
  }
}

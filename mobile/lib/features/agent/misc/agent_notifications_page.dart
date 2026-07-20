import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/sync_window_countdown.dart';
import '../../../core/notifications/notifications_day_rollover.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/server_clock.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../orders/held_order_model.dart' show HeldOrder, formatHeldCountdown;
import '../orders/held_orders_provider.dart';
import '../orders/order_create_models.dart' show formatMoneyUz, formatDebtMoney;
import '../orders/order_draft_provider.dart';
import '../orders/orders_providers.dart';
import '../shell/agent_app_bar.dart';
import '../sync/manual_sync_provider.dart';
import '../sync/manual_sync_runner.dart';
import '../visits/agent_visits_page.dart';

export '../../../core/notifications/notifications_day_rollover.dart'
    show notificationsReadIdsProvider;

enum _NotifFilter { all, urgent, orders, system }

enum _NotifKind { urgentHeld, urgentVisit, sync, debt, draft }

class _NotifItem {
  final String id;
  final _NotifKind kind;
  final _NotifFilter filter;
  final int sortWeight;
  final HeldOrder? held;
  final VisitRecord? visit;
  final OrderDebtRow? debt;
  final OrderDraftListEntry? draft;
  final Duration? syncLeft;
  final bool syncIsWindowEnd;
  final double syncProgress;

  const _NotifItem({
    required this.id,
    required this.kind,
    required this.filter,
    this.sortWeight = 0,
    this.held,
    this.visit,
    this.debt,
    this.draft,
    this.syncLeft,
    this.syncIsWindowEnd = true,
    this.syncProgress = 0,
  });
}

/// Home AppBar: qo'ng'iroq + held/chernovik badge (drawer o'rniga).
class AgentNotificationsBell extends ConsumerWidget {
  const AgentNotificationsBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final held = ref.watch(heldOrderCountProvider).valueOrNull ?? 0;
    final drafts = ref.watch(orderDraftListProvider).valueOrNull?.length ?? 0;
    final count = held + drafts;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        AgentIconButton(
          icon: Icons.notifications_outlined,
          onPressed: () => context.push('/notifications'),
        ),
        if (count > 0)
          Positioned(
            right: 0,
            top: 0,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  count > 9 ? '9+' : '$count',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Agent «Уведомления» — mockup: chips + typed cards from real local/API data.
class AgentNotificationsPage extends ConsumerStatefulWidget {
  const AgentNotificationsPage({super.key});

  @override
  ConsumerState<AgentNotificationsPage> createState() => _AgentNotificationsPageState();
}

class _AgentNotificationsPageState extends ConsumerState<AgentNotificationsPage> {
  _NotifFilter _filter = _NotifFilter.all;
  Timer? _syncTicker;
  Duration? _syncLeft;
  bool _syncIsWindowEnd = true;
  double _syncProgress = 0;
  bool _showSync = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(ref.read(notificationsDayRolloverProvider).checkNow());
      _refreshSync();
    });
    _syncTicker = Timer.periodic(const Duration(seconds: 1), (_) => _refreshSync());
  }

  @override
  void dispose() {
    _syncTicker?.cancel();
    super.dispose();
  }

  void _refreshSync() {
    final sync = ref.read(mobileConfigProvider).sync;
    if (!ServerClock.instance.hasAnchor) {
      if (_showSync || _syncLeft != null) {
        setState(() {
          _showSync = false;
          _syncLeft = null;
        });
      }
      return;
    }
    final nowLocal = syncWindowClockNow();
    final end = timeUntilSyncWindowEnd(sync, nowLocal);
    final start = timeUntilSyncWindowStart(sync, nowLocal);
    Duration? left;
    var isEnd = true;
    var progress = 0.0;
    var show = false;

    if (end != null) {
      left = end;
      isEnd = true;
      show = true;
      final from = sync.allowedWindowFrom?.trim();
      final to = sync.allowedWindowTo?.trim();
      if (from != null && from.isNotEmpty && to != null && to.isNotEmpty) {
        final total = _hmSpanMinutes(from, to);
        if (total > 0) {
          progress = (1.0 - (end.inSeconds / (total * 60))).clamp(0.0, 1.0);
        }
      } else {
        progress = 0.35;
      }
    } else if (start != null) {
      left = start;
      isEnd = false;
      show = true;
      progress = 0.08;
    }

    if (!mounted) return;
    final changed = _showSync != show ||
        _syncIsWindowEnd != isEnd ||
        _syncLeft?.inSeconds != left?.inSeconds ||
        (_syncProgress - progress).abs() > 0.01;
    if (!changed) return;
    setState(() {
      _syncLeft = left;
      _syncIsWindowEnd = isEnd;
      _syncProgress = progress;
      _showSync = show;
    });
  }

  int _hmSpanMinutes(String from, String to) {
    int? parse(String hm) {
      final p = hm.split(':');
      if (p.length < 2) return null;
      final h = int.tryParse(p[0]);
      final m = int.tryParse(p[1]);
      if (h == null || m == null) return null;
      return h * 60 + m;
    }

    final a = parse(from);
    final b = parse(to);
    if (a == null || b == null) return 0;
    if (b >= a) return b - a;
    return (24 * 60 - a) + b;
  }

  Future<void> _cancelHeld(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Отменить заказ?'),
        content: const Text(
          'Заказ в ожидании не будет отправлен на сервер и удалится с устройства.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Нет')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Да, отменить'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(heldOrderSchedulerProvider).cancelHeldOrder(id);
    if (mounted) {
      showAgentToast(context, 'Заказ отменён', accentColor: AppColors.warning);
    }
  }

  void _markAllRead(List<_NotifItem> items) {
    final ids = items.map((e) => e.id).toSet();
    ref.read(notificationsReadIdsProvider.notifier).state = {
      ...ref.read(notificationsReadIdsProvider),
      ...ids,
    };
    showAgentToast(context, 'Все отмечены прочитанными', accentColor: AppColors.primary);
  }

  void _openSettingsSheet(List<_NotifItem> items) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AgentSheetHandle(),
              ListTile(
                leading: const Icon(Icons.done_all, color: AppColors.primary),
                title: const Text('Отметить все прочитанными'),
                onTap: () {
                  Navigator.pop(ctx);
                  _markAllRead(items);
                },
              ),
              ListTile(
                leading: const Icon(Icons.settings_outlined, color: AppColors.textSecondary),
                title: const Text('Настройки приложения'),
                onTap: () {
                  Navigator.pop(ctx);
                  context.push('/settings');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<_NotifItem> _buildItems({
    required List<HeldOrder> held,
    required List<VisitRecord> visits,
    required List<OrderDebtRow> debts,
    required List<OrderDraftListEntry> drafts,
  }) {
    final items = <_NotifItem>[];
    final today = serverTodayKey();

    // Held: faol (pending) — kun filterisiz; DB o‘chirilmaydi.
    for (final h in held) {
      final rem = h.remaining();
      items.add(
        _NotifItem(
          id: 'held_${h.id}',
          kind: _NotifKind.urgentHeld,
          filter: _NotifFilter.urgent,
          sortWeight: rem.inSeconds,
          held: h,
        ),
      );
    }

    // Visits: visitsTodayProvider allaqachon bugungi kun.
    for (final v in visits.where((v) => v.status == 'in_progress')) {
      final noPhoto = v.photoPaths.isEmpty;
      items.add(
        _NotifItem(
          id: 'visit_${v.id ?? v.clientId ?? v.clientName}',
          kind: _NotifKind.urgentVisit,
          filter: _NotifFilter.urgent,
          sortWeight: noPhoto ? 30 : 90,
          visit: v,
        ),
      );
    }

    if (_showSync && _syncLeft != null) {
      items.add(
        _NotifItem(
          id: 'sync_window',
          kind: _NotifKind.sync,
          filter: _NotifFilter.system,
          sortWeight: 200,
          syncLeft: _syncLeft,
          syncIsWindowEnd: _syncIsWindowEnd,
          syncProgress: _syncProgress,
        ),
      );
    }

    // Qarz: faqat bugun yetkazilgan (eski kun shovqini yashirinadi).
    final debtRows = debts
        .where((d) => d.remainder > 0.0001 && isOnNotificationsDay(d.shippedAt, dayKey: today))
        .toList()
      ..sort((a, b) => b.remainder.compareTo(a.remainder));
    for (final d in debtRows.take(5)) {
      items.add(
        _NotifItem(
          id: 'debt_${d.orderId}',
          kind: _NotifKind.debt,
          filter: _NotifFilter.orders,
          sortWeight: 500,
          debt: d,
        ),
      );
    }

    // Chernovik: faqat bugun saqlangan (TTL/DB saqlanadi, inboxdan yashirinadi).
    for (final d in drafts.where((e) => isOnNotificationsDay(e.draft.savedAt, dayKey: today)).take(5)) {
      items.add(
        _NotifItem(
          id: 'draft_${d.draft.clientId}',
          kind: _NotifKind.draft,
          filter: _NotifFilter.system,
          sortWeight: 600,
          draft: d,
        ),
      );
    }

    items.sort((a, b) => a.sortWeight.compareTo(b.sortWeight));
    return items;
  }

  int _count(_NotifFilter f, List<_NotifItem> items) {
    if (f == _NotifFilter.all) return items.length;
    return items.where((e) => e.filter == f).length;
  }

  String _debtDays(OrderDebtRow d) {
    final raw = d.shippedAt;
    if (raw == null || raw.isEmpty) return '';
    final dt = DateTime.tryParse(raw)?.toLocal();
    if (dt == null) return '';
    final days = workRegionNow().difference(dt).inDays;
    if (days <= 0) return 'сегодня';
    return '$days дн';
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(heldOrderSchedulerProvider);
    ref.watch(heldOrderTickProvider);
    ref.watch(notificationsDayRolloverProvider);

    final held = ref.watch(heldOrdersProvider).valueOrNull ?? const [];
    final drafts = ref.watch(orderDraftListProvider).valueOrNull ?? const [];
    final visits = ref.watch(visitsTodayProvider).valueOrNull ?? const [];
    final debts = ref.watch(orderDebtsByOrdersProvider).valueOrNull?.data ?? const [];
    final readIds = ref.watch(notificationsReadIdsProvider);
    final syncState = ref.watch(manualSyncProvider);

    final items = _buildItems(
      held: held,
      visits: visits,
      debts: debts,
      drafts: drafts,
    );
    final debtCount = _count(_NotifFilter.orders, items);
    final chipDefs = <(_NotifFilter, String)>[
      (_NotifFilter.all, 'Все'),
      (_NotifFilter.urgent, 'Срочно'),
      if (debtCount > 0) (_NotifFilter.orders, 'Заказы'),
      (_NotifFilter.system, 'Система'),
    ];
    final activeFilter =
        chipDefs.any((c) => c.$1 == _filter) ? _filter : _NotifFilter.all;
    final visible = activeFilter == _NotifFilter.all
        ? items
        : items.where((e) => e.filter == activeFilter).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Уведомления',
        showBack: true,
        actions: [
          AgentIconButton(
            icon: Icons.settings_outlined,
            onPressed: () => _openSettingsSheet(items),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: TextButton(
              onPressed: items.isEmpty ? null : () => _markAllRead(items),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Все ✓',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await ref.read(notificationsDayRolloverProvider).checkNow();
          ref.invalidate(heldOrdersProvider);
          ref.invalidate(heldOrderCountProvider);
          ref.invalidate(orderDraftListProvider);
          ref.invalidate(visitsTodayProvider);
          ref.invalidate(orderDebtsByOrdersProvider);
          _refreshSync();
          await Future.wait([
            ref.read(heldOrdersProvider.future),
            ref.read(orderDraftListProvider.future),
          ]);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
          children: [
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: chipDefs.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final (f, label) = chipDefs[i];
                  final n = _count(f, items);
                  final selected = activeFilter == f;
                  final showCount = f != _NotifFilter.system || n > 0;
                  return _FilterChip(
                    label: showCount ? '$label $n' : label,
                    selected: selected,
                    onTap: () => setState(() => _filter = f),
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            if (visible.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 48),
                child: AgentEmptyState.fill(
                  message: 'Нет уведомлений',
                  action: AgentPrimaryButton(
                    label: 'К заказам',
                    height: 48,
                    onPressed: () => context.go('/orders'),
                  ),
                ),
              )
            else
              for (final item in visible)
                _NotifCard(
                  item: item,
                  unread: !readIds.contains(item.id),
                  syncRunning: syncState.status == ManualSyncStatus.running,
                  syncUiProgress: syncState.progress,
                  debtDays: _debtDays,
                  onMarkRead: () {
                    ref.read(notificationsReadIdsProvider.notifier).state = {
                      ...ref.read(notificationsReadIdsProvider),
                      item.id,
                    };
                  },
                  onCancelHeld: item.held != null ? () => _cancelHeld(item.held!.id) : null,
                  onSyncNow: () => startManualSync(context, ref, full: false),
                ),
          ],
        ),
      ),
    );
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
    return Material(
      color: selected ? AppColors.primary : AppColors.surfaceMuted,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

class _NotifCard extends StatelessWidget {
  final _NotifItem item;
  final bool unread;
  final bool syncRunning;
  final double syncUiProgress;
  final String Function(OrderDebtRow) debtDays;
  final VoidCallback onMarkRead;
  final VoidCallback? onCancelHeld;
  final VoidCallback onSyncNow;

  const _NotifCard({
    required this.item,
    required this.unread,
    required this.syncRunning,
    required this.syncUiProgress,
    required this.debtDays,
    required this.onMarkRead,
    required this.onCancelHeld,
    required this.onSyncNow,
  });

  @override
  Widget build(BuildContext context) {
    switch (item.kind) {
      case _NotifKind.urgentHeld:
        return _UrgentHeldCard(
          held: item.held!,
          unread: unread,
          onTap: () {
            onMarkRead();
            context.push('/orders/create?held_id=${item.held!.id}');
          },
          onCancel: onCancelHeld,
        );
      case _NotifKind.urgentVisit:
        return _UrgentVisitCard(
          visit: item.visit!,
          unread: unread,
          onTap: () {
            onMarkRead();
            final cid = item.visit!.clientId;
            if (cid != null) {
              context.push('/visits/active/$cid');
            } else {
              context.go('/visits');
            }
          },
        );
      case _NotifKind.sync:
        return _SyncCard(
          left: item.syncLeft ?? Duration.zero,
          isWindowEnd: item.syncIsWindowEnd,
          progress: syncRunning ? syncUiProgress : item.syncProgress,
          running: syncRunning,
          unread: unread,
          onNow: () {
            onMarkRead();
            onSyncNow();
          },
        );
      case _NotifKind.debt:
        return _DebtCard(
          debt: item.debt!,
          daysLabel: debtDays(item.debt!),
          unread: unread,
          onTap: () {
            onMarkRead();
            context.push('/clients/${item.debt!.clientId}');
          },
        );
      case _NotifKind.draft:
        return _DraftCard(
          entry: item.draft!,
          unread: unread,
          onTap: () {
            onMarkRead();
            context.push('/orders/create?client_id=${item.draft!.draft.clientId}');
          },
        );
    }
  }
}

class _UnreadDot extends StatelessWidget {
  const _UnreadDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _IconTile extends StatelessWidget {
  final Color bg;
  final Color fg;
  final IconData icon;
  final bool round;

  const _IconTile({
    required this.bg,
    required this.fg,
    required this.icon,
    this.round = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(round ? 22 : 12),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: fg, size: 22),
    );
  }
}

class _UrgentHeldCard extends StatefulWidget {
  final HeldOrder held;
  final bool unread;
  final VoidCallback onTap;
  final VoidCallback? onCancel;

  const _UrgentHeldCard({
    required this.held,
    required this.unread,
    required this.onTap,
    this.onCancel,
  });

  @override
  State<_UrgentHeldCard> createState() => _UrgentHeldCardState();
}

class _UrgentHeldCardState extends State<_UrgentHeldCard> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rem = widget.held.remaining();
    final urgent = rem.inSeconds <= 120;
    final countdown = formatHeldCountdown(rem);

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = urgent ? _pulse.value : 0.0;
        final borderAlpha = 0.35 + 0.35 * t;
        return Opacity(
          opacity: urgent ? (0.88 + 0.12 * t) : 1,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1F2),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.error.withValues(alpha: borderAlpha),
                width: 1.2,
              ),
            ),
            child: child,
          ),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _IconTile(
                  bg: AppColors.error,
                  fg: Colors.white,
                  icon: Icons.alarm,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Отправка заказа',
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.error,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'СРОЧНО',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                          if (widget.unread) ...[
                            const SizedBox(width: 6),
                            const _UnreadDot(),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${widget.held.clientName} · ${widget.held.itemCount} поз. · ${formatMoneyUz(widget.held.estimatedTotal)}',
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'осталось $countdown',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.error,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
                if (widget.onCancel != null)
                  IconButton(
                    tooltip: 'Отменить',
                    onPressed: widget.onCancel,
                    icon: const Icon(Icons.close, color: AppColors.error, size: 20),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _UrgentVisitCard extends StatefulWidget {
  final VisitRecord visit;
  final bool unread;
  final VoidCallback onTap;

  const _UrgentVisitCard({
    required this.visit,
    required this.unread,
    required this.onTap,
  });

  @override
  State<_UrgentVisitCard> createState() => _UrgentVisitCardState();
}

class _UrgentVisitCardState extends State<_UrgentVisitCard> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final noPhoto = widget.visit.photoPaths.isEmpty;

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = noPhoto ? _pulse.value : 0.0;
        return Opacity(
          opacity: noPhoto ? (0.9 + 0.1 * t) : 1,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1F2),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.error.withValues(alpha: 0.35 + 0.3 * t),
              ),
            ),
            child: child,
          ),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _IconTile(
                  bg: AppColors.error,
                  fg: Colors.white,
                  icon: Icons.alarm,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Завершить визит',
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.error,
                              ),
                            ),
                          ),
                          if (noPhoto)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'СРОЧНО',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          if (widget.unread) ...[
                            const SizedBox(width: 6),
                            const _UnreadDot(),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        noPhoto
                            ? '${widget.visit.clientName} — нет фотоотчёта'
                            : widget.visit.clientName,
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Визит в процессе',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SyncCard extends StatelessWidget {
  final Duration left;
  final bool isWindowEnd;
  final double progress;
  final bool running;
  final bool unread;
  final VoidCallback onNow;

  const _SyncCard({
    required this.left,
    required this.isWindowEnd,
    required this.progress,
    required this.running,
    required this.unread,
    required this.onNow,
  });

  @override
  Widget build(BuildContext context) {
    final time = left.inHours > 0
        ? formatCountdownHms(left)
        : formatHeldCountdown(left);
    final subtitle = isWindowEnd ? 'через $time' : 'начнётся через $time';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Row(
              children: [
                const _IconTile(
                  bg: Color(0xFFD7F3F1),
                  fg: AppColors.primary,
                  icon: Icons.sync,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Автосинхронизация',
                              style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          if (unread) const _UnreadDot(),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        running ? 'Синхронизация…' : subtitle,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: running ? null : onNow,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    minimumSize: const Size(0, 36),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    running ? '…' : 'Сейчас',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          LinearProgressIndicator(
            value: progress.clamp(0.05, 1.0),
            minHeight: 3,
            backgroundColor: AppColors.primarySoft,
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _DebtCard extends StatelessWidget {
  final OrderDebtRow debt;
  final String daysLabel;
  final bool unread;
  final VoidCallback onTap;

  const _DebtCard({
    required this.debt,
    required this.daysLabel,
    required this.unread,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final amount = formatDebtMoney(debt.remainder);
    final days = daysLabel.isNotEmpty ? ' · $daysLabel' : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const _IconTile(
                  bg: Color(0xFFFFE4E6),
                  fg: AppColors.error,
                  icon: Icons.account_balance_wallet_outlined,
                  round: true,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Просроченный долг',
                              style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          if (unread) const _UnreadDot(),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                          children: [
                            TextSpan(text: '${debt.clientName} · '),
                            TextSpan(
                              text: amount,
                              style: const TextStyle(
                                color: AppColors.error,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            TextSpan(text: days),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DraftCard extends StatelessWidget {
  final OrderDraftListEntry entry;
  final bool unread;
  final VoidCallback onTap;

  const _DraftCard({
    required this.entry,
    required this.unread,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final n = entry.draft.quantities.values.where((q) => q > 0).length;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const _IconTile(
                  bg: AppColors.primarySoft,
                  fg: AppColors.primary,
                  icon: Icons.edit_note,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Черновик заказа',
                              style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          if (unread) const _UnreadDot(),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${entry.clientName} · $n поз.',
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

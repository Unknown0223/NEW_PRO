import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/format/money_display.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';
import '../shell/expeditor_drawer.dart';

class ExpeditorVisitsPage extends ConsumerStatefulWidget {
  const ExpeditorVisitsPage({super.key});

  @override
  ConsumerState<ExpeditorVisitsPage> createState() =>
      _ExpeditorVisitsPageState();
}

class _ExpeditorVisitsPageState extends ConsumerState<ExpeditorVisitsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  final _tabKeys = ['active', 'completed', 'routes'];

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tab = _tabKeys[_tabs.index];
    final visits = ref.watch(expeditorVisitsProvider(tab));

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: const Text('Визиты'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () => _openMap(visits.valueOrNull ?? const []),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          onTap: (_) => setState(() {}),
          labelColor: AppColors.expeditorAccent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.expeditorAccent,
          tabs: const [
            Tab(text: 'Активный'),
            Tab(text: 'Завершенные'),
            Tab(text: 'Маршруты'),
          ],
        ),
      ),
      body: visits.when(
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: AppColors.expeditorAccent,
              onRefresh: () async =>
                  ref.invalidate(expeditorVisitsProvider(tab)),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.55,
                    child: AgentEmptyState.fill(message: 'Пока здесь пусто'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: AppColors.expeditorAccent,
            onRefresh: () async => ref.invalidate(expeditorVisitsProvider(tab)),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                if (tab == 'routes') {
                  return _VisitCard(
                    row: r,
                    seq: r['seq'] as int? ?? i + 1,
                    onTap: () => _openVisit(r),
                  );
                }
                return _ClientVisitCard(
                  row: r,
                  completed: tab == 'completed',
                  onTap: () => _openVisit(r, readOnly: tab == 'completed'),
                  onBalanceTap: () => _showBalanceSheet(r),
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

  void _openMap(List<Map<String, dynamic>> rows) {
    final withCoords = rows
        .where((r) =>
            (r['latitude'] as num?) != null &&
            (r['longitude'] as num?) != null &&
            ((r['latitude'] as num?) != 0 || (r['longitude'] as num?) != 0),)
        .toList();
    if (withCoords.isEmpty) {
      showAgentToast(context, 'Нет точек с координатами');
      return;
    }
    context.push('/exp-visits-map', extra: withCoords);
  }

  void _openVisit(Map<String, dynamic> v, {bool readOnly = false}) {
    final clientId = v['client_id'] as int?;
    if (clientId != null) {
      final extra = {...v, if (readOnly) 'readonly': true};
      context.push('/exp-client/$clientId', extra: extra);
      return;
    }
    final oid = v['order_id'] as int?;
    if (oid != null) context.push('/deliveries/$oid');
  }

  void _showBalanceSheet(Map<String, dynamic> v) {
    final clientId = v['client_id'] as int?;
    final fallback = (v['balance'] as num?)?.toDouble() ?? 0;
    showBalanceByAgentSheet(
      context,
      clientId: clientId,
      fallbackTotal: fallback,
    );
  }
}

class _VisitCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final int? seq;
  final VoidCallback onTap;

  const _VisitCard({required this.row, required this.seq, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = row['client_name']?.toString() ?? '—';
    final reason = row['visit_reason']?.toString() ?? '';
    final taskLabel = row['task_label']?.toString();

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.storefront_outlined,
                        color: AppColors.textSecondary, size: 20,),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(right: seq != null ? 28 : 0),
                          child: Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textHeadline,),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Причина визита:${reason.isNotEmpty ? ' $reason' : ''}',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textMuted),
                        ),
                        if (taskLabel != null && taskLabel.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4,),
                            decoration: BoxDecoration(
                              color: AppColors.expeditorAccent
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              taskLabel,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.expeditorAccent,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (seq != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: const BoxDecoration(
                    color: AppColors.textTitle,
                    borderRadius: BorderRadius.only(
                      topRight: Radius.circular(14),
                      bottomLeft: Radius.circular(12),
                    ),
                  ),
                  child: Text(
                    '$seq',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Активный / Завершенные tab — mijoz kartasi (foto + balans + zakaz summasi).
class _ClientVisitCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final bool completed;
  final VoidCallback onTap;
  final VoidCallback onBalanceTap;

  const _ClientVisitCard({
    required this.row,
    this.completed = false,
    required this.onTap,
    required this.onBalanceTap,
  });

  static (String, Color) _statusInfo(String status) {
    switch (status) {
      case 'delivered':
        return ('Доставлено', AppColors.success);
      case 'returned':
        return ('Возврат', AppColors.error);
      default:
        return ('Завершено', AppColors.expeditorAccent);
    }
  }

  Widget _completedFooter(double orderSum) {
    final (label, color) = _statusInfo(row['status']?.toString() ?? '');
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle, size: 14, color: color),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: color,),),
            ],
          ),
        ),
        Text("${formatMoneySpaced(orderSum)} So'm",
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.expeditorAccent,),),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = row['client_name']?.toString() ?? '—';
    final subtitle = row['address']?.toString() ??
        (row['order_number'] != null ? '№ ${row['order_number']}' : '');
    final balance = (row['balance'] as num?)?.toDouble() ?? 0;
    final orderSum = (row['total_sum'] as num?)?.toDouble() ?? 0;
    final isDebt = balance < 0;

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
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.storefront_outlined,
                        color: AppColors.textSecondary, size: 24,),
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
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textHeadline,),
                        ),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption
                                .copyWith(color: AppColors.textMuted),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (completed)
                _completedFooter(orderSum)
              else
                Row(
                  children: [
                    Expanded(
                      child: _MiniStat(
                        label: 'Баланс',
                        value: "${formatMoneySpaced(balance)} So'm",
                        valueColor:
                            isDebt ? AppColors.error : AppColors.textPrimary,
                        showChevron: true,
                        onTap: onBalanceTap,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MiniStat(
                        label: 'Заказ на сумму',
                        value: "${formatMoneySpaced(orderSum)} So'm",
                        valueColor: AppColors.expeditorAccent,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final bool showChevron;
  final VoidCallback? onTap;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.valueColor,
    this.showChevron = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.background,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.textMuted),),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: valueColor,
                      ),
                    ),
                  ],
                ),
              ),
              if (showChevron)
                const Icon(Icons.chevron_right,
                    size: 18, color: AppColors.textMuted,),
            ],
          ),
        ),
      ),
    );
  }
}

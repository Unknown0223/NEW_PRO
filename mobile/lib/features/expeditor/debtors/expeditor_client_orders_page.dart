import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../shared/expeditor_history_filter.dart';

/// «История заказов» — mijoz zakazlari + sana filtri.
class ExpeditorClientOrdersPage extends ConsumerStatefulWidget {
  final int clientId;
  const ExpeditorClientOrdersPage({super.key, required this.clientId});

  @override
  ConsumerState<ExpeditorClientOrdersPage> createState() =>
      _ExpeditorClientOrdersPageState();
}

class _ExpeditorClientOrdersPageState
    extends ConsumerState<ExpeditorClientOrdersPage> {
  HistoryDateRange _range = HistoryPreset.thisWeek.resolve();

  static (String, Color) _statusInfo(String status) {
    switch (status.trim().toLowerCase()) {
      case 'delivered':
        return ('Доставлено', AppColors.success);
      case 'returned':
        return ('Возврат', AppColors.error);
      case 'cancelled':
        return ('Отменено', AppColors.textMuted);
      case 'delivering':
        return ('В пути', AppColors.expeditorAccent);
      case 'picking':
        return ('Сборка', AppColors.warning);
      default:
        return (status, AppColors.textSecondary);
    }
  }

  Future<void> _openPreset() async {
    final r = await showHistoryPresetSheet(context);
    if (r != null && mounted) setState(() => _range = r);
  }

  Future<void> _openCalendar() async {
    final r = await pickHistoryDateRange(context, current: _range);
    if (r != null && mounted) setState(() => _range = r);
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(expeditorClientOrdersProvider(
        (clientId: widget.clientId, from: _range.fromIso, to: _range.toIso),),);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('История заказов'),
      ),
      body: Column(
        children: [
          HistoryFilterBar(
            range: _range,
            onPresetTap: _openPreset,
            onRangeTap: _openCalendar,
          ),
          Expanded(
            child: orders.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(
                      color: AppColors.expeditorAccent,),),
              error: (e, _) => Center(child: Text('Ошибка: $e')),
              data: (rows) {
                if (rows.isEmpty) {
                  return RefreshIndicator(
                    color: AppColors.expeditorAccent,
                    onRefresh: () async => ref.invalidate(
                        expeditorClientOrdersProvider((
                      clientId: widget.clientId,
                      from: _range.fromIso,
                      to: _range.toIso
                    ),),),
                    child: ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.6,
                          child:
                              AgentEmptyState.fill(message: 'Пока здесь пусто'),
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: AppColors.expeditorAccent,
                  onRefresh: () async => ref.invalidate(
                      expeditorClientOrdersProvider((
                    clientId: widget.clientId,
                    from: _range.fromIso,
                    to: _range.toIso
                  ),),),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _card(rows[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(Map<String, dynamic> o) {
    final number = o['order_number']?.toString() ?? '';
    final sum = (o['total_sum'] as num?)?.toDouble() ?? 0;
    final method = o['payment_method']?.toString();
    final (label, color) = _statusInfo(o['status']?.toString() ?? '');
    final raw = o['date']?.toString();
    final dt = raw == null ? null : DateTime.tryParse(raw);
    final date = dt == null
        ? null
        : DateFormat('dd.MM.yyyy HH:mm').format(workRegionNow(dt));

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Заказ №$number',
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textHeadline,),),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: color,),),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (date != null) ...[
            Row(
              children: [
                Text('Дата:',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.textMuted),),
                const Spacer(),
                Text(date,
                    style: const TextStyle(fontWeight: FontWeight.w700),),
              ],
            ),
            const SizedBox(height: 6),
          ],
          Row(
            children: [
              Text('Сумма:',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
              const Spacer(),
              Text(
                "${formatMoneySpaced(sum)}${method != null && method.isNotEmpty ? ' $method' : ''}",
                style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textHeadline,),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

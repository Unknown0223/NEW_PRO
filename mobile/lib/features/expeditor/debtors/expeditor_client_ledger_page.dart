import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../shared/expeditor_history_filter.dart';

const _ruMonthsGen = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const _ruMonthsShort = [
  'янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.',
];

String _two(int v) => v.toString().padLeft(2, '0');

/// «Акт сверки» — mijoz ledger (oylar bo'yicha guruhlangan) + sana filtri.
class ExpeditorClientLedgerPage extends ConsumerStatefulWidget {
  final int clientId;
  const ExpeditorClientLedgerPage({super.key, required this.clientId});

  @override
  ConsumerState<ExpeditorClientLedgerPage> createState() =>
      _ExpeditorClientLedgerPageState();
}

class _ExpeditorClientLedgerPageState
    extends ConsumerState<ExpeditorClientLedgerPage> {
  HistoryDateRange _range = HistoryPreset.last6Months.resolve();

  Future<void> _openPreset() async {
    final r = await showHistoryPresetSheet(context);
    if (r != null && mounted) setState(() => _range = r);
  }

  Future<void> _openCalendar() async {
    final r = await pickHistoryDateRange(context, current: _range);
    if (r != null && mounted) setState(() => _range = r);
  }

  ClientHistoryQuery get _q =>
      (clientId: widget.clientId, from: _range.fromIso, to: _range.toIso);

  @override
  Widget build(BuildContext context) {
    final ledger = ref.watch(expeditorClientLedgerProvider(_q));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Акт сверки')),
      body: Column(
        children: [
          HistoryFilterBar(
            range: _range,
            onPresetTap: _openPreset,
            onRangeTap: _openCalendar,
          ),
          Expanded(
            child: ledger.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(
                      color: AppColors.expeditorAccent,),),
              error: (e, _) => Center(child: Text('Ошибка: $e')),
              data: (d) {
                final rows = (d['rows'] as List?) ?? const [];
                if (rows.isEmpty) {
                  return RefreshIndicator(
                    color: AppColors.expeditorAccent,
                    onRefresh: () async =>
                        ref.invalidate(expeditorClientLedgerProvider(_q)),
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
                  onRefresh: () async =>
                      ref.invalidate(expeditorClientLedgerProvider(_q)),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    children: _buildItems(rows),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildItems(List<dynamic> rows) {
    final items = <Widget>[];
    String? lastMonthKey;
    for (final raw in rows) {
      final r = Map<String, dynamic>.from(raw as Map);
      final dt = DateTime.tryParse(r['date']?.toString() ?? '');
      final wr = dt == null ? null : workRegionNow(dt);
      if (wr != null) {
        final key = '${wr.year}-${wr.month}';
        if (key != lastMonthKey) {
          lastMonthKey = key;
          items.add(Padding(
            padding: const EdgeInsets.fromLTRB(4, 12, 4, 6),
            child: Text('${_ruMonthsGen[wr.month - 1]}. ${wr.year}',
                style: AppTypography.bodyMedium.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,),),
          ),);
        }
      }
      items.add(_card(r, wr));
      items.add(const SizedBox(height: 10));
    }
    return items;
  }

  Widget _card(Map<String, dynamic> r, DateTime? wr) {
    final amount = (r['amount'] as num?)?.toDouble() ?? 0;
    final color = amount < 0 ? AppColors.error : AppColors.success;
    final dateText = wr == null
        ? '—'
        : '${_two(wr.day)} ${_ruMonthsShort[wr.month - 1]}, ${_two(wr.hour)}:${_two(wr.minute)}';

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
              Text('Дата заказа:',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
              const Spacer(),
              Text(dateText,
                  style: const TextStyle(fontWeight: FontWeight.w800),),
            ],
          ),
          const Divider(height: 18, color: AppColors.borderLight),
          Row(
            children: [
              Text('Должен:',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
              const Spacer(),
              Text(formatMoneySpaced(amount),
                  style: TextStyle(fontWeight: FontWeight.w800, color: color),),
            ],
          ),
        ],
      ),
    );
  }
}

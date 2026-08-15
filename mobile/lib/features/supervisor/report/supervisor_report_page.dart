import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../shared/supervisor_api_parse.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

/// CACTUS «Отчёт» — summary + payment breakdown (mavjud).
class SupervisorReportPage extends ConsumerWidget {
  const SupervisorReportPage({super.key});

  String _money(dynamic v) {
    final n = double.tryParse(v?.toString().replaceAll(' ', '') ?? '0') ?? 0;
    return NumberFormat('#,###').format(n.round()).replaceAll(',', ' ');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accent = AppColors.supervisorAccent;
    final async = ref.watch(supervisorSummaryProvider);
    final visits = ref.watch(supervisorVisitsProvider('today'));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: supervisorAppBar(
        context,
        title: 'Отчёт',
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month_outlined),
            onPressed: () => showSupervisorSoon(context, feature: 'Период отчёта'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: accent,
        onRefresh: () async {
          ref.invalidate(supervisorSummaryProvider);
          ref.invalidate(supervisorVisitsProvider('today'));
          await ref.read(supervisorSummaryProvider.future);
        },
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('$e'))]),
          data: (raw) {
            final k = parseSupervisorKpi(raw);
            final parsed = visits.maybeWhen(
              data: SupervisorVisitsPayload.fromApi,
              orElse: () => null,
            );
            final byPay = k['sales_by_payment_method'];

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              children: [
                SvCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Сводка за сегодня', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      _metric('Сумма продаж', '${_money(k['total_sales_sum'] ?? 0)} сум'),
                      _metric('Визиты', '${k['visited_total'] ?? 0} / ${k['planned_visits'] ?? 0}'),
                      _metric('Выполнение', '${((k['visit_pct'] as num?)?.toDouble() ?? 0).round()} %'),
                      _metric('С заказами', '${k['visits_with_orders'] ?? k['successful_visits'] ?? 0}'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SvCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Оплата', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      if (byPay is! List || byPay.isEmpty)
                        const Row(
                          children: [
                            Expanded(child: Text('Детализация по методам оплаты', style: AppTypography.caption)),
                            SvSoonBadge(),
                          ],
                        )
                      else
                        ...[
                          for (final e in byPay)
                            if (e is Map)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Expanded(child: Text(e['method']?.toString() ?? e['name']?.toString() ?? '—')),
                                    Text(_money(e['sum'] ?? e['amount'] ?? 0), style: const TextStyle(fontWeight: FontWeight.w700)),
                                  ],
                                ),
                              ),
                        ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SvCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Агенты', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      if (parsed == null || parsed.rows.isEmpty)
                        const Text('Нет данных по агентам', style: AppTypography.caption)
                      else
                        ...parsed.rows.take(12).map(
                              (r) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                dense: true,
                                title: Text(r.agentName, style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: Text('Визиты ${r.visitedTotal}/${r.plannedVisits} · заказы ${r.visitsWithOrders}'),
                                trailing: Text(r.salesSum, style: TextStyle(color: accent, fontWeight: FontWeight.w700)),
                              ),
                            ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SvCard(
                  onTap: () {
                    final text = [
                      'Отчёт супервайзера',
                      'Сумма: ${_money(k['total_sales_sum'] ?? 0)} сум',
                      'Визиты: ${k['visited_total'] ?? 0}/${k['planned_visits'] ?? 0}',
                      'Выполнение: ${((k['visit_pct'] as num?)?.toDouble() ?? 0).round()}%',
                      if (parsed != null)
                        for (final r in parsed.rows.take(20))
                          '${r.agentName}: ${r.visitedTotal}/${r.plannedVisits} · ${r.salesSum}',
                    ].join('\n');
                    shareSupervisorText(context, text, successLabel: 'Отчёт скопирован');
                  },
                  child: const Row(
                    children: [
                      Icon(Icons.ios_share_outlined),
                      SizedBox(width: 12),
                      Expanded(child: Text('Поделиться / экспорт', style: TextStyle(fontWeight: FontWeight.w600))),
                      Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _metric(String a, String b) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(a, style: AppTypography.caption)),
            Text(b, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      );
}

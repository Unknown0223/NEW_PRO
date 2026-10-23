import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/supervisor_api.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/tabel/tabel_format.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';
import 'supervisor_kpi_utils.dart';

/// Дневной план / маршруты — общий или выбранный агент.
class SupervisorKpiRoutePage extends ConsumerWidget {
  const SupervisorKpiRoutePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const accent = AppColors.supervisorAccent;
    final month = ref.watch(supervisorKpiMonthProvider);
    final agentId = ref.watch(supervisorKpiAgentIdProvider);
    final teamAsync = ref.watch(supervisorTeamKpiProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: 'Дневной план',
        showMenu: false,
        actions: [
          TextButton(
            onPressed: () async {
              final current = ref.read(supervisorKpiMonthProvider);
              final picked = await showModalBottomSheet<String>(
                context: context,
                builder: (ctx) {
                  final months = <String>[for (var i = -5; i <= 1; i++) supervisorShiftMonth(current, i)];
                  return SafeArea(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final m in months)
                          ListTile(
                            title: Text(tabelMonthTitle(m)),
                            trailing: m == current ? const Icon(Icons.check, color: accent) : null,
                            onTap: () => Navigator.pop(ctx, m),
                          ),
                      ],
                    ),
                  );
                },
              );
              if (picked != null) {
                ref.read(supervisorKpiMonthProvider.notifier).state = picked;
              }
            },
            child: Text(tabelMonthTitle(month), style: const TextStyle(color: accent, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: teamAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (team) {
          if (agentId != null && agentId > 0) {
            final row = team.agents.where((a) => a.id == agentId).toList();
            if (row.isNotEmpty) {
              return _DaysList(
                title: row.first.name,
                subtitle: 'План агента · ${tabelMonthTitle(month)}',
                days: row.first.kpi.dailyRoute.days
                    .map(
                      (d) => SupervisorTeamDay(
                        date: d.date,
                        isWorkingDay: d.isWorkingDay,
                        isToday: d.isToday,
                        isFuture: d.isFuture,
                        planSum: d.planSum,
                        factSum: d.factSum,
                        executionPct: d.executionPct,
                        remainingSum: d.remainingSum,
                        status: d.status,
                      ),
                    )
                    .toList(),
                todayPlan: row.first.kpi.dailyRoute.todayPlanSum,
                carry: row.first.kpi.dailyRoute.carryForwardSum,
              );
            }
          }
          return _DaysList(
            title: 'Команда (${team.agentCount})',
            subtitle: 'Сумма по привязанным агентам · ${tabelMonthTitle(month)}',
            days: team.days,
            todayPlan: team.todayPlanSum,
            carry: team.carryForward,
          );
        },
      ),
    );
  }
}

class _DaysList extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<SupervisorTeamDay> days;
  final double todayPlan;
  final double carry;

  const _DaysList({
    required this.title,
    required this.subtitle,
    required this.days,
    required this.todayPlan,
    required this.carry,
  });

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Text(title, style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
        Text(subtitle, style: AppTypography.caption),
        const SizedBox(height: 10),
        SvCard(
          child: Column(
            children: [
              _kv('План на сегодня', formatMoneyUz(todayPlan)),
              _kv('Перенос', formatMoneyUz(carry)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (days.isEmpty)
          const Text('Нет дней плана', style: AppTypography.caption)
        else
          ...days.where((d) => d.isWorkingDay || d.planSum > 0 || d.factSum > 0).map((d) {
            final pct = d.executionPct?.round() ?? (d.planSum > 0 ? ((d.factSum / d.planSum) * 100).round() : 0);
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SvCard(
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 40,
                      decoration: BoxDecoration(
                        color: d.isToday ? accent : (d.isFuture ? AppColors.border : AppColors.success),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            d.date + (d.isToday ? ' · сегодня' : ''),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          Text(
                            'План ${formatMoneyUz(d.planSum)} · факт ${formatMoneyUz(d.factSum)}',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ),
                    Text('$pct%', style: TextStyle(fontWeight: FontWeight.w800, color: accent)),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _kv(String a, String b) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [Expanded(child: Text(a)), Text(b, style: const TextStyle(fontWeight: FontWeight.w700))]),
      );
}

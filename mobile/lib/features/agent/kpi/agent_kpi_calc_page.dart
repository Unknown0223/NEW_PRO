import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../tabel/tabel_format.dart';
import 'kpi_format.dart';
import 'kpi_provider.dart';

/// Screen 35 — KPI расчёт (oylik koeffitsient, tabel, guruhlar).
class AgentKpiCalcPage extends ConsumerWidget {
  const AgentKpiCalcPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final month = ref.watch(kpiMonthProvider);
    final dataAsync = ref.watch(agentKpiProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'KPI · Месяц',
        showBack: true,
        belowTitle: Text(
          'Месячный расчёт · ${tabelMonthTitle(month)}',
          style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          AgentIconButton(
            icon: Icons.route_outlined,
            onPressed: () => context.push('/kpi/route'),
          ),
          AgentIconButton(
            icon: Icons.table_rows_outlined,
            onPressed: () => context.push('/tabel'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(agentKpiProvider),
        child: dataAsync.when(
          data: (data) => _Body(data: data),
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 80),
              AgentErrorPanel(
                error: e,
                onRetry: () => ref.invalidate(agentKpiProvider),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final AgentKpiResult data;
  const _Body({required this.data});

  @override
  Widget build(BuildContext context) {
    final workDays = data.dailyRoute.days.where((d) => d.isWorkingDay).toList();
    final sales = workDays.map((d) => d.factSum).toList();
    final avg = sales.isEmpty ? 0.0 : sales.reduce((a, b) => a + b) / sales.length;
    final maxS = sales.isEmpty ? 0.0 : sales.reduce((a, b) => a > b ? a : b);
    final minS = sales.isEmpty ? 0.0 : sales.where((s) => s > 0).fold<double>(maxS, (m, s) => s < m ? s : m);
    final elapsed = data.dailyRoute.pastWorkingDays +
        (workDays.any((d) => d.isToday) ? 1 : 0);
    final monthPct = kpiPctInt(data.monthExecutionPct);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        _MonthHero(
          fact: data.monthFactSum,
          plan: data.monthPlanSum,
          pct: monthPct,
          elapsedDays: elapsed.clamp(0, data.dailyRoute.workingDaysTotal),
          totalWorkDays: data.dailyRoute.workingDaysTotal,
          sales: sales,
          avg: avg,
          maxS: maxS,
          minS: minS,
          forecast: data.forecastPct,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _MonthMetric(
                title: 'Продажи за месяц',
                current: tabelCompactSum(data.monthFactSum),
                target: tabelCompactSum(data.monthPlanSum),
                pct: monthPct.toDouble(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MonthMetric(
                title: 'Рабочие дни',
                current: '$elapsed/${data.dailyRoute.workingDaysTotal}',
                target: '${data.dailyRoute.workingDaysTotal}',
                pct: data.dailyRoute.workingDaysTotal > 0
                    ? (elapsed / data.dailyRoute.workingDaysTotal) * 100
                    : 0,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _MonthMetric(
          title: 'Дневной план (база)',
          current: tabelCompactSum(data.dailyRoute.baseDayPlan),
          target: 'сегодня ${tabelCompactSum(data.todayPlanDaySum)}',
          pct: data.todayExecutionPct,
          fullWidth: true,
        ),
        const SizedBox(height: 12),
        _CalcList(data: data),
        const SizedBox(height: 12),
        _HintsCard(data: data),
      ],
    );
  }
}

class _MonthHero extends StatelessWidget {
  final double fact;
  final double plan;
  final int pct;
  final int elapsedDays;
  final int totalWorkDays;
  final List<double> sales;
  final double avg;
  final double maxS;
  final double minS;
  final double? forecast;

  const _MonthHero({
    required this.fact,
    required this.plan,
    required this.pct,
    required this.elapsedDays,
    required this.totalWorkDays,
    required this.sales,
    required this.avg,
    required this.maxS,
    required this.minS,
    this.forecast,
  });

  @override
  Widget build(BuildContext context) {
    final maxBar = sales.fold<double>(0, (m, s) => s > m ? s : m);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B2538), Color(0xFF0F4544)],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ПРОДАЖИ ЗА МЕСЯЦ',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      '${formatMoneySpaced(fact)} сум',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text.rich(
                      TextSpan(
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12),
                        children: [
                          const TextSpan(text: 'план: '),
                          TextSpan(
                            text: formatMoneySpaced(plan),
                            style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                          if (forecast != null) ...[
                            const TextSpan(text: ' · '),
                            TextSpan(
                              text: 'прогноз ~${forecast!.round()}%',
                              style: const TextStyle(color: Color(0xFF86EFAC), fontWeight: FontWeight.w700),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'ИСПОЛНЕНИЕ KPI',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '$pct%',
                    style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    '$elapsedDays/$totalWorkDays дн.',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('1', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 10, fontWeight: FontWeight.w700)),
                    Text('месячный тренд', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 10, fontWeight: FontWeight.w700)),
                    Text('$totalWorkDays', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 10, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 48,
                  child: sales.isEmpty
                      ? const SizedBox.shrink()
                      : Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            for (var i = 0; i < sales.length; i++) ...[
                              if (i > 0) const SizedBox(width: 1),
                              Expanded(
                                child: Container(
                                  height: maxBar <= 0
                                      ? 2
                                      : (2 + (sales[i] / maxBar) * 46).clamp(2.0, 48.0),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF86EFAC).withValues(alpha: i == sales.length - 1 ? 1 : 0.55),
                                    borderRadius: BorderRadius.circular(2),
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
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _mini('∅ в день', tabelCompactSum(avg))),
              Expanded(child: _mini('макс', tabelCompactSum(maxS))),
              Expanded(child: _mini('мин', tabelCompactSum(minS > 0 && minS < maxS ? minS : 0))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mini(String label, String value) => Column(
        children: [
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 10)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
        ],
      );
}

class _MonthMetric extends StatelessWidget {
  final String title;
  final String current;
  final String target;
  final double? pct;
  final bool fullWidth;

  const _MonthMetric({
    required this.title,
    required this.current,
    required this.target,
    required this.pct,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    final p = pct ?? 0;
    final bar = p >= 100
        ? AppColors.success
        : p >= 80
            ? AppColors.primary
            : p >= 60
                ? AppColors.warning
                : AppColors.error;
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5EDF3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              Text(
                '${p.round()}%',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.primary),
              ),
            ],
          ),
          Text(current, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          Text('план: $target', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (p / 100).clamp(0.0, 1.0),
              minHeight: 4,
              backgroundColor: const Color(0xFFE5EDF3),
              valueColor: AlwaysStoppedAnimation(bar),
            ),
          ),
        ],
      ),
    );
  }
}

class _CalcList extends StatelessWidget {
  final AgentKpiResult data;
  const _CalcList({required this.data});

  Color _color(int i, double? pct) {
    final p = pct ?? 0;
    if (p >= 85) return AppColors.success;
    if (p >= 70) return i.isEven ? AppColors.primary : AppColors.info;
    return AppColors.warning;
  }

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Расчёт по KPI', style: AppTypography.headlineSmall.copyWith(fontSize: 14)),
          if (data.kpiGroups.isEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Нет планов по группам KPI.',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          ] else
            ...kpiVisibleGroups(data.kpiGroups).asMap().entries.map((e) {
              final g = e.value;
              final pct = kpiPctInt(g.executionPct);
              final color = _color(e.key, g.executionPct);
              final fact = kpiFormatPrimary(g.fact.primaryValue(g.primaryMetric), g.primaryMetric);
              final plan = kpiFormatPrimary(g.plan.primaryValue(g.primaryMetric), g.primaryMetric);
              final weight = g.weightPct?.round();
              return Container(
                margin: const EdgeInsets.only(top: 9),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5EDF3)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                g.name,
                                style: AppTypography.bodySmall.copyWith(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                [
                                  if (weight != null) 'вес $weight%',
                                  'факт $fact',
                                  'план $plan',
                                ].join(' · '),
                                style: AppTypography.captionSmall.copyWith(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '$pct%',
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w900,
                                color: color,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              g.score != null ? 'score ${g.score}' : 'score —',
                              style: AppTypography.captionSmall.copyWith(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (pct / 100).clamp(0.0, 1.0),
                        minHeight: 10,
                        backgroundColor: const Color(0xFFE5EDF3),
                        valueColor: AlwaysStoppedAnimation(color),
                      ),
                    ),
                    if ((g.remainingPrimary ?? 0) > 0) ...[
                      const SizedBox(height: 6),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          kpiRemainingLine(g),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: AppColors.error,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Премия',
                          style: AppTypography.captionSmall.copyWith(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                        Text(
                          data.bonusAvailable ? '—' : 'нет данных',
                          style: AppTypography.captionSmall.copyWith(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _HintsCard extends StatelessWidget {
  final AgentKpiResult data;
  const _HintsCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final hints = <(Color, Color, String)>[];
    if (data.todayRemainingSum > 0 && data.todayPlanDaySum > 0) {
      hints.add((
        AppColors.primarySoft,
        AppColors.primary,
        '1. Закрыть маршрутную сумму: ещё ${formatMoneySpaced(data.todayRemainingSum)} сум до дневной доли плана.',
      ));
    }
    if (data.monthRemainingSum > 0 && data.monthPlanSum > 0) {
      hints.add((
        const Color(0xFFFFF7ED),
        const Color(0xFF9A4D00),
        '2. До месячного плана: ${formatMoneySpaced(data.monthRemainingSum)} сум (${kpiPctInt(data.monthExecutionPct)}% исполнения).',
      ));
    }
    if (hints.isEmpty) {
      hints.add((
        AppColors.primarySoft,
        AppColors.primary,
        data.hasPlans
            ? 'План выполняется. Группы KPI смотрите в «Подробнее».'
            : 'План KPI ещё не утверждён — проверьте «Установка планов» на веб.',
      ));
    }

    return AgentSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Что сделать сегодня', style: AppTypography.headlineSmall.copyWith(fontSize: 14)),
          const SizedBox(height: 8),
          ...hints.map(
            (h) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: h.$1,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: h.$2.withValues(alpha: 0.35)),
              ),
              child: Text(
                h.$3,
                style: AppTypography.bodySmall.copyWith(color: h.$2, fontSize: 12.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

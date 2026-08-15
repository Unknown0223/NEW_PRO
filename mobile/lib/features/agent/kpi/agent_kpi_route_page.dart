import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../tabel/tabel_format.dart';
import 'kpi_format.dart';
import 'kpi_provider.dart';

/// Диагностика — Screen 35 (oylik KPI hisobot) shabloni.
class AgentKpiRoutePage extends ConsumerStatefulWidget {
  const AgentKpiRoutePage({super.key});

  @override
  ConsumerState<AgentKpiRoutePage> createState() => _AgentKpiRoutePageState();
}

class _AgentKpiRoutePageState extends ConsumerState<AgentKpiRoutePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final todayMonth = serverTodayKey().substring(0, 7);
      if (ref.read(kpiMonthProvider) != todayMonth) {
        ref.read(kpiMonthProvider.notifier).state = todayMonth;
      }
      ref.invalidate(agentKpiProvider);
    });
  }

  Future<void> _pickMonth() async {
    final current = ref.read(kpiMonthProvider);
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        final months = <String>[
          for (var i = -5; i <= 1; i++) tabelShiftMonth(current, i),
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Выберите месяц', style: AppTypography.headlineSmall.copyWith(fontSize: 16)),
                const SizedBox(height: 10),
                for (final m in months)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      tabelMonthTitle(m),
                      style: TextStyle(
                        fontWeight: m == current ? FontWeight.w800 : FontWeight.w600,
                        color: m == current ? AppColors.primary : AppColors.textPrimary,
                      ),
                    ),
                    trailing: m == current
                        ? const Icon(Icons.check_circle, color: AppColors.primary, size: 20)
                        : null,
                    onTap: () => Navigator.pop(ctx, m),
                  ),
              ],
            ),
          ),
        );
      },
    );
    if (picked == null || !mounted) return;
    ref.read(kpiMonthProvider.notifier).state = picked;
    ref.invalidate(agentKpiProvider);
  }

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(agentKpiProvider);
    final session = ref.watch(sessionProvider);
    final fallbackName = session.user?.name ?? '';
    final fallbackCode = session.user?.code ?? session.user?.login ?? '';
    final month = ref.watch(kpiMonthProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'KPI · ${tabelMonthTitle(month)}',
        showBack: false,
        belowTitle: dataAsync.maybeWhen(
          data: (d) => Text(
            _agentLine(d, fallbackName, fallbackCode),
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
          orElse: () => Text(
            _agentLine(AgentKpiResult.empty(), fallbackName, fallbackCode),
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
        ),
        actions: [
          AgentIconButton(
            icon: Icons.calendar_month_outlined,
            onPressed: _pickMonth,
          ),
          AgentIconButton(
            icon: Icons.download_outlined,
            onPressed: () => context.push('/kpi/route/days'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final todayMonth = serverTodayKey().substring(0, 7);
          if (ref.read(kpiMonthProvider) != todayMonth) {
            ref.read(kpiMonthProvider.notifier).state = todayMonth;
          }
          ref.invalidate(agentKpiProvider);
        },
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 80),
              AgentErrorPanel(error: e, onRetry: () => ref.invalidate(agentKpiProvider)),
            ],
          ),
          data: (data) => _MonthBody(data: data),
        ),
      ),
    );
  }

  String _agentLine(AgentKpiResult d, String fallbackName, String fallbackCode) {
    final name = d.agentName.trim().isNotEmpty ? d.agentName.trim() : fallbackName.trim();
    final code = (d.agentCode ?? '').trim().isNotEmpty
        ? d.agentCode!.trim()
        : fallbackCode.trim();
    if (name.isEmpty && code.isEmpty) return 'Месячный отчёт KPI';
    if (code.isEmpty) return name;
    if (name.isEmpty) return code;
    return '$name · $code';
  }
}

class _MonthBody extends StatelessWidget {
  final AgentKpiResult data;
  const _MonthBody({required this.data});

  @override
  Widget build(BuildContext context) {
    final groups = kpiVisibleGroups(data.kpiGroups);
    final todayDay = data.dailyRoute.days.where((d) => d.isToday).firstOrNull;
    final todayPlan = todayDay?.planSum ?? data.todayPlanDaySum;
    final todayFact = todayDay?.factSum ?? data.todaySalesSum;
    final todayRem = todayDay?.remainingSum ?? data.todayRemainingSum;
    final todayOver = math.max(0.0, todayFact - todayPlan);
    final todayPct = todayDay?.executionPct ?? data.todayExecutionPct;
    final remDays = data.dailyRoute.remainingWorkingDays;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        _TodaySalesHero(
          fact: todayFact,
          plan: todayPlan,
          remaining: todayRem,
          overSum: todayOver,
          pct: todayPct,
          vsYesterday: data.dailyRoute.vsYesterdayPct ?? data.todayVsYesterdayPct,
          workLeft: remDays,
          workTotal: data.dailyRoute.workingDaysTotal,
          carryForward: data.dailyRoute.carryForwardSum,
          monthFact: data.monthFactSum,
          monthPlan: data.monthPlanSum,
          monthPct: data.monthExecutionPct,
          onOpenDays: () => context.push('/kpi/route/days'),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: Text(
                'KPI · план на сегодня',
                style: AppTypography.headlineSmall.copyWith(fontSize: 14),
              ),
            ),
            TextButton(
              onPressed: () => context.push('/kpi/route/days'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Подробнее →',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (groups.isEmpty)
          AgentSurfaceCard(
            child: Text(
              data.hasPlans
                  ? 'Нет активных групп KPI.'
                  : 'Одобренных KPI-планов на месяц нет.',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          )
        else
          ..._grid(groups, remDays),
      ],
    );
  }

  List<Widget> _grid(List<AgentKpiGroupRow> groups, int remDays) {
    final out = <Widget>[];
    for (var i = 0; i < groups.length; i += 2) {
      if (i > 0) out.add(const SizedBox(height: 10));
      final left = groups[i];
      final right = i + 1 < groups.length ? groups[i + 1] : null;
      out.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _KpiTile(
                group: left,
                icon: kpiMetricIcon(left.primaryMetric),
                tone: kpiMetricIconTone(left.primaryMetric, i),
                remDays: remDays,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: right != null
                  ? _KpiTile(
                      group: right,
                      icon: kpiMetricIcon(right.primaryMetric),
                      tone: kpiMetricIconTone(right.primaryMetric, i + 1),
                      remDays: remDays,
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      );
    }
    return out;
  }
}

class _TodaySalesHero extends StatelessWidget {
  final double fact;
  final double plan;
  final double remaining;
  final double overSum;
  final double? pct;
  final double? vsYesterday;
  final int workLeft;
  final int workTotal;
  final double carryForward;
  final double monthFact;
  final double monthPlan;
  final double? monthPct;
  final VoidCallback onOpenDays;

  const _TodaySalesHero({
    required this.fact,
    required this.plan,
    required this.remaining,
    required this.overSum,
    required this.pct,
    required this.vsYesterday,
    required this.workLeft,
    required this.workTotal,
    required this.carryForward,
    required this.monthFact,
    required this.monthPlan,
    required this.monthPct,
    required this.onOpenDays,
  });

  @override
  Widget build(BuildContext context) {
    final p = kpiPctInt(pct);
    final vs = vsYesterday;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpenDays,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.darkSurface, AppColors.darkSurface2],
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: AppColors.darkSurface.withValues(alpha: 0.45),
                blurRadius: 28,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ПРОДАЖИ СЕГОДНЯ',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.92),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${formatMoneySpaced(fact)} сум',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'нужно: ${formatMoneySpaced(plan)} сум',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        if (vs != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            '${vs >= 0 ? '+' : ''}${vs.toStringAsFixed(1)}% vs вчера',
                            style: TextStyle(
                              color: vs >= 0 ? AppColors.kpiChartGreen : const Color(0xFFFECACA),
                              fontSize: 13.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'ИСПОЛНЕНИЕ',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.92),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        pct == null ? '—%' : '$p%',
                        style: const TextStyle(
                          color: AppColors.kpiChartGreen,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        '$workLeft/$workTotal раб. дн.',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: (p / 100).clamp(0.0, 1.0),
                  minHeight: 8,
                  backgroundColor: Colors.white.withValues(alpha: 0.15),
                  valueColor: const AlwaysStoppedAnimation(AppColors.kpiChartGreen),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _HeroStat(
                      overSum > 0 ? 'перевыполнение' : 'осталось',
                      overSum > 0 ? '+${formatMoneySpaced(overSum)}' : formatMoneySpaced(remaining),
                    ),
                  ),
                  Expanded(
                    child: _HeroStat('перенос', carryForward > 0 ? formatMoneySpaced(carryForward) : '0'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'месяц: ${formatMoneySpaced(monthFact)} / ${formatMoneySpaced(monthPlan)}'
                '${monthPct != null ? ' · ${kpiPctInt(monthPct)}%' : ''}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;
  const _HeroStat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  final AgentKpiGroupRow group;
  final IconData icon;
  final Color tone;
  final int remDays;

  const _KpiTile({
    required this.group,
    required this.icon,
    required this.tone,
    required this.remDays,
  });

  @override
  Widget build(BuildContext context) {
    final metric = group.primaryMetric;
    final monthPlan = group.plan.primaryValue(metric);
    final monthFact = group.fact.primaryValue(metric);
    final monthRem = group.remainingPrimary ?? math.max(0.0, monthPlan - monthFact);

    // Fallback: agar API today_plan=0 bo‘lsa — qoldiq / qolgan kunlar.
    var dayPlan = group.todayPlanPrimary;
    if (dayPlan <= 0 && remDays > 0 && monthRem > 0) {
      dayPlan = monthRem / remDays;
    }
    final dayFact = group.todayFactPrimary;
    final dayOver = math.max(0.0, dayFact - dayPlan);
    final dayRem = dayOver > 0 ? 0.0 : math.max(0.0, dayPlan - dayFact);
    final dayPct = dayPlan > 0
        ? kpiPctInt((dayFact / dayPlan) * 100)
        : kpiPctInt(group.todayExecutionPct);

    final badgeColor = dayPct >= 100
        ? AppColors.success
        : dayPct >= 80
            ? AppColors.primary
            : dayPct >= 40
                ? AppColors.warning
                : AppColors.error;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 11),
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
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 20, color: tone),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$dayPct%',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: badgeColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            group.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Факт',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppColors.textSecondary,
            ),
          ),
          Text(
            kpiFormatPrimary(dayFact, metric),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'план ${kpiFormatPrimary(dayPlan, metric)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          if (dayOver > 0)
            Text(
              'пере+ ${kpiFormatPrimary(dayOver, metric)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w900,
                color: AppColors.success,
              ),
            )
          else
            Text(
              'ост. ${kpiFormatPrimary(dayRem, metric)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w900,
                color: dayRem > 0 ? AppColors.error : AppColors.success,
              ),
            ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (dayPct / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: const Color(0xFFE5EDF3),
              valueColor: AlwaysStoppedAnimation(badgeColor),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'мес. ${kpiFormatPrimary(monthFact, metric)} / ${kpiFormatPrimary(monthPlan, metric)}'
            ' · ${kpiPctInt(group.executionPct)}%',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// `YYYY-MM` ni ± oyga siljitish.
String tabelShiftMonth(String month, int delta) {
  var m = month;
  if (delta >= 0) {
    for (var i = 0; i < delta; i++) {
      m = tabelNextMonth(m);
    }
  } else {
    for (var i = 0; i < -delta; i++) {
      m = tabelPrevMonth(m);
    }
  }
  return m;
}


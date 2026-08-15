import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../home/home_visit_metrics_provider.dart';
import '../shell/agent_app_bar.dart';
import '../tabel/tabel_format.dart';
import 'kpi_format.dart';
import 'kpi_provider.dart';

/// Screen 34 — Bugungi KPI (shablon).
class AgentKpiPage extends ConsumerWidget {
  const AgentKpiPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(agentKpiProvider);
    final metricsAsync = ref.watch(homeVisitMetricsProvider);
    final session = ref.watch(sessionProvider);
    final fallbackName = session.user?.name ?? '';
    final fallbackCode = session.user?.code ?? session.user?.login ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'KPI',
        belowTitle: dataAsync.maybeWhen(
          data: (d) => Text(
            kpiAgentSubtitle(d, fallbackName: fallbackName, fallbackCode: fallbackCode),
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
          orElse: () => Text(
            kpiAgentSubtitle(
              AgentKpiResult.empty(),
              fallbackName: fallbackName,
              fallbackCode: fallbackCode,
            ),
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
        ),
        actions: [
          if (dataAsync.valueOrNull != null)
            Container(
              margin: const EdgeInsets.only(right: 4),
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF7F7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                tabelMonthTitle(dataAsync.valueOrNull!.month),
                style: AppTypography.captionSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
            ),
          AgentIconButton(
            icon: Icons.calendar_month_outlined,
            onPressed: () => context.push('/kpi/calc'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(agentKpiProvider);
          ref.invalidate(homeVisitMetricsProvider);
        },
        child: dataAsync.when(
          data: (data) => _Body(data: data, visitMetrics: metricsAsync.valueOrNull),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 80),
              AgentErrorPanel(error: e, onRetry: () => ref.invalidate(agentKpiProvider)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final AgentKpiResult data;
  final HomeVisitMetrics? visitMetrics;

  const _Body({required this.data, this.visitMetrics});

  @override
  Widget build(BuildContext context) {
    final todayPct = kpiPctInt(data.todayExecutionPct);
    final onRoute = visitMetrics?.onRoute ?? data.todayVisits;
    final offRoute = visitMetrics?.offRoute ?? 0;
    final total = visitMetrics?.total ?? 0;
    final remaining = visitMetrics?.remainingOnRoute ??
        (total > onRoute ? total - onRoute : 0);
    final stops = total > 0 ? total : (onRoute + remaining);
    final visitPct = stops > 0 ? (onRoute / stops) * 100 : null;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        _TodayHero(
          sales: data.todaySalesSum,
          plan: data.todayPlanDaySum,
          pct: todayPct,
          remaining: data.todayRemainingSum,
          vsYesterday: data.todayVsYesterdayPct,
          week: data.week,
          workingDaysLeft: data.dailyRoute.remainingWorkingDays,
          workingDaysTotal: data.dailyRoute.workingDaysTotal,
          carryForward: data.dailyRoute.carryForwardSum,
        ),
        const SizedBox(height: 12),
        _VisitRouteCard(
          onRoute: onRoute,
          offRoute: offRoute,
          remaining: remaining,
          stops: stops > 0 ? stops : 12,
          pct: kpiPctInt(visitPct ?? data.todayExecutionPct),
          onOpen: () => context.go('/kpi/route'),
        ),
        const SizedBox(height: 12),
        ..._kpiGroupGrid(context, data),
        if (!data.hasPlans) ...[
          const SizedBox(height: 12),
          AgentSurfaceCard(
            child: Text(
              'Одобренных KPI-планов на месяц нет. Задайте в «Установка планов».',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ],
      ],
    );
  }

  List<Widget> _kpiGroupGrid(BuildContext context, AgentKpiResult data) {
    final groups = kpiVisibleGroups(data.kpiGroups);
    if (groups.isEmpty) return const [];

    final tiles = <Widget>[];
    for (var i = 0; i < groups.length; i += 2) {
      final left = groups[i];
      final right = i + 1 < groups.length ? groups[i + 1] : null;
      tiles.add(const SizedBox(height: 10));
      tiles.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _groupTile(left, i)),
            const SizedBox(width: 10),
            Expanded(
              child: right != null
                  ? _groupTile(right, i + 1)
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      );
    }
    return tiles;
  }

  Widget _groupTile(AgentKpiGroupRow g, int index) {
    final fact = g.fact.primaryValue(g.primaryMetric);
    final plan = g.plan.primaryValue(g.primaryMetric);
    return _MetricTile(
      title: g.name,
      icon: kpiMetricIcon(g.primaryMetric),
      current: kpiFormatCompact(fact, g.primaryMetric),
      target: '${kpiFormatCompact(plan, g.primaryMetric)} ${kpiMetricLabel(g.primaryMetric)}',
      pct: g.executionPct,
      tone: kpiMetricIconTone(g.primaryMetric, index),
    );
  }
}

class _TodayHero extends StatelessWidget {
  final double sales;
  final double plan;
  final int pct;
  final double remaining;
  final double? vsYesterday;
  final List<AgentKpiWeekDay> week;
  final int workingDaysLeft;
  final int workingDaysTotal;
  final double carryForward;

  const _TodayHero({
    required this.sales,
    required this.plan,
    required this.pct,
    required this.remaining,
    required this.vsYesterday,
    required this.week,
    required this.workingDaysLeft,
    required this.workingDaysTotal,
    required this.carryForward,
  });

  static const _wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  @override
  Widget build(BuildContext context) {
    final maxBar = week.fold<double>(0, (m, w) => w.salesSum > m ? w.salesSum : m);
    final avg = week.isEmpty ? 0.0 : week.fold<double>(0, (s, w) => s + w.salesSum) / week.length;
    final vs = vsYesterday;
    final vsLabel = vs == null ? null : '${vs >= 0 ? '+' : ''}${vs.toStringAsFixed(0)}% vs вчера';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF07958F), Color(0xFF055B57)],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.28),
            blurRadius: 34,
            offset: const Offset(0, 14),
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
                        color: Colors.white.withValues(alpha: 0.8),
                        letterSpacing: 0.6,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      '${formatMoneySpaced(sales)} сум',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text.rich(
                      TextSpan(
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.95),
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                        ),
                        children: [
                          const TextSpan(text: 'план: '),
                          TextSpan(
                            text: formatMoneySpaced(plan),
                            style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                          const TextSpan(text: ' сум'),
                          if (vsLabel != null) ...[
                            const TextSpan(text: ' · '),
                            TextSpan(
                              text: vsLabel,
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                color: (vs ?? 0) >= 0
                                    ? const Color(0xFFBBF7D0)
                                    : const Color(0xFFFECDD3),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (workingDaysTotal > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Text(
                          'раб. дни: $workingDaysLeft/$workingDaysTotal · осталось ${formatMoneySpaced(remaining)}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.95),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            height: 1.25,
                          ),
                        ),
                      ),
                    if (carryForward > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'перенос: ${formatMoneySpaced(carryForward)}',
                          style: const TextStyle(
                            color: Color(0xFFFEF08A),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            height: 1.25,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CircularProgressIndicator(
                      value: 1,
                      strokeWidth: 10,
                      backgroundColor: Colors.white.withValues(alpha: 0.18),
                      valueColor: const AlwaysStoppedAnimation(Colors.transparent),
                    ),
                    CircularProgressIndicator(
                      value: (pct / 100).clamp(0.0, 1.0),
                      strokeWidth: 10,
                      strokeCap: StrokeCap.round,
                      backgroundColor: Colors.transparent,
                      valueColor: const AlwaysStoppedAnimation(Colors.white),
                    ),
                    Text(
                      '$pct%',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Text(
                      'ПРОДАЖИ · ПОСЛЕДНИЕ 7 ДНЕЙ',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '∅ ${tabelCompactSum(avg)}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 56,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (var i = 0; i < week.length; i++) ...[
                        if (i > 0) const SizedBox(width: 4),
                        Expanded(
                          child: Container(
                            height: maxBar <= 0
                                ? 4
                                : (4 + (week[i].salesSum / maxBar) * 52).clamp(4.0, 56.0),
                            decoration: BoxDecoration(
                              color: i == week.length - 1
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.45),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    for (var i = 0; i < 7; i++) ...[
                      if (i > 0) const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          _wd[i],
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: i == 6 ? 1 : 0.7),
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VisitRouteCard extends StatelessWidget {
  final int onRoute;
  final int offRoute;
  final int remaining;
  final int stops;
  final int pct;
  final VoidCallback onOpen;

  const _VisitRouteCard({
    required this.onRoute,
    required this.offRoute,
    required this.remaining,
    required this.stops,
    required this.pct,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    final segs = List.generate(stops.clamp(1, 24), (i) {
      if (i < onRoute) return AppColors.success;
      if (i < onRoute + offRoute) return const Color(0xFFF59E0B);
      return const Color(0xFFE5EDF3);
    });

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(16),
        child: AgentSurfaceCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Маршрут на сегодня',
                          style: AppTypography.headlineSmall.copyWith(fontSize: 13.5),
                        ),
                        Text(
                          '$onRoute из $stops точек'
                          '${offRoute > 0 ? ' · вне маршрута $offRoute' : ''}',
                          style: AppTypography.captionSmall.copyWith(
                            color: AppColors.textMuted,
                            fontSize: 11.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$pct%',
                      style: AppTypography.captionSmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 20, color: AppColors.textMuted),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (var i = 0; i < segs.length; i++) ...[
                    if (i > 0) const SizedBox(width: 4),
                    Expanded(
                      child: Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: segs[i],
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _legend(AppColors.success, 'Посещено $onRoute'),
                  _legend(const Color(0xFFF59E0B), 'Вне маршрута $offRoute'),
                  _legend(const Color(0xFFE5EDF3), 'Осталось $remaining'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _legend(Color c, String t) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 4),
          Text(
            t,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.textMuted),
          ),
        ],
      );
}

class _MetricTile extends StatelessWidget {
  final String title;
  final IconData icon;
  final String current;
  final String target;
  final double? pct;
  final Color tone;

  const _MetricTile({
    required this.title,
    required this.icon,
    required this.current,
    required this.target,
    required this.pct,
    required this.tone,
  });

  @override
  Widget build(BuildContext context) {
    final p = pct ?? 0;
    final barColor = p >= 100
        ? AppColors.success
        : p >= 80
            ? AppColors.primary
            : p >= 60
                ? AppColors.warning
                : AppColors.error;

    return Container(
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
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 19, color: tone),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${p.round()}%',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              color: AppColors.textMuted,
              letterSpacing: 0.3,
            ),
          ),
          Text(
            current,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          Text(
            'план: $target',
            style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (p / 100).clamp(0.0, 1.0),
              minHeight: 4,
              backgroundColor: const Color(0xFFE5EDF3),
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
        ],
      ),
    );
  }
}

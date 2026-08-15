import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/api/supervisor_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/kpi/kpi_format.dart';
import '../../agent/tabel/tabel_format.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';
import 'supervisor_kpi_charts.dart';
import 'supervisor_kpi_utils.dart';

/// SVR KPI: Общий / По агентам — faqat bog‘langan agentlar, kunlik+oylik diagrammalar.
class SupervisorKpiPage extends ConsumerWidget {
  const SupervisorKpiPage({super.key});

  Future<void> _pickMonth(WidgetRef ref, BuildContext context) async {
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
                  trailing: m == current ? const Icon(Icons.check, color: AppColors.supervisorAccent) : null,
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
  }

  Future<void> _pickAgent(WidgetRef ref, BuildContext context, List<SupervisorLinkedAgent> agents) async {
    final current = ref.read(supervisorKpiAgentIdProvider);
    final picked = await showModalBottomSheet<int>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(title: Text('Выберите агента', style: TextStyle(fontWeight: FontWeight.w800))),
            for (final a in agents)
              ListTile(
                title: Text(a.label),
                trailing: a.id == current ? const Icon(Icons.check, color: AppColors.supervisorAccent) : null,
                onTap: () => Navigator.pop(ctx, a.id),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      ref.read(supervisorKpiAgentIdProvider.notifier).state = picked;
      ref.read(supervisorKpiByAgentModeProvider.notifier).state = true;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const accent = AppColors.supervisorAccent;
    final month = ref.watch(supervisorKpiMonthProvider);
    final agentId = ref.watch(supervisorKpiAgentIdProvider);
    final byAgent = ref.watch(supervisorKpiByAgentModeProvider);
    final agentsAsync = ref.watch(supervisorLinkedAgentsProvider);
    final teamAsync = ref.watch(supervisorTeamKpiProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: 'KPI',
        actions: [
          TextButton(
            onPressed: () => _pickMonth(ref, context),
            child: Text(tabelMonthTitle(month), style: const TextStyle(color: accent, fontWeight: FontWeight.w700)),
          ),
          IconButton(
            icon: const Icon(Icons.calendar_view_day_outlined),
            tooltip: 'Дневной план',
            onPressed: () => context.push('/sv-kpi/route'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Общий'), icon: Icon(Icons.groups_outlined, size: 18)),
                ButtonSegment(value: true, label: Text('По агентам'), icon: Icon(Icons.person_outline, size: 18)),
              ],
              selected: {byAgent},
              onSelectionChanged: (s) {
                final next = s.first;
                ref.read(supervisorKpiByAgentModeProvider.notifier).state = next;
                if (next) {
                  final agents = agentsAsync.valueOrNull ?? [];
                  if (agentId == null && agents.isNotEmpty) {
                    ref.read(supervisorKpiAgentIdProvider.notifier).state = agents.first.id;
                  }
                }
              },
            ),
          ),
          if (byAgent)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: agentsAsync.when(
                loading: () => const LinearProgressIndicator(color: accent),
                error: (e, _) => Text('$e'),
                data: (agents) {
                  if (agents.isEmpty) {
                    return const SvCard(child: Text('Нет привязанных агентов'));
                  }
                  final selected = agents.firstWhere(
                    (a) => a.id == agentId,
                    orElse: () => agents.first,
                  );
                  if (agentId != selected.id) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      ref.read(supervisorKpiAgentIdProvider.notifier).state = selected.id;
                    });
                  }
                  return SvCard(
                    onTap: () => _pickAgent(ref, context, agents),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: accent.withValues(alpha: 0.15),
                          child: Text(
                            selected.name.isNotEmpty ? selected.name[0].toUpperCase() : 'A',
                            style: const TextStyle(color: accent, fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(selected.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        const Icon(Icons.expand_more),
                      ],
                    ),
                  );
                },
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: accent,
              onRefresh: () async {
                ref.invalidate(supervisorTeamKpiProvider);
                ref.invalidate(supervisorLinkedAgentsProvider);
                final id = ref.read(supervisorKpiAgentIdProvider);
                if (id != null) ref.invalidate(supervisorAgentKpiProvider(id));
              },
              child: byAgent
                  ? _AgentBody(agentId: agentId)
                  : teamAsync.when(
                      loading: () => const Center(child: CircularProgressIndicator(color: accent)),
                      error: (e, _) => ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [Padding(padding: const EdgeInsets.all(24), child: Text('$e'))],
                      ),
                      data: (team) => _TeamBody(team: team),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TeamBody extends ConsumerWidget {
  final SupervisorTeamKpi team;
  const _TeamBody({required this.team});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const accent = AppColors.supervisorAccent;
    final todayPct = team.todayPct?.round() ??
        (team.todayPlan > 0 ? ((team.todaySales / team.todayPlan) * 100).round() : 0);
    final monthPct = team.monthPct?.round() ??
        (team.monthPlan > 0 ? ((team.monthFact / team.monthPlan) * 100).round() : 0);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      children: [
        Text(
          'Команда · ${team.agentCount} привязанных агент(ов)',
          style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        SupervisorKpiHero(
          title: 'ПРОДАЖИ СЕГОДНЯ · КОМАНДА',
          sales: team.todaySales,
          plan: team.todayPlan,
          pct: todayPct,
          remaining: team.todayRemaining,
          workingDaysLeft: team.remainingWorkingDays,
          workingDaysTotal: team.workingDaysTotal,
          carryForward: team.carryForward,
          week: team.week,
          accent: accent,
        ),
        const SizedBox(height: 12),
        SupervisorKpiStatStrip(
          monthPlan: team.monthPlan,
          monthFact: team.monthFact,
          monthPct: monthPct,
          visits: team.todayVisits,
          orders: team.todayOrders,
        ),
        const SizedBox(height: 12),
        SupervisorMonthBars(days: team.days, monthTitle: tabelMonthTitle(team.month)),
        const SizedBox(height: 12),
        SupervisorAgentShareChart(
          title: 'Распределение · сегодня',
          rows: team.todayShare,
          onTapAgent: (id) {
            ref.read(supervisorKpiAgentIdProvider.notifier).state = id;
            ref.read(supervisorKpiByAgentModeProvider.notifier).state = true;
          },
        ),
        const SizedBox(height: 12),
        SupervisorAgentShareChart(
          title: 'Распределение · месяц',
          rows: team.monthShare,
          onTapAgent: (id) {
            ref.read(supervisorKpiAgentIdProvider.notifier).state = id;
            ref.read(supervisorKpiByAgentModeProvider.notifier).state = true;
          },
        ),
        if (!team.hasPlans) ...[
          const SizedBox(height: 12),
          SvCard(
            child: Text(
              'У привязанных агентов ещё нет утверждённых KPI-планов на месяц.',
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ],
        const SizedBox(height: 12),
        SvCard(
          onTap: () => context.push('/sv-kpi/route'),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.route, color: accent),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Дневной план / маршруты', style: TextStyle(fontWeight: FontWeight.w700)),
                    Text('План по рабочим дням команды', style: AppTypography.caption),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ],
    );
  }
}

class _AgentBody extends ConsumerWidget {
  final int? agentId;
  const _AgentBody({required this.agentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (agentId == null || agentId! <= 0) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 80),
          Center(child: Text('Выберите агента')),
        ],
      );
    }
    final async = ref.watch(supervisorAgentKpiProvider(agentId!));
    final teamAsync = ref.watch(supervisorTeamKpiProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.supervisorAccent)),
      error: (e, _) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [Padding(padding: const EdgeInsets.all(24), child: Text('$e'))],
      ),
      data: (kpi) {
        final fromTeam = teamAsync.valueOrNull?.agents.where((a) => a.id == agentId);
        final weekSrc = (fromTeam != null && fromTeam.isNotEmpty) ? fromTeam.first.kpi.week : kpi.week;
        return _AgentKpiDetail(
          kpi: kpi,
          week: weekSrc
              .map(
                (w) => SupervisorTeamWeekDay(
                  date: w.date,
                  weekday: w.weekday,
                  salesSum: w.salesSum,
                  planSum: w.planSum ?? 0,
                  executionPct: w.executionPct,
                ),
              )
              .toList(),
          monthDays: kpi.dailyRoute.days
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
        );
      },
    );
  }
}

class _AgentKpiDetail extends StatelessWidget {
  final AgentKpiResult kpi;
  final List<SupervisorTeamWeekDay> week;
  final List<SupervisorTeamDay> monthDays;

  const _AgentKpiDetail({
    required this.kpi,
    required this.week,
    required this.monthDays,
  });

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    final todayPct = kpiPctInt(kpi.todayExecutionPct);
    final monthPct = kpiPctInt(kpi.monthExecutionPct);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      children: [
        Text(
          '${kpi.agentName}${kpi.agentCode != null && kpi.agentCode!.isNotEmpty ? ' · ${kpi.agentCode}' : ''}',
          style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        SupervisorKpiHero(
          title: 'ПРОДАЖИ СЕГОДНЯ · АГЕНТ',
          sales: kpi.todaySalesSum,
          plan: kpi.todayPlanDaySum,
          pct: todayPct,
          remaining: kpi.todayRemainingSum,
          workingDaysLeft: kpi.dailyRoute.remainingWorkingDays,
          workingDaysTotal: kpi.dailyRoute.workingDaysTotal,
          carryForward: kpi.dailyRoute.carryForwardSum,
          week: week,
          accent: accent,
        ),
        const SizedBox(height: 12),
        SupervisorKpiStatStrip(
          monthPlan: kpi.monthPlanSum,
          monthFact: kpi.monthFactSum,
          monthPct: monthPct,
          visits: kpi.todayVisits,
          orders: kpi.todayOrdersCount,
        ),
        const SizedBox(height: 12),
        SupervisorMonthBars(days: monthDays, monthTitle: tabelMonthTitle(kpi.month)),
        if (kpi.kpiGroups.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Группы KPI', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          ...kpi.kpiGroups.map((g) {
            final pct = g.todayExecutionPct?.round() ?? g.executionPct?.round() ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SvCard(
                child: Row(
                  children: [
                    Icon(kpiMetricIcon(g.primaryMetric), color: accent),
                    const SizedBox(width: 10),
                    Expanded(child: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                    Text('$pct%', style: const TextStyle(fontWeight: FontWeight.w800, color: accent)),
                  ],
                ),
              ),
            );
          }),
        ],
        const SizedBox(height: 8),
        SvCard(
          onTap: () => context.push('/sv-kpi/route'),
          child: const Row(
            children: [
              Icon(Icons.route, color: accent),
              SizedBox(width: 12),
              Expanded(child: Text('Дневной план агента', style: TextStyle(fontWeight: FontWeight.w700))),
              Icon(Icons.chevron_right),
            ],
          ),
        ),
      ],
    );
  }
}

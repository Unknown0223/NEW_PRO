import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import 'kpi_format.dart';
import 'kpi_provider.dart';

enum _DaysFilter { past, upcoming }

/// Диагностика · Подробнее — oy davomidagi ish kunlari.
class AgentKpiDiagnosticsDaysPage extends ConsumerWidget {
  const AgentKpiDiagnosticsDaysPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(agentKpiProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Дни месяца',
        showBack: true,
        belowTitle: dataAsync.maybeWhen(
          data: (d) => Text(
            '${d.dailyRoute.workingDaysTotal} раб. дней · перенос',
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
          orElse: () => Text(
            'Детали диагностики',
            style: AppTypography.captionSmall.copyWith(color: AppColors.textSecondary),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(agentKpiProvider),
        child: dataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 80),
              AgentErrorPanel(error: e, onRetry: () => ref.invalidate(agentKpiProvider)),
            ],
          ),
          data: (data) => _DaysBody(data: data),
        ),
      ),
    );
  }
}

class _DaysBody extends StatefulWidget {
  final AgentKpiResult data;
  const _DaysBody({required this.data});

  @override
  State<_DaysBody> createState() => _DaysBodyState();
}

class _DaysBodyState extends State<_DaysBody> {
  _DaysFilter _filter = _DaysFilter.upcoming;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final route = data.dailyRoute;
    final workDays = route.days.where((d) => d.isWorkingDay).toList();
    final done = workDays.where((d) => !d.isFuture && (d.executionPct ?? 0) >= 100).length;
    final warn = workDays.where((d) => !d.isFuture && (d.executionPct ?? 0) > 0 && (d.executionPct ?? 0) < 100).length;
    final pending = workDays.where((d) => d.isFuture || ((d.executionPct ?? 0) <= 0 && !d.isToday)).length;

    final pastDays = workDays.where((d) => !d.isToday && !d.isFuture).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final upcomingDays = [
      ...workDays.where((d) => d.isToday),
      ...workDays.where((d) => d.isFuture),
    ];
    final filtered = _filter == _DaysFilter.past ? pastDays : upcomingDays;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        AgentSurfaceCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Исполнение продаж · месяц',
                style: AppTypography.headlineSmall.copyWith(fontSize: 13.5),
              ),
              const SizedBox(height: 4),
              Text(
                '${formatMoneySpaced(data.monthFactSum)} / ${formatMoneySpaced(data.monthPlanSum)} сум · '
                '${kpiPctInt(data.monthExecutionPct)}%',
                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _Stat('Выполнено', '$done', AppColors.success)),
                  Expanded(child: _Stat('Частично', '$warn', const Color(0xFFF59E0B))),
                  Expanded(child: _Stat('Ожидается', '$pending', AppColors.textPrimary)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _FilterBtn(
                      label: 'Прошлые дни',
                      count: pastDays.length,
                      selected: _filter == _DaysFilter.past,
                      onTap: () => setState(() => _filter = _DaysFilter.past),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _FilterBtn(
                      label: 'Сегодня · новые',
                      count: upcomingDays.length,
                      selected: _filter == _DaysFilter.upcoming,
                      onTap: () => setState(() => _filter = _DaysFilter.upcoming),
                    ),
                  ),
                ],
              ),
              if (route.carryForwardSum > 0) ...[
                const SizedBox(height: 10),
                Text(
                  'Перенесённый остаток (равномерно): ${formatMoneySpaced(route.carryForwardSum)} сум',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF9A4D00),
                  ),
                ),
              ],
              if (route.surplusSum > 0) ...[
                const SizedBox(height: 6),
                Text(
                  'Перевыполнение (дневной план снижается): ${formatMoneySpaced(route.surplusSum)} сум',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Text(
                'На ${route.remainingWorkingDays} дн. поровну: ${formatMoneySpaced(route.todayPlanSum)} сум/день',
                style: AppTypography.captionSmall.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (workDays.isEmpty)
          AgentSurfaceCard(
            child: Text(
              'Рабочие дни не найдены. Проверьте настройку «Рабочие дни».',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          )
        else if (filtered.isEmpty)
          AgentSurfaceCard(
            child: Text(
              _filter == _DaysFilter.past
                  ? 'Прошлых рабочих дней нет.'
                  : 'Сегодня и будущих рабочих дней нет.',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          )
        else
          ...filtered.map((d) => _DayTile(day: d)),
      ],
    );
  }
}

class _FilterBtn extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _FilterBtn({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primary : const Color(0xFFF7FAFC),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.primary : const Color(0xFFE5EDF3),
              width: 1.2,
            ),
          ),
          child: Column(
            children: [
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$count дн.',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white.withValues(alpha: 0.85) : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Stat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label.toUpperCase(),
          style: AppTypography.captionSmall.copyWith(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
          ),
        ),
        Text(
          value,
          style: AppTypography.headlineMedium.copyWith(fontSize: 15, fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }
}

class _DayTile extends StatelessWidget {
  final AgentKpiDailyRouteDay day;
  const _DayTile({required this.day});

  Color get _tone {
    switch (day.status) {
      case 'done':
      case 'over':
        return AppColors.success;
      case 'warn':
        return const Color(0xFFF59E0B);
      case 'off':
        return const Color(0xFFCBD5E1);
      default:
        return day.isToday ? AppColors.primary : const Color(0xFFCBD5E1);
    }
  }

  String get _statusIcon {
    switch (day.status) {
      case 'over':
        return '▲';
      case 'done':
        return '✓';
      case 'warn':
        return '!';
      default:
        return day.isToday ? '●' : '○';
    }
  }

  @override
  Widget build(BuildContext context) {
    final pct = kpiPctInt(day.executionPct);
    DateTime? dt;
    try {
      dt = DateTime.parse(day.date);
    } catch (_) {}
    final title = dt != null ? DateFormat('d MMMM, EEEE', 'ru').format(dt) : day.date;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  margin: const EdgeInsets.only(top: 14),
                  decoration: BoxDecoration(
                    color: _tone,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: _tone.withValues(alpha: 0.25), blurRadius: 6, spreadRadius: 4),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: day.isToday ? AppColors.primary.withValues(alpha: 0.45) : const Color(0xFFE5EDF3),
                  width: day.isToday ? 1.5 : 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700, fontSize: 13.5),
                        ),
                      ),
                      Text(_statusIcon, style: TextStyle(color: _tone, fontWeight: FontWeight.w900)),
                    ],
                  ),
                  if (day.isToday)
                    Text(
                      'Сегодня',
                      style: AppTypography.captionSmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: 10.5,
                      ),
                    ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Text('нужно: ', style: TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                      Text(
                        formatMoneySpaced(day.planSum),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(width: 10),
                      const Text('факт: ', style: TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                      Text(
                        day.isFuture && day.factSum <= 0 ? '—' : formatMoneySpaced(day.factSum),
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: _tone),
                      ),
                      const Spacer(),
                      if (!day.isFuture || day.factSum > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _tone.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '$pct%',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: _tone),
                          ),
                        ),
                    ],
                  ),
                  if (day.carryIn > 0 && day.isToday) ...[
                    const SizedBox(height: 4),
                    Text(
                      '+${formatMoneySpaced(day.carryIn)} с прошлых дней (равномерно)',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF9A4D00),
                      ),
                    ),
                  ],
                  if (day.overSum > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'перевыполнение: +${formatMoneySpaced(day.overSum)} сум',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                  if (!day.isFuture && day.planSum > 0) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (pct / 100).clamp(0.0, 1.0),
                        minHeight: 4,
                        backgroundColor: const Color(0xFFE5EDF3),
                        valueColor: AlwaysStoppedAnimation(_tone),
                      ),
                    ),
                  ],
                  if (!day.isFuture && day.remainingSum > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'осталось: ${formatMoneySpaced(day.remainingSum)} сум',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.error),
                    ),
                  ],
                  if (day.isFuture) ...[
                    const SizedBox(height: 4),
                    Text(
                      'равная доля · оставшиеся дни',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textMuted.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

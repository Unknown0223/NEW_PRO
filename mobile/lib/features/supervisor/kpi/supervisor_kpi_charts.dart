import 'package:flutter/material.dart';

import '../../../core/api/supervisor_api.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/tabel/tabel_format.dart';

const _palette = <Color>[
  Color(0xFF1FA855),
  Color(0xFF0EA5E9),
  Color(0xFFF59E0B),
  Color(0xFF8B5CF6),
  Color(0xFFEF4444),
  Color(0xFF14B8A6),
  Color(0xFFEC4899),
  Color(0xFF6366F1),
];

Color supervisorShareColor(int index) => _palette[index % _palette.length];

Color supervisorDayBarColor(String status, {required bool isToday}) {
  if (isToday) return const Color(0xFF1FA855);
  return switch (status) {
    'done' || 'over' => const Color(0xFF22C55E),
    'good' => const Color(0xFF84CC16),
    'partial' => const Color(0xFFF59E0B),
    'miss' => const Color(0xFFEF4444),
    'future' => const Color(0xFFCBD5E1),
    _ => const Color(0xFF94A3B8),
  };
}

/// Gradient hero: bugungi plan/fakt + 7 kunlik ustunlar.
class SupervisorKpiHero extends StatelessWidget {
  final String title;
  final double sales;
  final double plan;
  final int pct;
  final double remaining;
  final int workingDaysLeft;
  final int workingDaysTotal;
  final double carryForward;
  final List<SupervisorTeamWeekDay> week;
  final Color accent;

  const SupervisorKpiHero({
    super.key,
    required this.title,
    required this.sales,
    required this.plan,
    required this.pct,
    required this.remaining,
    required this.workingDaysLeft,
    required this.workingDaysTotal,
    required this.carryForward,
    required this.week,
    this.accent = AppColors.supervisorAccent,
  });

  static const _wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  @override
  Widget build(BuildContext context) {
    final maxBar = week.fold<double>(0, (m, w) => w.salesSum > m ? w.salesSum : m);
    final avg = week.isEmpty ? 0.0 : week.fold<double>(0, (s, w) => s + w.salesSum) / week.length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent, Color.lerp(accent, const Color(0xFF064E3B), 0.55)!],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: accent.withValues(alpha: 0.28), blurRadius: 28, offset: const Offset(0, 12)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              letterSpacing: 0.5,
              fontWeight: FontWeight.w800,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${formatMoneySpaced(sales)} сум',
                      style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, height: 1.15),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'план: ${formatMoneySpaced(plan)} · остаток ${formatMoneySpaced(remaining)}',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    if (workingDaysTotal > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'раб. дни: $workingDaysLeft / $workingDaysTotal',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    if (carryForward > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Text(
                          'перенос: ${formatMoneySpaced(carryForward)}',
                          style: const TextStyle(color: Color(0xFFFEF08A), fontSize: 12.5, fontWeight: FontWeight.w900),
                        ),
                      ),
                  ],
                ),
              ),
              SizedBox(
                width: 70,
                height: 70,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CircularProgressIndicator(
                      value: 1,
                      strokeWidth: 9,
                      backgroundColor: Colors.white.withValues(alpha: 0.18),
                      valueColor: const AlwaysStoppedAnimation(Colors.transparent),
                    ),
                    CircularProgressIndicator(
                      value: (pct / 100).clamp(0.0, 1.0),
                      strokeWidth: 9,
                      strokeCap: StrokeCap.round,
                      backgroundColor: Colors.transparent,
                      valueColor: const AlwaysStoppedAnimation(Colors.white),
                    ),
                    Text('$pct%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17)),
                  ],
                ),
              ),
            ],
          ),
          if (week.isNotEmpty) ...[
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
                        '7 ДНЕЙ · ПРОДАЖИ',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 10.5, fontWeight: FontWeight.w800),
                      ),
                      const Spacer(),
                      Text(
                        '∅ ${tabelCompactSum(avg)}',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 10.5, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 64,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (var i = 0; i < week.length; i++) ...[
                          if (i > 0) const SizedBox(width: 4),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Expanded(
                                  child: Align(
                                    alignment: Alignment.bottomCenter,
                                    child: Container(
                                      width: double.infinity,
                                      height: maxBar <= 0
                                          ? 4
                                          : (4 + (week[i].salesSum / maxBar) * 44).clamp(4.0, 48.0),
                                      decoration: BoxDecoration(
                                        color: i == week.length - 1
                                            ? Colors.white
                                            : Colors.white.withValues(alpha: 0.45 + 0.08 * (i % 3)),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _wd[((week[i].weekday - 1) % 7).clamp(0, 6)],
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.85),
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Oylik plan/fakt kunlik ustunlar.
class SupervisorMonthBars extends StatelessWidget {
  final List<SupervisorTeamDay> days;
  final String monthTitle;

  const SupervisorMonthBars({super.key, required this.days, required this.monthTitle});

  @override
  Widget build(BuildContext context) {
    final visible = days.where((d) => d.isWorkingDay || d.factSum > 0 || d.planSum > 0).toList();
    final sample = visible.length > 16
        ? visible.where((d) => !d.isFuture || d.isToday).take(16).toList()
        : visible.take(16).toList();
    final maxV = sample.fold<double>(0, (m, d) {
      final v = d.factSum > d.planSum ? d.factSum : d.planSum;
      return v > m ? v : m;
    });

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Месяц · $monthTitle', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 4),
          Text('План / факт по дням', style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 12),
          if (sample.isEmpty)
            Text('Нет данных за месяц', style: AppTypography.caption.copyWith(color: AppColors.textMuted))
          else
            SizedBox(
              height: 120,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < sample.length; i++) ...[
                    if (i > 0) const SizedBox(width: 3),
                    Expanded(
                      child: _DayTwinBar(day: sample[i], maxV: maxV),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              _legendDot(const Color(0xFF94A3B8), 'План'),
              const SizedBox(width: 12),
              _legendDot(AppColors.supervisorAccent, 'Факт'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color c, String t) => Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 4),
          Text(t, style: AppTypography.caption.copyWith(fontSize: 11)),
        ],
      );
}

class _DayTwinBar extends StatelessWidget {
  final SupervisorTeamDay day;
  final double maxV;
  const _DayTwinBar({required this.day, required this.maxV});

  @override
  Widget build(BuildContext context) {
    final planH = maxV <= 0 ? 4.0 : (4 + (day.planSum / maxV) * 88).clamp(4.0, 92.0);
    final factH = maxV <= 0 ? 4.0 : (4 + (day.factSum / maxV) * 88).clamp(4.0, 92.0);
    final dayNum = day.date.length >= 10 ? day.date.substring(8, 10) : day.date;
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Container(
                  height: planH,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(width: 1),
              Expanded(
                child: Container(
                  height: factH,
                  decoration: BoxDecoration(
                    color: supervisorDayBarColor(day.status, isToday: day.isToday),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          dayNum,
          style: TextStyle(
            fontSize: 9,
            fontWeight: day.isToday ? FontWeight.w900 : FontWeight.w600,
            color: day.isToday ? AppColors.supervisorAccent : AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

/// Agentlar bo‘yicha ulush (rangli horizontal bars).
class SupervisorAgentShareChart extends StatelessWidget {
  final String title;
  final List<SupervisorAgentShare> rows;
  final ValueChanged<int>? onTapAgent;

  const SupervisorAgentShareChart({
    super.key,
    required this.title,
    required this.rows,
    this.onTapAgent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 4),
          Text('Доля продаж по агентам', style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            Text('Нет продаж у привязанных агентов', style: AppTypography.caption.copyWith(color: AppColors.textMuted))
          else
            ...rows.asMap().entries.map((e) {
              final i = e.key;
              final r = e.value;
              final color = supervisorShareColor(i);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InkWell(
                  onTap: onTapAgent == null ? null : () => onTapAgent!(r.id),
                  borderRadius: BorderRadius.circular(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              r.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                          ),
                          Text(
                            '${r.sharePct.toStringAsFixed(0)}%',
                            style: TextStyle(fontWeight: FontWeight.w900, color: color),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: (r.sharePct / 100).clamp(0.0, 1.0),
                          minHeight: 8,
                          backgroundColor: color.withValues(alpha: 0.12),
                          valueColor: AlwaysStoppedAnimation(color),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${formatMoneySpaced(r.salesSum)} / план ${formatMoneySpaced(r.planSum)}'
                        '${r.executionPct != null ? ' · ${r.executionPct!.round()}%' : ''}',
                        style: AppTypography.caption.copyWith(fontSize: 11),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

/// Oy / kun KPI qisqa kartochkalar.
class SupervisorKpiStatStrip extends StatelessWidget {
  final double monthPlan;
  final double monthFact;
  final int monthPct;
  final int visits;
  final int orders;

  const SupervisorKpiStatStrip({
    super.key,
    required this.monthPlan,
    required this.monthFact,
    required this.monthPct,
    required this.visits,
    required this.orders,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _chip('Месяц факт', formatMoneySpaced(monthFact), const Color(0xFF0EA5E9))),
        const SizedBox(width: 8),
        Expanded(child: _chip('Вып. месяца', '$monthPct%', const Color(0xFF8B5CF6))),
        const SizedBox(width: 8),
        Expanded(child: _chip('Визиты', '$visits', const Color(0xFFF59E0B))),
        const SizedBox(width: 8),
        Expanded(child: _chip('Заказы', '$orders', const Color(0xFFEF4444))),
      ],
    );
  }

  Widget _chip(String label, String value, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w900, color: c, fontSize: 12)),
            const SizedBox(height: 2),
            Text(label, textAlign: TextAlign.center, style: AppTypography.caption.copyWith(fontSize: 10)),
          ],
        ),
      );
}

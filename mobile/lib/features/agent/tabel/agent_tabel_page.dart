import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import 'agent_tabel_day_sheet.dart';
import 'agent_tabel_detail_page.dart';
import 'tabel_format.dart';
import 'tabel_provider.dart';
import 'tabel_status.dart';

/// «Табель» — agent oylik davomat kalendari (web timesheet bilan bir xil statuslar).
class AgentTabelPage extends ConsumerWidget {
  const AgentTabelPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final month = ref.watch(tabelMonthProvider);
    final dataAsync = ref.watch(tabelDataProvider);
    final session = ref.watch(sessionProvider);
    final fallbackName = session.user?.name ?? '';
    final fallbackCode = session.user?.code ?? session.user?.login ?? '';

    final subtitle = dataAsync.maybeWhen(
      data: (d) => _employeeLine(d.employee.fio, d.employee.code ?? d.employee.login),
      orElse: () => _employeeLine(fallbackName, fallbackCode),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Табель · ${tabelMonthTitle(month)}',
        showBack: true,
        belowTitle: _MonthSwitcher(
          month: month,
          subtitle: subtitle,
          onPrev: () => ref.read(tabelMonthProvider.notifier).state =
              tabelPrevMonth(month),
          onNext: () => ref.read(tabelMonthProvider.notifier).state =
              tabelNextMonth(month),
        ),
        actions: [
          AgentIconButton(
            icon: Icons.table_rows_outlined,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AgentTabelDetailPage()),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(tabelDataProvider),
        child: dataAsync.when(
          data: (data) => _content(context, data, month),
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (e, _) => AgentErrorPanel(
            error: e,
            onRetry: () => ref.invalidate(tabelDataProvider),
          ),
        ),
      ),
    );
  }

  String _employeeLine(String fio, String code) {
    final f = fio.trim();
    final c = code.trim();
    if (f.isEmpty && c.isEmpty) return '';
    if (c.isEmpty) return f;
    if (f.isEmpty) return c;
    return '$f · $c';
  }

  Widget _content(BuildContext context, AgentTimesheetResult data, String month) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        _SummaryCard(data: data, month: month),
        const SizedBox(height: 12),
        _CalendarCard(data: data),
        const SizedBox(height: 12),
        const _LegendCard(),
        const SizedBox(height: 12),
        _RecentDaysCard(data: data),
        const SizedBox(height: 12),
        AgentSecondaryButton(
          label: 'Батафсил жадвал',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const AgentTabelDetailPage()),
          ),
        ),
      ],
    );
  }
}

class _MonthSwitcher extends StatelessWidget {
  final String month;
  final String subtitle;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  const _MonthSwitcher({
    required this.month,
    required this.subtitle,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        _stepBtn(Icons.chevron_left, onPrev),
        const SizedBox(width: 6),
        _stepBtn(Icons.chevron_right, onNext),
      ],
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback onTap) {
    return Material(
      color: AppColors.surfaceMuted,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(icon, size: 20, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final AgentTimesheetResult data;
  final String month;
  const _SummaryCard({required this.data, required this.month});

  @override
  Widget build(BuildContext context) {
    final today = serverTodayKey();
    final counts = tabelCountUpToToday(
      data.days.map((d) => (date: d.date, status: d.status)),
      today,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B2538), Color(0xFF0F4544)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${tabelMonthTitle(month)} · Итого',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            tabelFmtTotal(counts.workedTotal),
            style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _stat('${counts.worked}', 'Работал'),
              _stat('${counts.absent}', 'Отсутствовал'),
              _stat('${counts.holiday}', 'Выходной'),
              _stat('${counts.halfDay}', 'Полдня'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _stat('${counts.vacation}', 'Отпуск'),
              _stat('${counts.sick}', 'Больничный'),
              _stat('${counts.trip}', 'Командировка'),
              const Expanded(child: SizedBox.shrink()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _CalendarCard extends StatelessWidget {
  final AgentTimesheetResult data;
  const _CalendarCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final today = serverTodayKey();
    final days = data.days;
    final leading = days.isEmpty ? 0 : (days.first.weekday - 1);

    final cells = <Widget>[];
    for (var i = 0; i < leading; i++) {
      cells.add(const SizedBox.shrink());
    }
    for (final d in days) {
      cells.add(
        _dayCell(
          context,
          d,
          today: today,
          employee: data.employee,
          locked: data.locked,
        ),
      );
    }

    return AgentSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Календарь',
            style: AppTypography.headlineSmall
                .copyWith(fontWeight: FontWeight.w900, fontSize: 17),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (final w in tabelWeekdayShort)
                Expanded(
                  child: Text(
                    w,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 5,
            crossAxisSpacing: 5,
            childAspectRatio: 0.88,
            children: cells,
          ),
        ],
      ),
    );
  }

  Widget _dayCell(
    BuildContext context,
    AgentTimesheetDay d, {
    required String today,
    required AgentTimesheetEmployee employee,
    required bool locked,
  }) {
    final isToday = d.date == today;
    final isFuture = d.date.compareTo(today) > 0;

    final Widget body;
    // Web: kelajakdagi (qo'yilmagan) kunlar — nuqta «·».
    if (isFuture) {
      body = Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${d.day}',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Color(0xFF94A3B8),
              ),
            ),
            const Text(
              '·',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: Color(0xFF94A3B8),
                height: 1,
              ),
            ),
          ],
        ),
      );
    } else {
      final meta = tabelStatusMeta(d.status);
      final hasComment = (d.comment ?? '').trim().isNotEmpty ||
          d.history.any((h) => (h.comment ?? '').trim().isNotEmpty);
      body = Container(
        decoration: BoxDecoration(
          color: meta.bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isToday ? AppColors.primary : Colors.transparent,
            width: isToday ? 2 : 1,
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${d.day}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: meta.color,
                      height: 1.05,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    meta.short,
                    style: TextStyle(
                      fontSize: meta.short == '0.5' ? 10 : 12,
                      fontWeight: FontWeight.w900,
                      color: meta.color,
                      height: 1,
                    ),
                  ),
                ],
              ),
            ),
            if (hasComment)
              Positioned(
                right: 4,
                top: 4,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: meta.color,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => showAgentTabelDaySheet(
          context,
          day: d,
          employee: employee,
          locked: locked,
        ),
        borderRadius: BorderRadius.circular(8),
        child: body,
      ),
    );
  }
}

class _LegendCard extends StatelessWidget {
  const _LegendCard();

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Легенда',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 10,
            children: [
              for (final s in tabelAttendanceStatuses)
                _legendChip(tabelStatusMeta(s)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendChip(TabelStatusMeta meta) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: meta.bg,
            borderRadius: BorderRadius.circular(7),
            border: Border.all(color: meta.color.withValues(alpha: 0.45)),
          ),
          child: Text(
            meta.short,
            style: TextStyle(
              fontSize: meta.short == '0.5' ? 10 : 13,
              fontWeight: FontWeight.w900,
              color: meta.color,
            ),
          ),
        ),
        const SizedBox(width: 7),
        Text(
          meta.label,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _RecentDaysCard extends StatelessWidget {
  final AgentTimesheetResult data;
  const _RecentDaysCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final today = serverTodayKey();
    final past = data.days.where((d) => d.date.compareTo(today) <= 0).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final recent = past.take(5).toList();

    return AgentSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Охирги кунлар',
            style: AppTypography.headlineSmall
                .copyWith(fontWeight: FontWeight.w900, fontSize: 17),
          ),
          const SizedBox(height: 10),
          if (recent.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Маълумот йўқ',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMuted,
                ),
              ),
            )
          else
            for (var i = 0; i < recent.length; i++)
              _recentRow(
                context,
                recent[i],
                last: i == recent.length - 1,
              ),
        ],
      ),
    );
  }

  Widget _recentRow(
    BuildContext context,
    AgentTimesheetDay d, {
    required bool last,
  }) {
    final meta = tabelStatusMeta(d.status);
    final note = _note(d, meta);
    final hasComment = (d.comment ?? '').trim().isNotEmpty ||
        d.history.any((h) => (h.comment ?? '').trim().isNotEmpty);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => showAgentTabelDaySheet(
          context,
          day: d,
          employee: data.employee,
          locked: data.locked,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            border: last
                ? null
                : const Border(bottom: BorderSide(color: Color(0xFFEEF2F6))),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 58,
                child: Text(
                  tabelDayShort(d.date),
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: meta.bg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${meta.short} · ${meta.label}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: meta.color,
                  ),
                ),
              ),
              if (hasComment) ...[
                const SizedBox(width: 5),
                Icon(Icons.chat_bubble_outline, size: 14, color: meta.color),
              ],
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  note,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _note(AgentTimesheetDay d, TabelStatusMeta meta) {
    final comment = (d.comment ?? '').trim();
    if (comment.isNotEmpty) return comment;
    if (meta.backend == 'worked' || meta.backend == 'half_day') {
      final parts = <String>[];
      if (d.visits > 0) parts.add('${d.visits} точек');
      if (d.sales != 0) parts.add('${tabelCompactSum(d.sales)} сум');
      if (parts.isEmpty) return meta.label;
      return parts.join(' · ');
    }
    return meta.label;
  }
}

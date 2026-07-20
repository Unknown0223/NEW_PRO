import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import 'agent_tabel_day_sheet.dart';
import 'tabel_format.dart';
import 'tabel_provider.dart';
import 'tabel_status.dart';

/// «Табель · Detail» — web statuslari bo'yicha filter + kunlik jadval.
class AgentTabelDetailPage extends ConsumerStatefulWidget {
  const AgentTabelDetailPage({super.key});

  @override
  ConsumerState<AgentTabelDetailPage> createState() =>
      _AgentTabelDetailPageState();
}

class _AgentTabelDetailPageState extends ConsumerState<AgentTabelDetailPage> {
  String? _filter; // null = Ҳаммаси, aks holda backend status

  @override
  Widget build(BuildContext context) {
    final month = ref.watch(tabelMonthProvider);
    final dataAsync = ref.watch(tabelDataProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Табель · Detail',
        showBack: true,
        belowTitle: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            tabelMonthTitle(month),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(tabelDataProvider),
        child: dataAsync.when(
          data: (data) => _content(data),
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

  Widget _content(AgentTimesheetResult data) {
    final today = serverTodayKey();
    final counts = tabelCountUpToToday(
      data.days.map((d) => (date: d.date, status: d.status)),
      today,
    );
    // Faqat bugungacha — kelajak kunlar webdagi kabi nuqta, jadvalda yo'q.
    final rows = data.days.where((d) => d.date.compareTo(today) <= 0).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final filtered = _filter == null
        ? rows
        : rows.where((d) => d.status == _filter).toList();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
      children: [
        _summaryCards(counts),
        const SizedBox(height: 12),
        _filterChips(),
        const SizedBox(height: 12),
        _table(data, filtered),
        const SizedBox(height: 12),
        _totals(data, counts),
      ],
    );
  }

  Widget _summaryCards(TabelDayCounts counts) {
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 6,
      crossAxisSpacing: 6,
      childAspectRatio: 0.95,
      children: [
        for (final s in tabelAttendanceStatuses)
          _summaryCell(tabelStatusMeta(s), counts.countFor(s)),
      ],
    );
  }

  Widget _summaryCell(TabelStatusMeta meta, int count) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        color: meta.bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: meta.color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            meta.short,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: meta.color,
            ),
          ),
          Text(
            meta.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w600,
              color: meta.color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _chip(
            label: 'Ҳаммаси',
            selected: _filter == null,
            onTap: () => setState(() => _filter = null),
          ),
          for (final s in tabelAttendanceStatuses) ...[
            const SizedBox(width: 6),
            _chipStatus(tabelStatusMeta(s)),
          ],
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    TabelStatusMeta? meta,
  }) {
    final Color bg;
    final Color fg;
    final Color border;
    if (selected && meta != null) {
      bg = meta.bg;
      fg = meta.color;
      border = meta.color;
    } else if (selected) {
      bg = AppColors.primary;
      fg = Colors.white;
      border = AppColors.primary;
    } else {
      bg = const Color(0xFFF7FAFC);
      fg = AppColors.textSecondary;
      border = const Color(0xFFE5EDF3);
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: 11),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: border,
              width: selected && meta != null ? 1.5 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: Row(
            children: [
              if (meta != null) ...[
                Text(
                  meta.short,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: fg,
                  ),
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chipStatus(TabelStatusMeta meta) {
    return _chip(
      label: meta.label,
      selected: _filter == meta.backend,
      onTap: () => setState(() => _filter = meta.backend),
      meta: meta,
    );
  }

  Widget _table(AgentTimesheetResult data, List<AgentTimesheetDay> rows) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFEEF2F6))),
            ),
            child: const Row(
              children: [
                Expanded(child: _HeaderText('Кун')),
                SizedBox(
                  width: 66,
                  child: _HeaderText('Савдо', alignRight: true),
                ),
                SizedBox(
                  width: 58,
                  child: _HeaderText('Ташриф', alignRight: true),
                ),
                SizedBox(
                  width: 56,
                  child: _HeaderText('Соат', alignRight: true),
                ),
              ],
            ),
          ),
          if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 22),
              child: Center(
                child: Text(
                  'Ушбу фильтр бўйича кунлар йўқ',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textMuted),
                ),
              ),
            )
          else
            for (var i = 0; i < rows.length; i++)
              _row(
                data,
                rows[i],
                last: i == rows.length - 1,
              ),
        ],
      ),
    );
  }

  Widget _row(
    AgentTimesheetResult data,
    AgentTimesheetDay d, {
    required bool last,
  }) {
    final meta = tabelStatusMeta(d.status);
    final weekday = tabelWeekdayShort[(d.weekday - 1).clamp(0, 6)];
    final isAbsent = meta.backend == 'absent';
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isAbsent ? const Color(0xFFF8FAFC) : Colors.transparent,
            border: last
                ? null
                : const Border(bottom: BorderSide(color: Color(0xFFF1F4F7))),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: meta.bg,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        meta.short,
                        style: TextStyle(
                          fontSize: meta.short == '0.5' ? 9 : 11,
                          fontWeight: FontWeight.w800,
                          color: meta.color,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  '${tabelDayShort(d.date)} · $weekday',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              if (hasComment) ...[
                                const SizedBox(width: 4),
                                Icon(
                                  Icons.chat_bubble_outline,
                                  size: 12,
                                  color: meta.color,
                                ),
                              ],
                            ],
                          ),
                          Text(
                            meta.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9.5,
                              color: meta.color,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 66,
                child: Text(
                  d.sales == 0 ? '0' : tabelCompactSum(d.sales),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color:
                        d.sales == 0 ? AppColors.textMuted : AppColors.textPrimary,
                  ),
                ),
              ),
              SizedBox(
                width: 58,
                child: Text(
                  '${d.visits}',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: d.visits == 0
                        ? AppColors.textMuted
                        : AppColors.textPrimary,
                  ),
                ),
              ),
              SizedBox(
                width: 56,
                child: Text(
                  tabelHours(d.workedMinutes),
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _totals(AgentTimesheetResult data, TabelDayCounts counts) {
    final t = data.totals;
    return AgentSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Умумий · ойлик',
            style: AppTypography.headlineSmall
                .copyWith(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            'Итого: ${tabelFmtTotal(counts.workedTotal)}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _totalCell('Савдо', tabelCompactSum(t.salesTotal)),
              _totalCell('Ташриф', '${t.visitsTotal}'),
              _totalCell('Соат', tabelHoursTotal(t.workedMinutesTotal)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _totalCell(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderText extends StatelessWidget {
  final String text;
  final bool alignRight;
  const _HeaderText(this.text, {this.alignRight = false});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: alignRight ? TextAlign.right : TextAlign.left,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.4,
        color: AppColors.textMuted,
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import 'tabel_format.dart';
import 'tabel_status.dart';

/// Web TimesheetCellModal (view) — kun tafsilotlari + kommentariya + tarix.
Future<void> showAgentTabelDaySheet(
  BuildContext context, {
  required AgentTimesheetDay day,
  required AgentTimesheetEmployee employee,
  required bool locked,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final h = MediaQuery.sizeOf(ctx).height * 0.78;
      return Container(
        height: h,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: AgentSheetHandle(),
            ),
            Expanded(
              child: _TabelDaySheetBody(
                day: day,
                employee: employee,
                locked: locked,
              ),
            ),
          ],
        ),
      );
    },
  );
}

class _TabelDaySheetBody extends StatelessWidget {
  final AgentTimesheetDay day;
  final AgentTimesheetEmployee employee;
  final bool locked;

  const _TabelDaySheetBody({
    required this.day,
    required this.employee,
    required this.locked,
  });

  @override
  Widget build(BuildContext context) {
    final today = serverTodayKey();
    final isFuture = day.date.compareTo(today) > 0;
    final meta = tabelStatusMeta(day.status);
    final weekday = tabelWeekdayShort[(day.weekday - 1).clamp(0, 6)];
    final comment = _latestComment(day);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      children: [
        const Text(
          'Запись табеля',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${tabelDayShort(day.date)} · $weekday · ${day.date}',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
          ),
        ),
        const SizedBox(height: 14),
        _employeeRow(employee, day.source),
        const SizedBox(height: 14),
        if (isFuture) ...[
          _infoBanner(
            icon: Icons.schedule_rounded,
            text: 'Будущая дата — статус ещё не проставлен (·).',
            tone: const Color(0xFF64748B),
            bg: const Color(0xFFF1F5F9),
          ),
          const SizedBox(height: 12),
        ] else ...[
          _statusCard(meta),
          const SizedBox(height: 12),
          _metricsRow(day),
          const SizedBox(height: 12),
        ],
        if (locked)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _infoBanner(
              icon: Icons.lock_outline_rounded,
              text: 'Период заблокирован (payroll lock).',
              tone: const Color(0xFFB45309),
              bg: const Color(0xFFFFFBEB),
            ),
          ),
        _sectionTitle('Комментарий'),
        const SizedBox(height: 6),
        if (comment == null || comment.isEmpty)
          const Text(
            'Комментария нет',
            style: TextStyle(
              fontSize: 12.5,
              fontStyle: FontStyle.italic,
              color: AppColors.textMuted,
            ),
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Text(
              '«$comment»',
              style: const TextStyle(
                fontSize: 13,
                height: 1.35,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        const SizedBox(height: 16),
        _sectionTitle('История изменений'),
        const SizedBox(height: 8),
        if (day.history.isEmpty)
          Text(
            'Изменений нет — источник: ${tabelSourceLabel(day.source)}.',
            style: const TextStyle(
              fontSize: 12.5,
              fontStyle: FontStyle.italic,
              color: AppColors.textMuted,
            ),
          )
        else
          for (final h in day.history) _historyItem(h),
        const SizedBox(height: 8),
        AgentSecondaryButton(
          label: 'Ёпиш',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ],
    );
  }

  String? _latestComment(AgentTimesheetDay d) {
    final c = d.comment?.trim();
    if (c != null && c.isNotEmpty) return c;
    for (final h in d.history) {
      final hc = h.comment?.trim();
      if (hc != null && hc.isNotEmpty) return hc;
    }
    return null;
  }

  Widget _employeeRow(AgentTimesheetEmployee e, String source) {
    final initials = _initials(e.fio.isNotEmpty ? e.fio : e.login);
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Text(
            initials,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                e.fio.isNotEmpty ? e.fio : e.login,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '${e.role} · ${e.code ?? e.login}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(tabelSourceIcon(source), size: 13, color: AppColors.textMuted),
              const SizedBox(width: 4),
              Text(
                tabelSourceLabel(source),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _statusCard(TabelStatusMeta meta) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: meta.bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: meta.color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: meta.color,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              meta.short,
              style: TextStyle(
                fontSize: meta.short == '0.5' ? 11 : 14,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Статус',
                  style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                ),
                Text(
                  meta.label,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: meta.color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricsRow(AgentTimesheetDay d) {
    return Row(
      children: [
        _metric('Савдо', d.sales == 0 ? '0' : tabelCompactSum(d.sales)),
        const SizedBox(width: 8),
        _metric('Ташриф', '${d.visits}'),
        const SizedBox(width: 8),
        _metric('Соат', tabelHours(d.workedMinutes)),
      ],
    );
  }

  Widget _metric(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEF2F6)),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _historyItem(AgentTimesheetDayHistory h) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 10,
            height: 10,
            decoration: const BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: h.oldValue ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const TextSpan(
                        text: ' → ',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                      TextSpan(
                        text: h.newValue ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  style: const TextStyle(fontSize: 12.5),
                ),
                Text(
                  '${h.changedBy} · ${_fmtAt(h.changedAt)}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
                if ((h.comment ?? '').trim().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '«${h.comment!.trim()}»',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoBanner({
    required IconData icon,
    required String text,
    required Color tone,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: tone),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: tone,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String t) {
    return Text(
      t.toUpperCase(),
      style: const TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.6,
        color: AppColors.textMuted,
      ),
    );
  }

  String _initials(String fio) {
    final parts = fio.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty);
    return parts.take(2).map((e) => e[0].toUpperCase()).join();
  }

  String _fmtAt(String iso) {
    final wr = toWorkRegionFromIso(iso);
    if (wr == null) return iso;
    final dd = wr.day.toString().padLeft(2, '0');
    final mm = wr.month.toString().padLeft(2, '0');
    final hh = wr.hour.toString().padLeft(2, '0');
    final mi = wr.minute.toString().padLeft(2, '0');
    return '$dd.$mm.${wr.year} $hh:$mi';
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';

/// Sana oralig'i (UTC instant chegaralari) + ko'rsatiladigan yorliq.
class HistoryDateRange {
  final DateTime? fromUtc;
  final DateTime? toUtc;
  final String label;

  const HistoryDateRange({this.fromUtc, this.toUtc, this.label = 'Выбрать'});

  String? get fromIso => fromUtc?.toIso8601String();
  String? get toIso => toUtc?.toIso8601String();

  String get rangeText {
    if (fromUtc == null && toUtc == null) return 'Все время';
    final f = fromUtc == null
        ? '...'
        : DateFormat('dd.MM.yyyy').format(workRegionNow(fromUtc));
    final t = toUtc == null
        ? '...'
        : DateFormat('dd.MM.yyyy').format(workRegionNow(toUtc));
    return '$f - $t';
  }
}

const _off = Duration(hours: kWorkRegionUtcOffsetHours);

DateTime _dayStartUtc(DateTime wrWall) =>
    DateTime.utc(wrWall.year, wrWall.month, wrWall.day).subtract(_off);

DateTime _dayEndUtc(DateTime wrWall) =>
    DateTime.utc(wrWall.year, wrWall.month, wrWall.day, 23, 59, 59)
        .subtract(_off);

/// «Диапазон дата» presetlari — ish-mintaqa (server) vaqtiga tayanadi.
enum HistoryPreset {
  today('Сегодня'),
  yesterday('Вчера'),
  thisWeek('На этой неделе'),
  lastWeek('Прошлая неделя'),
  thisMonth('В этом месяце'),
  lastMonth('Прошлый месяц'),
  last3Months('Прошлое 3 месяца'),
  last6Months('Прошлое 6 месяцев');

  final String label;
  const HistoryPreset(this.label);

  HistoryDateRange resolve() {
    final now = workRegionNow();
    switch (this) {
      case HistoryPreset.today:
        return HistoryDateRange(
            fromUtc: _dayStartUtc(now), toUtc: _dayEndUtc(now), label: label,);
      case HistoryPreset.yesterday:
        final y = now.subtract(const Duration(days: 1));
        return HistoryDateRange(
            fromUtc: _dayStartUtc(y), toUtc: _dayEndUtc(y), label: label,);
      case HistoryPreset.thisWeek:
        final start = now.subtract(Duration(days: now.weekday - 1));
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(now),
            label: label,);
      case HistoryPreset.lastWeek:
        final start =
            now.subtract(Duration(days: now.weekday - 1 + 7));
        final end = start.add(const Duration(days: 6));
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(end),
            label: label,);
      case HistoryPreset.thisMonth:
        final start = DateTime.utc(now.year, now.month, 1);
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(now),
            label: label,);
      case HistoryPreset.lastMonth:
        final start = DateTime.utc(now.year, now.month - 1, 1);
        final end = DateTime.utc(now.year, now.month, 0); // prev month last day
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(end),
            label: label,);
      case HistoryPreset.last3Months:
        final start = DateTime.utc(now.year, now.month - 3, now.day);
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(now),
            label: label,);
      case HistoryPreset.last6Months:
        final start = DateTime.utc(now.year, now.month - 6, now.day);
        return HistoryDateRange(
            fromUtc: _dayStartUtc(start),
            toUtc: _dayEndUtc(now),
            label: label,);
    }
  }
}

/// «Диапазон дата» — preset tanlash sheeti.
Future<HistoryDateRange?> showHistoryPresetSheet(
  BuildContext context, {
  HistoryPreset? current,
}) {
  return showModalBottomSheet<HistoryDateRange>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => _PresetSheet(current: current),
  );
}

class _PresetSheet extends StatefulWidget {
  final HistoryPreset? current;
  const _PresetSheet({this.current});

  @override
  State<_PresetSheet> createState() => _PresetSheetState();
}

class _PresetSheetState extends State<_PresetSheet> {
  HistoryPreset? _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.current;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AgentSheetHandle(),
            const SizedBox(height: 6),
            const Center(
              child: Text('Диапазон дата',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
            ),
            const SizedBox(height: 8),
            for (final p in HistoryPreset.values)
              RadioListTile<HistoryPreset>(
                value: p,
                groupValue: _selected,
                onChanged: (v) => setState(() => _selected = v),
                activeColor: AppColors.expeditorAccent,
                dense: true,
                title: Text(p.label),
              ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.surfaceVariant,
                        foregroundColor: AppColors.textSecondary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Отмена',
                          style: TextStyle(fontWeight: FontWeight.w700),),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.expeditorAccent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: _selected == null
                          ? null
                          : () => Navigator.pop(context, _selected!.resolve()),
                      child: const Text('Применить',
                          style: TextStyle(fontWeight: FontWeight.w700),),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _ruMonthsNom = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const _ruWeekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/// Kalendar orqali ixtiyoriy oraliq tanlash («Выберите дату» — dizayn uslubi).
Future<HistoryDateRange?> pickHistoryDateRange(
  BuildContext context, {
  HistoryDateRange? current,
}) async {
  final nowWr = workRegionNow();
  final initialStart = current?.fromUtc != null
      ? workRegionNow(current!.fromUtc)
      : DateTime(nowWr.year, nowWr.month, 1);
  final initialEnd =
      current?.toUtc != null ? workRegionNow(current!.toUtc) : nowWr;

  final picked = await showDialog<DateTimeRange>(
    context: context,
    barrierColor: Colors.black54,
    builder: (_) => _RangeCalendarDialog(
      initialStart:
          DateTime(initialStart.year, initialStart.month, initialStart.day),
      initialEnd: DateTime(initialEnd.year, initialEnd.month, initialEnd.day),
    ),
  );
  if (picked == null) return null;
  return HistoryDateRange(
    fromUtc: _dayStartUtc(picked.start),
    toUtc: _dayEndUtc(picked.end),
    label: 'Выбрать',
  );
}

class _RangeCalendarDialog extends StatefulWidget {
  final DateTime initialStart;
  final DateTime initialEnd;
  const _RangeCalendarDialog({
    required this.initialStart,
    required this.initialEnd,
  });

  @override
  State<_RangeCalendarDialog> createState() => _RangeCalendarDialogState();
}

class _RangeCalendarDialogState extends State<_RangeCalendarDialog> {
  late DateTime _start = widget.initialStart;
  late DateTime? _end = widget.initialEnd;
  late DateTime _visible =
      DateTime(widget.initialStart.year, widget.initialStart.month);

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  void _onTap(DateTime day) {
    setState(() {
      if (_end != null) {
        _start = day;
        _end = null;
      } else if (day.isBefore(_start)) {
        _end = _start;
        _start = day;
      } else {
        _end = day;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd.MM.yyyy');
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Teal sarlavha
            Container(
              width: double.infinity,
              color: AppColors.expeditorAccent,
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Выберите дату',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,),),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12,),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Text(fmt.format(_start),
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,),),
                        const Expanded(
                          child: Icon(Icons.arrow_forward,
                              color: Colors.white70, size: 18,),
                        ),
                        Text(_end != null ? fmt.format(_end!) : '—',
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,),),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Oq kalendar
            Container(
              color: AppColors.surface,
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.chevron_left),
                        onPressed: () => setState(() => _visible = DateTime(
                            _visible.year, _visible.month - 1,),),
                      ),
                      Expanded(
                        child: Text(
                          '${_ruMonthsNom[_visible.month - 1]} ${_visible.year}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w800,),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.chevron_right),
                        onPressed: () => setState(() => _visible = DateTime(
                            _visible.year, _visible.month + 1,),),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      for (final w in _ruWeekdays)
                        Expanded(
                          child: Center(
                            child: Text(w,
                                style: AppTypography.caption.copyWith(
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600,),),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ..._weeks(),
                ],
              ),
            ),
            // Tugmalar
            Container(
              color: AppColors.surface,
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  FilledButton.tonal(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.surfaceVariant,
                      foregroundColor: AppColors.textSecondary,
                    ),
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Отмена',
                        style: TextStyle(fontWeight: FontWeight.w700),),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: AppColors.expeditorAccent,),
                    onPressed: () => Navigator.pop(
                      context,
                      DateTimeRange(start: _start, end: _end ?? _start),
                    ),
                    child: const Text('Сохранить',
                        style: TextStyle(fontWeight: FontWeight.w700),),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _weeks() {
    final daysInMonth = DateTime(_visible.year, _visible.month + 1, 0).day;
    final firstWeekday = DateTime(_visible.year, _visible.month, 1).weekday;
    final cells = <DateTime?>[];
    for (var i = 1; i < firstWeekday; i++) {
      cells.add(null);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.add(DateTime(_visible.year, _visible.month, d));
    }
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final weeks = <Widget>[];
    for (var i = 0; i < cells.length; i += 7) {
      weeks.add(Row(
        children: [for (var j = 0; j < 7; j++) _dayCell(cells[i + j])],
      ),);
    }
    return weeks;
  }

  Widget _dayCell(DateTime? day) {
    if (day == null) return const Expanded(child: SizedBox(height: 44));
    final isStart = _sameDay(day, _start);
    final isEnd = _end != null && _sameDay(day, _end!);
    final isEndpoint = isStart || isEnd;
    final inRange = _end != null &&
        day.isAfter(_start) &&
        day.isBefore(_end!);

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: GestureDetector(
          onTap: () => _onTap(day),
          child: Container(
            height: 38,
            decoration: BoxDecoration(
              color: isEndpoint
                  ? AppColors.expeditorAccent
                  : inRange
                      ? AppColors.expeditorAccent.withValues(alpha: 0.16)
                      : Colors.transparent,
              borderRadius: BorderRadius.circular(isEndpoint ? 19 : 8),
            ),
            alignment: Alignment.center,
            child: Text(
              '${day.day}',
              style: TextStyle(
                color: isEndpoint ? Colors.white : AppColors.textPrimary,
                fontWeight: isEndpoint ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Filtr paneli: «Выбрать» (presetlar) + sana oralig'i (kalendar).
class HistoryFilterBar extends StatelessWidget {
  final HistoryDateRange range;
  final VoidCallback onPresetTap;
  final VoidCallback onRangeTap;

  const HistoryFilterBar({
    super.key,
    required this.range,
    required this.onPresetTap,
    required this.onRangeTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Row(
        children: [
          InkWell(
            onTap: onPresetTap,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(range.label,
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600),),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down,
                      size: 18, color: AppColors.textMuted,),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              onTap: onRangeTap,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined,
                        size: 16, color: AppColors.textMuted,),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(range.rangeText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyMedium
                              .copyWith(fontWeight: FontWeight.w600),),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

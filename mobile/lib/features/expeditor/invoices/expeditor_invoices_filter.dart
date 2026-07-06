import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../shared/expeditor_history_filter.dart';

/// Nakladnoy filtrlari.
class InvoiceFilterState {
  final HistoryDateRange dateRange;
  final int? warehouseId;
  final String? warehouseName;
  final Set<String> statuses;

  const InvoiceFilterState({
    required this.dateRange,
    this.warehouseId,
    this.warehouseName,
    this.statuses = const {},
  });

  factory InvoiceFilterState.defaults() => InvoiceFilterState(
        dateRange: HistoryPreset.thisWeek.resolve(),
      );

  bool get hasExtra =>
      warehouseId != null || statuses.isNotEmpty || dateRange.label != 'На этой неделе';

  bool get hasAdvanced => warehouseId != null || statuses.isNotEmpty;

  InvoiceFilterState copyWith({
    HistoryDateRange? dateRange,
    int? warehouseId,
    String? warehouseName,
    Set<String>? statuses,
    bool clearWarehouse = false,
  }) =>
      InvoiceFilterState(
        dateRange: dateRange ?? this.dateRange,
        warehouseId: clearWarehouse ? null : (warehouseId ?? this.warehouseId),
        warehouseName:
            clearWarehouse ? null : (warehouseName ?? this.warehouseName),
        statuses: statuses ?? this.statuses,
      );
}

const invoiceStatusOptions = [
  ('waiting_confirmation', 'Ожидание подтверждения'),
  ('confirmed', 'Подтвержденные'),
];

String invoiceStatusLabel(String code) {
  for (final o in invoiceStatusOptions) {
    if (o.$1 == code) return o.$2;
  }
  return code;
}

/// «Фильтр» bottom sheet.
Future<InvoiceFilterState?> showInvoiceFilterSheet(
  BuildContext context, {
  required InvoiceFilterState current,
  required List<Map<String, dynamic>> warehouses,
}) {
  return showModalBottomSheet<InvoiceFilterState>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => _InvoiceFilterSheet(
      initial: current,
      warehouses: warehouses,
    ),
  );
}

class _InvoiceFilterSheet extends StatefulWidget {
  final InvoiceFilterState initial;
  final List<Map<String, dynamic>> warehouses;

  const _InvoiceFilterSheet({
    required this.initial,
    required this.warehouses,
  });

  @override
  State<_InvoiceFilterSheet> createState() => _InvoiceFilterSheetState();
}

class _InvoiceFilterSheetState extends State<_InvoiceFilterSheet> {
  late HistoryDateRange _range;
  int? _warehouseId;
  String? _warehouseName;
  late Set<String> _statuses;

  @override
  void initState() {
    super.initState();
    _range = widget.initial.dateRange;
    _warehouseId = widget.initial.warehouseId;
    _warehouseName = widget.initial.warehouseName;
    _statuses = Set<String>.from(widget.initial.statuses);
  }

  Future<void> _pickPreset() async {
    final r = await showHistoryPresetSheet(context);
    if (r != null && mounted) setState(() => _range = r);
  }

  Future<void> _pickCalendar() async {
    final r = await pickHistoryDateRange(context, current: _range);
    if (r != null && mounted) setState(() => _range = r);
  }

  Future<void> _pickWarehouse() async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            const SizedBox(height: 6),
            Stack(
              alignment: Alignment.center,
              children: [
                const Text('Склад',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ),
              ],
            ),
            for (final w in widget.warehouses)
              ListTile(
                leading: Icon(
                  _warehouseId == w['id']
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color: AppColors.expeditorAccent,
                ),
                title: Text(w['name']?.toString() ?? '—'),
                onTap: () => Navigator.pop(ctx, w),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _warehouseId = picked['id'] as int?;
        _warehouseName = picked['name']?.toString();
      });
    }
  }

  Future<void> _pickStatus() async {
    final picked = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => _StatusSheet(initial: _statuses),
    );
    if (picked != null && mounted) setState(() => _statuses = picked);
  }

  @override
  Widget build(BuildContext context) {
    final statusText = _statuses.isEmpty
        ? 'Статус'
        : _statuses.map(invoiceStatusLabel).join(', ');

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AgentSheetHandle(),
              const SizedBox(height: 6),
              Stack(
                alignment: Alignment.center,
                children: [
                  const Text('Фильтр',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                  Align(
                    alignment: Alignment.centerRight,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      _range.label,
                      onTap: _pickPreset,
                      trailing: Icons.keyboard_arrow_down,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _field(
                      _range.rangeText,
                      onTap: _pickCalendar,
                      leading: Icons.calendar_today_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _field(
                _warehouseName ?? 'Склад',
                onTap: _pickWarehouse,
                trailing: Icons.keyboard_arrow_down,
              ),
              const SizedBox(height: 10),
              _field(
                statusText,
                onTap: _pickStatus,
                trailing: Icons.keyboard_arrow_down,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.surfaceVariant,
                        foregroundColor: AppColors.textSecondary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Закрыть',
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
                      onPressed: () => Navigator.pop(
                        context,
                        InvoiceFilterState(
                          dateRange: _range,
                          warehouseId: _warehouseId,
                          warehouseName: _warehouseName,
                          statuses: _statuses,
                        ),
                      ),
                      child: const Text('Применить',
                          style: TextStyle(fontWeight: FontWeight.w700),),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    String text, {
    required VoidCallback onTap,
    IconData? leading,
    IconData? trailing,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          children: [
            if (leading != null) ...[
              Icon(leading, size: 16, color: AppColors.textMuted),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (trailing != null)
              Icon(trailing, color: AppColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}

class _StatusSheet extends StatefulWidget {
  final Set<String> initial;
  const _StatusSheet({required this.initial});

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  late Set<String> _selected = Set<String>.from(widget.initial);

  void _toggleAll(bool? v) {
    setState(() {
      if (v == true) {
        _selected = invoiceStatusOptions.map((e) => e.$1).toSet();
      } else {
        _selected.clear();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final allSelected =
        _selected.length == invoiceStatusOptions.length;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            const SizedBox(height: 6),
            Stack(
              alignment: Alignment.center,
              children: [
                const Text('Статус',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
            CheckboxListTile(
              value: allSelected,
              tristate: true,
              onChanged: _toggleAll,
              activeColor: AppColors.expeditorAccent,
              title: const Text('Выбрать все'),
            ),
            for (final o in invoiceStatusOptions)
              CheckboxListTile(
                value: _selected.contains(o.$1),
                onChanged: (v) => setState(() {
                  if (v == true) {
                    _selected.add(o.$1);
                  } else {
                    _selected.remove(o.$1);
                  }
                }),
                activeColor: AppColors.expeditorAccent,
                title: Text(o.$2),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Отмена'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                          backgroundColor: AppColors.expeditorAccent,),
                      onPressed: () => Navigator.pop(context, _selected),
                      child: const Text('Выбрать'),
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

List<Map<String, dynamic>> applyInvoiceFilters(
  List<Map<String, dynamic>> rows,
  InvoiceFilterState filter,
) {
  return rows.where((d) {
    final shipRaw = d['ship_date']?.toString();
    if (shipRaw != null && shipRaw.isNotEmpty) {
      final day = shipRaw.length >= 10 ? shipRaw.substring(0, 10) : shipRaw;
      if (filter.dateRange.fromUtc != null) {
        final fromDay =
            DateFormat('yyyy-MM-dd').format(workRegionNow(filter.dateRange.fromUtc));
        if (day.compareTo(fromDay) < 0) return false;
      }
      if (filter.dateRange.toUtc != null) {
        final toDay =
            DateFormat('yyyy-MM-dd').format(workRegionNow(filter.dateRange.toUtc));
        if (day.compareTo(toDay) > 0) return false;
      }
    }

    if (filter.warehouseId != null &&
        d['warehouse_id'] != filter.warehouseId) {
      return false;
    }

    if (filter.statuses.isNotEmpty &&
        !filter.statuses.contains(d['status']?.toString())) {
      return false;
    }

    return true;
  }).toList();
}

String formatInvoiceDay(String? raw) {
  if (raw == null || raw.isEmpty) return '—';
  if (raw.contains('-') && raw.length >= 10) {
    final p = raw.substring(0, 10).split('-');
    if (p.length == 3) return '${p[2]}.${p[1]}.${p[0]}';
  }
  final dt = DateTime.tryParse(raw);
  if (dt == null) return raw;
  final l = dt.toLocal();
  return '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')}.${l.year}';
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/api/mobile_api.dart';
import '../shell/agent_app_bar.dart';
import '../home/home_visit_metrics_provider.dart';
import 'agent_report_mock_data.dart';
import 'agent_report_provider.dart';

class AgentReportPage extends ConsumerStatefulWidget {
  const AgentReportPage({super.key});

  @override
  ConsumerState<AgentReportPage> createState() => _AgentReportPageState();
}

class _AgentReportPageState extends ConsumerState<AgentReportPage> {
  int? _openParentIndex;

  List<int> _parentIndices(List<AgentReportRow> rows) {
    return [for (var i = 0; i < rows.length; i++) if (rows[i].depth == 0) i];
  }

  int? _rootCategoryIndex(List<AgentReportRow> rows, int index) {
    for (var j = index - 1; j >= 0; j--) {
      if (rows[j].depth == 0) return j;
    }
    return null;
  }

  List<({int idx, AgentReportRow row, bool open, bool clickable})> _visibleRows(List<AgentReportRow> rows) {
    final list = <({int idx, AgentReportRow row, bool open, bool clickable})>[];
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      if (r.depth == 0) {
        list.add((idx: i, row: r, open: _openParentIndex == i, clickable: true));
      } else if (_openParentIndex != null && _rootCategoryIndex(rows, i) == _openParentIndex) {
        list.add((idx: i, row: r, open: false, clickable: false));
      }
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final rowsAsync = ref.watch(agentReportRowsProvider);
    final salesTotalsAsync = ref.watch(agentReportSalesTotalsProvider);

    ref.listen(agentReportRowsProvider, (prev, next) {
      final rows = next.valueOrNull;
      if (rows == null) return;
      final parents = _parentIndices(rows);
      if (_openParentIndex != null && parents.contains(_openParentIndex)) return;
      setState(() {
        _openParentIndex = parents.isEmpty ? null : parents.first;
      });
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Отчёты',
        actions: [
          AgentIconButton(icon: Icons.filter_alt_outlined, showDot: true, onPressed: () => AgentFilterSheet.show(context)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(agentReportRowsProvider);
          ref.invalidate(agentReportDataProvider);
          ref.invalidate(agentReportSalesTotalsProvider);
        },
        child: rowsAsync.when(
              data: (rows) {
                final salesTotals = salesTotalsAsync.valueOrNull;
                final visible = _visibleRows(rows);

                if (rows.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
                    children: [
                      _statGrid(salesTotals),
                      const SizedBox(height: 12),
                      const AgentEmptyState(message: S.emptyReport),
                    ],
                  );
                }

                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
                  children: [
                    _statGrid(salesTotals),
                    const SizedBox(height: 12),
                    AgentSurfaceCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                            child: Text(
                              'Продажи по категориям',
                              style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w800, fontSize: 14),
                            ),
                          ),
                          Container(
                            color: const Color(0xFFF6F9FB),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            child: _tableHeader(),
                          ),
                          for (final item in visible) _categoryRow(item),
                        ],
                      ),
                    ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, _) => Center(child: Text('$e')),
            ),
      ),
    );
  }

  Widget _statGrid(AgentDailySalesTotals? salesTotals) {
    final totals = salesTotals ?? AgentDailySalesTotals(qty: 0, volumeM3: 0, sum: 0, akb: 0);
    final metrics = ref.watch(homeVisitMetricsProvider).valueOrNull;
    final visitLabel = metrics != null && metrics.total > 0
        ? '${metrics.visited}/${metrics.total}'
        : '—';
    final kpi = metrics != null && metrics.total > 0
        ? '${((metrics.onRoute / metrics.total) * 100).round()}%'
        : '—';

    return AgentReportStatGrid(
      items: [
        (label: 'Продажи', value: _fmtSum(totals.sum)),
        (label: 'Объём', value: '${_fmtQty(totals.qty)} шт'),
        (label: 'KPI', value: kpi),
        (label: 'Визиты', value: visitLabel),
      ],
    );
  }

  static const _qtyColWidth = 52.0;
  static const _sumColFlex = 5;

  Widget _tableHeader() {
    return Row(
      children: [
        const Expanded(
          flex: 7,
          child: Text(
            'Категория',
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textMuted),
          ),
        ),
        SizedBox(
          width: _qtyColWidth,
          child: const Text(
            'Кол-во',
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textMuted),
          ),
        ),
        const SizedBox(width: 8),
        const Expanded(
          flex: _sumColFlex,
          child: Text(
            'Сумма',
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }

  Widget _metricText(
    String value, {
    required Color color,
    bool bold = false,
    double fontSize = 12.5,
  }) {
    return Text(
      value,
      maxLines: 1,
      textAlign: TextAlign.right,
      overflow: TextOverflow.fade,
      softWrap: false,
      style: TextStyle(
        fontSize: fontSize,
        fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
        color: color,
        height: 1.1,
      ),
    );
  }

  Widget _categoryRow(({int idx, AgentReportRow row, bool open, bool clickable}) item) {
    final r = item.row;
    final open = item.open;
    final color = open ? AppColors.primary : AppColors.textPrimary;
    final bg = r.depth > 0 ? const Color(0xFFF0F4F8) : null;

    return Material(
      color: bg ?? AppColors.surface,
      child: InkWell(
        onTap: item.clickable
            ? () => setState(() {
                  _openParentIndex = _openParentIndex == item.idx ? null : item.idx;
                })
            : null,
        child: Container(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.borderLight))),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          constraints: const BoxConstraints(minHeight: 46),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: 7,
                child: Row(
                  children: [
                    if (r.depth == 0)
                      AnimatedRotation(
                        turns: open ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 180),
                        child: Icon(
                          Icons.keyboard_arrow_down,
                          size: 20,
                          color: open ? AppColors.primary : AppColors.textMuted,
                        ),
                      ),
                    if (r.depth == 0) const SizedBox(width: 2),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(left: r.depth > 0 ? 14.0 * r.depth : 0),
                        child: Text(
                          r.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: r.depth == 0 ? 13.5 : 12.5,
                            fontWeight: r.depth == 0 ? FontWeight.w600 : FontWeight.w500,
                            color: r.depth == 0 ? color : AppColors.textSecondary,
                            height: 1.2,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: _qtyColWidth,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: _metricText(r.count, color: color),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: _sumColFlex,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: _metricText(r.sum, color: color, bold: true),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtQty(double v) {
    if (v == v.truncateToDouble()) return v.truncate().toString();
    return v.toStringAsFixed(1);
  }

  String _fmtVolume(double v) {
    if (v == 0) return '0.0';
    if (v.abs() < 0.01) return v.toStringAsFixed(3);
    return v.toStringAsFixed(1);
  }

  String _fmtSum(double v) {
    final n = v.round();
    final s = n.abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

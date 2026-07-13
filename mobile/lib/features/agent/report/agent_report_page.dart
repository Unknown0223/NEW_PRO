import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/api/mobile_api.dart';
import '../shell/agent_app_bar.dart';
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

  List<({int idx, AgentReportRow row, bool open, bool clickable})> _visibleRows(List<AgentReportRow> rows) {
    final list = <({int idx, AgentReportRow row, bool open, bool clickable})>[];
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      if (r.depth == 0) {
        list.add((idx: i, row: r, open: _openParentIndex == i, clickable: true));
      } else if (_openParentIndex != null) {
        var lastParent = -1;
        for (var j = 0; j < i; j++) {
          if (rows[j].depth == 0) lastParent = j;
        }
        if (lastParent == _openParentIndex) {
          list.add((idx: i, row: r, open: false, clickable: false));
        }
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
        _openParentIndex = parents.isEmpty ? null : (parents.length > 4 ? parents[4] : parents.first);
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
                        children: [
                          Container(
                            color: const Color(0xFFF6F9FB),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            child: const Row(
                              children: [
                                Expanded(
                                  flex: 135,
                                  child: Text(
                                    'Категория',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                                  ),
                                ),
                                Expanded(
                                  flex: 82,
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.center,
                                    child: Text(
                                      'Количество',
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  flex: 82,
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.center,
                                    child: Text(
                                      'Объем',
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  flex: 115,
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerRight,
                                    child: Text(
                                      'Сумма',
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.right,
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                                    ),
                                  ),
                                ),
                              ],
                            ),
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

    return AgentReportStatGrid(
      items: [
        (label: 'Общая сумма', value: _fmtSum(totals.sum)),
        (label: 'Акб', value: '${totals.akb}'),
        (label: 'Общий кол-во', value: _fmtQty(totals.qty)),
        (label: 'Общий объем', value: _fmtVolume(totals.volumeM3)),
      ],
    );
  }

  Widget _categoryRow(({int idx, AgentReportRow row, bool open, bool clickable}) item) {
    final r = item.row;
    final open = item.open;
    final color = open ? AppColors.primary : AppColors.textPrimary;
    final bg = r.depth == 1 ? const Color(0xFFF0F4F8) : null;

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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          constraints: const BoxConstraints(minHeight: 48),
          child: Row(
            children: [
              Expanded(
                flex: 135,
                child: Row(
                  children: [
                    if (r.depth == 0)
                      AnimatedRotation(
                        turns: open ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 180),
                        child: Icon(
                          Icons.keyboard_arrow_down,
                          size: 22,
                          color: open ? AppColors.primary : AppColors.textMuted,
                        ),
                      ),
                    if (r.depth == 0) const SizedBox(width: 4),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(left: r.depth == 1 ? 20 : 0),
                        child: Text(
                          r.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: r.depth == 1 ? 13 : 14,
                            fontWeight: r.depth == 0 ? FontWeight.w600 : FontWeight.w500,
                            color: r.depth == 1 ? AppColors.textSecondary : color,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                flex: 82,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Text(
                    r.count,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w600, color: color),
                  ),
                ),
              ),
              Expanded(
                flex: 82,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Text(
                    r.volume,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w600, color: color),
                  ),
                ),
              ),
              Expanded(
                flex: 115,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    r.sum,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: TextStyle(fontWeight: FontWeight.w800, color: color),
                  ),
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

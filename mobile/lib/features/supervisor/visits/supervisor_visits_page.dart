import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_api_parse.dart';
import '../shared/supervisor_visit_detail_sheet.dart';
import '../supervisor_providers.dart';

enum _VisitDateFilter { today, yesterday, week }

class SupervisorVisitsPage extends ConsumerStatefulWidget {
  const SupervisorVisitsPage({super.key});

  @override
  ConsumerState<SupervisorVisitsPage> createState() => _SupervisorVisitsPageState();
}

class _SupervisorVisitsPageState extends ConsumerState<SupervisorVisitsPage> {
  _VisitDateFilter _dateFilter = _VisitDateFilter.today;

  String? _dateParam() {
    final now = DateTime.now();
    switch (_dateFilter) {
      case _VisitDateFilter.today:
        return null;
      case _VisitDateFilter.yesterday:
        final y = now.subtract(const Duration(days: 1));
        return '${y.year}-${y.month.toString().padLeft(2, '0')}-${y.day.toString().padLeft(2, '0')}';
      case _VisitDateFilter.week:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final policy = SupervisorConfigPolicy(
      supervision: session.mobileConfig?.supervision,
      misc: session.mobileConfig?.misc,
    );
    final dateKey = _dateParam() ?? 'today';
    final visitsAsync = ref.watch(supervisorVisitsProvider(dateKey));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vizitlar'),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                _DateChip('Bugun', _dateFilter == _VisitDateFilter.today, () {
                  setState(() => _dateFilter = _VisitDateFilter.today);
                }),
                const SizedBox(width: 8),
                _DateChip('Kecha', _dateFilter == _VisitDateFilter.yesterday, () {
                  setState(() => _dateFilter = _VisitDateFilter.yesterday);
                }),
                const SizedBox(width: 8),
                _DateChip('Hafta', _dateFilter == _VisitDateFilter.week, () {
                  setState(() => _dateFilter = _VisitDateFilter.week);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Haftalik filtr tez orada qo\'shiladi')),
                  );
                }),
              ],
            ),
          ),
          visitsAsync.when(
            data: (payload) {
              final parsed = SupervisorVisitsPayload.fromApi(payload);
              return Column(
                children: [
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.supervisorAccent.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      Expanded(child: _VisitStat('Rejada', '${parsed.totalPlanned()}', AppColors.textPrimary)),
                      Container(width: 1, height: 30, color: AppColors.border),
                      Expanded(child: _VisitStat('Bajarildi', '${parsed.totalVisited()}', AppColors.success)),
                      Container(width: 1, height: 30, color: AppColors.border),
                      Expanded(child: _VisitStat('Buyurtmali', '${parsed.totalWithOrders()}', AppColors.info)),
                      Container(width: 1, height: 30, color: AppColors.border),
                      Expanded(child: _VisitStat('Qoldi', '${parsed.totalNotVisited()}', AppColors.warning)),
                    ],),
                  ),
                  const SizedBox(height: 8),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => const SizedBox.shrink(),
          ),
          Expanded(
            child: visitsAsync.when(
              data: (payload) {
                final parsed = SupervisorVisitsPayload.fromApi(payload);
                if (parsed.rows.isEmpty) {
                  return const Center(child: AgentEmptyState(message: S.emptySupervisorVisits));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(supervisorVisitsProvider(dateKey)),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: parsed.rows.length,
                    itemBuilder: (ctx, i) {
                      final row = parsed.rows[i];
                      final progress = row.plannedVisits > 0
                          ? row.visitedTotal / row.plannedVisits
                          : 0.0;
                      return Card(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => showSupervisorVisitDetailSheet(
                            context,
                            row: row,
                            policy: policy,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: AppColors.supervisorAccent.withValues(alpha: 0.1),
                                    child: Text(
                                      row.agentName.isNotEmpty ? row.agentName[0].toUpperCase() : '?',
                                      style: const TextStyle(
                                        color: AppColors.supervisorAccent,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(row.agentName, style: AppTypography.titleMedium),
                                        if (row.agentCode != null)
                                          Text(row.agentCode!, style: AppTypography.caption),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${row.visitedTotal}/${row.plannedVisits}',
                                    style: AppTypography.labelMedium.copyWith(
                                      color: progress >= 1 ? AppColors.success : AppColors.supervisorAccent,
                                    ),
                                  ),
                                ],),
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(3),
                                  child: LinearProgressIndicator(
                                    value: progress.clamp(0.0, 1.0),
                                    backgroundColor: AppColors.border,
                                    valueColor: AlwaysStoppedAnimation(
                                      progress >= 1 ? AppColors.success : AppColors.supervisorAccent,
                                    ),
                                    minHeight: 4,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    _MiniStat('Qolmagan', '${row.notVisited}'),
                                    const SizedBox(width: 12),
                                    _MiniStat('Buyurtma', '${row.visitsWithOrders}'),
                                    const SizedBox(width: 12),
                                    _MiniStat('GPS', '${row.gpsVisits}'),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e')),
            ),
          ),
        ],
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _DateChip(this.label, this.selected, this.onTap);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.supervisorAccent : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? AppColors.supervisorAccent : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: selected ? Colors.white : AppColors.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _VisitStat extends StatelessWidget {
  final String label, value;
  final Color color;
  const _VisitStat(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: color)),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
    ],);
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  const _MiniStat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Text('$label: $value', style: const TextStyle(fontSize: 10, color: AppColors.textMuted));
  }
}

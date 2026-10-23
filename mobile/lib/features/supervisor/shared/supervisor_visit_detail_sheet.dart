import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/face/face_verification_flow.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/supervisor_config_enforcement.dart';
import 'supervisor_api_parse.dart';

/// Agent vizit hisoboti + config checklist.
Future<void> showSupervisorVisitDetailSheet(
  BuildContext context,
  WidgetRef ref, {
  required SupervisorVisitAgentRow row,
  required SupervisorConfigPolicy policy,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final checklist = policy.enabledChecklistLabels();
      final checked = <String, bool>{for (final l in checklist) l: false};

      return StatefulBuilder(
        builder: (ctx, setState) {
          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: SafeArea(
              top: false,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(row.agentName, style: AppTypography.headlineSmall),
                  if (row.agentCode != null && row.agentCode!.isNotEmpty)
                    Text('Код: ${row.agentCode}', style: AppTypography.bodySmall),
                  const SizedBox(height: 16),
                  _MetricRow('По плану', '${row.plannedVisits}'),
                  _MetricRow('Выполнено', '${row.visitedTotal}'),
                  _MetricRow('Не посещено', '${row.notVisited}'),
                  _MetricRow('Визиты с заказом', '${row.visitsWithOrders}'),
                  _MetricRow('GPS-визиты', '${row.gpsVisits}'),
                  _MetricRow('Фотоотчёты', '${row.photoReports}'),
                  _MetricRow('Продажи', row.salesSum),
                  if (checklist.isNotEmpty) ...[
                    const Divider(height: 32),
                    const Text('Чек-лист проверки', style: AppTypography.titleMedium),
                    const SizedBox(height: 8),
                    ...checklist.map(
                      (label) => CheckboxListTile(
                        value: checked[label] ?? false,
                        title: Text(label, style: AppTypography.bodyMedium),
                        onChanged: (v) => setState(() => checked[label] = v ?? false),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () async {
                      final ok = await FaceVerificationFlow.ensure(
                        context,
                        ref,
                        verifyContext: 'territory_check',
                        title: 'Проверка лица супервайзера',
                      );
                      if (!ok || !context.mounted) return;
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Проверка сохранена')),
                      );
                    },
                    child: const Text('Сохранить'),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

class _MetricRow extends StatelessWidget {
  final String label;
  final String value;
  const _MetricRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodyMedium),
          Text(value, style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

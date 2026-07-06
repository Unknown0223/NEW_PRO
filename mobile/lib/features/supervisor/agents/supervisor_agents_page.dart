import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../supervisor_providers.dart';

class SupervisorAgentsPage extends ConsumerWidget {
  const SupervisorAgentsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final supervision = session.mobileConfig?.supervision;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agentlar'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          IconButton(icon: const Icon(Icons.map_outlined), onPressed: () => _showMap(context)),
        ],
      ),
      body: Column(
        children: [
          // Supervisor checklist capabilities
          if (supervision != null)
            Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.supervisorAccent.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Tekshiruv imkoniyatlari', style: AppTypography.labelMedium),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6, runSpacing: 4,
                    children: [
                      if (supervision.checkReceiptFaces) const _CheckChip('Chek yuzlari'),
                      if (supervision.checkMerchandising) const _CheckChip('Merchandising'),
                      if (supervision.checkDefaultPrice) const _CheckChip('Narx'),
                      if (supervision.checkMotivation) const _CheckChip('Motivatsiya'),
                      if (supervision.checkStock) const _CheckChip('Ombor'),
                      if (supervision.checkSales) const _CheckChip('Sotuvlar'),
                    ],
                  ),
                ],
              ),
            ),

          Expanded(
            child: ref.watch(supervisorAgentLocationsProvider).when(
              data: (pins) {
                if (pins.isEmpty) {
                  return const Center(child: AgentEmptyState(message: S.emptySupervisorAgents));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(supervisorAgentLocationsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: pins.length,
                    itemBuilder: (ctx, i) {
                      final p = pins[i];
                      return Card(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        child: ListTile(
                          leading: const CircleAvatar(child: Icon(Icons.person_pin_circle)),
                          title: Text(p.agentName ?? 'Agent #${p.agentId}'),
                          subtitle: Text(
                            p.latitude != null
                                ? '${p.latitude!.toStringAsFixed(4)}, ${p.longitude!.toStringAsFixed(4)}'
                                : 'Koordinata yo\'q',
                          ),
                          trailing: Text(p.recordedAt?.substring(11, 16) ?? ''),
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

  void _showMap(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, controller) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                const Text('Agentlar xaritasi', style: AppTypography.headlineSmall),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],),
            ),
            Expanded(
              child: Container(
                color: AppColors.surfaceVariant,
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.map, size: 48, color: AppColors.textDisabled),
                      SizedBox(height: 8),
                      Text('Xarita ko\'rinishi', style: TextStyle(color: AppColors.textMuted)),
                      Text('(Flutter Map / Yandex MapKit)', style: TextStyle(fontSize: 12, color: AppColors.textDisabled)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CheckChip extends StatelessWidget {
  final String label;
  const _CheckChip(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.supervisorAccent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.check, size: 12, color: AppColors.supervisorAccent),
        const SizedBox(width: 3),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.supervisorAccent)),
      ],),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

class SupervisorAgentsPage extends ConsumerStatefulWidget {
  const SupervisorAgentsPage({super.key});

  @override
  ConsumerState<SupervisorAgentsPage> createState() => _SupervisorAgentsPageState();
}

class _SupervisorAgentsPageState extends ConsumerState<SupervisorAgentsPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final policy = SupervisorConfigPolicy(session.mobileConfig);
    final checklist = policy.enabledChecklistLabels();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Агенты'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () async {
              final q = await showSupervisorSearchSheet(context, hint: 'Поиск агентов');
              if (q != null) setState(() => _query = q);
            },
          ),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () {
              final pins = ref.read(supervisorAgentLocationsProvider).valueOrNull ?? [];
              openSupervisorMapPins(
                context: context,
                pins: pins.map((p) => (name: p.agentName, lat: p.latitude, lng: p.longitude)).toList(),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (checklist.isNotEmpty)
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
                  const Text('Проверки', style: AppTypography.labelMedium),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      for (final label in checklist) _CheckChip(label),
                    ],
                  ),
                ],
              ),
            ),
          Expanded(
            child: ref.watch(supervisorAgentLocationsProvider).when(
                  data: (pins) {
                    var list = pins;
                    if (_query.isNotEmpty) {
                      final q = _query.toLowerCase();
                      list = pins
                          .where((p) => (p.agentName ?? '').toLowerCase().contains(q) || '${p.agentId}'.contains(q))
                          .toList();
                    }
                    if (list.isEmpty) {
                      return const Center(child: AgentEmptyState(message: S.emptySupervisorAgents));
                    }
                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(supervisorAgentLocationsProvider),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: list.length,
                        itemBuilder: (ctx, i) {
                          final p = list[i];
                          final hasGeo = p.latitude != null && p.longitude != null;
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            child: ListTile(
                              leading: const CircleAvatar(child: Icon(Icons.person_pin_circle)),
                              title: Text(p.agentName ?? 'Агент #${p.agentId}'),
                              subtitle: Text(
                                hasGeo
                                    ? '${p.latitude!.toStringAsFixed(5)}, ${p.longitude!.toStringAsFixed(5)}'
                                    : 'Координаты не указаны',
                              ),
                              trailing: Icon(
                                hasGeo ? Icons.gps_fixed : Icons.gps_off,
                                color: hasGeo ? AppColors.supervisorAccent : AppColors.textMuted,
                              ),
                              onTap: hasGeo
                                  ? () => openSupervisorMapPins(
                                        context: context,
                                        pins: [(name: p.agentName, lat: p.latitude, lng: p.longitude)],
                                      )
                                  : null,
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check, size: 12, color: AppColors.supervisorAccent),
          const SizedBox(width: 3),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.supervisorAccent)),
        ],
      ),
    );
  }
}

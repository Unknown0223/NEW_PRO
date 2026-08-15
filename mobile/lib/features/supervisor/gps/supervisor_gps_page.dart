import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

class SupervisorGpsPage extends ConsumerWidget {
  const SupervisorGpsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const accent = AppColors.supervisorAccent;
    final l10n = ref.watch(svL10nProvider);
    final async = ref.watch(supervisorAgentLocationsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: l10n.gpsMonitoring,
        showMenu: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: () => sendSupervisorMyLocation(ref, context),
          ),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () {
              final pins = (async.valueOrNull ?? [])
                  .map((p) => (name: p.agentName, lat: p.latitude, lng: p.longitude))
                  .toList();
              openSupervisorMapPins(context: context, pins: pins);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: accent,
        onRefresh: () async {
          ref.invalidate(supervisorAgentLocationsProvider);
          await ref.read(supervisorAgentLocationsProvider.future);
        },
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SvCard(
                child: Column(
                  children: List.generate(
                    3,
                    (_) => Container(
                      height: 14,
                      margin: const EdgeInsets.only(bottom: 10),
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          error: (_, __) => ListView(
            children: const [
              Padding(
                padding: EdgeInsets.all(24),
                child: Text('Нет данных GPS агентов'),
              ),
            ],
          ),
          data: (pins) {
            if (pins.isEmpty) {
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Нет данных GPS агентов', style: AppTypography.caption),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: pins.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                if (i == 0) {
                  return SvCard(
                    onTap: () {
                      openSupervisorMapPins(
                        context: context,
                        pins: pins
                            .map((p) => (name: p.agentName, lat: p.latitude, lng: p.longitude))
                            .toList(),
                      );
                    },
                    child: const Row(
                      children: [
                        Icon(Icons.map_outlined),
                        SizedBox(width: 12),
                        Expanded(child: Text('Открыть на карте', style: TextStyle(fontWeight: FontWeight.w600))),
                        Icon(Icons.chevron_right),
                      ],
                    ),
                  );
                }
                final p = pins[i - 1];
                final hasGeo = p.latitude != null && p.longitude != null;
                return SvCard(
                  onTap: hasGeo
                      ? () => openSupervisorMapPins(
                            context: context,
                            pins: [(name: p.agentName, lat: p.latitude, lng: p.longitude)],
                          )
                      : null,
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: accent.withValues(alpha: 0.12),
                        child: const Icon(Icons.person_pin_circle, color: accent),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (p.agentName ?? 'Агент ${p.agentId}').trim().isEmpty
                                  ? 'Агент ${p.agentId}'
                                  : p.agentName!,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              hasGeo
                                  ? '${p.latitude!.toStringAsFixed(5)}, ${p.longitude!.toStringAsFixed(5)}'
                                  : 'Координаты не указаны',
                              style: AppTypography.caption,
                            ),
                            if (p.recordedAt != null)
                              Text(p.recordedAt!, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                          ],
                        ),
                      ),
                      Icon(
                        hasGeo ? Icons.gps_fixed : Icons.gps_off,
                        color: hasGeo ? accent : AppColors.textMuted,
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../shared/supervisor_api_parse.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

class SupervisorOutletsPage extends ConsumerStatefulWidget {
  const SupervisorOutletsPage({super.key});

  @override
  ConsumerState<SupervisorOutletsPage> createState() => _SupervisorOutletsPageState();
}

class _SupervisorOutletsPageState extends ConsumerState<SupervisorOutletsPage> {
  String _query = '';
  bool _onlyWithGps = false;

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    final l10n = ref.watch(svL10nProvider);
    final visits = ref.watch(supervisorVisitsProvider('today'));
    final gps = ref.watch(supervisorAgentLocationsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: l10n.outlets,
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () async {
              final q = await showSupervisorSearchSheet(context, hint: l10n.search);
              if (q != null) setState(() => _query = q);
            },
          ),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () {
              final pins = (gps.valueOrNull ?? [])
                  .map((p) => (name: p.agentName, lat: p.latitude, lng: p.longitude))
                  .toList();
              openSupervisorMapPins(context: context, pins: pins);
            },
          ),
          IconButton(
            icon: Icon(_onlyWithGps ? Icons.filter_alt : Icons.filter_list),
            onPressed: () => setState(() => _onlyWithGps = !_onlyWithGps),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_query.isNotEmpty || _onlyWithGps)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SvCard(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        [
                          if (_query.isNotEmpty) '«$_query»',
                          if (_onlyWithGps) 'только с GPS',
                        ].join(' · '),
                        style: AppTypography.caption,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() {
                        _query = '';
                        _onlyWithGps = false;
                      }),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: visits.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text('Нет данных')),
              data: (payload) {
                final gpsIds = {
                  for (final p in gps.valueOrNull ?? const [])
                    if (p.latitude != null && p.longitude != null) p.agentId,
                };
                var rows = SupervisorVisitsPayload.fromApi(payload).rows;
                if (_onlyWithGps) {
                  rows = rows.where((r) => gpsIds.contains(r.agentId)).toList();
                }
                if (_query.isNotEmpty) {
                  final q = _query.toLowerCase();
                  rows = rows
                      .where((r) =>
                          r.agentName.toLowerCase().contains(q) ||
                          (r.agentCode?.toLowerCase().contains(q) ?? false),)
                      .toList();
                }
                if (rows.isEmpty) {
                  return const Center(child: Text('Нет точек для отображения'));
                }
                return RefreshIndicator(
                  color: accent,
                  onRefresh: () async {
                    ref.invalidate(supervisorVisitsProvider('today'));
                    await ref.read(supervisorVisitsProvider('today').future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      final match = (gps.valueOrNull ?? []).where((p) => p.agentId == r.agentId).toList();
                      final hasGps = match.any((p) => p.latitude != null);
                      return SvCard(
                        onTap: () {
                          if (hasGps) {
                            final p = match.first;
                            openSupervisorMapPins(
                              context: context,
                              pins: [(name: r.agentName, lat: p.latitude, lng: p.longitude)],
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Координаты не указаны')),
                            );
                          }
                        },
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.storefront, color: accent),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(r.agentName.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                                  Text(
                                    r.agentCode?.isNotEmpty == true ? r.agentCode! : 'Агент',
                                    style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(hasGps ? Icons.gps_fixed : Icons.gps_off, size: 14, color: hasGps ? accent : AppColors.textMuted),
                                      const SizedBox(width: 4),
                                      Text(hasGps ? 'GPS' : 'нет GPS', style: AppTypography.caption),
                                      const Spacer(),
                                      Text('${r.salesSum} UZS', style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

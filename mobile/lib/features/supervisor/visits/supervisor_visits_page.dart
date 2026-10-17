import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/prefs/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_api_parse.dart';
import '../shared/supervisor_visit_detail_sheet.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

class SupervisorVisitsPage extends ConsumerStatefulWidget {
  const SupervisorVisitsPage({super.key});

  @override
  ConsumerState<SupervisorVisitsPage> createState() => _SupervisorVisitsPageState();
}

class _SupervisorVisitsPageState extends ConsumerState<SupervisorVisitsPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _onlyWithLocation = false;
  String _query = '';
  String _dateKey = 'today';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _pickFilter() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Сегодня'),
              trailing: _dateKey == 'today' ? const Icon(Icons.check, color: AppColors.supervisorAccent) : null,
              onTap: () => Navigator.pop(ctx, 'today'),
            ),
            ListTile(
              title: const Text('Вчера'),
              trailing: _dateKey != 'today' ? const Icon(Icons.check, color: AppColors.supervisorAccent) : null,
              onTap: () {
                final y = DateTime.now().subtract(const Duration(days: 1));
                final key =
                    '${y.year}-${y.month.toString().padLeft(2, '0')}-${y.day.toString().padLeft(2, '0')}';
                Navigator.pop(ctx, key);
              },
            ),
            ListTile(
              title: const Text('Сброс', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: const Text('Сегодня · без поиска'),
              onTap: () => Navigator.pop(ctx, 'reset'),
            ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    if (picked == 'reset') {
      setState(() {
        _dateKey = 'today';
        _query = '';
        _onlyWithLocation = false;
      });
      return;
    }
    setState(() => _dateKey = picked);
  }

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    final l10n = ref.watch(svL10nProvider);
    final visitsAsync = ref.watch(supervisorVisitsProvider(_dateKey));
    final gpsAsync = ref.watch(supervisorAgentLocationsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: l10n.visits,
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () async {
              final q = await showSupervisorSearchSheet(context, hint: l10n.search);
              if (q != null) setState(() => _query = q);
            },
          ),
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _pickFilter,
          ),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () {
              final pins = (gpsAsync.valueOrNull ?? [])
                  .map((p) => (name: p.agentName, lat: p.latitude, lng: p.longitude))
                  .toList();
              openSupervisorMapPins(context: context, pins: pins);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          TabBar(
            controller: _tabs,
            labelColor: accent,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: accent,
            labelStyle: const TextStyle(fontWeight: FontWeight.w700),
            tabs: [
              Tab(text: l10n.notVisited),
              Tab(text: l10n.visited),
            ],
          ),
          if (_query.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SvCard(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(child: Text('«$_query»', style: AppTypography.caption)),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() => _query = ''),
                    ),
                  ],
                ),
              ),
            ),
          CheckboxListTile(
            dense: true,
            value: _onlyWithLocation,
            onChanged: (v) => setState(() => _onlyWithLocation = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('Показать только с местоположением', style: TextStyle(fontSize: 13)),
            activeColor: accent,
          ),
          Expanded(
            child: visitsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text('Нет визитов')),
              data: (payload) {
                final parsed = SupervisorVisitsPayload.fromApi(payload);
                final gpsIds = {
                  for (final p in gpsAsync.valueOrNull ?? const [])
                    if (p.latitude != null && p.longitude != null) p.agentId,
                };
                final notVisited = parsed.rows.where((r) => r.notVisited > 0 || r.visitedTotal == 0).toList();
                final visited = parsed.rows.where((r) => r.visitedTotal > 0).toList();
                var list = _tabs.index == 0 ? notVisited : visited;
                if (_onlyWithLocation) {
                  list = list.where((r) => gpsIds.contains(r.agentId)).toList();
                }
                if (_query.isNotEmpty) {
                  final q = _query.toLowerCase();
                  list = list
                      .where((r) =>
                          r.agentName.toLowerCase().contains(q) ||
                          (r.agentCode?.toLowerCase().contains(q) ?? false),)
                      .toList();
                }

                if (list.isEmpty) {
                  return Center(
                    child: Text(
                      _tabs.index == 0 ? 'Нет непосещённых' : 'Нет визитов',
                      style: AppTypography.caption,
                    ),
                  );
                }

                return RefreshIndicator(
                  color: accent,
                  onRefresh: () async {
                    ref.invalidate(supervisorVisitsProvider(_dateKey));
                    await ref.read(supervisorVisitsProvider(_dateKey).future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final r = list[i];
                      return SvCard(
                        onTap: () {
                          final session = ref.read(sessionProvider);
                          showSupervisorVisitDetailSheet(
                            context,
                            ref,
                            row: r,
                            policy: SupervisorConfigPolicy(session.mobileConfig),
                          );
                        },
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.storefront, color: accent, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(r.agentName.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                                  if (r.agentCode != null && r.agentCode!.isNotEmpty)
                                    Text(r.agentCode!, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Text('План ${r.visitedTotal}/${r.plannedVisits}', style: AppTypography.caption),
                                      const Spacer(),
                                      Text('${r.salesSum} UZS', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              margin: const EdgeInsets.only(left: 8),
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.primaryDark,
                                borderRadius: BorderRadius.circular(13),
                              ),
                              child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
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

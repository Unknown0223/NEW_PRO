import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_product.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';
import '../shell/expeditor_drawer.dart';
import 'expeditor_visit_cards.dart';
import 'expeditor_visits_tezyuk.dart';

class ExpeditorVisitsPage extends ConsumerStatefulWidget {
  const ExpeditorVisitsPage({super.key});

  @override
  ConsumerState<ExpeditorVisitsPage> createState() =>
      _ExpeditorVisitsPageState();
}

class _ExpeditorVisitsPageState extends ConsumerState<ExpeditorVisitsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  final _tabKeys = ['active', 'completed', 'routes'];

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (isTezyukProduct) {
      return const ExpeditorVisitsTezyukView();
    }

    final tab = _tabKeys[_tabs.index];
    final visits = ref.watch(expeditorVisitsProvider(tab));

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: const Text('Визиты'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () => _openMap(visits.valueOrNull ?? const []),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          onTap: (_) => setState(() {}),
          labelColor: AppColors.expeditorAccent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.expeditorAccent,
          tabs: const [
            Tab(text: 'Активный'),
            Tab(text: 'Завершенные'),
            Tab(text: 'Маршруты'),
          ],
        ),
      ),
      body: visits.when(
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: AppColors.expeditorAccent,
              onRefresh: () async =>
                  ref.invalidate(expeditorVisitsProvider(tab)),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.55,
                    child: AgentEmptyState.fill(message: 'Пока здесь пусто'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: AppColors.expeditorAccent,
            onRefresh: () async => ref.invalidate(expeditorVisitsProvider(tab)),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = rows[i];
                if (tab == 'routes') {
                  return ExpeditorVisitCard(
                    row: r,
                    seq: r['seq'] as int? ?? i + 1,
                    onTap: () => _openVisit(r),
                  );
                }
                return ExpeditorClientVisitCard(
                  row: r,
                  completed: tab == 'completed',
                  onTap: () => _openVisit(r, readOnly: tab == 'completed'),
                  onBalanceTap: () => _showBalanceSheet(r),
                );
              },
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.expeditorAccent),
        ),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
      ),
    );
  }

  void _openMap(List<Map<String, dynamic>> rows) {
    final withCoords = rows
        .where(
          (r) =>
              (r['latitude'] as num?) != null &&
              (r['longitude'] as num?) != null &&
              ((r['latitude'] as num?) != 0 || (r['longitude'] as num?) != 0),
        )
        .toList();
    if (withCoords.isEmpty) {
      showAgentToast(context, 'Нет точек с координатами');
      return;
    }
    context.push('/exp-visits-map', extra: withCoords);
  }

  void _openVisit(Map<String, dynamic> v, {bool readOnly = false}) {
    final clientId = v['client_id'] as int?;
    if (clientId != null) {
      final extra = {...v, if (readOnly) 'readonly': true};
      context.push('/exp-client/$clientId', extra: extra);
      return;
    }
    final oid = v['order_id'] as int?;
    if (oid != null) context.push('/deliveries/$oid');
  }

  void _showBalanceSheet(Map<String, dynamic> v) {
    final clientId = v['client_id'] as int?;
    final fallback = (v['balance'] as num?)?.toDouble() ?? 0;
    showBalanceByAgentSheet(
      context,
      clientId: clientId,
      fallbackTotal: fallback,
    );
  }
}
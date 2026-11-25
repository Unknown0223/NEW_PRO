import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';
import '../shared/tezyuk_filter_chips.dart';
import '../shell/expeditor_drawer.dart';
import 'expeditor_visit_cards.dart';
import 'expeditor_visits_tezyuk_filter.dart';

/// Stitch `tashriflar_va_xarita` — faqat TezYuk.
class ExpeditorVisitsTezyukView extends ConsumerStatefulWidget {
  const ExpeditorVisitsTezyukView({super.key});

  @override
  ConsumerState<ExpeditorVisitsTezyukView> createState() =>
      _ExpeditorVisitsTezyukViewState();
}

class _ExpeditorVisitsTezyukViewState
    extends ConsumerState<ExpeditorVisitsTezyukView> {
  int _chip = 0;

  Future<void> _refresh() async {
    ref.invalidate(expeditorVisitsProvider('active'));
    ref.invalidate(expeditorVisitsProvider('completed'));
    await Future.wait([
      ref.read(expeditorVisitsProvider('active').future),
      ref.read(expeditorVisitsProvider('completed').future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final active = ref.watch(expeditorVisitsProvider('active'));
    final completed = ref.watch(expeditorVisitsProvider('completed'));
    final filterKey = tezyukVisitChipKeys[_chip];

    return Scaffold(
      backgroundColor: TezyukColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        backgroundColor: TezyukColors.background,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Tashriflar',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.map_outlined),
            onPressed: () {
              final merged = mergeTezyukVisitRows(
                active.valueOrNull ?? const [],
                completed.valueOrNull ?? const [],
              );
              _openMap(filterTezyukVisitRows(merged, filterKey));
            },
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 4),
          TezyukFilterChips(
            labels: tezyukVisitChipLabels,
            selectedIndex: _chip,
            onSelected: (i) => setState(() => _chip = i),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _buildList(active, completed, filterKey),
          ),
        ],
      ),
    );
  }

  Widget _buildList(
    AsyncValue<List<Map<String, dynamic>>> active,
    AsyncValue<List<Map<String, dynamic>>> completed,
    String filterKey,
  ) {
  if (active.isLoading || completed.isLoading) {
    return const Center(
      child: CircularProgressIndicator(color: TezyukColors.primary),
    );
  }
  if (active.hasError) {
    return Center(child: Text('Xato: ${active.error}'));
  }
  if (completed.hasError) {
    return Center(child: Text('Xato: ${completed.error}'));
  }

  final merged = mergeTezyukVisitRows(
    active.value ?? const [],
    completed.value ?? const [],
  );
  final rows = filterTezyukVisitRows(merged, filterKey);

  if (rows.isEmpty) {
    return RefreshIndicator(
      color: TezyukColors.primary,
      onRefresh: _refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.45,
            child: AgentEmptyState.fill(message: 'Hali bo\'sh'),
          ),
        ],
      ),
    );
  }

  return RefreshIndicator(
    color: TezyukColors.primary,
    onRefresh: _refresh,
    child: ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final r = rows[i];
        final status = (r['status']?.toString() ?? '').toLowerCase();
        final isDone = status == 'delivered' || status == 'returned';
        return ExpeditorClientVisitCard(
          tezyuk: true,
          row: r,
          completed: isDone,
          onTap: () => _openVisit(r, readOnly: isDone),
          onBalanceTap: () => _showBalanceSheet(r),
        );
      },
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
      showAgentToast(context, 'Koordinatali nuqta yo\'q');
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
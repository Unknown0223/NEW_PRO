import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/stock_snapshot_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import 'warehouse_stock_providers.dart';

class AgentWarehouseStockPage extends ConsumerStatefulWidget {
  const AgentWarehouseStockPage({super.key});

  @override
  ConsumerState<AgentWarehouseStockPage> createState() => _AgentWarehouseStockPageState();
}

class _AgentWarehouseStockPageState extends ConsumerState<AgentWarehouseStockPage> with WidgetsBindingObserver {
  final Map<String, bool> _expanded = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      ref.read(warehouseStockProvider.notifier).refresh();
    }
  }

  Future<void> _refreshStock({bool force = false}) async {
    await ref.read(warehouseStockProvider.notifier).refresh(force: force);
    final stockAsync = ref.read(warehouseStockProvider);
    if (stockAsync.hasValue && !stockAsync.hasError) {
      await _recordStockSnapshotIfNeeded();
    }
  }

  Future<void> _recordStockSnapshotIfNeeded() async {
    final cfg = ref.read(sessionProvider).mobileConfig;
    if (cfg?.misc.requireStockSnapshotForOrder != true) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      await ref.read(stockSnapshotApiProvider).recordStockSnapshot(slug);
      final now = DateTime.now();
      final day =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      await ref.read(agentLocalPrefsProvider.notifier).setPrefs((p) => p.copyWith(stockSnapshotDay: day));
    } catch (_) {}
  }

  Future<void> _openSearch() async {
    await context.push('/search?from=/warehouse-stock');
    if (mounted) await _refreshStock();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(agentRouteReselectProvider, (prev, next) {
      if (next == '/warehouse-stock') {
        _refreshStock();
        ref.read(agentRouteReselectProvider.notifier).state = null;
      }
    });

    ref.listen(warehouseStockProvider, (prev, next) {
      final view = next.valueOrNull;
      if (view?.warehouseId != null &&
          ref.read(warehouseStockWarehouseIdProvider) == null) {
        ref.read(warehouseStockWarehouseIdProvider.notifier).state = view!.warehouseId;
      }
    });

    final stockAsync = ref.watch(warehouseStockProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Остатки на складе',
        showBack: true,
        actions: [
          AgentIconButton(icon: Icons.search, onPressed: _openSearch),
        ],
      ),
      body: stockAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(e.toString(), textAlign: TextAlign.center, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => _refreshStock(force: true), child: const Text('Qayta urinish')),
              ],
            ),
          ),
        ),
        data: (view) {
          final whName = view.warehouses
                  .where((w) => w['id'] == view.warehouseId)
                  .map((w) => w['name']?.toString())
                  .firstOrNull ??
              'Ombor';

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                color: AppColors.surface,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Row(
                  children: [
                    Text(
                      whName,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.teal700),
                    ),
                    const SizedBox(width: 8),
                    if (view.warehouses.length > 1)
                      PopupMenuButton<int>(
                        icon: const Icon(Icons.expand_more, color: AppColors.teal700),
                        onSelected: (v) {
                          ref.read(warehouseStockWarehouseIdProvider.notifier).state = v;
                          _refreshStock(force: true);
                        },
                        itemBuilder: (_) => [
                          for (final w in view.warehouses)
                            PopupMenuItem<int>(
                              value: (w['id'] as num?)?.toInt() ?? 0,
                              child: Text(w['name']?.toString() ?? ''),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => _refreshStock(force: true),
                  child: !view.hasAnyStock
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                              height: MediaQuery.sizeOf(context).height * 0.45,
                              child: AgentEmptyState.fill(message: S.emptyStock),
                            ),
                          ],
                        )
                      : ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                          children: [
                            for (final cat in view.categories)
                              AgentExpandableStockGroup(
                                title: cat.name,
                                expanded: _expanded[cat.name] ?? false,
                                onToggle: () => setState(() {
                                  final open = !(_expanded[cat.name] ?? false);
                                  for (final k in _expanded.keys) {
                                    _expanded[k] = false;
                                  }
                                  _expanded[cat.name] = open;
                                }),
                                items: cat.items
                                    .map((l) => (name: l.name, price: l.priceLabel, count: l.count))
                                    .toList(),
                              ),
                          ],
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

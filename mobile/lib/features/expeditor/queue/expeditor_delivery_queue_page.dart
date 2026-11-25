import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_product.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../expeditor_status_labels.dart';
import '../shared/tezyuk_filter_chips.dart';
import '../shell/expeditor_drawer.dart';
import 'expeditor_delivery_queue_filter.dart';

/// TezYuk — yetkazish navbati (stock `/deliveries` dan alohida).
class ExpeditorDeliveryQueuePage extends ConsumerStatefulWidget {
  const ExpeditorDeliveryQueuePage({super.key});

  @override
  ConsumerState<ExpeditorDeliveryQueuePage> createState() =>
      _ExpeditorDeliveryQueuePageState();
}

class _ExpeditorDeliveryQueuePageState
    extends ConsumerState<ExpeditorDeliveryQueuePage>
    with SingleTickerProviderStateMixin {
  TabController? _salesDocTabs;
  int _tezyukChip = 0;

  static const _tabKeys = ['all', 'pending', 'delivered', 'return'];

  static const _tezyukChipLabels = [
    'Hammasi',
    'Kutilmoqda',
    'Yetkazildi',
    'Qaytarish',
  ];

  static const _salesDocTabLabels = [
    'Все',
    'В ожидании',
    'Доставлено',
    'Возврат',
  ];

  @override
  void initState() {
    super.initState();
    if (!isTezyukProduct) {
      _salesDocTabs = TabController(length: 4, vsync: this);
    }
  }

  @override
  void dispose() {
    _salesDocTabs?.dispose();
    super.dispose();
  }

  String get _tabKey {
    if (isTezyukProduct) {
      return _tabKeys[_tezyukChip.clamp(0, _tabKeys.length - 1)];
    }
    final idx = _salesDocTabs?.index ?? 0;
    return _tabKeys[idx.clamp(0, _tabKeys.length - 1)];
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(deliveriesProvider(null));
    final tezyuk = isTezyukProduct;

    return Scaffold(
      backgroundColor:
          tezyuk ? TezyukColors.background : AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        backgroundColor: tezyuk ? TezyukColors.background : null,
        surfaceTintColor: tezyuk ? Colors.transparent : null,
        title: Text(
          tezyuk ? 'Yetkazish' : 'Доставки',
          style: tezyuk
              ? const TextStyle(fontWeight: FontWeight.w800)
              : null,
        ),
        bottom: tezyuk
            ? null
            : TabBar(
                controller: _salesDocTabs,
                onTap: (_) => setState(() {}),
                labelColor: AppColors.expeditorAccent,
                unselectedLabelColor: AppColors.textSecondary,
                tabs: [
                  for (final l in _salesDocTabLabels) Tab(text: l),
                ],
              ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (tezyuk) ...[
            const SizedBox(height: 4),
            TezyukFilterChips(
              labels: _tezyukChipLabels,
              selectedIndex: _tezyukChip,
              onSelected: (i) => setState(() => _tezyukChip = i),
            ),
            const SizedBox(height: 8),
          ],
          Expanded(child: _queueBody(async, tezyuk)),
        ],
      ),
    );
  }

  Widget _queueBody(AsyncValue<List<dynamic>> async, bool tezyuk) {
    return async.when(
      loading: () => Center(
        child: CircularProgressIndicator(
          color: tezyuk ? TezyukColors.primary : AppColors.expeditorAccent,
        ),
      ),
      error: (e, _) => Center(child: Text(tezyuk ? 'Xato: $e' : 'Ошибка: $e')),
      data: (list) {
        final rows = filterQueueRows(
          list.map((e) => Map<String, dynamic>.from(e)).toList(),
          _tabKey,
        );
        if (rows.isEmpty) {
          return AgentEmptyState.fill(
            message: tezyuk ? 'Hali buyurtma yo\'q' : 'Пока здесь пусто',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final o = rows[i];
            final id = o['id'] as int? ?? 0;
            final status = o['status']?.toString() ?? '';
            final sum =
                formatMoneySpaced((o['total_sum'] as num?)?.toDouble() ?? 0);

            if (tezyuk) {
              return Material(
                color: TezyukColors.surfaceBright,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: TezyukColors.surfaceContainerHigh),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: id > 0 ? () => context.push('/deliveries/$id') : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                o['client_name']?.toString() ?? '—',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                  color: TezyukColors.onSurface,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '#${o['number'] ?? id} · ${expeditorStatusLabel(status)}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: TezyukColors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          "$sum So'm",
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: TezyukColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }

            return AgentSurfaceCard(
              child: ListTile(
                onTap: id > 0 ? () => context.push('/deliveries/$id') : null,
                title: Text(
                  '#${o['number'] ?? id} · ${o['client_name'] ?? '—'}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(_salesDocStatusLabel(status)),
                trailing: Text(sum),
              ),
            );
          },
        );
      },
    );
  }

  static String _salesDocStatusLabel(String status) {
    switch (status.trim().toLowerCase()) {
      case 'new':
        return 'Новый';
      case 'confirmed':
        return 'Подтверждён';
      case 'picking':
        return 'Комплектация';
      case 'delivering':
        return 'В доставке';
      case 'delivered':
        return 'Доставлено';
      case 'returned':
        return 'Возврат';
      case 'cancelled':
        return 'Отменён';
      default:
        return status;
    }
  }
}
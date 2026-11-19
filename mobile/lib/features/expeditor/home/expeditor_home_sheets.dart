import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../expeditor_status_labels.dart';

String _money(num v) => "${formatMoneySpaced(v.toDouble())} so'm";

/// Bosh ekran bottom-sheet qobig'i (tutqich + sarlavha + yopish).
Future<void> _showExpeditorSheet(
  BuildContext context, {
  required String title,
  required Widget child,
  double heightFactor = 0.86,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return Container(
        height: MediaQuery.sizeOf(ctx).height * heightFactor,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: AgentSheetHandle(),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: AppTypography.titleMedium
                          .copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Material(
                    color: AppColors.surfaceVariant,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => Navigator.pop(ctx),
                      child: const SizedBox(
                          width: 30,
                          height: 30,
                          child: Icon(Icons.close, size: 18),),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
            Expanded(child: child),
          ],
        ),
      );
    },
  );
}

/// «По клиентам» — yetkazib berishlar mijozlar kesimida.
Future<void> showExpeditorDeliveryByClientsSheet(BuildContext context) {
  return _showExpeditorSheet(
    context,
    title: 'Доставка по клиентам',
    child: const _DeliveryByClientsView(),
  );
}

/// «По продуктам» — yetkazib berishlar mahsulotlar kesimida.
Future<void> showExpeditorDeliveryByProductsSheet(BuildContext context) {
  return _showExpeditorSheet(
    context,
    title: 'Доставка по продуктам',
    child: const _DeliveryByProductsView(),
  );
}

/// «Информация оплаты» — to'lovlar (Список оплат / По клиентам).
Future<void> showExpeditorPaymentsSheet(BuildContext context) {
  return _showExpeditorSheet(
    context,
    title: 'Оплаты',
    child: const _PaymentsSheetView(),
  );
}

class _DeliveryByClientsView extends ConsumerWidget {
  const _DeliveryByClientsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deliveries = ref.watch(deliveriesProvider(null));
    return deliveries.when(
      data: (rows) {
        if (rows.isEmpty) {
          return AgentEmptyState.fill(message: 'Пока здесь пусто');
        }
        final groups = <String, _ClientAgg>{};
        for (final r in rows) {
          final name = (r['client_name'] ?? r['client'] ?? '—').toString();
          final amount = (r['total'] as num?)?.toDouble() ??
              (r['amount'] as num?)?.toDouble() ??
              (r['sum'] as num?)?.toDouble() ??
              0;
          final delivered = r['status']?.toString() == 'delivered';
          final g = groups.putIfAbsent(name, () => _ClientAgg());
          g.count += 1;
          g.amount += amount;
          if (delivered) g.delivered += 1;
        }
        final list = groups.entries.toList()
          ..sort((a, b) => b.value.amount.compareTo(a.value.amount));
        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final e = list[i];
            return AgentSurfaceCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.storefront_outlined,
                        color: AppColors.textSecondary, size: 20,),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.key,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700),),
                        const SizedBox(height: 2),
                        Text(
                            'Доставлено: ${e.value.delivered} / ${e.value.count}',
                            style: AppTypography.caption,),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(_money(e.value.amount),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.expeditorAccent,),),
                ],
              ),
            );
          },
        );
      },
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
      error: (e, _) => AgentEmptyState.fill(message: 'Пока здесь пусто'),
    );
  }
}

class _ClientAgg {
  int count = 0;
  int delivered = 0;
  double amount = 0;
}

class _DeliveryByProductsView extends ConsumerWidget {
  const _DeliveryByProductsView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(expeditorDashboardProvider);
    return dash.when(
      data: (d) {
        final rows = (d['shipment_report'] as List?)?.cast<Map>() ?? [];
        final products = rows
            .map((e) => Map<String, dynamic>.from(e))
            .where((r) =>
                ((r['qty'] as num?) ?? 0) != 0 ||
                ((r['sum'] as num?) ?? 0) != 0,)
            .toList();
        if (products.isEmpty) {
          return AgentEmptyState.fill(message: 'Пока здесь пусто');
        }
        return ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: products.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final r = products[i];
            return AgentSurfaceCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                        r['label']?.toString() ?? r['type']?.toString() ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w700),),
                  ),
                  Text('${r['qty'] ?? 0} шт', style: AppTypography.caption),
                  const SizedBox(width: 12),
                  Text(_money((r['sum'] as num?) ?? 0),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.expeditorAccent,),),
                ],
              ),
            );
          },
        );
      },
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
      error: (e, _) => AgentEmptyState.fill(message: 'Пока здесь пусто'),
    );
  }
}

class _PaymentsSheetView extends ConsumerStatefulWidget {
  const _PaymentsSheetView();

  @override
  ConsumerState<_PaymentsSheetView> createState() => _PaymentsSheetViewState();
}

class _PaymentsSheetViewState extends ConsumerState<_PaymentsSheetView>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupBy = _tabs.index == 0 ? 'list' : 'clients';
    final data = ref.watch(expeditorPaymentsSummaryProvider(groupBy));

    return Column(
      children: [
        TabBar(
          controller: _tabs,
          onTap: (_) => setState(() {}),
          labelColor: AppColors.expeditorAccent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.expeditorAccent,
          tabs: const [
            Tab(text: 'Список оплат'),
            Tab(text: 'По клиентам'),
          ],
        ),
        Expanded(
          child: data.when(
            data: (payload) {
              final rows = (payload['data'] as List?) ?? [];
              if (rows.isEmpty) {
                return AgentEmptyState.fill(message: 'Пока здесь пусто');
              }
              if (groupBy == 'list') {
                return ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final p = Map<String, dynamic>.from(rows[i] as Map);
                    final wf = p['workflow_status']?.toString() ?? 'confirmed';
                    final paid = p['paid_at']?.toString() ??
                        p['received_at']?.toString();
                    final dt = paid != null ? DateTime.tryParse(paid) : null;
                    final pending = expeditorPaymentIsPending(wf);
                    return AgentSurfaceCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    '${p['client_name'] ?? ''} — #${p['order_number'] ?? ''}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,),),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (dt != null)
                                      DateFormat('dd.MM.yyyy HH:mm')
                                          .format(dt.toLocal()),
                                    expeditorPaymentWorkflowLabel(wf),
                                  ].where((s) => s.isNotEmpty).join(' · '),
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _money((p['amount'] as num?) ?? 0),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: pending
                                  ? AppColors.warning
                                  : AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final c = Map<String, dynamic>.from(rows[i] as Map);
                  return AgentSurfaceCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(c['client_name']?.toString() ?? '—',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,),),
                              const SizedBox(height: 2),
                              Text(
                                  'Платежей: ${(c['payments'] as List?)?.length ?? 0}',
                                  style: AppTypography.caption,),
                            ],
                          ),
                        ),
                        Text(
                          _money((c['total'] as num?) ?? 0),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.success,),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => const Center(
                child: CircularProgressIndicator(
                    color: AppColors.expeditorAccent,),),
            error: (e, _) => AgentEmptyState.fill(message: 'Пока здесь пусто'),
          ),
        ),
      ],
    );
  }
}

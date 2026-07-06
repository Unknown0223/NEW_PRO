import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../expeditor_providers.dart';

/// «Остаток в машине» — ekspeditor skladdan olib chiqqan, hali mijozga
/// yetkazilmagan mahsulotlar ro'yxati (qoldiq).
class ExpeditorDeliveriesPage extends ConsumerWidget {
  const ExpeditorDeliveriesPage({super.key});

  static String _qty(num? v) {
    final d = (v ?? 0).toDouble();
    if (d == d.roundToDouble()) return d.toInt().toString();
    return d.toStringAsFixed(3).replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stock = ref.watch(expeditorVehicleStockProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Остаток в машине')),
      body: stock.when(
        data: (data) {
          final products = (data['products'] as List?)
                  ?.map((e) => Map<String, dynamic>.from(e as Map))
                  .toList() ??
              [];
          final totals = Map<String, dynamic>.from(data['totals'] as Map? ?? {});
          if (products.isEmpty) {
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(expeditorVehicleStockProvider),
              child: ListView(
                children: [
                  SizedBox(
                    height: MediaQuery.of(context).size.height * 0.7,
                    child: AgentEmptyState.fill(message: S.emptyVehicleStock),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(expeditorVehicleStockProvider),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              itemCount: products.length + 1,
              itemBuilder: (ctx, i) {
                if (i == 0) return _SummaryHeader(totals: totals);
                final p = products[i - 1];
                final code = p['code']?.toString();
                final category = p['category']?.toString();
                final subtitleParts = <String>[
                  if (code != null && code.isNotEmpty) code,
                  if (category != null && category.isNotEmpty) category,
                ];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 3),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.expeditorAccent.withValues(alpha: 0.1),
                      child: const Icon(Icons.inventory_2_outlined, color: AppColors.expeditorAccent),
                    ),
                    title: Text(
                      p['name']?.toString() ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: subtitleParts.isEmpty
                        ? null
                        : Text(subtitleParts.join(' · '),
                            maxLines: 2, overflow: TextOverflow.ellipsis,),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          _qty(p['remaining_qty'] as num?),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                            color: AppColors.expeditorAccent,
                          ),
                        ),
                        Text(
                          'из ${_qty(p['loaded_qty'] as num?)}',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Xato: $e')),
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  final Map<String, dynamic> totals;
  const _SummaryHeader({required this.totals});

  @override
  Widget build(BuildContext context) {
    final productCount = (totals['product_count'] as num?)?.toInt() ?? 0;
    final remaining = ExpeditorDeliveriesPage._qty(totals['remaining_qty'] as num?);
    final delivered = ExpeditorDeliveriesPage._qty(totals['delivered_qty'] as num?);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: AppColors.expeditorAccent.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            _Metric(label: 'Наименований', value: productCount.toString()),
            _divider(),
            _Metric(label: 'Остаток', value: remaining, accent: true),
            _divider(),
            _Metric(label: 'Доставлено', value: delivered),
          ],
        ),
      ),
    );
  }

  Widget _divider() => Container(
        width: 1,
        height: 34,
        margin: const EdgeInsets.symmetric(horizontal: 8),
        color: AppColors.textSecondary.withValues(alpha: 0.18),
      );
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  final bool accent;
  const _Metric({required this.label, required this.value, this.accent = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: accent ? AppColors.expeditorAccent : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

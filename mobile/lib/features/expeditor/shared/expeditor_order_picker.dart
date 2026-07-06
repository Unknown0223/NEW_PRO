import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_typography.dart';
import '../expeditor_providers.dart';

/// Yetkazilgan buyurtmalar ro'yxati — to'lov yoki qaytarish uchun tanlash.
class ExpeditorOrderPicker extends ConsumerWidget {
  final String title;
  final String emptyMessage;
  final bool onlyDelivered;
  final bool onlyWithDebt;
  final void Function(int orderId) onSelect;

  /// Ro'yxat ustida ko'rsatiladigan ixtiyoriy banner (masalan, qaytarilgan to'lovlar taymeri).
  final Widget? header;

  const ExpeditorOrderPicker({
    super.key,
    required this.title,
    required this.emptyMessage,
    required this.onSelect,
    this.onlyDelivered = false,
    this.onlyWithDebt = false,
    this.header,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(deliveriesProvider(null));

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: orders.when(
        data: (list) {
          var filtered = list;
          if (onlyDelivered) {
            filtered = filtered.where((o) => o['status'] == 'delivered').toList();
          }
          if (onlyWithDebt) {
            filtered = filtered.where((o) {
              final debt = double.tryParse(o['debt']?.toString() ?? '') ?? 0;
              return debt > 0;
            }).toList();
          }
          final itemCount = filtered.length + (header != null ? 1 : 0);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(deliveriesProvider(null)),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              itemCount: itemCount == 0 ? 1 : itemCount,
              itemBuilder: (ctx, i) {
                if (header != null && i == 0) return header!;
                final idx = header != null ? i - 1 : i;
                if (filtered.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(child: Text(emptyMessage)),
                  );
                }
                final o = filtered[idx];
                final id = o['id'] as int? ?? 0;
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 3),
                  child: ListTile(
                    title: Text('#${o['number'] ?? id}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(o['client_name']?.toString() ?? ''),
                    trailing: Text(
                      o['total_sum']?.toString() ?? '',
                      style: AppTypography.bodySmall,
                    ),
                    onTap: () => onSelect(id),
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

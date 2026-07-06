import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// «Mening qaytarishlarim» — ekspeditor omborga TOPSHIRADIGAN qaytarish
/// hujjatlari (vozvratnaya nakladnaya): mahsulot + miqdor va zavsklad qabul
/// holati (kutilmoqda / qabul qilindi / rad etildi).
class ExpeditorMyReturnsPage extends ConsumerWidget {
  const ExpeditorMyReturnsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(expeditorMyReturnsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mening qaytarishlarim'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(
          message: e.toString(),
          onRetry: () => ref.invalidate(expeditorMyReturnsProvider),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return const _EmptyView();
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(expeditorMyReturnsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _ReturnCard(rows[i]),
            ),
          );
        },
      ),
    );
  }
}

class _ReturnCard extends StatelessWidget {
  const _ReturnCard(this.row);

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final status = row['status']?.toString() ?? 'pending';
    final statusLabel = row['status_label']?.toString() ?? status;
    final number = row['number']?.toString() ?? '—';
    final orderNumber = row['order_number']?.toString();
    final clientName = row['client_name']?.toString();
    final createdAt = _fmtDate(row['created_at']?.toString());
    final acceptedAt = _fmtDate(row['accepted_at']?.toString());
    final items = (row['items'] as List? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final totalQty = (row['total_qty'] as num?)?.toDouble() ?? 0;
    final refund = (row['refund_amount'] != null)
        ? double.tryParse(row['refund_amount'].toString())
        : null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          title: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      number,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (orderNumber != null && orderNumber.isNotEmpty)
                          'Zakaz $orderNumber',
                        if (clientName != null && clientName.isNotEmpty) clientName,
                      ].join(' · '),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusBadge(status: status, label: statusLabel),
            ],
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                const Icon(Icons.inventory_2_outlined,
                    size: 14, color: AppColors.textMuted,),
                const SizedBox(width: 4),
                Text(
                  '${items.length} nom · jami ${_fmtQty(totalQty)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const Spacer(),
                Text(
                  createdAt,
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          children: [
            const Divider(height: 1, color: AppColors.divider),
            const SizedBox(height: 8),
            ...items.map(
              (it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            it['name']?.toString() ?? '—',
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.textPrimary,),
                          ),
                          Text(
                            it['sku']?.toString() ?? '',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textMuted,),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      _fmtQty(double.tryParse(it['qty']?.toString() ?? '0') ?? 0),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (refund != null && refund > 0) ...[
              const SizedBox(height: 6),
              const Divider(height: 1, color: AppColors.divider),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Text('Qaytarish summasi',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),),
                  const Spacer(),
                  Text(
                    "${formatMoneySpaced(refund)} So'm",
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600,),
                  ),
                ],
              ),
            ],
            if (acceptedAt.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.verified_outlined,
                      size: 14, color: AppColors.success,),
                  const SizedBox(width: 4),
                  Text(
                    'Zavsklad qabul qildi · $acceptedAt',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.success,),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _fmtQty(double q) {
    if (q == q.roundToDouble()) return q.toInt().toString();
    return q.toStringAsFixed(2);
  }

  static String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final l = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(l.day)}.${two(l.month)}.${l.year} ${two(l.hour)}:${two(l.minute)}';
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.label});

  final String status;
  final String label;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    switch (status) {
      case 'posted':
        bg = AppColors.success.withValues(alpha: 0.12);
        fg = AppColors.success;
        break;
      case 'cancelled':
        bg = AppColors.error.withValues(alpha: 0.12);
        fg = AppColors.error;
        break;
      default:
        bg = AppColors.warning.withValues(alpha: 0.15);
        fg = AppColors.warning;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Icon(Icons.assignment_return_outlined,
            size: 56, color: AppColors.textDisabled,),
        SizedBox(height: 12),
        Center(
          child: Text(
            'Hozircha qaytarish hujjatlari yo\'q',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Qayta urinish')),
        ],
      ),
    );
  }
}

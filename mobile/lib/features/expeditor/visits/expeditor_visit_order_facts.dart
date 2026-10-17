import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// Zakaz kartasidagi tarkib: mahsulotlar, chegirma va bonus.
class ExpeditorVisitOrderFacts extends ConsumerWidget {
  final int orderId;

  const ExpeditorVisitOrderFacts({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(expeditorOrderDetailProvider(orderId));
    return detail.when(
      skipLoadingOnReload: true,
      loading: () => const Padding(
        padding: EdgeInsets.only(top: 12),
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.expeditorAccent,
            ),
          ),
        ),
      ),
      error: (_, __) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Text(
          'Состав заказа не загрузился',
          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
        ),
      ),
      data: _body,
    );
  }

  Widget _body(Map<String, dynamic> order) {
    final items = ((order['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    final sale = items.where((row) => row['is_bonus'] != true).toList();
    final bonus = items.where((row) => row['is_bonus'] == true).toList();
    final discount = (order['discount_sum'] as num?)?.toDouble() ?? 0;
    final bonusSum = (order['bonus_sum'] as num?)?.toDouble() ?? 0;
    final bonusQty = bonus.fold<double>(
      0,
      (sum, row) => sum + ((row['qty'] as num?)?.toDouble() ?? 0),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        const Divider(height: 1, color: AppColors.borderLight),
        const SizedBox(height: 10),
        if (sale.isEmpty && bonus.isEmpty)
          Text(
            'В заказе нет позиций',
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          )
        else ...[
          for (final row in sale) _saleLine(row),
          for (final row in bonus) _bonusLine(row),
        ],
        const SizedBox(height: 4),
        _moneyRow(
          'Скидка:',
          discount > 0 ? '−${formatMoneySpaced(discount)} сум' : '0 сум',
          valueColor: discount > 0 ? AppColors.discInk : null,
        ),
        const SizedBox(height: 6),
        _moneyRow(
          'Бонус:',
          _bonusLabel(bonusQty, bonusSum),
          valueColor: bonusQty > 0 || bonusSum > 0 ? AppColors.bonusInk : null,
        ),
      ],
    );
  }

  Widget _saleLine(Map<String, dynamic> row) {
    final name = row['product_name']?.toString().trim();
    final qty = (row['qty'] as num?)?.toDouble() ?? 0;
    final price = (row['price'] as num?)?.toDouble() ?? 0;
    final total = (row['total'] as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name == null || name.isEmpty ? 'Товар' : name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textHeadline,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_qty(qty)} × ${formatMoneySpaced(price)}',
                  style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${formatMoneySpaced(total)} сум',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.textHeadline,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bonusLine(Map<String, dynamic> row) {
    final name = row['product_name']?.toString().trim();
    final qty = (row['qty'] as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Бонус: ${name == null || name.isEmpty ? 'товар' : name}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.bonusInk,
              ),
            ),
          ),
          Text(
            '${_qty(qty)} шт',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.bonusInk,
            ),
          ),
        ],
      ),
    );
  }

  Widget _moneyRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: valueColor ?? AppColors.textHeadline,
          ),
        ),
      ],
    );
  }

  String _bonusLabel(double qty, double sum) {
    if (qty <= 0 && sum <= 0) return '0';
    final parts = <String>[];
    if (qty > 0) parts.add('${_qty(qty)} шт');
    if (sum > 0) parts.add('${formatMoneySpaced(sum)} сум');
    return parts.join(' · ');
  }

  String _qty(double qty) {
    if (qty == qty.roundToDouble()) return qty.toStringAsFixed(0);
    return qty.toStringAsFixed(2);
  }
}

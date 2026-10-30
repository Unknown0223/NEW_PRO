import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;

/// Bosh sahifa «Отчет по отгрузкам» — o‘qiladigan qatorlar.
class ExpeditorHomeReportTable extends StatelessWidget {
  final List<Map<String, dynamic>> rows;

  const ExpeditorHomeReportTable({super.key, required this.rows});

  Color _color(String type) {
    switch (type) {
      case 'delivered':
        return AppColors.success;
      case 'return':
      case 'shelf_return':
        return AppColors.error;
      case 'exchange_return':
        return AppColors.warning;
      default:
        return AppColors.textPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    const header = TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: AppColors.textSecondary,
    );
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Row(
            children: [
              Expanded(flex: 5, child: Text('Тип', style: header)),
              SizedBox(
                width: 64,
                child: Text('Кол-во', textAlign: TextAlign.right, style: header),
              ),
              SizedBox(width: 10),
              SizedBox(
                width: 88,
                child: Text('Сумма', textAlign: TextAlign.right, style: header),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < rows.length; i++) ...[
          _ReportRow(row: rows[i], color: _color(rows[i]['type']?.toString() ?? ''), zebra: i.isOdd),
          if (i != rows.length - 1) const SizedBox(height: 6),
        ],
      ],
    );
  }
}

class _ReportRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final Color color;
  final bool zebra;

  const _ReportRow({
    required this.row,
    required this.color,
    required this.zebra,
  });

  @override
  Widget build(BuildContext context) {
    final type = row['type']?.toString() ?? '';
    final label = row['label']?.toString() ?? type;
    final qty = '${row['qty'] ?? 0}';
    final sum = formatMoneySpaced(((row['sum'] as num?) ?? 0).toDouble());
    const value = TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textHeadline);
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 11, 12, 11),
      decoration: BoxDecoration(
        color: zebra ? AppColors.surfaceMuted : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 5,
            child: Text(
              label,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color, height: 1.2),
            ),
          ),
          SizedBox(width: 64, child: Text(qty, textAlign: TextAlign.right, style: value)),
          const SizedBox(width: 10),
          SizedBox(width: 88, child: Text(sum, textAlign: TextAlign.right, style: value)),
        ],
      ),
    );
  }
}

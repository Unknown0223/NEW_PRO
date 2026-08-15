import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;

/// «Расчет бонусов» — tovar (dona) vs to‘lov (summa), rasmga mos bottom sheet.
Future<({double goodsQty, double cashQty})?> showExpeditorBonusCalcSheet({
  required BuildContext context,
  required String productName,
  required double unitPrice,
  required double bonusAvailable,
  required double goodsQty,
  required double cashQty,
  String? ruleLabel,
}) {
  return showModalBottomSheet<({double goodsQty, double cashQty})>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFFF3F5F7),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => _BonusCalcSheet(
      productName: productName,
      unitPrice: unitPrice,
      bonusAvailable: bonusAvailable,
      initialGoods: goodsQty,
      initialCash: cashQty,
      ruleLabel: ruleLabel,
    ),
  );
}

class _BonusCalcSheet extends StatefulWidget {
  final String productName;
  final double unitPrice;
  final double bonusAvailable;
  final double initialGoods;
  final double initialCash;
  final String? ruleLabel;

  const _BonusCalcSheet({
    required this.productName,
    required this.unitPrice,
    required this.bonusAvailable,
    required this.initialGoods,
    required this.initialCash,
    this.ruleLabel,
  });

  @override
  State<_BonusCalcSheet> createState() => _BonusCalcSheetState();
}

class _BonusCalcSheetState extends State<_BonusCalcSheet> {
  late double _goods;
  late double _cash;

  int get _maxB => widget.bonusAvailable.floor().clamp(0, 999999);

  @override
  void initState() {
    super.initState();
    _goods = widget.initialGoods.floorToDouble().clamp(0, _maxB.toDouble());
    _cash = widget.initialCash.floorToDouble().clamp(0, _maxB.toDouble());
    _clampPair();
  }

  void _clampPair() {
    final maxB = _maxB.toDouble();
    _goods = _goods.clamp(0, maxB);
    _cash = _cash.clamp(0, maxB - _goods);
  }

  double get _cashSum => _cash * widget.unitPrice;
  double get _remaining => (_maxB - _goods - _cash).clamp(0, _maxB.toDouble());

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.9;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxH),
      child: Padding(
        padding: EdgeInsets.only(bottom: bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Расчет бонусов',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  children: [
                    if (widget.ruleLabel != null &&
                        widget.ruleLabel!.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          widget.ruleLabel!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10,),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x0A0F172A),
                            blurRadius: 6,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Text(
                        'Доступно бонуса к возврату: $_maxB шт',
                        textAlign: TextAlign.center,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _card(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.productName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _kv('Таннарх (цена)',
                              formatMoneySpaced(widget.unitPrice),),
                          _kv('Общее количество', '$_maxB Шт.'),
                          _kv('Доступное количество для возврата',
                              '${_remaining.toStringAsFixed(0)} Шт.',),
                          _kv(
                            'Сумма возврата в виде оплаты',
                            formatMoneySpaced(_cashSum),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _card(
                      child: Column(
                        children: [
                          _stepper(
                            label: 'Количество возврата в виде товара',
                            value: _goods,
                            max: (_maxB - _cash).clamp(0, _maxB.toDouble()),
                            onChanged: (v) => setState(() {
                              _goods = v;
                              _clampPair();
                            }),
                          ),
                          const SizedBox(height: 14),
                          _stepper(
                            label: 'Количество возврата в виде оплаты',
                            value: _cash,
                            max: (_maxB - _goods).clamp(0, _maxB.toDouble()),
                            onChanged: (v) => setState(() {
                              _cash = v;
                              _clampPair();
                            }),
                          ),
                        ],
                      ),
                    ),
                    if (_remaining > 0 && (_goods + _cash) > 0) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Не распределено: ${_remaining.toStringAsFixed(0)} шт — '
                        'при оформлении может стать «Долг бонус».',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.warning,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() {
                        _goods = 0;
                        _cash = 0;
                      }),
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Сбросить распределение'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        backgroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textPrimary,
                              side: const BorderSide(color: AppColors.border),
                              backgroundColor: Colors.white,
                            ),
                            child: const Text('Закрыть'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(
                              context,
                              (goodsQty: _goods, cashQty: _cash),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0A8F7E),
                              foregroundColor: Colors.white,
                              elevation: 0,
                            ),
                            child: const Text('Сохранить'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: child,
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              k,
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            v,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepper({
    required String label,
    required double value,
    required double max,
    required ValueChanged<double> onChanged,
  }) {
    final n = value.round();
    final maxN = max.floor();
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          ),
        ),
        _roundBtn(
          icon: Icons.remove,
          enabled: n > 0,
          onTap: () => onChanged((n - 1).clamp(0, maxN).toDouble()),
        ),
        SizedBox(
          width: 36,
          child: Text(
            '$n',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        _roundBtn(
          icon: Icons.add,
          enabled: n < maxN,
          onTap: () => onChanged((n + 1).clamp(0, maxN).toDouble()),
        ),
      ],
    );
  }

  Widget _roundBtn({
    required IconData icon,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          color: Colors.white,
        ),
        child: Icon(
          icon,
          size: 18,
          color: enabled ? AppColors.textPrimary : AppColors.textMuted,
        ),
      ),
    );
  }
}

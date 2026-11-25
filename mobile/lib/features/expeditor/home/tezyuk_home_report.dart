import 'package:flutter/material.dart';

import '../../../core/theme/tezyuk_colors.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../home/expeditor_home_sheets.dart';
import 'expeditor_home_model.dart';

class TezyukYuklarHisoboti extends StatefulWidget {
  final List<HomeShipmentLine> lines;
  const TezyukYuklarHisoboti({super.key, required this.lines});

  @override
  State<TezyukYuklarHisoboti> createState() => _TezyukYuklarHisobotiState();
}

class _TezyukYuklarHisobotiState extends State<TezyukYuklarHisoboti> {
  int _tab = 0;

  Color _dot(String key) {
    switch (key) {
      case 'delivered':
        return TezyukColors.success;
      case 'return':
        return TezyukColors.error;
      case 'shelf_return':
      case 'exchange_return':
        return TezyukColors.warning;
      default:
        return TezyukColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TezyukColors.surfaceBright,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TezyukColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Expanded(
                child: Text(
                  'Yuklar hisoboti',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                'Bugun',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: TezyukColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: TezyukColors.surfaceContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _tabBtn(0, 'Umumiy'),
                _tabBtn(1, 'Mijozlar'),
                _tabBtn(2, 'Mahsulotlar'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_tab == 0) ..._umumiy(),
          if (_tab == 1)
            _LinkRow(
              label: 'Mijozlar bo\'yicha',
              onTap: () => showExpeditorDeliveryByClientsSheet(context),
            ),
          if (_tab == 2)
            _LinkRow(
              label: 'Mahsulotlar bo\'yicha',
              onTap: () => showExpeditorDeliveryByProductsSheet(context),
            ),
        ],
      ),
    );
  }

  Widget _tabBtn(int i, String label) {
    final sel = _tab == i;
    return Expanded(
      child: Material(
        color: sel ? TezyukColors.surfaceBright : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: () => setState(() => _tab = i),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: sel
                    ? TezyukColors.primary
                    : TezyukColors.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _umumiy() {
    if (widget.lines.isEmpty) {
      return const [
        Text(
          'Hisobot ma\'lumoti yo\'q',
          style: TextStyle(color: TezyukColors.onSurfaceVariant),
        ),
      ];
    }
    final out = <Widget>[];
    for (var i = 0; i < widget.lines.length; i++) {
      final line = widget.lines[i];
      final last = i == widget.lines.length - 1;
      out.add(
        Padding(
          padding: EdgeInsets.only(top: 10, bottom: last ? 0 : 10),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: _dot(line.key),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(line.label, style: const TextStyle(fontSize: 14)),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${formatMoneySpaced(line.sum)} so\'m',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: line.key == 'return' ||
                              line.key == 'shelf_return'
                          ? TezyukColors.error
                          : TezyukColors.onSurface,
                    ),
                  ),
                  Text(
                    '${line.qty} quti',
                    style: const TextStyle(
                      fontSize: 12,
                      color: TezyukColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
      if (!last) {
        out.add(const Divider(height: 1, color: TezyukColors.outlineVariant));
      }
    }
    return out;
  }
}

class _LinkRow extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _LinkRow({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, size: 18),
        ],
      ),
    );
  }
}

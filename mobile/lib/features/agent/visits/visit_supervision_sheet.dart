import 'package:flutter/material.dart';
import '../../../core/config/mobile_config.dart';

/// Agent vizitida supervayzer audit checklist (config: supervision.check_*).
class VisitSupervisionSheet extends StatefulWidget {
  final SupervisionConfig supervision;

  const VisitSupervisionSheet({super.key, required this.supervision});

  static Future<Map<String, bool>?> show(BuildContext context, SupervisionConfig supervision) {
    return showModalBottomSheet<Map<String, bool>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => VisitSupervisionSheet(supervision: supervision),
    );
  }

  @override
  State<VisitSupervisionSheet> createState() => _VisitSupervisionSheetState();
}

class _VisitSupervisionSheetState extends State<VisitSupervisionSheet> {
  final _checks = <String, bool>{};

  @override
  void initState() {
    super.initState();
    for (final e in _items) {
      _checks[e.key] = false;
    }
  }

  List<({String key, String label})> get _items {
    final s = widget.supervision;
    final out = <({String key, String label})>[];
    if (s.checkReceiptFaces) out.add((key: 'receipt', label: 'Chek yuzlari'));
    if (s.checkMerchandising) out.add((key: 'merch', label: 'Merchandising'));
    if (s.checkDefaultPrice) out.add((key: 'price', label: 'Narx'));
    if (s.checkMotivation) out.add((key: 'motivation', label: 'Motivatsiya'));
    if (s.checkStock) out.add((key: 'stock', label: 'Ombor'));
    if (s.checkSales) out.add((key: 'sales', label: 'Sotuvlar'));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) {
      return const Padding(padding: EdgeInsets.all(24), child: Text('Audit checklist yoqilmagan'));
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Audit checklist', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          ..._items.map(
            (e) => CheckboxListTile(
              value: _checks[e.key] ?? false,
              onChanged: (v) => setState(() => _checks[e.key] = v ?? false),
              title: Text(e.label),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => Navigator.pop(context, Map<String, bool>.from(_checks)),
            child: const Text('Saqlash'),
          ),
        ],
      ),
    );
  }
}

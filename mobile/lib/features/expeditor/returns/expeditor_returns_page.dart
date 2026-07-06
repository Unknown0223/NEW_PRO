import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../shared/expeditor_order_picker.dart';

class ExpeditorReturnsPage extends ConsumerStatefulWidget {
  const ExpeditorReturnsPage({super.key});

  @override
  ConsumerState<ExpeditorReturnsPage> createState() => _ExpeditorReturnsPageState();
}

class _ExpeditorReturnsPageState extends ConsumerState<ExpeditorReturnsPage> {
  String _returnReason = '';
  final _noteCtrl = TextEditingController();
  final Map<int, TextEditingController> _qtyCtrls = {};
  bool _submitting = false;

  @override
  void dispose() {
    _noteCtrl.dispose();
    for (final c in _qtyCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  int? _orderIdFromRoute() {
    final uri = GoRouterState.of(context).uri;
    final raw = uri.queryParameters['order_id'];
    if (raw == null) return null;
    return int.tryParse(raw);
  }

  void _ensureQtyControllers(List<Map<String, dynamic>> items) {
    for (final it in items) {
      final id = it['id'] as int?;
      if (id == null) continue;
      if (_qtyCtrls.containsKey(id)) continue;
      final maxQty = (it['qty'] as num?)?.toDouble() ?? 0;
      _qtyCtrls[id] = TextEditingController(text: maxQty > 0 ? maxQty.toStringAsFixed(0) : '0');
    }
  }

  List<Map<String, dynamic>> _collectReturnItems(List<Map<String, dynamic>> items) {
    final out = <Map<String, dynamic>>[];
    for (final it in items) {
      final id = it['id'] as int?;
      if (id == null) continue;
      final ctrl = _qtyCtrls[id];
      if (ctrl == null) continue;
      final qty = double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0;
      if (qty <= 0) continue;
      out.add({'order_item_id': id, 'qty': qty});
    }
    return out;
  }

  Future<void> _submitReturn(int orderId, String slug, List<Map<String, dynamic>> items) async {
    if (_returnReason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sababni tanlang')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final lines = _collectReturnItems(items);
      await ref.read(expeditorApiProvider).partialReturn(
            slug,
            orderId,
            reason: _returnReason,
            note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
            items: lines.isEmpty ? null : lines,
          );
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      ref.invalidate(deliveriesProvider(null));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Qaytarish qayd etildi'), backgroundColor: AppColors.warning),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitReload(int orderId, String slug) async {
    setState(() => _submitting = true);
    try {
      await ref.read(expeditorApiProvider).reloadFromVehicle(
            slug,
            orderId,
            note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
          );
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      ref.invalidate(deliveriesProvider(null));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Dogruzka qayd etildi')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final policy = ExpeditorConfigPolicy.fromMobileConfig(session.mobileConfig);
    final orderId = _orderIdFromRoute();
    final slug = session.tenantSlug ?? '';

    if (!policy.returnsEnabled) {
      return Scaffold(
        appBar: AppBar(title: const Text('Qaytarishlar')),
        body: const Center(child: Text('Qaytarish admin panelda o\'chirilgan')),
      );
    }

    if (orderId == null) {
      return ExpeditorOrderPicker(
        title: 'Qaytarish uchun buyurtma',
        emptyMessage: 'Qaytarish uchun yetkazilgan buyurtma yo\'q',
        onlyDelivered: true,
        onSelect: (id) => context.replace('/returns?order_id=$id'),
      );
    }

    final detail = ref.watch(expeditorOrderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text('Qaytarish #$orderId')),
      body: detail.when(
        data: (order) {
          final rawItems = (order['items'] as List?)?.cast<Map>() ?? [];
          final items = rawItems.map((e) => Map<String, dynamic>.from(e)).toList();
          _ensureQtyControllers(items);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _CapabilityRow('Qisman qaytarish', policy.allowPartialReturn),
                      _CapabilityRow('Avtomobildan yuklash', policy.allowReloadFromVehicle),
                      if (policy.allowReturnFromShelf)
                        const Padding(
                          padding: EdgeInsets.only(top: 6),
                          child: Text(
                            'Polkadan qaytarish — veb-panel orqali «Vozvrat s polki»',
                            style: TextStyle(fontSize: 11),
                          ),
                        ),
                    ],
                  ),
                ),
                if (policy.allowPartialReturn && items.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Qaytariladigan mahsulotlar', style: AppTypography.titleMedium),
                  const SizedBox(height: 8),
                  ...items.map((it) {
                    final id = it['id'] as int;
                    final maxQty = (it['qty'] as num?)?.toDouble() ?? 0;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${it['sku'] ?? ''} ${it['product_name'] ?? ''}\nmax: ${maxQty.toStringAsFixed(0)}',
                              style: AppTypography.bodySmall,
                            ),
                          ),
                          SizedBox(
                            width: 72,
                            child: TextField(
                              controller: _qtyCtrls[id],
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Qty',
                                isDense: true,
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: _noteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Izoh (ixtiyoriy)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                if (policy.allowPartialReturn) ...[
                  const SizedBox(height: 20),
                  const Text('Qaytarish sababi', style: AppTypography.titleMedium),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _returnReason.isEmpty ? null : _returnReason,
                    decoration: const InputDecoration(hintText: 'Sababni tanlang', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'defective', child: Text('Nuqsonli mahsulot')),
                      DropdownMenuItem(value: 'wrong', child: Text('Noto\'g\'ri mahsulot')),
                      DropdownMenuItem(value: 'excess', child: Text('Ortiqcha')),
                      DropdownMenuItem(value: 'other', child: Text('Boshqa')),
                    ],
                    onChanged: _submitting ? null : (v) => setState(() => _returnReason = v ?? ''),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _submitting ? null : () => _submitReturn(orderId, slug, items),
                    icon: const Icon(Icons.replay),
                    label: const Text('QAYTARISHNI YUBORISH'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
                  ),
                ],
                if (policy.allowReloadFromVehicle) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _submitting ? null : () => _submitReload(orderId, slug),
                    icon: const Icon(Icons.local_shipping),
                    label: const Text('Avtomobildan qayta yuklash'),
                  ),
                ],
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Xato: $e')),
      ),
    );
  }
}

class _CapabilityRow extends StatelessWidget {
  final String label;
  final bool enabled;
  const _CapabilityRow(this.label, this.enabled);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(enabled ? Icons.check_circle : Icons.cancel, size: 16, color: enabled ? AppColors.success : AppColors.error),
          const SizedBox(width: 6),
          Text(label, style: AppTypography.bodySmall),
        ],
      ),
    );
  }
}

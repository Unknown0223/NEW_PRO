import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/biometric_transaction_confirm.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../shared/expeditor_order_picker.dart';
import 'expeditor_return_kind_picker.dart';
import 'expeditor_return_reason_picker.dart';
import '../shell/expeditor_drawer.dart';

class ExpeditorReturnsPage extends ConsumerStatefulWidget {
  const ExpeditorReturnsPage({super.key});

  @override
  ConsumerState<ExpeditorReturnsPage> createState() => _ExpeditorReturnsPageState();
}

class _ExpeditorReturnsPageState extends ConsumerState<ExpeditorReturnsPage> {
  String _returnReason = '';
  ExpeditorReturnKind? _kind;
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

  List<Map<String, dynamic>> _collectReturnItems(
    List<Map<String, dynamic>> items, {
    required bool full,
  }) {
    final out = <Map<String, dynamic>>[];
    for (final it in items) {
      final id = it['id'] as int?;
      if (id == null) continue;
      final maxQty = (it['qty'] as num?)?.toDouble() ?? 0;
      final qty = full
          ? maxQty
          : (double.tryParse(_qtyCtrls[id]?.text.replaceAll(',', '.') ?? '') ?? 0);
      if (qty <= 0) continue;
      out.add({'order_item_id': id, 'qty': qty});
    }
    return out;
  }

  Future<void> _submitReturn(int orderId, String slug, List<Map<String, dynamic>> items) async {
    if (_returnReason.isEmpty) {
      showAgentToast(context, 'Выберите причину');
      return;
    }
    setState(() => _submitting = true);
    try {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.read(sessionProvider).mobileConfig,
      );
      final confirmed = await BiometricTransactionConfirm.confirm(
        ref,
        context: context,
        required: policy.fingerprintRequired,
        reason: 'Подтвердите возврат',
      );
      if (!confirmed) return;
      final lines = _collectReturnItems(items, full: _kind == ExpeditorReturnKind.full);
      if (lines.isEmpty) {
        if (mounted) {
          showAgentToast(context, 'Укажите количество возврата');
        }
        return;
      }
      await ref.read(expeditorApiProvider).partialReturn(
            slug,
            orderId,
            reason: _returnReason,
            note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
            items: lines.isEmpty ? null : lines,
          );
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      ref.invalidate(deliveriesProvider(null));
      ref.invalidate(expeditorDashboardProvider);
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      if (mounted) {
        showAgentToast(context, '$e', accentColor: AppColors.error);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitReload(int orderId, String slug) async {
    setState(() => _submitting = true);
    try {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.read(sessionProvider).mobileConfig,
      );
      final confirmed = await BiometricTransactionConfirm.confirm(
        ref,
        context: context,
        required: policy.fingerprintRequired,
        reason: 'Подтвердите догруз',
      );
      if (!confirmed) return;
      await ref.read(expeditorApiProvider).reloadFromVehicle(
            slug,
            orderId,
            note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
          );
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      ref.invalidate(deliveriesProvider(null));
      if (mounted) {
        showAgentToast(context, 'Догруз зарегистрирован', accentColor: AppColors.success);
        if (context.canPop()) context.pop();
      }
    } catch (e) {
      if (mounted) {
        showAgentToast(context, '$e', accentColor: AppColors.error);
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
        drawer: const ExpeditorDrawer(),
        appBar: AppBar(title: const Text('Возвраты')),
        body: const Center(child: Text('Возвраты отключены в админ-панели')),
      );
    }

    if (orderId == null) {
      return ExpeditorOrderPicker(
        title: 'Заказ для возврата',
        emptyMessage: 'Нет доставленных заказов для возврата',
        onlyDelivered: true,
        onSelect: (id) => context.replace('/returns?order_id=$id'),
      );
    }

    final detail = ref.watch(expeditorOrderDetailProvider(orderId));

    return Scaffold(
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(title: Text('Возврат #$orderId')),
      body: detail.when(
        data: (order) {
          final rawItems = (order['items'] as List?)?.cast<Map>() ?? [];
          final items = rawItems.map((e) => Map<String, dynamic>.from(e)).toList();
          _ensureQtyControllers(items);

          final full = _kind == ExpeditorReturnKind.full;
          final partial = _kind == ExpeditorReturnKind.partial;
          final shelf = _kind == ExpeditorReturnKind.shelf;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ExpeditorReturnKindPicker(
                  value: _kind,
                  partialEnabled: policy.allowPartialReturn,
                  shelfEnabled: policy.allowReturnFromShelf,
                  onChanged: (kind) => setState(() => _kind = kind),
                ),
                if (partial && items.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Товары к возврату', style: AppTypography.titleMedium),
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
                              '${it['sku'] ?? ''} ${it['product_name'] ?? ''}\nмакс.: ${maxQty.toStringAsFixed(0)}',
                              style: AppTypography.bodySmall,
                            ),
                          ),
                          SizedBox(
                            width: 72,
                            child: TextField(
                              controller: _qtyCtrls[id],
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Кол-во',
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
                if (full)
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Text(
                      'Вернутся все товары этого заказа.',
                      style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                    ),
                  ),
                if (full || partial) ...[
                  const SizedBox(height: 16),
                  ExpeditorReturnReasonPicker(
                    value: _returnReason,
                    enabled: !_submitting,
                    onChanged: (v) => setState(() => _returnReason = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _noteCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Комментарий (необязательно)',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _submitting
                        ? null
                        : () {
                            if ((order['status']?.toString() ?? '') == 'returned') {
                              context.go('/home');
                              return;
                            }
                            _submitReturn(orderId, slug, items);
                          },
                    icon: const Icon(Icons.replay),
                    label: Text(full ? 'ОТПРАВИТЬ ПОЛНЫЙ ВОЗВРАТ' : 'ОТПРАВИТЬ ЧАСТИЧНЫЙ ВОЗВРАТ'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
                  ),
                ],
                if (shelf && policy.allowReturnFromShelf) ...[
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => context.push('/exp-return-by-order/$orderId'),
                    icon: const Icon(Icons.inventory_2_outlined),
                    label: const Text('ОТКРЫТЬ ВОЗВРАТ С ПОЛКИ'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.expeditorAccent),
                  ),
                ],
                if (policy.allowReloadFromVehicle) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'Догруз — это не возврат. Заказ снова станет «доставляется», товар остаётся в машине.',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _submitting ? null : () => _submitReload(orderId, slug),
                    icon: const Icon(Icons.local_shipping),
                    label: const Text('Догрузить из машины'),
                  ),
                ],
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
      ),
    );
  }
}


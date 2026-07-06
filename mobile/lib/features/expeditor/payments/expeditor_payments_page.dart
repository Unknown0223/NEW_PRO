import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_status_labels.dart';
import '../expeditor_providers.dart';
import '../shared/expeditor_order_picker.dart';
import 'expeditor_returned_payments_banner.dart';

class ExpeditorPaymentsPage extends ConsumerStatefulWidget {
  const ExpeditorPaymentsPage({super.key});

  @override
  ConsumerState<ExpeditorPaymentsPage> createState() => _ExpeditorPaymentsPageState();
}

class _ExpeditorPaymentsPageState extends ConsumerState<ExpeditorPaymentsPage> {
  final _amountCtrl = TextEditingController();
  String? _selectedPaymentType;
  bool _submitting = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  int? _orderIdFromRoute() {
    final uri = GoRouterState.of(context).uri;
    final raw = uri.queryParameters['order_id'];
    if (raw == null) return null;
    return int.tryParse(raw);
  }

  Future<void> _submit(int orderId, String slug) async {
    final amount = parseGroupedNumber(_amountCtrl.text);
    final pt = _selectedPaymentType;
    if (amount <= 0 || pt == null || pt.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Summa va to\'lov usulini kiriting')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(expeditorApiProvider).createPayment(
            slug,
            orderId,
            paymentType: pt,
            amount: amount,
          );
      ref.invalidate(expeditorPaymentContextProvider(orderId));
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('To\'lov arizasi yuborildi. Kassa tasdiqlashini kuting.'),
            backgroundColor: AppColors.warning,
          ),
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

    if (!policy.paymentsEnabled) {
      return Scaffold(
        appBar: AppBar(title: const Text('To\'lovlar')),
        body: Center(child: Text(policy.blockPaymentMessage())),
      );
    }

    if (orderId == null) {
      return ExpeditorOrderPicker(
        title: 'To\'lov uchun buyurtma',
        emptyMessage: 'To\'lov qabul qilish uchun yetkazilgan buyurtma yo\'q',
        onlyDelivered: true,
        onlyWithDebt: true,
        header: const ExpeditorReturnedPaymentsBanner(),
        onSelect: (id) => context.replace('/payments?order_id=$id'),
      );
    }

    final ctxAsync = ref.watch(expeditorPaymentContextProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text('To\'lov #$orderId')),
      body: ctxAsync.when(
        data: (ctx) {
          final methods = (ctx['payment_methods'] as List?)?.cast<Map>() ?? [];
          final remaining = (ctx['remaining'] as num?)?.toDouble() ?? 0;
          final pendingTotal = (ctx['pending_total'] as num?)?.toDouble() ?? 0;
          final pendingRows = (ctx['pending_payments'] as List?)?.cast<Map>() ?? [];
          final currency = ctx['currency_symbol']?.toString() ?? policy.currencySymbol;
          final strict = (ctx['strict_payment_method'] as bool?) ?? policy.deliveryPaymentMethodStrict;
          final canSubmit = remaining > 0.01;

          if (_selectedPaymentType == null && methods.isNotEmpty) {
            _selectedPaymentType = methods.first['payment_type']?.toString();
          }
          if (strict && methods.length == 1) {
            _selectedPaymentType = methods.first['payment_type']?.toString();
          }
          if (_amountCtrl.text.isEmpty && remaining > 0) {
            _amountCtrl.text = formatMoneySpaced(remaining);
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Qoldiq: ${formatMoneySpaced(remaining)} $currency', style: AppTypography.titleMedium),
                if (pendingTotal > 0) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Tasdiqlanishni kutmoqda: ${formatMoneySpaced(pendingTotal)} $currency',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.warning),
                  ),
                ],
                if (pendingRows.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  ...pendingRows.map((p) {
                    final m = Map<String, dynamic>.from(p);
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text('${formatMoneySpaced((m['amount'] as num?)?.toDouble() ?? 0)} $currency — ${expeditorPaymentWorkflowLabel(m['workflow_status']?.toString() ?? '')}'),
                      subtitle: const Text('Web panelda «Заявки на оплату экспедиторов» orqali tasdiqlanadi'),
                    );
                  }),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: const [ThousandsTextInputFormatter()],
                  decoration: InputDecoration(
                    labelText: 'Summa ($currency)',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('To\'lov usuli', style: AppTypography.labelLarge),
                ...methods.map((m) {
                  final map = Map<String, dynamic>.from(m);
                  final pt = map['payment_type']?.toString() ?? '';
                  final name = map['name']?.toString() ?? pt;
                  return RadioListTile<String>(
                    value: pt,
                    groupValue: _selectedPaymentType,
                    title: Text(name),
                    onChanged: (strict && methods.length == 1) || _submitting
                        ? null
                        : (v) => setState(() => _selectedPaymentType = v),
                  );
                }),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _submitting || !canSubmit ? null : () => _submit(orderId, slug),
                  child: _submitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('ARIZA YUBORISH'),
                ),
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

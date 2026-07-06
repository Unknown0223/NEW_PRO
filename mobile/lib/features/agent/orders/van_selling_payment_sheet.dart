import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/order_config_policy.dart';
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Van selling: buyurtmadan keyin to‘lov qabul qilish.
class VanSellingPaymentSheet extends ConsumerStatefulWidget {
  final int clientId;
  final int orderId;

  const VanSellingPaymentSheet({
    super.key,
    required this.clientId,
    required this.orderId,
  });

  static Future<bool?> show(
    BuildContext context, {
    required int clientId,
    required int orderId,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: VanSellingPaymentSheet(clientId: clientId, orderId: orderId),
      ),
    );
  }

  @override
  ConsumerState<VanSellingPaymentSheet> createState() => _VanSellingPaymentSheetState();
}

class _VanSellingPaymentSheetState extends ConsumerState<VanSellingPaymentSheet> {
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _selectedPaymentType;
  final _amountCtrl = TextEditingController();

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Tenant topilmadi';
      });
      return;
    }
    try {
      final ctx = await ref.read(mobileApiProvider).getOrderCashInContext(
            slug,
            clientId: widget.clientId,
            orderIds: [widget.orderId],
          );
      final orders = (ctx['orders'] as List?) ?? [];
      Map<String, dynamic>? row;
      for (final o in orders) {
        if (o is Map && (o['id'] as num?)?.toInt() == widget.orderId) {
          row = Map<String, dynamic>.from(o);
          break;
        }
      }
      final debt = row?['debt']?.toString();
      final amount = row?['order_amount']?.toString();
      if (mounted) {
        _amountCtrl.text = (debt != null && debt.isNotEmpty && debt != '0' && debt != '0.00')
            ? debt.replaceAll(RegExp(r'[^\d.]'), '')
            : (amount ?? '').replaceAll(RegExp(r'[^\d.]'), '');
        final misc = ref.read(sessionProvider).mobileConfig?.misc ?? const MiscConfig();
        final methods = filterAllowedPaymentMethods(ref.read(paymentMethodsProvider), misc);
        setState(() {
          _loading = false;
          if (methods.isNotEmpty) _selectedPaymentType = methods.first.paymentType;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e is ApiException ? e.message : '$e';
        });
      }
    }
  }

  Future<void> _submit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final pt = _selectedPaymentType;
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '.').trim());
    if (pt == null || pt.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('To‘lov usulini tanlang'), backgroundColor: AppColors.error),
      );
      return;
    }
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Summani kiriting'), backgroundColor: AppColors.error),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(mobileApiProvider).postOrderCashIn(
        slug,
        clientId: widget.clientId,
        orderId: widget.orderId,
        paymentType: pt,
        amount: amount,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'To‘lov xato'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final misc = ref.watch(sessionProvider).mobileConfig?.misc ?? const MiscConfig();
    final methods = filterAllowedPaymentMethods(ref.watch(paymentMethodsProvider), misc);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('To‘lov qabul qilish', style: AppTypography.headlineSmall),
          const SizedBox(height: 8),
          Text(
            'Buyurtma #${widget.orderId}',
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.error))
          else ...[
            if (methods.isEmpty)
              const Text('To‘lov usullari konfiguratsiyada yo‘q')
            else
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'To‘lov usuli'),
                initialValue: _selectedPaymentType,
                items: methods
                    .map((m) => DropdownMenuItem(
                          value: m.paymentType,
                          child: Text(m.name),
                        ),)
                    .toList(),
                onChanged: (v) => setState(() => _selectedPaymentType = v),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Summa'),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : () => Navigator.pop(context, false),
                    child: const Text('Keyinroq'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Saqlash'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

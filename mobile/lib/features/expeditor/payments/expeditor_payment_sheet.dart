import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// Pastdan tepaga suriladigan to'lov oynasi (Добавить оплату uslubida).
/// Qiymatlar 3 xonali guruhlanadi, qoldiq/kutilayotgan/xato ko'rsatiladi.
Future<bool?> showExpeditorPaymentSheet(
  BuildContext context, {
  required int orderId,
  String title = 'Добавить оплату',
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => ExpeditorPaymentSheet(orderId: orderId, title: title),
  );
}

class ExpeditorPaymentSheet extends ConsumerStatefulWidget {
  final int orderId;
  final String title;
  const ExpeditorPaymentSheet({
    super.key,
    required this.orderId,
    this.title = 'Добавить оплату',
  });

  @override
  ConsumerState<ExpeditorPaymentSheet> createState() =>
      _ExpeditorPaymentSheetState();
}

class _ExpeditorPaymentSheetState extends ConsumerState<ExpeditorPaymentSheet> {
  final _controllers = <String, TextEditingController>{};
  final _comment = TextEditingController();
  bool _consignment = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    _comment.dispose();
    super.dispose();
  }

  TextEditingController _ctrl(String key) =>
      _controllers.putIfAbsent(key, () => TextEditingController());

  Future<void> _submit(
    List<Map<String, dynamic>> methods, {
    double maxPayable = 0,
  }) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    final entries = <MapEntry<String, double>>[];
    for (final m in methods) {
      final key = m['payment_type']?.toString() ?? '';
      if (key.isEmpty) continue;
      final amount = parseGroupedNumber(_ctrl(key).text);
      if (amount > 0) entries.add(MapEntry(key, amount));
    }
    if (entries.isEmpty) {
      setState(() => _error = 'Введите сумму оплаты');
      return;
    }
    final totalEntered = entries.fold<double>(0, (s, e) => s + e.value);
    if (maxPayable > 0 && totalEntered > maxPayable + 0.01) {
      setState(() => _error =
          'Сумма превышает доступную: ${formatMoneySpaced(maxPayable)}',);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final note = [
      if (_consignment) '[Консигнация]',
      _comment.text.trim(),
    ].where((e) => e.isNotEmpty).join(' ');
    try {
      final api = ref.read(expeditorApiProvider);
      for (final e in entries) {
        await api.createPayment(
          slug,
          widget.orderId,
          paymentType: e.key,
          amount: e.value,
          note: note.isEmpty ? null : note,
        );
      }
      ref.invalidate(expeditorPaymentContextProvider(widget.orderId));
      ref.invalidate(expeditorReturnedPaymentsProvider);
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = '$e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(expeditorPaymentContextProvider(widget.orderId));
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: ctx.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                  child: CircularProgressIndicator(
                      color: AppColors.expeditorAccent,),),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Text('Ошибка: $e',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.error),),
            ),
            data: (data) => _form(data),
          ),
        ),
      ),
    );
  }

  Widget _form(Map<String, dynamic> data) {
    final methods = ((data['payment_methods'] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final currency = data['currency_symbol']?.toString() ?? 'UZS';
    final remaining = (data['remaining'] as num?)?.toDouble() ?? 0;
    final clientDebt = (data['client_debt'] as num?)?.toDouble() ?? 0;
    final pendingTotal = (data['pending_total'] as num?)?.toDouble() ?? 0;
    final maxPayable = (data['max_payable'] as num?)?.toDouble() ??
        (remaining > clientDebt ? remaining : clientDebt);
    final nothingPayable = maxPayable <= 0.01;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AgentSheetHandle(),
        const SizedBox(height: 6),
        Stack(
          alignment: Alignment.center,
          children: [
            Text(widget.title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                icon: const Icon(Icons.close, color: AppColors.textMuted),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          remaining > 0
              ? 'Остаток по заказу: ${formatMoneySpaced(remaining)} $currency'
              : 'Долг клиента: ${formatMoneySpaced(clientDebt)} $currency',
          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
        ),
        if (remaining > 0 && clientDebt > remaining)
          Text('Долг клиента: ${formatMoneySpaced(clientDebt)} $currency',
              style:
                  AppTypography.caption.copyWith(color: AppColors.textMuted),),
        if (pendingTotal > 0) ...[
          const SizedBox(height: 4),
          Text(
            'Ожидает подтверждения: ${formatMoneySpaced(pendingTotal)} $currency',
            style: AppTypography.caption.copyWith(color: AppColors.warning),
          ),
        ],
        if (nothingPayable) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline,
                    size: 18, color: AppColors.warning,),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    pendingTotal > 0
                        ? 'Оплата уже внесена и ожидает подтверждения кассой.'
                        : 'По этому заказу нет суммы к оплате.',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline,
                    size: 18, color: AppColors.error,),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_error!,
                      style: AppTypography.caption
                          .copyWith(color: AppColors.error),),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        Flexible(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (methods.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text('Нет доступных методов оплаты',
                        textAlign: TextAlign.center,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.textMuted),),
                  )
                else
                  ...methods.map((m) {
                    final key = m['payment_type']?.toString() ?? '';
                    final name = m['name']?.toString() ?? key;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TextField(
                        controller: _ctrl(key),
                        keyboardType: TextInputType.number,
                        inputFormatters: const [
                          ThousandsTextInputFormatter(),
                        ],
                        decoration: InputDecoration(
                          labelText: '$name ($currency)',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                                color: AppColors.expeditorAccent, width: 1.5,),
                          ),
                        ),
                      ),
                    );
                  }),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: CheckboxListTile(
                    value: _consignment,
                    onChanged: (v) => setState(() => _consignment = v ?? false),
                    activeColor: AppColors.expeditorAccent,
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                    title: const Text('Консигнация',
                        style: TextStyle(fontWeight: FontWeight.w600),),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _comment,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Комментарий',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                          color: AppColors.expeditorAccent, width: 1.5,),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.tonal(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.surfaceVariant,
                  foregroundColor: AppColors.textSecondary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _submitting ? null : () => Navigator.pop(context),
                child: const Text('Выйти',
                    style: TextStyle(fontWeight: FontWeight.w700),),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.expeditorAccent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: (_submitting || nothingPayable)
                    ? null
                    : () => _submit(methods, maxPayable: maxPayable),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white,),
                      )
                    : const Text('Добавить',
                        style: TextStyle(fontWeight: FontWeight.w700),),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import 'expeditor_payment_sheet.dart';

/// Kassir tomonidan ekspeditorga «qaytarilgan» (xato) to'lovlar banneri.
/// Har bir to'lov uchun teskari taymer ko'rsatiladi — shu vaqt ichida
/// ekspeditor to'lovni to'g'rilab qayta yuborishi kerak. Vaqt tugasa,
/// qaytarish bekor qilinadi va element ro'yxatdan tushadi.
class ExpeditorReturnedPaymentsBanner extends ConsumerStatefulWidget {
  const ExpeditorReturnedPaymentsBanner({super.key});

  @override
  ConsumerState<ExpeditorReturnedPaymentsBanner> createState() =>
      _ExpeditorReturnedPaymentsBannerState();
}

class _ExpeditorReturnedPaymentsBannerState
    extends ConsumerState<ExpeditorReturnedPaymentsBanner> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // Har soniyada teskari taymerni yangilab turamiz.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _formatLeft(Duration d) {
    if (d.isNegative) return '00:00';
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (d.inHours > 0) {
      final h = d.inHours.toString().padLeft(2, '0');
      return '$h:$m:$s';
    }
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(expeditorReturnedPaymentsProvider);
    final items = async.maybeWhen(
      data: (list) => list,
      orElse: () => const <Map<String, dynamic>>[],
    );
    if (items.isEmpty) return const SizedBox.shrink();

    final now = DateTime.now();
    // Muddati tugaganlarni yashiramiz va providerni yangilaymiz.
    final visible = items.where((m) {
      final exp = DateTime.tryParse(m['expires_at']?.toString() ?? '')?.toLocal();
      return exp != null && exp.isAfter(now);
    }).toList();

    if (visible.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.invalidate(expeditorReturnedPaymentsProvider);
      });
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(top: 6, bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.assignment_return_outlined,
                  color: AppColors.warning, size: 20,),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'To\'lovni to\'g\'rilash kerak',
                  style: AppTypography.titleMedium.copyWith(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Kassa to\'lovni qaytardi. Taymer tugaguncha to\'g\'rilab qayta yuboring, aks holda qaytarish bekor qilinadi.',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          ...visible.map((m) => _row(context, m, now)),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> m, DateTime now) {
    final exp = DateTime.tryParse(m['expires_at']?.toString() ?? '')?.toLocal();
    final left = exp != null ? exp.difference(now) : Duration.zero;
    final urgent = left.inSeconds <= 60;
    final orderId = m['order_id'] as int?;
    final clientName = m['client_name']?.toString() ?? '—';
    final orderNumber = m['order_number']?.toString();
    final amount = (m['amount'] as num?)?.toDouble() ?? 0;
    final reason = m['reason']?.toString();

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: orderId == null
              ? null
              : () => showExpeditorPaymentSheet(
                    context,
                    orderId: orderId,
                    title: 'Исправить оплату',
                  ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        clientName,
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${formatMoneySpaced(amount)} so\'m'
                        '${orderNumber != null ? ' • #$orderNumber' : ''}',
                        style: AppTypography.bodySmall
                            .copyWith(color: AppColors.textSecondary),
                      ),
                      if (reason != null && reason.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Sabab: $reason',
                          style: AppTypography.bodySmall
                              .copyWith(color: AppColors.textSecondary),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6,),
                      decoration: BoxDecoration(
                        color: (urgent ? AppColors.error : AppColors.warning)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.timer_outlined,
                              size: 14,
                              color: urgent
                                  ? AppColors.error
                                  : AppColors.warning,),
                          const SizedBox(width: 4),
                          Text(
                            _formatLeft(left),
                            style: AppTypography.labelLarge.copyWith(
                              color: urgent
                                  ? AppColors.error
                                  : AppColors.warning,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'To\'g\'rilash',
                      style: AppTypography.labelMedium
                          .copyWith(color: AppColors.expeditorAccent),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

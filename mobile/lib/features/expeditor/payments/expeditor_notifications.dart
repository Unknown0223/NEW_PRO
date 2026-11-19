import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import 'expeditor_payment_sheet.dart';

/// AppBar uchun bildirishnoma qo'ng'irog'i (o'ng tomonda).
/// Kassir qaytargan (taymerli) to'lovlar soni bilan belgi ko'rsatadi.
class ExpeditorNotificationsBell extends ConsumerWidget {
  const ExpeditorNotificationsBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(expeditorReturnedPaymentsProvider);
    final items = async.maybeWhen(
      data: (list) => list,
      orElse: () => const <Map<String, dynamic>>[],
    );
    final now = DateTime.now();
    final count = items.where((m) {
      final e = DateTime.tryParse(m['expires_at']?.toString() ?? '')?.toLocal();
      return e != null && e.isAfter(now);
    }).length;

    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          tooltip: 'Уведомления',
          icon: const Icon(Icons.notifications_outlined),
          onPressed: () => showExpeditorNotificationsSheet(context),
        ),
        if (count > 0)
          Positioned(
            right: 6,
            top: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,),
              ),
            ),
          ),
      ],
    );
  }
}

Future<void> showExpeditorNotificationsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => const _NotificationsSheet(),
  );
}

class _NotificationsSheet extends ConsumerStatefulWidget {
  const _NotificationsSheet();

  @override
  ConsumerState<_NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends ConsumerState<_NotificationsSheet> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
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
    final now = DateTime.now();
    final items = async
        .maybeWhen(
          data: (list) => list,
          orElse: () => const <Map<String, dynamic>>[],
        )
        .where((m) {
      final e = DateTime.tryParse(m['expires_at']?.toString() ?? '')?.toLocal();
      return e != null && e.isAfter(now);
    }).toList();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.notifications_outlined,
                    color: AppColors.expeditorAccent, size: 20,),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text('Уведомления',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            if (items.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Column(
                  children: [
                    const Icon(Icons.notifications_off_outlined,
                        size: 40, color: AppColors.textMuted,),
                    const SizedBox(height: 8),
                    Text('Нет новых уведомлений',
                        style: AppTypography.bodyMedium
                            .copyWith(color: AppColors.textMuted),),
                  ],
                ),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _row(items[i], now),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(Map<String, dynamic> m, DateTime now) {
    final exp = DateTime.tryParse(m['expires_at']?.toString() ?? '')?.toLocal();
    final left = exp != null ? exp.difference(now) : Duration.zero;
    final urgent = left.inSeconds <= 60;
    final orderId = m['order_id'] as int?;
    final clientName = m['client_name']?.toString() ?? '—';
    final orderNumber = m['order_number']?.toString();
    final amount = (m['amount'] as num?)?.toDouble() ?? 0;
    final reason = m['reason']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: orderId == null
              ? null
              : () async {
                  Navigator.pop(context);
                  await showExpeditorPaymentSheet(
                    context,
                    orderId: orderId,
                    title: 'Исправить оплату',
                  );
                },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.assignment_return_outlined,
                        size: 18, color: AppColors.warning,),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Нужно исправить оплату',
                        style: AppTypography.bodyMedium.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.warning,),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4,),
                      decoration: BoxDecoration(
                        color: (urgent ? AppColors.error : AppColors.warning)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.timer_outlined,
                              size: 13,
                              color:
                                  urgent ? AppColors.error : AppColors.warning,),
                          const SizedBox(width: 3),
                          Text(
                            _formatLeft(left),
                            style: AppTypography.labelMedium.copyWith(
                              color:
                                  urgent ? AppColors.error : AppColors.warning,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
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
                  Text('Причина кассы: $reason',
                      style: AppTypography.bodySmall
                          .copyWith(color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,),
                ],
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text('Исправить →',
                      style: AppTypography.labelMedium.copyWith(
                          color: AppColors.expeditorAccent,
                          fontWeight: FontWeight.w700,),),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/ui/client_photo_thumb.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;

class ExpeditorVisitCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final int? seq;
  final VoidCallback onTap;
  final bool tezyuk;

  const ExpeditorVisitCard({
    super.key,
    required this.row,
    required this.seq,
    required this.onTap,
    this.tezyuk = false,
  });

  @override
  Widget build(BuildContext context) {
    final name = row['client_name']?.toString() ?? '—';
    final reason = row['visit_reason']?.toString() ?? '';
    final taskLabel = row['task_label']?.toString();
    final accent = tezyuk ? TezyukColors.primary : AppColors.expeditorAccent;
    final radius = tezyuk ? 16.0 : 14.0;

    return Material(
      color: tezyuk ? TezyukColors.surfaceBright : AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radius),
        side: tezyuk
            ? const BorderSide(color: TezyukColors.surfaceContainerHigh)
            : BorderSide.none,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClientPhotoThumb(
                    source: row['photo_url']?.toString(),
                    size: 40,
                    radius: tezyuk ? 12 : 10,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(right: seq != null ? 28 : 0),
                          child: Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: tezyuk
                                  ? TezyukColors.onSurface
                                  : AppColors.textHeadline,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tezyuk
                              ? 'Sabab:${reason.isNotEmpty ? ' $reason' : ' —'}'
                              : 'Причина визита:${reason.isNotEmpty ? ' $reason' : ''}',
                          style: AppTypography.caption.copyWith(
                            color: tezyuk
                                ? TezyukColors.onSurfaceVariant
                                : AppColors.textMuted,
                          ),
                        ),
                        if (taskLabel != null && taskLabel.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              taskLabel,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: accent,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (seq != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: tezyuk
                        ? TezyukColors.primary
                        : AppColors.textTitle,
                    borderRadius: BorderRadius.only(
                      topRight: Radius.circular(radius),
                      bottomLeft: const Radius.circular(12),
                    ),
                  ),
                  child: Text(
                    '$seq',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class ExpeditorClientVisitCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final bool completed;
  final VoidCallback onTap;
  final VoidCallback onBalanceTap;
  final bool tezyuk;

  const ExpeditorClientVisitCard({
    super.key,
    required this.row,
    this.completed = false,
    required this.onTap,
    required this.onBalanceTap,
    this.tezyuk = false,
  });

  static (String, Color) statusInfo(String status, bool tezyuk) {
    switch (status) {
      case 'delivered':
        return (
          tezyuk ? 'Yetkazildi' : 'Доставлено',
          tezyuk ? TezyukColors.success : AppColors.success,
        );
      case 'returned':
        return (
          tezyuk ? 'Qaytarildi' : 'Возврат',
          tezyuk ? TezyukColors.error : AppColors.error,
        );
      default:
        return (
          tezyuk ? 'Bajarildi' : 'Завершено',
          tezyuk ? TezyukColors.primary : AppColors.expeditorAccent,
        );
    }
  }

  Widget _completedFooter(double orderSum) {
    final accent = tezyuk ? TezyukColors.primary : AppColors.expeditorAccent;
    final (label, color) = statusInfo(row['status']?.toString() ?? '', tezyuk);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
        Text(
          "${formatMoneySpaced(orderSum)} So'm",
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: accent,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = row['client_name']?.toString() ?? '—';
    final subtitle = row['address']?.toString() ??
        (row['order_number'] != null ? '№ ${row['order_number']}' : '');
    final balance = (row['balance'] as num?)?.toDouble() ?? 0;
    final orderSum = (row['total_sum'] as num?)?.toDouble() ?? 0;
    final isDebt = balance < 0;
    final accent = tezyuk ? TezyukColors.primary : AppColors.expeditorAccent;
    final radius = tezyuk ? 16.0 : 14.0;

    return Material(
      color: tezyuk ? TezyukColors.surfaceBright : AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radius),
        side: tezyuk
            ? const BorderSide(color: TezyukColors.surfaceContainerHigh)
            : BorderSide.none,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClientPhotoThumb(
                    source: row['photo_url']?.toString(),
                    size: 48,
                    radius: tezyuk ? 12 : 10,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: tezyuk
                                ? TezyukColors.onSurface
                                : AppColors.textHeadline,
                          ),
                        ),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: tezyuk
                                  ? TezyukColors.onSurfaceVariant
                                  : AppColors.textMuted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (completed)
                _completedFooter(orderSum)
              else
                Row(
                  children: [
                    Expanded(
                      child: ExpeditorVisitMiniStat(
                        tezyuk: tezyuk,
                        label: tezyuk ? 'Balans' : 'Баланс',
                        value: "${formatMoneySpaced(balance)} So'm",
                        valueColor: isDebt
                            ? (tezyuk ? TezyukColors.error : AppColors.error)
                            : (tezyuk
                                ? TezyukColors.onSurface
                                : AppColors.textPrimary),
                        showChevron: true,
                        onTap: onBalanceTap,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ExpeditorVisitMiniStat(
                        tezyuk: tezyuk,
                        label: tezyuk ? 'Buyurtma' : 'Заказ на сумму',
                        value: "${formatMoneySpaced(orderSum)} So'm",
                        valueColor: accent,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class ExpeditorVisitMiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final bool showChevron;
  final VoidCallback? onTap;
  final bool tezyuk;

  const ExpeditorVisitMiniStat({
    super.key,
    required this.label,
    required this.value,
    required this.valueColor,
    this.showChevron = false,
    this.onTap,
    this.tezyuk = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tezyuk ? TezyukColors.surfaceContainerLow : AppColors.background,
      borderRadius: BorderRadius.circular(tezyuk ? 12 : 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(tezyuk ? 12 : 10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppTypography.caption.copyWith(
                        color: tezyuk
                            ? TezyukColors.onSurfaceVariant
                            : AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: valueColor,
                      ),
                    ),
                  ],
                ),
              ),
              if (showChevron)
                Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: tezyuk
                      ? TezyukColors.onSurfaceVariant
                      : AppColors.textMuted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
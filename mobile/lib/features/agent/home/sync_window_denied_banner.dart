import 'package:flutter/material.dart';

import '../../../core/config/mobile_config_policy.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Vaqtinchalik: sinxron oynasi tashqarida — yopiladi, qayta urinishda yana chiqadi.
class SyncWindowDeniedBanner extends StatelessWidget {
  const SyncWindowDeniedBanner({
    super.key,
    required this.info,
    required this.onClose,
  });

  final SyncWindowDeniedInfo info;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        decoration: BoxDecoration(
          color: AppColors.warningSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFDBA74)),
          boxShadow: [
            BoxShadow(
              color: AppColors.warning.withValues(alpha: 0.12),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.schedule_rounded, color: Color(0xFF9A4D00), size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    info.title,
                    style: AppTypography.bodySmall.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF9A4D00),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    info.windowLine,
                    style: AppTypography.bodySmall.copyWith(
                      color: const Color(0xFF9A4D00),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    info.nowLine,
                    style: AppTypography.caption.copyWith(
                      color: const Color(0xFFB45309),
                      fontSize: 12,
                    ),
                  ),
                  if (info.slotLine != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      info.slotLine!,
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF9A4D00),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    info.hint,
                    style: AppTypography.caption.copyWith(
                      color: const Color(0xFF92400E),
                      height: 1.35,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Закрыть',
              onPressed: onClose,
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF9A4D00)),
            ),
          ],
        ),
      ),
    );
  }
}

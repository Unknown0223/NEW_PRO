import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Qaytarish sababi — oddiy ro‘yxat emas, bosiladigan kartochkalar.
class ExpeditorReturnReasonPicker extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  const ExpeditorReturnReasonPicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  static const options = <(String, String)>[
    ('defective', 'Бракованный товар'),
    ('wrong', 'Неверный товар'),
    ('excess', 'Излишек'),
    ('other', 'Другое'),
  ];

  @override
  Widget build(BuildContext context) {
    final picked = value.isNotEmpty;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: picked ? AppColors.warning : AppColors.warning.withValues(alpha: 0.85),
          width: 1.6,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.flag_rounded, color: AppColors.warning, size: 22),
              SizedBox(width: 8),
              Text(
                'Причина возврата',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textHeadline),
              ),
              Text(' *', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.error)),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            picked ? 'Выбрано' : 'Нажмите одну причину',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          for (final option in options) ...[
            _ReasonTile(
              label: option.$2,
              selected: value == option.$1,
              onTap: enabled ? () => onChanged(option.$1) : null,
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _ReasonTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.warning : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.warning : AppColors.warning.withValues(alpha: 0.55),
              width: 1.4,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                color: selected ? Colors.white : AppColors.warning,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : AppColors.textHeadline,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

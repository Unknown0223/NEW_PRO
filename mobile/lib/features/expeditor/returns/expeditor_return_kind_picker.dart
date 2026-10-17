import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Vozvratning 3 turi: to‘liq, qisman, polkadan.
enum ExpeditorReturnKind { full, partial, shelf }

class ExpeditorReturnKindPicker extends StatelessWidget {
  final ExpeditorReturnKind? value;
  final bool partialEnabled;
  final bool shelfEnabled;
  final ValueChanged<ExpeditorReturnKind> onChanged;

  const ExpeditorReturnKindPicker({
    super.key,
    required this.value,
    required this.partialEnabled,
    required this.shelfEnabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Вид возврата',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textHeadline),
        ),
        const SizedBox(height: 4),
        const Text(
          'Выберите один из трёх',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        _KindTile(
          icon: Icons.assignment_return,
          title: 'Полный возврат',
          subtitle: 'Весь заказ целиком',
          selected: value == ExpeditorReturnKind.full,
          enabled: partialEnabled,
          onTap: () => onChanged(ExpeditorReturnKind.full),
        ),
        const SizedBox(height: 8),
        _KindTile(
          icon: Icons.tune,
          title: 'Частичный возврат',
          subtitle: 'Только часть товара',
          selected: value == ExpeditorReturnKind.partial,
          enabled: partialEnabled,
          onTap: () => onChanged(ExpeditorReturnKind.partial),
        ),
        const SizedBox(height: 8),
        _KindTile(
          icon: Icons.inventory_2_outlined,
          title: 'Возврат с полки',
          subtitle: shelfEnabled
              ? 'Товар с полки по этому заказу'
              : 'Выключено в настройках рабочего места',
          selected: value == ExpeditorReturnKind.shelf,
          enabled: shelfEnabled,
          onTap: () => onChanged(ExpeditorReturnKind.shelf),
        ),
      ],
    );
  }
}

class _KindTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  const _KindTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = !enabled
        ? AppColors.textMuted
        : selected
            ? Colors.white
            : AppColors.textHeadline;
    return Material(
      color: !enabled
          ? AppColors.surfaceVariant
          : selected
              ? AppColors.warning
              : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.warning : AppColors.borderLight,
              width: 1.4,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, color: selected && enabled ? Colors.white : AppColors.warning, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
                    Text(subtitle, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: selected && enabled ? Colors.white : AppColors.textSecondary)),
                  ],
                ),
              ),
              Icon(
                selected && enabled ? Icons.check_circle : Icons.circle_outlined,
                color: selected && enabled ? Colors.white : AppColors.textMuted,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

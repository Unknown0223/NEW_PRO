import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';

/// Shablon: `pt-[10px]` + label `top-0 left-4` (NewClientScreen).
class AgentOutlineField extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String? hint;
  final bool showRequiredStar;
  final int maxLines;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final bool readOnly;
  final VoidCallback? onTap;
  final String? errorText;

  const AgentOutlineField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.showRequiredStar = false,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
    this.readOnly = false,
    this.onTap,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    final labelText = showRequiredStar ? '$label *' : label;
    final minH = maxLines > 1 ? 88.0 : 52.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: SizedBox(
                  height: minH,
                  child: TextField(
                    controller: controller,
                    readOnly: readOnly,
                    onTap: onTap,
                    maxLines: maxLines,
                    keyboardType: keyboardType,
                    inputFormatters: inputFormatters,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText: hint,
                      hintStyle: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.textMuted),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: EdgeInsets.fromLTRB(16, 16, 16, maxLines > 1 ? 12 : 16),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(
                          color: errorText != null ? AppColors.error : const Color(0xFFCBD5E1),
                          width: 2,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(
                          color: errorText != null ? AppColors.error : AppColors.primary,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 16,
                top: 0,
                child: Container(
                  color: AppColors.surface,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    labelText,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 16 / 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (errorText != null)
            Padding(
              padding: const EdgeInsets.only(left: 4, top: 4),
              child: Text(errorText!, style: const TextStyle(fontSize: 12, color: AppColors.error)),
            ),
        ],
      ),
    );
  }
}

/// Shablon SelectLike — dropdown (active = teal border).
class AgentOutlineSelect extends StatelessWidget {
  final String label;
  final String? value;
  final List<String> options;
  /// `value` → ko‘rinadigan matn (bo‘lmasa `options` o‘zi chiqadi).
  final Map<String, String>? optionLabels;
  final ValueChanged<String?>? onChanged;
  final bool showRequiredStar;
  final EdgeInsetsGeometry padding;
  final Color labelBackgroundColor;

  const AgentOutlineSelect({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    this.optionLabels,
    this.onChanged,
    this.showRequiredStar = false,
    this.padding = const EdgeInsets.only(bottom: 20),
    this.labelBackgroundColor = AppColors.surface,
  });

  @override
  Widget build(BuildContext context) {
    final labelText = showRequiredStar ? '$label *' : label;
    final enabled = onChanged != null && options.isNotEmpty;
    final active = enabled && value != null && value!.isNotEmpty;
    final safeValue = active && options.contains(value) ? value : null;

    return Padding(
      padding: padding,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: SizedBox(
              height: 52,
              child: DropdownButtonFormField<String>(
                initialValue: safeValue,
                isExpanded: true,
                onChanged: enabled ? onChanged : null,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: enabled ? Colors.white : const Color(0xFFF1F5F9),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: active ? AppColors.primary : const Color(0xFFCBD5E1),
                      width: 2,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
                hint: Text(
                  safeValue == null ? ' ' : '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                items: options
                    .map(
                      (o) => DropdownMenuItem(
                        value: o,
                        child: Text(
                          optionLabels?[o] ?? o,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
          Positioned(
            left: 16,
            top: 0,
            child: Container(
              color: labelBackgroundColor,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                labelText,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 16 / 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shablon kartochka bo‘limi (rounded 16, oq fon).
class AgentTemplateSection extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;

  const AgentTemplateSection({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textHeadline),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

/// Shablon GPS / Фото tugmalari.
class AgentTemplateActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  const AgentTemplateActionButton({
    super.key,
    required this.icon,
    required this.label,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFE3EBF1),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onPressed,
        child: SizedBox(
          height: 48,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

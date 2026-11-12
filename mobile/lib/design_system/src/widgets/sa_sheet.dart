import 'package:flutter/material.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';

/// Pastki varaq — barcha bottom sheet'lar shu orqali ochiladi.
///
///   SaSheet.show(context, title: 'Bonus', child: BonusBody());
class SaSheet {
  const SaSheet._();

  static Future<T?> show<T>(
    BuildContext context, {
    required String title,
    required Widget child,
    String? subtitle,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final scheme = Theme.of(ctx).colorScheme;
        return Container(
          decoration: BoxDecoration(
            color: scheme.surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(SaRadius.sheet),
            ),
          ),
          padding: EdgeInsets.only(
            left: SaSpace.lg,
            right: SaSpace.lg,
            top: SaSpace.sm,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + SaSpace.lg,
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: scheme.outlineVariant,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: SaSpace.md),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: SaType.title),
                          if (subtitle != null)
                            Text(subtitle, style: SaType.caption),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: SaSpace.sm),
                Flexible(child: SingleChildScrollView(child: child)),
              ],
            ),
          ),
        );
      },
    );
  }
}

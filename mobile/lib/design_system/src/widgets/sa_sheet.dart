import 'package:flutter/material.dart';

import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';
import 'sa_motion.dart';

/// Pastki varaq — spring pop (420ms) bilan ochiladi.
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
      transitionAnimationController: null,
      builder: (ctx) {
        final scheme = Theme.of(ctx).colorScheme;
        final reduce = saReduceMotion(ctx);
        return SaPopIn(
          child: AnimatedPadding(
            duration: reduce ? Duration.zero : SaDurations.base,
            curve: SaCurves.standard,
            padding: EdgeInsets.only(
              left: SaSpace.lg,
              right: SaSpace.lg,
              top: SaSpace.sm,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + SaSpace.lg,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: scheme.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(SaRadius.sheet),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 24,
                    offset: const Offset(0, -8),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: SaSpace.sm),
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
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: SaSpace.lg),
                      child: Row(
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
                    ),
                    const SizedBox(height: SaSpace.sm),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(
                          SaSpace.lg,
                          0,
                          SaSpace.lg,
                          SaSpace.lg,
                        ),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

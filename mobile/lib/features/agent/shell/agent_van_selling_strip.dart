import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/van_movement_status_bar.dart';

/// Van selling: marshrut nomi + harakat holati (config bo‘yicha).
class AgentVanSellingStrip extends ConsumerWidget {
  final String routeName;

  const AgentVanSellingStrip({super.key, required this.routeName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final van = ref.watch(sessionProvider).mobileConfig?.vanSelling;
    final showMovement = van?.allowChangeMovementStatus ?? false;
    final name = routeName.trim();
    if (name.isEmpty && !showMovement) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (name.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            color: AppColors.surfaceMuted,
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelMedium.copyWith(color: AppColors.textMenu),
            ),
          ),
        if (showMovement) const VanMovementStatusBar(),
      ],
    );
  }
}

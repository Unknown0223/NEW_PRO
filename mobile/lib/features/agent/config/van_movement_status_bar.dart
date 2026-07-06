import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';

/// Van selling: yo'lda / to'xtagan holati (config: allow_change_movement_status).
class VanMovementStatusBar extends ConsumerWidget {
  const VanMovementStatusBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(agentLocalPrefsProvider).valueOrNull;
    final status = prefs?.vanMovementStatus ?? 'stopped';
    final moving = status == 'moving';

    return Material(
      color: moving ? AppColors.warning.withValues(alpha: 0.15) : AppColors.primary.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Icon(moving ? Icons.directions_car : Icons.local_parking, size: 18),
            const SizedBox(width: 8),
            Expanded(child: Text(moving ? 'Yo\'lda' : 'To\'xtagan', style: const TextStyle(fontSize: 13))),
            TextButton(
              onPressed: () async {
                final next = moving ? 'stopped' : 'moving';
                await ref.read(agentLocalPrefsProvider.notifier).setPrefs((p) => p.copyWith(vanMovementStatus: next));
              },
              child: Text(moving ? 'To\'xtadim' : 'Yo\'lga chiqdim'),
            ),
          ],
        ),
      ),
    );
  }
}

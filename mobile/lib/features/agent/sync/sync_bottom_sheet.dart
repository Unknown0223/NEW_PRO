import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import 'manual_sync_runner.dart';

/// Shablon SyncSheet — 3 jarayon (Rol / Oddiy / To‘liq) + BrandSync animatsiya.
class SyncBottomSheet extends ConsumerWidget {
  const SyncBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const SyncBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final roleWord = saBrandSyncRoleWord(ref.watch(sessionProvider).user?.role);
    final now = TimeOfDay.now();
    final clock =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    return SaPopIn(
      child: Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(SaRadius.sheet)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AgentSheetHandle(),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sinxronlash',
                            style: AppTypography.headlineMedium.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            '3 xil alohida jarayon',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SaPressable(
                      onTap: () => Navigator.pop(context),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.close, size: 18, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SaEnter(
                  preset: SaMotionPreset.rise,
                  child: _SyncOptionCard(
                    icon: Icons.badge_outlined,
                    title: 'Rol kartasi',
                    sub: 'Rasm, raqam va ruxsatlar',
                    badge: '$roleWord animatsiyasi bilan',
                    onTap: () => _run(context, ref, full: false, identity: true),
                  ),
                ),
                const SizedBox(height: 8),
                SaEnter(
                  delay: SaStaggerDelay.of(1),
                  preset: SaMotionPreset.rise,
                  child: _SyncOptionCard(
                    icon: Icons.sync_rounded,
                    title: 'Oddiy sinxron',
                    sub: "Faqat o'zgargan yozuvlar",
                    badge: '$roleWord animatsiyasi bilan',
                    onTap: () => _run(context, ref, full: false),
                  ),
                ),
                const SizedBox(height: 8),
                SaEnter(
                  delay: SaStaggerDelay.of(2),
                  preset: SaMotionPreset.rise,
                  child: _SyncOptionCard(
                    icon: Icons.layers_outlined,
                    title: 'Hammasini sinxronlash',
                    sub: "To'liq kesh va foto",
                    badge: '$roleWord animatsiyasi bilan',
                    highlighted: true,
                    onTap: () => _run(context, ref, full: true),
                  ),
                ),
                const SizedBox(height: 10),
                SaEnter(
                  delay: SaStaggerDelay.of(3),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.wifi_rounded, size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Oflayn kesh tayyor',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                        Text(
                          clock,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SaEnter(
                  delay: SaStaggerDelay.of(4),
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/manual-sync?full=1');
                    },
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Sinxron ekranini ochish'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _run(
    BuildContext context,
    WidgetRef ref, {
    required bool full,
    bool identity = false,
  }) {
    final container = ProviderScope.containerOf(context);
    Navigator.pop(context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(
        startManualSyncWithContainer(
          container,
          full: full,
          identity: identity,
        ),
      );
    });
  }
}


class _SyncOptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String sub;
  final String badge;
  final VoidCallback onTap;
  final bool highlighted;

  const _SyncOptionCard({
    required this.icon,
    required this.title,
    required this.sub,
    required this.badge,
    required this.onTap,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.primary;
    return SaPressable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: highlighted ? accent.withValues(alpha: 0.08) : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: highlighted ? accent.withValues(alpha: 0.28) : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: accent, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    sub,
                    style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                  ),
                  Text(
                    badge,
                    style: AppTypography.caption.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w600,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

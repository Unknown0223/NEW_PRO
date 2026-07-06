import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';

/// Ekspeditor sinxronizatsiyasi — agent SyncSheet ko'rinishidagi ikki variant
/// («Полная» / «Обычная»), oranj rang. Tanlangan turni qaytaradi:
///   true  — полная (full), false — обычная (normal), null — bekor.
class ExpeditorSyncSheet extends StatelessWidget {
  const ExpeditorSyncSheet({super.key});

  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const ExpeditorSyncSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(0, 8, 0, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AgentSheetHandle(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Text(
                      'Синхронизация',
                      style: AppTypography.headlineMedium
                          .copyWith(fontWeight: FontWeight.w800),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Material(
                        color: AppColors.surfaceVariant,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => Navigator.pop(context),
                          child: const SizedBox(
                            width: 28,
                            height: 28,
                            child: Icon(Icons.close,
                                size: 18, color: AppColors.textSecondary,),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _SyncRow(
                icon: Icons.cloud_download_outlined,
                title: 'Полная синхронизация',
                onTap: () => Navigator.pop(context, true),
              ),
              const Divider(height: 1, color: AppColors.borderLight),
              _SyncRow(
                icon: Icons.sync,
                title: 'Обычная синхронизация',
                onTap: () => Navigator.pop(context, false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SyncRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _SyncRow({required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        height: 58,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Icon(icon, color: AppColors.expeditorAccent, size: 24),
              const SizedBox(width: 12),
              Text(title,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600,),),
            ],
          ),
        ),
      ),
    );
  }
}

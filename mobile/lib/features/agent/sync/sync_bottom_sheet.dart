import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/app_strings_ru.dart';
import 'manual_sync_runner.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';

/// Sinxronizatsiya tanlash (shablon SyncSheet).
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
                      S.syncTitle,
                      style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
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
                            child: Icon(Icons.close, size: 18, color: AppColors.textSecondary),
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
                subtitle: 'Каталог, заказы и обмен с сервером',
                onTap: () => _run(context, ref, full: true),
              ),
              const Divider(height: 1, color: AppColors.borderLight),
              _SyncRow(
                icon: Icons.sync,
                title: 'Обычная синхронизация',
                subtitle: 'Изменения с последней синхронизации',
                onTap: () => _run(context, ref, full: false),
              ),
              const Divider(height: 1, color: AppColors.borderLight),
              _SyncRow(
                icon: Icons.photo_library_outlined,
                title: 'Синхронизация фото',
                subtitle: 'Накопленные фото — без ограничения по времени',
                onTap: () => _runPhotos(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _run(BuildContext context, WidgetRef ref, {required bool full}) {
    // Sheet dispose qiladi — WidgetRef ishlatilmasin; container ildiz Scope dan olinadi.
    final container = ProviderScope.containerOf(context);
    Navigator.pop(context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(startManualSyncWithContainer(container, full: full));
    });
  }

  void _runPhotos(BuildContext context) {
    final container = ProviderScope.containerOf(context);
    Navigator.pop(context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(startPhotoSyncWithContainer(container));
    });
  }
}

class _SyncRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  const _SyncRow({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            Icon(icon, color: AppColors.teal700, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        subtitle!,
                        style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

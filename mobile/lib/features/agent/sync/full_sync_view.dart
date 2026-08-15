import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/sync/bootstrap_sync_labels.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';

/// Shablon: «Полная синхронизация» — progress va success holati.
class FullSyncView extends StatelessWidget {
  final bool isSuccess;
  final double progress;
  final List<FullSyncItemState> items;
  final VoidCallback? onContinue;
  final VoidCallback? onBack;
  final String title;
  final String? subtitle;
  final int recordTotal;
  final Color? accentColor;

  const FullSyncView({
    super.key,
    required this.isSuccess,
    required this.progress,
    required this.items,
    this.onContinue,
    this.onBack,
    this.title = 'Полная синхронизация',
    this.subtitle,
    this.recordTotal = 847,
    this.accentColor,
  });

  static const progressLabels = [
    'Товары',
    'Склады',
    'Тара продукты',
    'Клиенты',
    'Заказы',
    'Библиотека',
  ];

  static const successExtraLabel = 'Другие';

  int get _recordCurrent => (progress.clamp(0.0, 1.0) * recordTotal).round();

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? AppColors.primary;
    final syncSubtitle = subtitle ?? '${S.firstLaunch} · ${S.syncRecordsLabel}';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentTopBar(
        title: title,
        onBack: onBack,
        belowTitle: Text(
          syncSubtitle,
          style: AppTypography.bodyMedium.copyWith(
            fontSize: 13,
            color: AppColors.textMuted,
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
          child: Column(
            children: [
              AgentOnboardingCard(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(
                  children: [
                    if (isSuccess)
                      const _BootstrapSuccessIcon()
                    else
                      SyncProgressRing(
                        progress: progress,
                        current: _recordCurrent,
                        total: recordTotal,
                      ),
                    const SizedBox(height: 20),
                    ...items.asMap().entries.map((entry) {
                      return TweenAnimationBuilder<Offset>(
                        key: ValueKey('${entry.value.label}-${entry.value.status}'),
                        tween: Tween(begin: const Offset(-0.1, 0), end: Offset.zero),
                        duration: Duration(milliseconds: 400 + entry.key * 100),
                        curve: Curves.easeOut,
                        builder: (context, offset, child) {
                          return Transform.translate(
                            offset: offset * 20,
                            child: Opacity(
                              opacity: (1 - offset.dx.abs()).clamp(0.0, 1.0),
                              child: child,
                            ),
                          );
                        },
                        child: _SyncCheckRow(item: entry.value),
                      );
                    }),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: isSuccess ? onContinue : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accent,
                          disabledBackgroundColor: const Color(0xFFCBD5E1),
                          disabledForegroundColor: Colors.white,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                        child: Text(S.continueBtn),
                      ),
                    ),
                  ],
                ),
              ),
              if (isSuccess) ...[
                const SizedBox(height: 14),
                AgentOnboardingCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEAFBEF),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check_rounded, color: AppColors.success, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              S.syncDataUpdated,
                              style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              S.syncAllDone,
                              style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      const _ReadyBadge(),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _BootstrapSuccessIcon extends StatelessWidget {
  const _BootstrapSuccessIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 148,
      height: 148,
      alignment: Alignment.center,
      child: Container(
        width: 88,
        height: 88,
        decoration: const BoxDecoration(
          color: Color(0xFFEAFBEF),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check_rounded, size: 42, color: AppColors.success),
      ),
    );
  }
}

class _ReadyBadge extends StatelessWidget {
  const _ReadyBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Text(
        S.readyBadge,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: Color(0xFF157F3A),
          height: 1.2,
        ),
      ),
    );
  }
}

enum FullSyncItemStatus { pending, loading, done }

class FullSyncItemState {
  final String label;
  final FullSyncItemStatus status;

  const FullSyncItemState(this.label, this.status);
}

class _SyncCheckRow extends StatelessWidget {
  final FullSyncItemState item;

  const _SyncCheckRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            item.label,
            style: AppTypography.bodyMedium.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: item.status == FullSyncItemStatus.pending
                  ? AppColors.textMuted
                  : AppColors.textTitle,
            ),
          ),
          _StatusIcon(status: item.status),
        ],
      ),
    );
  }
}

class _StatusIcon extends StatelessWidget {
  final FullSyncItemStatus status;

  const _StatusIcon({required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case FullSyncItemStatus.done:
        return const Icon(Icons.check_rounded, color: AppColors.success, size: 18);
      case FullSyncItemStatus.loading:
        return const SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
        );
      case FullSyncItemStatus.pending:
        return Container(
          width: 14,
          height: 14,
          decoration: const BoxDecoration(
            color: Color(0xFFD8E2EA),
            shape: BoxShape.circle,
          ),
        );
    }
  }
}

/// Bootstrap qadamidan UI holatini hisoblash (progress va ro‘yxat faqat oldinga).
FullSyncViewModel fullSyncViewModelFromBootstrap({
  required bool isSuccess,
  required int stepIndex,
  int? syncPhaseIndex,
  String? role,
}) {
  final plan = BootstrapSyncPlan.forRole(role);
  final labels = plan.phaseLabels;
  final total = labels.length;
  const syncStepIdx = 3;
  final isAgent = BootstrapSyncPlan.isAgentRole(role);

  if (isSuccess) {
    final all = [
      ...labels.map((l) => FullSyncItemState(l, FullSyncItemStatus.done)),
      if (isAgent) const FullSyncItemState(FullSyncView.successExtraLabel, FullSyncItemStatus.done),
    ];
    return FullSyncViewModel(
      progress: 1,
      items: all,
      isSuccess: true,
      title: plan.title,
    );
  }

  if (stepIndex < syncStepIdx) {
    final prep = 0.03 + 0.02 * stepIndex;
    return _syncPhaseModel(
      labels: labels,
      activeIndex: 0,
      doneThrough: -1,
      progress: prep,
      title: plan.title,
    );
  }

  if (stepIndex > syncStepIdx) {
    return _syncPhaseModel(
      labels: labels,
      activeIndex: total,
      doneThrough: total - 1,
      progress: 0.98,
      title: plan.title,
    );
  }

  final phase = (syncPhaseIndex ?? 0).clamp(0, total - 1);
  const prepWeight = 0.10;
  final syncProgress = prepWeight + (1.0 - prepWeight) * ((phase + 0.35) / total);
  return _syncPhaseModel(
    labels: labels,
    activeIndex: phase,
    doneThrough: phase - 1,
    progress: syncProgress.clamp(0.0, 0.99),
    title: plan.title,
  );
}

FullSyncViewModel _syncPhaseModel({
  required List<String> labels,
  required int activeIndex,
  required int doneThrough,
  required double progress,
  required String title,
}) {
  final items = <FullSyncItemState>[];
  for (var i = 0; i < labels.length; i++) {
    final FullSyncItemStatus st;
    if (i <= doneThrough) {
      st = FullSyncItemStatus.done;
    } else if (i == activeIndex) {
      st = FullSyncItemStatus.loading;
    } else {
      st = FullSyncItemStatus.pending;
    }
    items.add(FullSyncItemState(labels[i], st));
  }
  return FullSyncViewModel(
    progress: progress.clamp(0.0, 0.99),
    items: items,
    isSuccess: false,
    title: title,
  );
}

class FullSyncViewModel {
  final double progress;
  final List<FullSyncItemState> items;
  final bool isSuccess;
  final String title;

  const FullSyncViewModel({
    required this.progress,
    required this.items,
    required this.isSuccess,
    this.title = 'Полная синхронизация',
  });
}

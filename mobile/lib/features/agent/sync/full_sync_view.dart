import 'dart:math' as math;

import 'package:flutter/material.dart';

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
  final Color? accentColor;

  const FullSyncView({
    super.key,
    required this.isSuccess,
    required this.progress,
    required this.items,
    this.onContinue,
    this.onBack,
    this.title = 'Полная синхронизация',
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

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? AppColors.primary;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentTopBar(
        title: title,
        onBack: onBack,
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: AgentSurfaceCard(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isSuccess) ...[
                        _SuccessBadge(),
                        const SizedBox(height: 28),
                      ] else ...[
                        _SyncProgressRing(key: const ValueKey('sync-ring'), progress: progress),
                        const SizedBox(height: 28),
                      ],
                      ...items.map(_SyncCheckRow.new),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: isSuccess ? onContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent,
                  disabledBackgroundColor: const Color(0xFFE2E8F0),
                  disabledForegroundColor: AppColors.textDisabled,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                child: const Text('Продолжить'),
              ),
            ),
          ),
        ],
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

/// Progress halqasi — qiymat hech qachon orqaga qaytmaydi (UI «qayta to‘lish» effektini yo‘qotadi).
class _SyncProgressRing extends StatefulWidget {
  final double progress;

  const _SyncProgressRing({super.key, required this.progress});

  @override
  State<_SyncProgressRing> createState() => _SyncProgressRingState();
}

class _SyncProgressRingState extends State<_SyncProgressRing> {
  double _displayed = 0;

  @override
  void initState() {
    super.initState();
    _displayed = widget.progress.clamp(0.0, 1.0);
  }

  @override
  void didUpdateWidget(_SyncProgressRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.progress.clamp(0.0, 1.0);
    if (next < _displayed - 0.08) {
      _displayed = next;
    } else if (next > _displayed) {
      _displayed = next;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pct = (_displayed * 100).round();
    return SizedBox(
      width: 168,
      height: 168,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size(168, 168),
            painter: _GradientRingPainter(progress: _displayed),
          ),
          Text(
            '$pct%',
            style: AppTypography.headlineMedium.copyWith(
              fontSize: 32,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF22A06B),
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientRingPainter extends CustomPainter {
  final double progress;

  _GradientRingPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;
    const stroke = 12.0;

    final bg = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bg);

    if (progress <= 0) return;

    final rect = Rect.fromCircle(center: center, radius: radius);
    const gradient = SweepGradient(
      startAngle: -math.pi / 2,
      endAngle: 3 * math.pi / 2,
      colors: [
        Color(0xFF12C86F),
        Color(0xFF079BD4),
        Color(0x6612C86F),
      ],
    );

    final fg = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * progress, false, fg);
  }

  @override
  bool shouldRepaint(covariant _GradientRingPainter oldDelegate) => oldDelegate.progress != progress;
}

class _SuccessBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        color: const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(44),
      ),
      child: const Icon(Icons.check_rounded, size: 48, color: Color(0xFF22C55E)),
    );
  }
}

class _SyncCheckRow extends StatelessWidget {
  final FullSyncItemState item;

  const _SyncCheckRow(this.item);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          _StatusIcon(status: item.status),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              item.label,
              style: AppTypography.bodyMedium.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: item.status == FullSyncItemStatus.pending
                    ? AppColors.textDisabled
                    : AppColors.textPrimary,
              ),
            ),
          ),
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
        return Container(
          width: 28,
          height: 28,
          decoration: const BoxDecoration(
            color: Color(0xFF22C55E),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, size: 18, color: Colors.white),
        );
      case FullSyncItemStatus.loading:
        return Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.borderLight),
          ),
          child: const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textMuted),
          ),
        );
      case FullSyncItemStatus.pending:
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.borderLight),
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

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'attendance_gate_steps.dart';
import 'attendance_models.dart';
import 'punch_face_result.dart';

/// Birinchi kirish — bitta yaxlit sahifa (tab/chip/dialog yo‘q).
class AttendanceGatePage extends StatelessWidget {
  const AttendanceGatePage({
    super.key,
    required this.state,
    required this.steps,
    required this.stepIndex,
    required this.submitting,
    required this.statusText,
    required this.onPrimary,
    this.onChoosePhoto,
    this.onChooseVideo,
    this.dayCode,
    this.faceResult,
    this.onContinueAfterResult,
    this.onRetryAfterFail,
  });

  final MobileAttendanceState state;
  final List<AttendanceGateStep> steps;
  final int stepIndex;
  final bool submitting;
  final String? statusText;
  final VoidCallback onPrimary;
  final VoidCallback? onChoosePhoto;
  final VoidCallback? onChooseVideo;
  final int? dayCode;
  final PunchFaceResult? faceResult;
  final VoidCallback? onContinueAfterResult;
  final VoidCallback? onRetryAfterFail;

  @override
  Widget build(BuildContext context) {
    if (faceResult != null) {
      return _ResultBody(
        result: faceResult!,
        onContinue: onContinueAfterResult,
        onRetry: onRetryAfterFail,
      );
    }
    if (steps.isEmpty) {
      return const Center(child: Text('Нет доступного способа отметки'));
    }
    final idx = stepIndex.clamp(0, steps.length - 1);
    final step = steps[idx];
    final progress = (idx + 1) / steps.length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Смена: ${state.shiftName}',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.textTitle,
            ),
          ),
          Text(
            '${state.shiftStart} – ${state.shiftEnd}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 28),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(_iconFor(step.kind), size: 72, color: AppColors.primary),
                const SizedBox(height: 20),
                Text(
                  step.title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textTitle,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  step.hint,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.35,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (step.kind == AttendanceGateStepKind.video && dayCode != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    '$dayCode',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 8,
                      color: AppColors.primaryDark,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Произнесите этот код на видео',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ],
                if (statusText != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    statusText!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (step.kind != AttendanceGateStepKind.choose) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: AppColors.surfaceMuted,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${idx + 1} / ${steps.length}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 18),
          ],
          if (step.kind == AttendanceGateStepKind.choose) ...[
            FilledButton.icon(
              onPressed: submitting ? null : onChoosePhoto,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.face_retouching_natural),
              label: const Text(
                'Face ID · фото',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: submitting ? null : onChooseVideo,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryDark,
                minimumSize: const Size.fromHeight(52),
                side: const BorderSide(color: AppColors.primary, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.videocam_outlined),
              label: const Text(
                'Видео + дневной код',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ] else
            FilledButton(
              onPressed: submitting ? null : onPrimary,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                submitting ? 'Подождите…' : _buttonLabel(step),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }

  static IconData _iconFor(AttendanceGateStepKind kind) {
    switch (kind) {
      case AttendanceGateStepKind.choose:
        return Icons.how_to_reg_rounded;
      case AttendanceGateStepKind.liveness:
        return Icons.face_retouching_natural;
      case AttendanceGateStepKind.workplace:
        return Icons.photo_camera_back_outlined;
      case AttendanceGateStepKind.video:
        return Icons.videocam_outlined;
      case AttendanceGateStepKind.submit:
        return Icons.login_rounded;
    }
  }

  static String _buttonLabel(AttendanceGateStep step) {
    switch (step.kind) {
      case AttendanceGateStepKind.choose:
        return 'Выбрать';
      case AttendanceGateStepKind.liveness:
      case AttendanceGateStepKind.workplace:
        return 'Открыть камеру';
      case AttendanceGateStepKind.video:
        return 'Записать видео';
      case AttendanceGateStepKind.submit:
        return 'Отметить ПРИХОД';
    }
  }
}

class _ResultBody extends StatelessWidget {
  const _ResultBody({
    required this.result,
    this.onContinue,
    this.onRetry,
  });

  final PunchFaceResult result;
  final VoidCallback? onContinue;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final ok = result.matched;
    final color = ok ? AppColors.success : AppColors.error;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  ok ? Icons.verified_rounded : Icons.face_retouching_off,
                  size: 88,
                  color: color,
                ),
                const SizedBox(height: 20),
                Text(
                  result.titleRu,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: ok ? AppColors.textTitle : AppColors.error,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  result.detailRu,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.35,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (result.scorePercent != null) ...[
                  const SizedBox(height: 20),
                  Text(
                    '${result.scorePercent!.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      color: color,
                    ),
                  ),
                  Text(
                    ok ? 'совпадение — это ваш аккаунт' : 'не ваш эталон — в табель не принято',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          if (ok)
            FilledButton(
              onPressed: onContinue,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text(
                'Открыть приложение',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            )
          else
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text(
                'Повторить Face ID',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }
}

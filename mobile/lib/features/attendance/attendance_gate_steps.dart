import 'attendance_models.dart';

enum AttendanceGateStepKind { liveness, workplace, video, submit }

/// Birinchi kirish (gate) — bitta oqim, akkaunt shartiga qarab.
class AttendanceGateStep {
  const AttendanceGateStep({
    required this.kind,
    required this.title,
    required this.hint,
    this.direction,
  });

  final AttendanceGateStepKind kind;
  final String title;
  final String hint;
  final String? direction;
}

/// Sof: gate sahifasi qadamlari (unit-test).
List<AttendanceGateStep> buildAttendanceGateSteps({
  required bool photoEnabled,
  required bool videoEnabled,
  required bool kioskAllowed,
  required int livenessDirections,
  required bool requireDualCamera,
  List<String>? livenessSequence,
}) {
  if (photoEnabled) {
    final seq = livenessSequence ?? LivenessHelper.buildSequence(livenessDirections);
    final steps = <AttendanceGateStep>[];
    for (var i = 0; i < seq.length; i++) {
      final dir = seq[i];
      final label = LivenessHelper.labelsRu[dir] ?? dir;
      steps.add(
        AttendanceGateStep(
          kind: AttendanceGateStepKind.liveness,
          direction: dir,
          title: 'Шаг ${i + 1}/${seq.length}',
          hint: label,
        ),
      );
    }
    if (requireDualCamera) {
      steps.add(
        const AttendanceGateStep(
          kind: AttendanceGateStepKind.workplace,
          title: 'Рабочее место',
          hint: 'Сфотографируйте объект задней камерой',
        ),
      );
    }
    steps.add(
      const AttendanceGateStep(
        kind: AttendanceGateStepKind.submit,
        title: 'ПРИХОД',
        hint: 'Отметьте приход — приложение откроется',
      ),
    );
    return steps;
  }

  if (videoEnabled) {
    return const [
      AttendanceGateStep(
        kind: AttendanceGateStepKind.video,
        title: 'Видео-отметка',
        hint: 'Произнесите дневной код на фронтальном видео',
      ),
      AttendanceGateStep(
        kind: AttendanceGateStepKind.submit,
        title: 'ПРИХОД',
        hint: 'Отправьте видео — приложение откроется',
      ),
    ];
  }

  if (kioskAllowed) {
    return const [
      AttendanceGateStep(
        kind: AttendanceGateStepKind.submit,
        title: 'Вход',
        hint: 'Киоск доступен после входа в приложение',
      ),
    ];
  }

  return const [];
}

import 'attendance_models.dart';

enum AttendanceGateStepKind { choose, liveness, workplace, video, submit }

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
/// [selectedMethod]: `photo` | `video` | null (ikkala yoqilganda avval tanlov).
List<AttendanceGateStep> buildAttendanceGateSteps({
  required bool photoEnabled,
  required bool videoEnabled,
  required bool kioskAllowed,
  required int livenessDirections,
  required bool requireDualCamera,
  List<String>? livenessSequence,
  String? selectedMethod,
  bool videoCodeRequired = false,
  int? dayCode,
}) {
  if (photoEnabled && videoEnabled && selectedMethod == null) {
    return const [
      AttendanceGateStep(
        kind: AttendanceGateStepKind.choose,
        title: 'Способ отметки',
        hint: 'Face ID сверяет лицо с эталоном аккаунта. Либо видео: произнесите дневной код (фронт + задняя камера).',
      ),
    ];
  }

  final useVideo = videoEnabled && (selectedMethod == 'video' || !photoEnabled);
  if (useVideo) {
    final codeHint = videoCodeRequired && dayCode != null
        ? 'Произнесите код $dayCode на фронт-видео, затем снимите рабочее место (задняя камера)'
        : 'Фронт-видео с лицом, затем задняя камера рабочего места';
    return [
      AttendanceGateStep(
        kind: AttendanceGateStepKind.video,
        title: 'Видео + код',
        hint: codeHint,
      ),
      const AttendanceGateStep(
        kind: AttendanceGateStepKind.submit,
        title: 'ПРИХОД',
        hint: 'Сервер проверит код и примет отметку в табель',
      ),
    ];
  }

  if (photoEnabled) {
    final n = livenessSequence?.length ?? (livenessDirections == 8 ? 8 : 4);
    final steps = <AttendanceGateStep>[
      AttendanceGateStep(
        kind: AttendanceGateStepKind.liveness,
        title: 'Face ID · проверка лица',
        hint:
            'Следуйте стрелкам ($n). Селфи сверят с эталоном ЭТОГО аккаунта — чужое лицо в табель не попадёт',
      ),
    ];
    if (requireDualCamera) {
      steps.add(
        const AttendanceGateStep(
          kind: AttendanceGateStepKind.workplace,
          title: 'Рабочее место',
          hint: 'Задняя камера: стол, стол или объект на рабочем месте',
        ),
      );
    }
    steps.add(
      const AttendanceGateStep(
        kind: AttendanceGateStepKind.submit,
        title: 'ПРИХОД + Face ID',
        hint: 'Только при совпадении с эталоном аккаунта отметка попадёт в табель',
      ),
    );
    return steps;
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

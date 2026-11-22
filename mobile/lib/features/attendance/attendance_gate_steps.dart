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
/// Liveness — bitta qadam: kamera ichida random strelkalar.
List<AttendanceGateStep> buildAttendanceGateSteps({
  required bool photoEnabled,
  required bool videoEnabled,
  required bool kioskAllowed,
  required int livenessDirections,
  required bool requireDualCamera,
  List<String>? livenessSequence,
}) {
  if (photoEnabled) {
    final n = livenessSequence?.length ?? (livenessDirections == 8 ? 8 : 4);
    final steps = <AttendanceGateStep>[
      AttendanceGateStep(
        kind: AttendanceGateStepKind.liveness,
        title: 'Проверка лица',
        hint: 'Следуйте стрелкам в камере ($n). Селфи сверят с эталоном аккаунта',
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
        hint: 'Сервер сверит лицо с вашим эталоном и покажет результат',
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

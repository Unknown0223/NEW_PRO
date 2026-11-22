import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/attendance_gate_steps.dart';

void main() {
  group('buildAttendanceGateSteps', () {
    test('foto: bitta liveness + dual + submit', () {
      final steps = buildAttendanceGateSteps(
        photoEnabled: true,
        videoEnabled: true,
        kioskAllowed: true,
        livenessDirections: 4,
        requireDualCamera: true,
        livenessSequence: const ['right', 'left', 'up', 'down'],
      );
      expect(steps.map((e) => e.kind).toList(), [
        AttendanceGateStepKind.liveness,
        AttendanceGateStepKind.workplace,
        AttendanceGateStepKind.submit,
      ]);
    });

    test('foto: dual yo‘q — liveness + submit', () {
      final steps = buildAttendanceGateSteps(
        photoEnabled: true,
        videoEnabled: false,
        kioskAllowed: false,
        livenessDirections: 2,
        requireDualCamera: false,
      );
      expect(steps.map((e) => e.kind).toList(), [
        AttendanceGateStepKind.liveness,
        AttendanceGateStepKind.submit,
      ]);
    });

    test('faqat video', () {
      final steps = buildAttendanceGateSteps(
        photoEnabled: false,
        videoEnabled: true,
        kioskAllowed: false,
        livenessDirections: 4,
        requireDualCamera: true,
      );
      expect(steps.map((e) => e.kind).toList(), [
        AttendanceGateStepKind.video,
        AttendanceGateStepKind.submit,
      ]);
    });

    test('hech narsa — bo‘sh', () {
      expect(
        buildAttendanceGateSteps(
          photoEnabled: false,
          videoEnabled: false,
          kioskAllowed: false,
          livenessDirections: 4,
          requireDualCamera: false,
        ),
        isEmpty,
      );
    });
  });
}

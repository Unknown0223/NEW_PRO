import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/attendance_gate_steps.dart';

void main() {
  group('buildAttendanceGateSteps', () {
    test('foto yoqilgan — faqat Face ID oqimi (video e’tiborsiz)', () {
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

    test('faqat foto: dual yo‘q — liveness + submit', () {
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

    test('faqat video + kod', () {
      final steps = buildAttendanceGateSteps(
        photoEnabled: false,
        videoEnabled: true,
        kioskAllowed: false,
        livenessDirections: 4,
        requireDualCamera: true,
        videoCodeRequired: true,
        dayCode: 427,
      );
      expect(steps.map((e) => e.kind).toList(), [
        AttendanceGateStepKind.video,
        AttendanceGateStepKind.submit,
      ]);
      expect(steps.first.hint, contains('427'));
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

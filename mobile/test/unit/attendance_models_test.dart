import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/attendance_models.dart';

void main() {
  group('Attendance mobile models & guards', () {
    test('LivenessHelper builds 4 and 8 direction sequences', () {
      final seq4 = LivenessHelper.buildSequence(4);
      expect(seq4.length, 4);
      expect(seq4.toSet().length, 4);

      final seq8 = LivenessHelper.buildSequence(8);
      expect(seq8.length, 8);
      expect(seq8.toSet().length, 8);
    });

    test('LocationIntegrityGuard blocks mock GPS and low accuracy', () {
      final mocked = LocationIntegrityGuard(
        isMocked: true,
        accuracyMeters: 15,
        clientUtc: DateTime.now().toUtc(),
      );
      expect(mocked.validate(), contains('Fake GPS'));

      final lowAcc = LocationIntegrityGuard(
        isMocked: false,
        accuracyMeters: 250,
        maxAllowedAccuracyMeters: 100,
        clientUtc: DateTime.now().toUtc(),
      );
      expect(lowAcc.validate(), contains('Низкая точность GPS'));
    });

    test('MobileAttendanceState parses server payload', () {
      final st = MobileAttendanceState.fromJson({
        'server_time': '2026-10-25T10:00:00.000Z',
        'today_ymd': '2026-10-25',
        'shift': {'name': 'Дневная', 'start_time': '08:00', 'end_time': '17:00'},
        'face_enrolled': true,
        'liveness_directions': 8,
        'require_dual_camera': true,
        'max_gps_accuracy_m': 100,
        'kiosk_allowed': true,
        'video_punch': {
          'enabled': true,
          'code_required': true,
          'day_code': 742,
          'min_sec': 5,
          'max_sec': 10,
          'capture_mode': 'simultaneous',
        },
        'locations': [
          {'id': 1, 'name': 'Офис', 'lat': 40.78, 'lng': 72.34, 'radius_m': 150}
        ],
        'today_punches': [],
      });
      expect(st.todayYmd, '2026-10-25');
      expect(st.shiftStart, '08:00');
      expect(st.livenessDirections, 8);
      expect(st.dayCode, 742);
      expect(st.captureMode, 'simultaneous');
      expect(st.kioskAllowed, isTrue);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/attendance_models.dart';

void main() {
  group('attendanceVisibleTabs', () {
    test('faqat yoqilgan usullar + Заявки', () {
      expect(
        attendanceVisibleTabs(
          photoEnabled: true,
          videoEnabled: false,
          kioskAllowed: false,
        ),
        [AttendanceMethodTab.photo, AttendanceMethodTab.requests],
      );
      expect(
        attendanceVisibleTabs(
          photoEnabled: false,
          videoEnabled: true,
          kioskAllowed: true,
        ),
        [
          AttendanceMethodTab.video,
          AttendanceMethodTab.kiosk,
          AttendanceMethodTab.requests,
        ],
      );
    });

    test('gateMode: bitta asosiy punch, Заявки yo‘q', () {
      expect(
        attendanceVisibleTabs(
          photoEnabled: true,
          videoEnabled: true,
          kioskAllowed: true,
          gateMode: true,
        ),
        [AttendanceMethodTab.photo],
      );
      expect(
        attendanceVisibleTabs(
          photoEnabled: false,
          videoEnabled: true,
          kioskAllowed: false,
          gateMode: true,
        ),
        [AttendanceMethodTab.video],
      );
    });

    test('hech narsa yoqilmasa — bo‘sh', () {
      expect(
        attendanceVisibleTabs(
          photoEnabled: false,
          videoEnabled: false,
          kioskAllowed: false,
        ),
        [AttendanceMethodTab.requests],
      );
      expect(
        attendanceVisibleTabs(
          photoEnabled: false,
          videoEnabled: false,
          kioskAllowed: false,
          gateMode: true,
        ),
        isEmpty,
      );
    });
  });

  group('MobileAttendanceState.fromJson allowed_methods', () {
    test('allowed_methods foto-only', () {
      final st = MobileAttendanceState.fromJson({
        'allowed_methods': ['photo', 'terminal'],
        'shift': {'name': 'Смена', 'start_time': '09:00', 'end_time': '18:00'},
        'video_punch': {'enabled': true},
        'photo_punch': {'enabled': true},
        'kiosk_allowed': true,
      });
      expect(st.photoEnabled, isTrue);
      expect(st.videoEnabled, isFalse);
      expect(st.kioskAllowed, isFalse);
      expect(st.visibleTabs(), [AttendanceMethodTab.photo, AttendanceMethodTab.requests]);
    });
  });
}

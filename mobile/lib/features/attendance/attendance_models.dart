import 'dart:math';

export '../../core/security/location_guard.dart' show LocationIntegrityGuard, LocationGuardException;

/// 4 va 8 yo'nalishli Liveness bosh burish bosqichlari.
class LivenessHelper {
  static const List<String> fourDirections = ['left', 'right', 'up', 'down'];
  static const List<String> eightDirections = [
    'left',
    'right',
    'up',
    'down',
    'up_left',
    'up_right',
    'down_left',
    'down_right',
  ];

  static const Map<String, String> labelsRu = {
    'left': 'Поверните голову ВЛЕВО ⬅️',
    'right': 'Поверните голову ВПРАВО ➡️',
    'up': 'Поднимите голову ВВЕРХ ⬆️',
    'down': 'Опустите голову ВНИЗ ⬇️',
    'up_left': 'Поверните ВВЕРХ-ВЛЕВО ↖️',
    'up_right': 'Поверните ВВЕРХ-ВПРАВО ↗️',
    'down_left': 'Поверните ВНИЗ-ВЛЕВО ↙️',
    'down_right': 'Поверните ВНИЗ-ВПРАВО ↘️',
  };

  static List<String> buildSequence(int count, {Random? random}) {
    final rng = random ?? Random();
    final base = List<String>.from(count == 8 ? eightDirections : fourDirections);
    base.shuffle(rng);
    return base;
  }
}

enum AttendanceMethodTab { photo, video, kiosk, requests }

class MobileAttendanceState {
  final String serverTime;
  final String todayYmd;
  final String shiftName;
  final String shiftStart;
  final String shiftEnd;
  final bool faceEnrolled;
  final int livenessDirections;
  final bool requireDualCamera;
  final double maxGpsAccuracyM;
  final bool kioskAllowed;
  final bool photoEnabled;
  final bool videoEnabled;
  final bool videoCodeRequired;
  final int? dayCode;
  final int videoMinSec;
  final int videoMaxSec;
  final String captureMode;
  final bool terminalAllowed;
  final List<String> allowedMethods;
  final List<Map<String, dynamic>> locations;
  final Map<String, dynamic>? todayRecord;
  final List<Map<String, dynamic>> todayPunches;

  const MobileAttendanceState({
    required this.serverTime,
    required this.todayYmd,
    required this.shiftName,
    required this.shiftStart,
    required this.shiftEnd,
    required this.faceEnrolled,
    required this.livenessDirections,
    required this.requireDualCamera,
    required this.maxGpsAccuracyM,
    required this.kioskAllowed,
    required this.photoEnabled,
    required this.videoEnabled,
    required this.videoCodeRequired,
    required this.dayCode,
    required this.videoMinSec,
    required this.videoMaxSec,
    required this.captureMode,
    required this.terminalAllowed,
    required this.allowedMethods,
    required this.locations,
    required this.todayRecord,
    required this.todayPunches,
  });

  bool get mobileAny => photoEnabled || videoEnabled || kioskAllowed;
  bool get terminalOnly => !mobileAny && terminalAllowed;
  bool get punchDisabled => !mobileAny && !terminalAllowed;

  /// Mobil tablar (Заявки har doim oxirida).
  List<AttendanceMethodTab> get visibleTabs {
    final tabs = <AttendanceMethodTab>[];
    if (photoEnabled) tabs.add(AttendanceMethodTab.photo);
    if (videoEnabled) tabs.add(AttendanceMethodTab.video);
    if (kioskAllowed) tabs.add(AttendanceMethodTab.kiosk);
    tabs.add(AttendanceMethodTab.requests);
    return tabs;
  }

  factory MobileAttendanceState.fromJson(Map<String, dynamic> json) {
    final shift = json['shift'] is Map
        ? Map<String, dynamic>.from(json['shift'] as Map)
        : <String, dynamic>{};
    final vp = json['video_punch'] is Map
        ? Map<String, dynamic>.from(json['video_punch'] as Map)
        : <String, dynamic>{};
    final pp = json['photo_punch'] is Map
        ? Map<String, dynamic>.from(json['photo_punch'] as Map)
        : <String, dynamic>{};
    final pm = json['punch_modes'] is Map
        ? Map<String, dynamic>.from(json['punch_modes'] as Map)
        : <String, dynamic>{};
    final locs = (json['locations'] is List ? json['locations'] as List : const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final punches = (json['today_punches'] is List ? json['today_punches'] as List : const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    final allowed = (json['allowed_methods'] is List ? json['allowed_methods'] as List : const [])
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();

    final bool photoEnabled;
    final bool videoEnabled;
    final bool kioskAllowed;
    final bool terminalAllowed;
    if (allowed.isNotEmpty) {
      photoEnabled = allowed.contains('photo');
      videoEnabled = allowed.contains('video');
      kioskAllowed = allowed.contains('kiosk');
      terminalAllowed = allowed.contains('terminal');
    } else if (pm.isNotEmpty) {
      photoEnabled = pm['photo'] != false;
      videoEnabled = pm['video'] != false && vp['enabled'] != false;
      kioskAllowed = pm['kiosk'] != false && json['kiosk_allowed'] == true;
      terminalAllowed = pm['terminal'] != false;
    } else {
      photoEnabled = pp['enabled'] != false;
      videoEnabled = vp['enabled'] != false;
      kioskAllowed = json['kiosk_allowed'] == true;
      terminalAllowed = true;
    }

    return MobileAttendanceState(
      serverTime: json['server_time']?.toString() ?? '',
      todayYmd: json['today_ymd']?.toString() ?? '',
      shiftName: shift['name']?.toString() ?? '09:00–18:00',
      shiftStart: shift['start_time']?.toString() ?? '09:00',
      shiftEnd: shift['end_time']?.toString() ?? '18:00',
      faceEnrolled: json['face_enrolled'] == true,
      livenessDirections: (json['liveness_directions'] as num?)?.toInt() == 8 ? 8 : 4,
      requireDualCamera: json['require_dual_camera'] != false,
      maxGpsAccuracyM: (json['max_gps_accuracy_m'] as num?)?.toDouble() ?? 100.0,
      kioskAllowed: kioskAllowed,
      photoEnabled: photoEnabled,
      videoEnabled: videoEnabled,
      videoCodeRequired: vp['code_required'] != false,
      dayCode: (vp['day_code'] as num?)?.toInt(),
      videoMinSec: (vp['min_sec'] as num?)?.toInt() ?? 5,
      videoMaxSec: (vp['max_sec'] as num?)?.toInt() ?? 10,
      captureMode: vp['capture_mode']?.toString() ?? 'sequential',
      terminalAllowed: terminalAllowed,
      allowedMethods: allowed.isNotEmpty
          ? allowed
          : [
              if (photoEnabled) 'photo',
              if (videoEnabled) 'video',
              if (kioskAllowed) 'kiosk',
              if (terminalAllowed) 'terminal',
            ],
      locations: locs,
      todayRecord: json['today_record'] is Map
          ? Map<String, dynamic>.from(json['today_record'] as Map)
          : null,
      todayPunches: punches,
    );
  }
}

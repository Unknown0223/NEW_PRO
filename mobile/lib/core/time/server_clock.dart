import 'package:flutter/foundation.dart';

/// Serverdan langarlangan, buzib bo‘lmaydigan soat.
///
/// Maqsad: sinхрон oynasi va biznes «bugun» hisoblari qurilma soatiga
/// tayanmasin. **Server UTC har doim manba** — noto‘g‘ri saqlangan floor
/// (+5 ikki marta va h.k.) yangi `X-Server-Time` bilan tuzatiladi.
class ServerClock {
  ServerClock._();
  static final ServerClock instance = ServerClock._();

  final Stopwatch _mono = Stopwatch()..start();

  DateTime? _anchorServerUtc;
  Duration? _anchorMono;

  /// Saqlangan «pol» — oflayn holatda orqaga ketmaslik (faqat server yo‘qida).
  DateTime? _floorUtc;
  DateTime? _floorDeviceUtc;
  DateTime? _lastPersistedFloorUtc;

  void Function(DateTime serverUtc, DateTime deviceUtc)? _onPersist;

  bool get hasAnchor => _anchorServerUtc != null && _anchorMono != null;

  /// Restartda saqlangan floor. Agar floor qurilma UTC dan sezilarli oldinda
  /// bo‘lsa (tipik: local wall-clock UTC deb yozilgan) — e’tiborsiz qoldiramiz.
  void loadPersisted(DateTime? floorUtc, [DateTime? floorDeviceUtc]) {
    if (floorUtc == null) return;
    final utc = floorUtc.toUtc();
    if (utc.year < 2020 || utc.year > 2100) return;

    final deviceUtc = DateTime.now().toUtc();
    // +2 soatdan ko‘p oldinda — buzilgan floor (masalan 12:00Z o‘rniga 07:00Z).
    if (utc.isAfter(deviceUtc.add(const Duration(hours: 2)))) {
      if (kDebugMode) {
        debugPrint(
          'ServerClock: buzilgan floor tashlandi (floor=$utc, deviceUtc=$deviceUtc)',
        );
      }
      return;
    }

    _floorUtc = utc;
    _floorDeviceUtc = (floorDeviceUtc ?? DateTime.now()).toUtc();
    _lastPersistedFloorUtc = utc;
  }

  void configurePersistence(
    void Function(DateTime serverUtc, DateTime deviceUtc)? onPersist,
  ) {
    _onPersist = onPersist;
  }

  void _persistFloor(DateTime utc) {
    _floorUtc = utc;
    _floorDeviceUtc = DateTime.now().toUtc();
    final lastP = _lastPersistedFloorUtc;
    if (_onPersist != null &&
        (lastP == null || utc.difference(lastP).inSeconds.abs() >= 60)) {
      _lastPersistedFloorUtc = utc;
      try {
        _onPersist!(utc, _floorDeviceUtc!);
      } catch (_) {}
    }
  }

  /// Ishonchli server UTC — **har doim** langarni yangilaydi (orqaga ham).
  ///
  /// Avvalgi mantiq «orqaga ketishni rad» qilardi; noto‘g‘ri floor/langar
  /// (+5 ikki marta → 17:00) qolganda to‘g‘ri `X-Server-Time` (07:00Z)
  /// rad etilib, sync 17:00 deb hisoblanardi.
  void anchorFromServerUtc(DateTime? serverUtc) {
    if (serverUtc == null) return;
    final utc = serverUtc.toUtc();
    if (utc.year < 2020 || utc.year > 2100) return;

    final monoNow = _mono.elapsed;
    final prev = _anchorServerUtc;
    final prevMono = _anchorMono;

    _anchorServerUtc = utc;
    _anchorMono = monoNow;
    _persistFloor(utc);

    if (kDebugMode &&
        prev != null &&
        prevMono != null &&
        utc.isBefore(prev.add(monoNow - prevMono).subtract(const Duration(minutes: 1)))) {
      debugPrint(
        'ServerClock: server UTC langarni orqaga tuzatdi '
        '(was≈${prev.add(monoNow - prevMono)}, now=$utc)',
      );
    }
  }

  DateTime? nowUtcOrNull() {
    final base = _anchorServerUtc;
    final at = _anchorMono;
    if (base == null || at == null) return null;
    return base.add(_mono.elapsed - at);
  }

  /// Jonli langar > floor (oflayn) > qurilma soati.
  DateTime bestEffortNowUtc() {
    final live = nowUtcOrNull();
    if (live != null) return live;

    final floor = _floorUtc;
    final floorDev = _floorDeviceUtc;
    if (floor != null && floorDev != null) {
      final forward = DateTime.now().toUtc().difference(floorDev);
      if (forward.isNegative) return floor;
      return floor.add(forward);
    }

    return DateTime.now().toUtc();
  }
}

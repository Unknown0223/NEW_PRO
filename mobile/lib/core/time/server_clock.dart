import 'package:flutter/foundation.dart';

/// Serverdan langarlanган, buzib bo‘lmaydigan soat.
///
/// Maqsad: sinхрон oynasi (vaqt bo‘yicha ruxsat) va biznes «bugun» hisoblari
/// qurilma soatiga tayanmasin. Agar foydalanuvchi telefon soatini yoki vaqt
/// mintaqasini o‘zgartirsa ham, tizimni aldab bo‘lmasligi kerak.
///
/// Yondashuv:
/// * Jarayon davomida ishlaydigan **monotonik** `Stopwatch` — qurilma soati
///   o‘zgartirilsa ham orqaga qaytmaydi/sakramaydi.
/// * Har bir server javobida (HTTP `Date` sarlavhasi yoki joylashuv ping
///   javobidagi `recorded_at`) ishonchli UTC vaqt olinadi va monotonik
///   nuqtaga «langarlanadi».
/// * `nowUtc` = langar_server_utc + (monotonik_hozir − langar_monotonik).
/// * Eng oxirgi ishonchli server vaqti **diskka saqlanadi** (`floor`). Ilova
///   qayta ishga tushganda yuklab olinadi va vaqt hech qachon shu floor'dan
///   **orqaga ketmaydi** — qurilma soati orqaga surilsa ham aldab bo‘lmaydi.
class ServerClock {
  ServerClock._();
  static final ServerClock instance = ServerClock._();

  /// Jarayon boshlanishidan beri yuruvchi monotonik soat (qurilma soatidan
  /// mustaqil).
  final Stopwatch _mono = Stopwatch()..start();

  DateTime? _anchorServerUtc;
  Duration? _anchorMono;

  /// Saqlangan «pol» — ko‘rilgan eng katta ishonchli server UTC.
  DateTime? _floorUtc;

  /// `_floorUtc` o‘rnatilgan paytdagi qurilma soati (UTC) — offline holatda
  /// vaqtni oldinga surish uchun mos nuqta.
  DateTime? _floorDeviceUtc;

  /// Oxirgi diskka yozilgan floor (yozuvlar sonini cheklash uchun).
  DateTime? _lastPersistedFloorUtc;

  void Function(DateTime serverUtc, DateTime deviceUtc)? _onPersist;

  /// Shu seansda server bilan kamida bir marta vaqt langarlanganmi.
  bool get hasAnchor => _anchorServerUtc != null && _anchorMono != null;

  /// Restartda saqlangan floor ni yuklash (`main()` da, birinchi so‘rovdan oldin).
  void loadPersisted(DateTime? floorUtc, [DateTime? floorDeviceUtc]) {
    if (floorUtc == null) return;
    final utc = floorUtc.toUtc();
    if (utc.year < 2020 || utc.year > 2100) return;
    _floorUtc = utc;
    _floorDeviceUtc = (floorDeviceUtc ?? DateTime.now()).toUtc();
    _lastPersistedFloorUtc = utc;
  }

  /// Floor diskka yozilishi uchun callback (`main()` da SQLite ga ulanadi).
  void configurePersistence(
    void Function(DateTime serverUtc, DateTime deviceUtc)? onPersist,
  ) {
    _onPersist = onPersist;
  }

  void _bumpFloor(DateTime utc) {
    final cur = _floorUtc;
    if (cur != null && !utc.isAfter(cur)) return;
    _floorUtc = utc;
    _floorDeviceUtc = DateTime.now().toUtc();
    final lastP = _lastPersistedFloorUtc;
    // Diskka yozishni cheklaymiz: floor kamida 60s oldinga siljiganda.
    if (_onPersist != null &&
        (lastP == null || utc.difference(lastP).inSeconds.abs() >= 60)) {
      _lastPersistedFloorUtc = utc;
      try {
        _onPersist!(utc, _floorDeviceUtc!);
      } catch (_) {
        // Saqlash xatosi — soat ishlashiga ta'sir qilmaydi.
      }
    }
  }

  /// Ishonchli server UTC vaqtdan langar o‘rnatadi.
  ///
  /// Faqat oldinga siljishga ruxsat beriladi — eski/orqadagi qiymatlar
  /// langarni «orqaga tortib» yubormaydi (server soati ham sakrashi mumkin,
  /// shu sabab monotonik bilan birga tekshiramiz).
  void anchorFromServerUtc(DateTime? serverUtc) {
    if (serverUtc == null) return;
    final utc = serverUtc.toUtc();
    // Aql bovar qilmas qiymatlardan himoya.
    if (utc.year < 2020 || utc.year > 2100) return;

    final monoNow = _mono.elapsed;

    // Birinchi langar — to‘g‘ridan-to‘g‘ri o‘rnatamiz.
    final base = _anchorServerUtc;
    final at = _anchorMono;
    if (base == null || at == null) {
      _anchorServerUtc = utc;
      _anchorMono = monoNow;
      _bumpFloor(utc);
      return;
    }

    // Joriy hisoblangan ishonchli vaqt.
    final predicted = base.add(monoNow - at);
    // Yangi server qiymati ishonchli vaqtdan oldinga ketgan yoki juda yaqin
    // bo‘lsa — langarni yangilaymiz (drift'ni tuzatish). Orqaga ketsa
    // (oyna ruxsatini «qaytarib olishga» urinish) — e'tiborsiz qoldiramiz.
    if (utc.isAfter(predicted.subtract(const Duration(seconds: 2)))) {
      _anchorServerUtc = utc;
      _anchorMono = monoNow;
    } else if (kDebugMode) {
      debugPrint(
        'ServerClock: orqaga ketgan vaqt e\'tiborsiz qoldirildi '
        '(server=$utc, predicted=$predicted)',
      );
    }
    _bumpFloor(utc);
  }

  /// Ishonchli hozirgi vaqt (UTC), agar seansda hali langarlanmagan bo‘lsa —
  /// `null`. Qat'iy gating (sinxron oynasi) shu metodga tayanadi.
  DateTime? nowUtcOrNull() {
    final base = _anchorServerUtc;
    final at = _anchorMono;
    if (base == null || at == null) return null;
    return base.add(_mono.elapsed - at);
  }

  /// Eng ishonchli hozirgi UTC, ko‘rsatish va biznes «bugun» hisoblari uchun:
  /// jonli langar > saqlangan floor (orqaga ketmaydi) > qurilma soati.
  ///
  /// Qat'iy gating uchun bu emas, `nowUtcOrNull()`/`hasAnchor` ishlatiladi.
  DateTime bestEffortNowUtc() {
    final live = nowUtcOrNull();
    if (live != null) return live;

    final floor = _floorUtc;
    final floorDev = _floorDeviceUtc;
    if (floor != null && floorDev != null) {
      final forward = DateTime.now().toUtc().difference(floorDev);
      // Qurilma soati orqaga surilgan bo‘lsa — floor'da turamiz.
      if (forward.isNegative) return floor;
      return floor.add(forward);
    }

    // Hech qachon server bilan bog‘lanmagan — boshqa ilojimiz yo‘q.
    return DateTime.now().toUtc();
  }
}

import 'package:intl/intl.dart';

import 'server_clock.dart';

/// Ish mintaqasi vaqti — server bilan bir xil (default Asia/Tashkent, UTC+5).
/// Tenant sozlamasidan [applyWorkRegionFromServer] orqali yangilanadi.
const int kDefaultWorkRegionUtcOffsetHours = 5;
const String kDefaultWorkRegionTimezoneId = 'Asia/Tashkent';

int _workRegionUtcOffsetHours = kDefaultWorkRegionUtcOffsetHours;
String _workRegionTimezoneId = kDefaultWorkRegionTimezoneId;

int get kWorkRegionUtcOffsetHours => _workRegionUtcOffsetHours;
String get kWorkRegionTimezoneId => _workRegionTimezoneId;

/// Server `work_timezone` / `work_utc_offset_hours` (agent-config).
void applyWorkRegionFromServer({
  String? timezoneId,
  num? utcOffsetHours,
}) {
  final id = timezoneId?.trim();
  if (id != null && id.isNotEmpty) {
    _workRegionTimezoneId = id;
  }
  if (utcOffsetHours != null && utcOffsetHours.isFinite) {
    final h = utcOffsetHours.round();
    if (h >= -14 && h <= 14) {
      _workRegionUtcOffsetHours = h;
    }
  }
}

/// UTC instant → ish mintaqasi **devor soati** (timezone-siz, local-naive).
///
/// Faqat soat/minut/kun komponentlari olinadi — `isUtc` qolmaydi.
/// Aks holda `DateFormat` / `difference` qurilma TZ da yana +offset qo‘shadi
/// (12:00 Toshkent → 17:00 ko‘rinishi).
DateTime workRegionWallClockFromUtc(DateTime utc) {
  final u = utc.toUtc();
  final shifted = u.add(Duration(hours: _workRegionUtcOffsetHours));
  // Aniq local-naive (isUtc: false).
  return DateTime(
    shifted.year,
    shifted.month,
    shifted.day,
    shifted.hour,
    shifted.minute,
    shifted.second,
    shifted.millisecond,
    shifted.microsecond,
  );
}

/// Hozirgi vaqt ish mintaqasida, local-naive wall-clock.
///
/// Server bilan langarlangan ishonchli vaqt mavjud bo‘lsa — o‘sha ishlatiladi
/// (qurilma soatiga tayanmaydi). Aks holda (hali server bilan bog‘lanmagan)
/// qurilma vaqtiga qaytadi.
DateTime workRegionNow([DateTime? reference]) {
  if (reference != null) {
    return workRegionWallClockFromUtc(reference.toUtc());
  }
  // `bestEffortNowUtc`: jonli langar > saqlangan floor (orqaga ketmaydi) >
  // qurilma soati. Shu sabab telefon soati/mintaqasini o‘zgartirib aldab
  // bo‘lmaydi (kamida oxirgi ko‘rilgan server vaqtidan orqaga ketmaydi).
  return workRegionWallClockFromUtc(ServerClock.instance.bestEffortNowUtc());
}

/// Server-langarlangan hozirgi UTC (saqlangan floor bilan — orqaga ketmaydi).
DateTime serverNowUtc() => ServerClock.instance.bestEffortNowUtc();

/// Server-langarlangan hozirgi UTC, ISO8601 ko‘rinishida (yozuvlar uchun).
String serverNowUtcIso() => serverNowUtc().toIso8601String();

/// Ish mintaqasi bo‘yicha bugungi sana kaliti: `yyyy-MM-dd`.
String serverTodayKey() {
  final wr = workRegionNow();
  final y = wr.year.toString().padLeft(4, '0');
  final m = wr.month.toString().padLeft(2, '0');
  final d = wr.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

/// Ish mintaqasi bo‘yicha bugungi hafta kuni (1=Dushanba … 7=Yakshanba).
int serverTodayWeekday() => workRegionNow().weekday;

/// Server bilan vaqt jonli langarlanganmi (qat'iy gating uchun).
bool isServerTimeReady() => ServerClock.instance.hasAnchor;

/// Sinхрон oynasi soati — ishonchli (serverdan langarlangan) vaqtga tayanadi.
///
/// Agent konfigidagi «08:00–17:30» ish mintaqasi soatiga nisbatan
/// qo‘llaniladi. Qurilma soati o‘zgartirilsa ham sinxron oynasi buzilmaydi:
/// server bilan bog‘langach vaqt server bo‘yicha hisoblanadi.
///
/// [at] berilsa (test/maxsus holatlar) — o‘sha to‘g‘ridan-to‘g‘ri qaytariladi.
DateTime syncWindowClockNow([DateTime? at]) {
  if (at != null) return at;
  return workRegionNow();
}

int syncWindowMinutesOfDay(DateTime dt) => dt.hour * 60 + dt.minute;

DateTime? parseUtcIso(String? iso) {
  final raw = iso?.trim();
  if (raw == null || raw.isEmpty) return null;
  try {
    return DateTime.parse(raw).toUtc();
  } catch (_) {
    return null;
  }
}

/// ISO (UTC) → ish mintaqasi wall-clock (local-naive).
DateTime? toWorkRegionFromIso(String? iso) {
  final utc = parseUtcIso(iso);
  if (utc == null) return null;
  return workRegionWallClockFromUtc(utc);
}

/// Foydalanuvchiga ko‘rsatish: `14.06.2026 07:58`
String formatWorkRegionDateTime(
  String? iso, {
  String pattern = 'dd.MM.yyyy HH:mm',
}) {
  final wr = toWorkRegionFromIso(iso);
  if (wr == null) return '—';
  return DateFormat(pattern).format(wr);
}

/// Sinхрон oynasi HH:mm — ish mintaqasi bo‘yicha daqiqalar.
int workRegionMinutesOfDay([DateTime? reference]) {
  final wr = reference ?? workRegionNow();
  return wr.hour * 60 + wr.minute;
}

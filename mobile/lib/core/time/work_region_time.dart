import 'package:intl/intl.dart';

import 'server_clock.dart';

/// Ish mintaqasi vaqti — server bilan bir xil (Asia/Tashkent, UTC+5).
/// Qurilma vaqti noto‘g‘ri bo‘lsa ham sinхron oynasi va «oxirgi sinхрон» to‘g‘ri ko‘rinadi.
const int kWorkRegionUtcOffsetHours = 5;
const String kWorkRegionTimezoneId = 'Asia/Tashkent';

/// Hozirgi vaqt ish mintaqasida (UTC+5).
///
/// Server bilan langarlangan ishonchli vaqt mavjud bo‘lsa — o‘sha ishlatiladi
/// (qurilma soatiga tayanmaydi). Aks holda (hali server bilan bog‘lanmagan)
/// qurilma vaqtiga qaytadi.
DateTime workRegionNow([DateTime? reference]) {
  if (reference != null) {
    return reference.toUtc().add(const Duration(hours: kWorkRegionUtcOffsetHours));
  }
  // `bestEffortNowUtc`: jonli langar > saqlangan floor (orqaga ketmaydi) >
  // qurilma soati. Shu sabab telefon soati/mintaqasini o‘zgartirib aldab
  // bo‘lmaydi (kamida oxirgi ko‘rilgan server vaqtidan orqaga ketmaydi).
  return ServerClock.instance
      .bestEffortNowUtc()
      .add(const Duration(hours: kWorkRegionUtcOffsetHours));
}

/// Server-langarlangan hozirgi UTC (saqlangan floor bilan — orqaga ketmaydi).
DateTime serverNowUtc() => ServerClock.instance.bestEffortNowUtc();

/// Server-langarlangan hozirgi UTC, ISO8601 ko‘rinishida (yozuvlar uchun).
String serverNowUtcIso() => serverNowUtc().toIso8601String();

/// Ish mintaqasi (UTC+5) bo‘yicha bugungi sana kaliti: `yyyy-MM-dd`.
String serverTodayKey() => workRegionNow().toIso8601String().substring(0, 10);

/// Ish mintaqasi bo‘yicha bugungi hafta kuni (1=Dushanba … 7=Yakshanba).
int serverTodayWeekday() => workRegionNow().weekday;

/// Server bilan vaqt jonli langarlanganmi (qat'iy gating uchun).
bool isServerTimeReady() => ServerClock.instance.hasAnchor;

/// Sinхron oynasi soati — ishonchli (serverdan langarlangan) vaqtga tayanadi.
///
/// Agent konfigidagi «08:00–17:30» ish mintaqasi (UTC+5) soatiga nisbatan
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

/// ISO (UTC) → ish mintaqasi.
DateTime? toWorkRegionFromIso(String? iso) {
  final utc = parseUtcIso(iso);
  if (utc == null) return null;
  return utc.add(const Duration(hours: kWorkRegionUtcOffsetHours));
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

/// Sinхron oynasi HH:mm — ish mintaqasi bo‘yicha daqiqalar.
int workRegionMinutesOfDay([DateTime? reference]) {
  final wr = reference ?? workRegionNow();
  return wr.hour * 60 + wr.minute;
}

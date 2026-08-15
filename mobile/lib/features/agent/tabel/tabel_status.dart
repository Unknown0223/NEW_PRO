import 'package:flutter/material.dart';

/// Web `timesheet-shared.ts` STATUS_META bilan to'liq mos status modeli:
/// 0 / 0.5 / 1 / В / О / Б / К.
///
/// Backend: worked | half_day | absent | holiday | vacation | sick | trip
const List<String> tabelAttendanceStatuses = [
  'absent',
  'half_day',
  'worked',
  'holiday',
  'vacation',
  'sick',
  'trip',
];

class TabelStatusMeta {
  final String backend;
  /// Katakcha qisqa kodi: 0 / 0.5 / 1 / В / О / Б / К
  final String short;
  /// To'liq yorliq (web legendasi bilan bir xil).
  final String label;
  final Color color;
  final Color bg;
  final IconData icon;

  const TabelStatusMeta({
    required this.backend,
    required this.short,
    required this.label,
    required this.color,
    required this.bg,
    required this.icon,
  });
}

// Ranglar — web STATUS_META / TabelERP bilan bir xil.
const Color _workedColor = Color(0xFF0E8C7A);
const Color _workedBg = Color(0xFFE6F5F2);
const Color _halfColor = Color(0xFF0F766E);
const Color _halfBg = Color(0xFFCCFBF1);
const Color _absentColor = Color(0xFF64748B);
const Color _absentBg = Color(0xFFE2E8F0);
const Color _holidayColor = Color(0xFF3B82F6);
const Color _holidayBg = Color(0xFFDBEAFE);
const Color _vacationColor = Color(0xFFA16207);
const Color _vacationBg = Color(0xFFFEF08A);
const Color _sickColor = Color(0xFFEA580C);
const Color _sickBg = Color(0xFFFFEDD5);
const Color _tripColor = Color(0xFF9333EA);
const Color _tripBg = Color(0xFFF3E8FF);

/// Backend status → UI meta (web STATUS_META).
TabelStatusMeta tabelStatusMeta(String backendStatus) {
  switch (backendStatus) {
    case 'worked':
      return const TabelStatusMeta(
        backend: 'worked',
        short: '1',
        label: 'Работал',
        color: _workedColor,
        bg: _workedBg,
        icon: Icons.check_rounded,
      );
    case 'half_day':
      return const TabelStatusMeta(
        backend: 'half_day',
        short: '0.5',
        label: 'Полдня',
        color: _halfColor,
        bg: _halfBg,
        icon: Icons.hourglass_bottom_rounded,
      );
    case 'holiday':
      return const TabelStatusMeta(
        backend: 'holiday',
        short: 'В',
        label: 'Выходной',
        color: _holidayColor,
        bg: _holidayBg,
        icon: Icons.weekend_outlined,
      );
    case 'vacation':
      return const TabelStatusMeta(
        backend: 'vacation',
        short: 'О',
        label: 'Отпуск',
        color: _vacationColor,
        bg: _vacationBg,
        icon: Icons.beach_access_rounded,
      );
    case 'sick':
      return const TabelStatusMeta(
        backend: 'sick',
        short: 'Б',
        label: 'Больничный',
        color: _sickColor,
        bg: _sickBg,
        icon: Icons.healing_rounded,
      );
    case 'trip':
      return const TabelStatusMeta(
        backend: 'trip',
        short: 'К',
        label: 'Командировка',
        color: _tripColor,
        bg: _tripBg,
        icon: Icons.flight_takeoff_rounded,
      );
    case 'absent':
    default:
      return const TabelStatusMeta(
        backend: 'absent',
        short: '0',
        label: 'Отсутствовал',
        color: _absentColor,
        bg: _absentBg,
        icon: Icons.close_rounded,
      );
  }
}

/// Statusning «Итого» ga hissasi (web statusWorkValue).
double tabelStatusWorkValue(String backendStatus) {
  if (backendStatus == 'worked') return 1;
  if (backendStatus == 'half_day') return 0.5;
  return 0;
}

/// Manba yorlig'i — web SOURCE_META.
String tabelSourceLabel(String source) {
  switch (source) {
    case 'manual':
      return 'Ручной ввод';
    case 'gps':
      return 'GPS-визит';
    case 'mobile_login':
      return 'Вход в приложение';
    case 'auto':
    default:
      return 'Автоматически';
  }
}

IconData tabelSourceIcon(String source) {
  switch (source) {
    case 'manual':
      return Icons.edit_note_rounded;
    case 'gps':
      return Icons.location_on_outlined;
    case 'mobile_login':
      return Icons.smartphone_outlined;
    case 'auto':
    default:
      return Icons.smart_toy_outlined;
  }
}

String tabelFmtTotal(double t) {
  if (t % 1 == 0) return t.toInt().toString();
  return t.toStringAsFixed(1);
}

/// Bugungacha bo'lgan kunlar bo'yicha status hisoblari (kelajak = nuqta, hisobga kirmaydi).
class TabelDayCounts {
  final double workedTotal;
  final int worked;
  final int halfDay;
  final int absent;
  final int holiday;
  final int vacation;
  final int sick;
  final int trip;

  const TabelDayCounts({
    required this.workedTotal,
    required this.worked,
    required this.halfDay,
    required this.absent,
    required this.holiday,
    required this.vacation,
    required this.sick,
    required this.trip,
  });

  int countFor(String backendStatus) {
    switch (backendStatus) {
      case 'worked':
        return worked;
      case 'half_day':
        return halfDay;
      case 'absent':
        return absent;
      case 'holiday':
        return holiday;
      case 'vacation':
        return vacation;
      case 'sick':
        return sick;
      case 'trip':
        return trip;
      default:
        return 0;
    }
  }
}

TabelDayCounts tabelCountUpToToday(
  Iterable<({String date, String status})> days,
  String today,
) {
  var workedTotal = 0.0;
  var worked = 0;
  var halfDay = 0;
  var absent = 0;
  var holiday = 0;
  var vacation = 0;
  var sick = 0;
  var trip = 0;

  for (final d in days) {
    if (d.date.compareTo(today) > 0) continue;
    workedTotal += tabelStatusWorkValue(d.status);
    switch (d.status) {
      case 'worked':
        worked += 1;
      case 'half_day':
        halfDay += 1;
      case 'absent':
        absent += 1;
      case 'holiday':
        holiday += 1;
      case 'vacation':
        vacation += 1;
      case 'sick':
        sick += 1;
      case 'trip':
        trip += 1;
    }
  }

  return TabelDayCounts(
    workedTotal: workedTotal,
    worked: worked,
    halfDay: halfDay,
    absent: absent,
    holiday: holiday,
    vacation: vacation,
    sick: sick,
    trip: trip,
  );
}

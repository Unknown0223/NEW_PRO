// Табель uchun formatlash yordamchilari (oy nomi, sana, summa, soat).

const List<String> _ruMonthsNominative = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const List<String> _ruMonthsShortGenitive = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

/// Короткие дни недели (Пн..Вс).
const List<String> tabelWeekdayShort = [
  'Пн',
  'Вт',
  'Ср',
  'Чт',
  'Пт',
  'Сб',
  'Вс',
];

/// `YYYY-MM` → «Июнь 2026».
String tabelMonthTitle(String month) {
  final parts = month.split('-');
  if (parts.length != 2) return month;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (y == null || m == null || m < 1 || m > 12) return month;
  return '${_ruMonthsNominative[m - 1]} $y';
}

/// `YYYY-MM-DD` → «26 июн».
String tabelDayShort(String date) {
  final parts = date.split('-');
  if (parts.length != 3) return date;
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (m == null || d == null || m < 1 || m > 12) return date;
  return '$d ${_ruMonthsShortGenitive[m - 1]}';
}

/// `YYYY-MM` → oldingi oy.
String tabelPrevMonth(String month) => _shiftMonth(month, -1);

/// `YYYY-MM` → keyingi oy.
String tabelNextMonth(String month) => _shiftMonth(month, 1);

String _shiftMonth(String month, int delta) {
  final parts = month.split('-');
  if (parts.length != 2) return month;
  final py = int.tryParse(parts[0]);
  final pm = int.tryParse(parts[1]);
  if (py == null || pm == null) return month;
  var y = py;
  var m = pm + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}';
}

/// Katta summani ixcham ko'rsatish: 3480000 → «3.48M», 78400000 → «78.4M».
String tabelCompactSum(double v) {
  if (v == 0) return '0';
  final abs = v.abs();
  final sign = v < 0 ? '-' : '';
  if (abs >= 1000000000) {
    return '$sign${_trim(abs / 1000000000)}B';
  }
  if (abs >= 1000000) {
    return '$sign${_trim(abs / 1000000)}M';
  }
  if (abs >= 1000) {
    return '$sign${_trim(abs / 1000)}K';
  }
  return '$sign${abs.round()}';
}

String _trim(double v) {
  final s = v.toStringAsFixed(2);
  return s.replaceAll(RegExp(r'\.?0+$'), '');
}

/// Minutlar → «8ч 42м» yoki «—» (0 bo'lsa).
String tabelHours(int minutes) {
  if (minutes <= 0) return '—';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$mм';
  if (m == 0) return '$hч';
  return '$hч ${m.toString().padLeft(2, '0')}м';
}

/// Umumiy soat (ойлик) — «184ч».
String tabelHoursTotal(int minutes) {
  if (minutes <= 0) return '0ч';
  final h = (minutes / 60).round();
  return '$hч';
}

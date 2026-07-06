import '../time/work_region_time.dart';

/// Konsignatsiya to'lov muddati — veb `currentMonthEndIsoDate` va mobil konfig qoidalari.
String currentMonthEndIsoDate([DateTime? from]) {
  final now = from ?? workRegionNow();
  final eom = DateTime(now.year, now.month + 1, 0);
  return _isoDate(eom);
}

String firstDayNextMonthIsoDate([DateTime? from]) {
  final now = from ?? workRegionNow();
  return _isoDate(DateTime(now.year, now.month + 1, 1));
}

String addDaysIsoDate(int days, [DateTime? from]) {
  final base = from ?? workRegionNow();
  return _isoDate(base.add(Duration(days: days)));
}

String _isoDate(DateTime d) {
  final y = d.year;
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

/// `mobile_config.orders.consignment_payment_due_rule` bo'yicha boshlang'ich muddat.
String defaultConsignmentDueDate(String? rule) {
  final raw = rule?.trim() ?? '';
  if (raw.isEmpty) return currentMonthEndIsoDate();

  switch (raw) {
    case 'last_day_of_this_month':
      return currentMonthEndIsoDate();
    case 'first_day_next_month':
    case 'specific_day_next_month':
      return firstDayNextMonthIsoDate();
    case 'days_from_order_date':
      return addDaysIsoDate(30);
    default:
      final legacyDays = int.tryParse(raw);
      if (legacyDays != null && legacyDays > 0) {
        return addDaysIsoDate(legacyDays);
      }
      return currentMonthEndIsoDate();
  }
}

String formatConsignmentDueDateRu(String iso) {
  final parts = iso.trim().split('-');
  if (parts.length != 3) return iso;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return iso;
  return '${d.toString().padLeft(2, '0')}.${m.toString().padLeft(2, '0')}.$y';
}

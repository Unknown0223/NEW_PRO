String supervisorShiftMonth(String month, int delta) {
  final parts = month.split('-');
  var y = int.parse(parts[0]);
  var m = int.parse(parts[1]) + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  final mm = m.toString().padLeft(2, '0');
  return '$y-$mm';
}

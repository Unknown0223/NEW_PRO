/// Web `sync.post_order_delay_minutes` → held-order (ожидание) taymeri.
/// 0 = darhol yuborish; 1…59 = kutish daqiqalari.
int clampPostOrderDelayMinutes(int raw) {
  if (raw <= 0) return 0;
  return raw > 59 ? 59 : raw;
}

/// Zakaz yaratilganda avto-yuborish vaqti.
DateTime computeHeldSubmitAt({
  required DateTime createdAt,
  required int delayMinutes,
}) {
  final d = clampPostOrderDelayMinutes(delayMinutes);
  return createdAt.add(Duration(minutes: d));
}

/// Ilovada syncni yana [delayMinutes] ga kechiktirish (web sozlamasi).
/// [from] odatda `DateTime.now()` yoki joriy `submitAt` (qaysi kechroq bo‘lsa).
DateTime postponeHeldSubmitAt({
  required DateTime from,
  required int delayMinutes,
}) {
  final d = clampPostOrderDelayMinutes(delayMinutes);
  if (d <= 0) {
    // Sozlama «Сразу» bo‘lsa ham agent 1 daqiqa olishi mumkin.
    return from.add(const Duration(minutes: 1));
  }
  return from.add(Duration(minutes: d));
}

/// Qayta tahrirlashdan keyin oyna qayta ochiladi (createdAt=now, submitAt=now+delay).
({DateTime createdAt, DateTime submitAt}) refreshHeldEditWindow({
  required DateTime now,
  required int delayMinutes,
}) {
  final createdAt = now;
  return (
    createdAt: createdAt,
    submitAt: computeHeldSubmitAt(createdAt: createdAt, delayMinutes: delayMinutes),
  );
}

import 'mobile_config.dart';

class MobileOrderGuardResult {
  final bool allowed;
  final String? message;

  const MobileOrderGuardResult({required this.allowed, this.message});

  static const ok = MobileOrderGuardResult(allowed: true);
}

MobileOrderGuardResult checkShipmentDateRequired(MiscConfig misc, String? shipmentDate) {
  if (!misc.requireShipmentDate) return MobileOrderGuardResult.ok;
  final raw = shipmentDate?.trim() ?? '';
  if (raw.isEmpty) {
    return const MobileOrderGuardResult(
      allowed: false,
      message: 'Укажите дату отгрузки',
    );
  }
  return MobileOrderGuardResult.ok;
}

MobileOrderGuardResult checkStockSnapshotRequired(MiscConfig misc, {required bool hasSnapshotToday}) {
  if (!misc.requireStockSnapshotForOrder) return MobileOrderGuardResult.ok;
  if (!hasSnapshotToday) {
    return const MobileOrderGuardResult(
      allowed: false,
      message: 'Сначала откройте «Остатки на складе» (снимок остатков)',
    );
  }
  return MobileOrderGuardResult.ok;
}

bool isStockSnapshotFresh(String? snapshotDayIso) {
  if (snapshotDayIso == null || snapshotDayIso.isEmpty) return false;
  final now = DateTime.now();
  final today = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  return snapshotDayIso == today;
}

bool supervisionChecklistEnabled(SupervisionConfig? supervision) {
  if (supervision == null) return false;
  return supervision.checkReceiptFaces ||
      supervision.checkMerchandising ||
      supervision.checkDefaultPrice ||
      supervision.checkStock ||
      supervision.checkSales ||
      supervision.checkMotivation;
}

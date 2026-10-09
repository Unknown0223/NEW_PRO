import '../../../core/config/mobile_config.dart';

/// Superayzer mobil siyosati — veb «Конфигурации» / `mobile_config` bilan bog‘langan.
class SupervisorConfigPolicy {
  final MobileConfig? config;

  const SupervisorConfigPolicy(this.config);

  SupervisionConfig? get supervision => config?.supervision;
  MiscConfig? get misc => config?.misc;
  ClientConfig? get client => config?.client;
  GpsConfig? get gps => config?.gps;
  SyncConfig? get sync => config?.sync;

  bool get canCreateClient => client?.canCreate == true;
  bool get canEditClient => client?.canEdit == true;
  bool get canChangeClientLocation => client?.canChangeClientLocation == true;
  bool get showClientBalance => client?.showBalance ?? true;
  bool get showClientPhotos => client?.showPhotos ?? true;
  bool get visitStartEndEnabled => misc?.visitStartEndEnabled ?? true;
  bool get gpsTrackingEnabled => gps?.trackingEnabled ?? true;
  int get gpsIntervalSec => gps?.trackingIntervalSec ?? 300;
  bool get syncBlocked => sync?.blockSync == true;

  bool get hasAnyChecklist =>
      supervision?.checkReceiptFaces == true ||
      supervision?.checkMerchandising == true ||
      supervision?.checkDefaultPrice == true ||
      supervision?.checkMotivation == true ||
      supervision?.checkStock == true ||
      supervision?.checkSales == true;

  List<String> enabledChecklistLabels() {
    final s = supervision;
    if (s == null) return [];
    final out = <String>[];
    if (s.checkReceiptFaces) out.add('Чеки');
    if (s.checkMerchandising) out.add('Мерчандайзинг');
    if (s.checkDefaultPrice) out.add('Цена');
    if (s.checkMotivation) out.add('Мотивация');
    if (s.checkStock) out.add('Склад');
    if (s.checkSales) out.add('Продажи');
    return out;
  }
}

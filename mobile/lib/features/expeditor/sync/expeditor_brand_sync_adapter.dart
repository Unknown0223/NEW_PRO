import '../../agent/sync/manual_sync_provider.dart';
import 'expeditor_sync_provider.dart';

/// Ekspeditor sync holatini BrandSyncView (ManualSyncState) ga moslashtirish.
ManualSyncStatus manualSyncStatusFromExpeditor(ExpeditorSyncStatus status) {
  switch (status) {
    case ExpeditorSyncStatus.idle:
      return ManualSyncStatus.idle;
    case ExpeditorSyncStatus.running:
      return ManualSyncStatus.running;
    case ExpeditorSyncStatus.success:
      return ManualSyncStatus.success;
    case ExpeditorSyncStatus.error:
      return ManualSyncStatus.error;
  }
}

/// Bosqich → progress (BrandSync vizual qadam uchun).
double expeditorBrandSyncProgress({
  required ExpeditorSyncStatus status,
  required int phaseIndex,
  int phaseCount = 7,
}) {
  if (status == ExpeditorSyncStatus.success) return 1;
  if (status == ExpeditorSyncStatus.idle) return 0;
  if (phaseCount <= 0) return 0.06;
  const prep = 0.08;
  final active = phaseIndex.clamp(0, phaseCount - 1);
  return (prep + (1.0 - prep) * ((active + 0.35) / phaseCount))
      .clamp(0.0, 0.99);
}

ManualSyncState manualSyncStateFromExpeditor(ExpeditorSyncState s) {
  return ManualSyncState(
    status: manualSyncStatusFromExpeditor(s.status),
    phaseIndex: s.phaseIndex,
    full: s.full,
    progress: expeditorBrandSyncProgress(
      status: s.status,
      phaseIndex: s.phaseIndex,
    ),
    result: s.result,
    errorInfo: s.errorInfo,
  );
}

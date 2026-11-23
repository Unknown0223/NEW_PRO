import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/sync/manual_sync_provider.dart';
import 'package:salesdoc_mobile/features/expeditor/sync/expeditor_brand_sync_adapter.dart';
import 'package:salesdoc_mobile/features/expeditor/sync/expeditor_sync_provider.dart';

void main() {
  test('maps expeditor status to ManualSyncStatus', () {
    expect(
      manualSyncStatusFromExpeditor(ExpeditorSyncStatus.running),
      ManualSyncStatus.running,
    );
    expect(
      manualSyncStatusFromExpeditor(ExpeditorSyncStatus.success),
      ManualSyncStatus.success,
    );
  });

  test('progress is 1 on success and below 1 while running', () {
    expect(
      expeditorBrandSyncProgress(
        status: ExpeditorSyncStatus.success,
        phaseIndex: 3,
      ),
      1,
    );
    final mid = expeditorBrandSyncProgress(
      status: ExpeditorSyncStatus.running,
      phaseIndex: 2,
    );
    expect(mid, greaterThan(0.08));
    expect(mid, lessThan(1));
  });

  test('adapter fills ManualSyncState for BrandSyncView', () {
    final state = manualSyncStateFromExpeditor(
      const ExpeditorSyncState(
        status: ExpeditorSyncStatus.running,
        phaseIndex: 1,
        full: true,
      ),
    );
    expect(state.full, isTrue);
    expect(state.status, ManualSyncStatus.running);
    expect(state.progress, greaterThan(0));
    expect(state.progress, lessThan(1));
  });
}

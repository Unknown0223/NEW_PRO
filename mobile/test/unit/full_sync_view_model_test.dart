import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/sync/full_sync_view.dart';

void main() {
  group('fullSyncViewModelFromBootstrap', () {
    test('prep steps do not advance sync checklist', () {
      final m0 = fullSyncViewModelFromBootstrap(isSuccess: false, stepIndex: 0);
      final m1 = fullSyncViewModelFromBootstrap(isSuccess: false, stepIndex: 1);
      final m2 = fullSyncViewModelFromBootstrap(isSuccess: false, stepIndex: 2);

      expect(m0.items.first.status, FullSyncItemStatus.loading);
      expect(m0.items[1].status, FullSyncItemStatus.pending);
      expect(m1.progress, greaterThanOrEqualTo(m0.progress));
      expect(m2.progress, greaterThanOrEqualTo(m1.progress));
    });

    test('sync phases advance monotonically', () {
      double prev = 0;
      int prevDone = -1;
      for (var phase = 0; phase < 6; phase++) {
        final m = fullSyncViewModelFromBootstrap(
          isSuccess: false,
          stepIndex: 3,
          syncPhaseIndex: phase,
        );
        expect(m.progress, greaterThanOrEqualTo(prev));
        final doneCount = m.items.where((i) => i.status == FullSyncItemStatus.done).length;
        expect(doneCount, greaterThanOrEqualTo(prevDone));
        prev = m.progress;
        prevDone = doneCount;
      }
    });

    test('expeditor sync phases advance', () {
      final m = fullSyncViewModelFromBootstrap(
        isSuccess: false,
        stepIndex: 3,
        syncPhaseIndex: 1,
        role: 'expeditor',
      );
      expect(m.title, 'Полная синхронизация');
      expect(m.items.length, 7);
      expect(m.items[1].status, FullSyncItemStatus.loading);
    });

    test('success shows 100%', () {
      final m = fullSyncViewModelFromBootstrap(isSuccess: true, stepIndex: 5, role: 'agent');
      expect(m.progress, 1.0);
      expect(m.isSuccess, isTrue);
      expect(m.items.every((i) => i.status == FullSyncItemStatus.done), isTrue);
    });
  });
}

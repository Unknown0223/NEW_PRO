import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/sync/sync_engine.dart';

void main() {
  group('SyncEngine.isFullCatalogSync', () {
    test('null or empty means full catalog replace', () {
      expect(SyncEngine.isFullCatalogSync(null), isTrue);
      expect(SyncEngine.isFullCatalogSync(''), isTrue);
    });

    test('timestamp means incremental merge', () {
      expect(SyncEngine.isFullCatalogSync('2026-06-07T12:00:00.000Z'), isFalse);
    });
  });
}

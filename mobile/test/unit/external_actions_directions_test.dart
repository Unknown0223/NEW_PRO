import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/utils/external_actions.dart';

void main() {
  group('buildClientDirectionsUris', () {
    test('includes yandex rtext and google dir with from', () {
      final uris = buildClientDirectionsUris(
        toLat: 41.3,
        toLng: 69.2,
        fromLat: 41.31,
        fromLng: 69.25,
      );
      final s = uris.map((u) => u.toString()).join('\n');
      expect(s, contains('yandexmaps://'));
      expect(s, contains('rtext=41.31,69.25~41.3,69.2'));
      expect(s, contains('google.navigation:q=41.3,69.2'));
      expect(s, contains('google.com/maps/dir'));
      expect(s, contains('origin=41.31,69.25'));
      expect(s, contains('destination=41.3,69.2'));
    });

    test('without from still builds destination-only routes', () {
      final uris = buildClientDirectionsUris(toLat: 41.3, toLng: 69.2);
      final s = uris.map((u) => u.toString()).join('\n');
      expect(s, contains('rtext=~41.3,69.2'));
      expect(s, isNot(contains('origin=')));
      expect(s, contains('destination=41.3,69.2'));
    });
  });

  group('hasValidLatLng', () {
    test('rejects zero / null', () {
      expect(hasValidLatLng(null, null), isFalse);
      expect(hasValidLatLng(0, 0), isFalse);
      expect(hasValidLatLng(41.3, 69.2), isTrue);
    });
  });
}

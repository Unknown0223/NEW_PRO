import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/ui/client_photo_thumb.dart';
import 'package:salesdoc_mobile/features/agent/route/agent_route_provider.dart';

void main() {
  test('unionRouteStopsWithPlanned adds planned clients missing from the saved route', () {
    final union = unionRouteStopsWithPlanned(
      routeStops: [
        {'client_id': 1, 'client_name': 'Old', 'latitude': 1.0, 'longitude': 2.0},
      ],
      plannedStops: [
        {'client_id': 1, 'client_name': 'Old', 'latitude': 1.0, 'longitude': 2.0},
        {'client_id': 9, 'client_name': 'New', 'latitude': 3.0, 'longitude': 4.0},
      ],
    );
    expect(union.map((s) => s['client_id']).toList(), [1, 9]);
  });

  test('firstClientPhotoUrl reads photo_url', () {
    expect(firstClientPhotoUrl({'photo_url': 'https://cdn/p.jpg'}), 'https://cdn/p.jpg');
    expect(firstClientPhotoUrl({'name': 'A'}), isNull);
  });

  test('isLocalClientPhotoPath distinguishes files from urls', () {
    expect(isLocalClientPhotoPath('/data/user/0/app/cache/p.jpg'), isTrue);
    expect(isLocalClientPhotoPath('https://cdn.example/p.jpg'), isFalse);
    expect(isLocalClientPhotoPath('data:image/jpeg;base64,xx'), isFalse);
  });
}

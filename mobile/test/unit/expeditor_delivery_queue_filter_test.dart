import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/queue/expeditor_delivery_queue_filter.dart';

void main() {
  final rows = [
    {'id': 1, 'status': 'delivering'},
    {'id': 2, 'status': 'delivered'},
    {'id': 3, 'status': 'returned'},
    {'id': 4, 'status': 'shipping'},
    {'id': 5, 'status': 'picking'},
    {'id': 6, 'status': 'confirmed'},
  ];

  test('filterQueueRows all returns same length', () {
    expect(filterQueueRows(rows, 'all'), hasLength(6));
  });

  test('filterQueueRows pending', () {
    final out = filterQueueRows(rows, 'pending');
    expect(out.map((e) => e['id']), [1, 4, 5, 6]);
  });

  test('filterQueueRows delivered', () {
    expect(filterQueueRows(rows, 'delivered').single['id'], 2);
  });

  test('filterQueueRows return', () {
    expect(filterQueueRows(rows, 'return').single['id'], 3);
  });
}

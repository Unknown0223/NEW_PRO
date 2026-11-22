import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/api/mobile_api.dart';
import 'package:salesdoc_mobile/features/agent/clients/client_photo_report_flow.dart';

void main() {
  group('clientPhotoReportFromPendingRow', () {
    test('maps sqlite row to negative-id ClientPhotoReport with local path', () {
      final row = clientPhotoReportFromPendingRow({
        'id': 17,
        'client_id': 5,
        'image_path': r'C:\app\pending_photos\1.jpg',
        'caption': 'Буш полка',
        'order_id': null,
        'created_at': '2026-11-22T10:00:00.000',
      });
      expect(row, isNotNull);
      expect(row!.id, -17);
      expect(row.imageUrl, r'C:\app\pending_photos\1.jpg');
      expect(row.caption, 'Буш полка');
      expect(row.orderId, isNull);
      expect(row.createdAt, '2026-11-22T10:00:00.000');
    });

    test('rejects missing id or empty path', () {
      expect(
        clientPhotoReportFromPendingRow({'id': 1, 'image_path': ''}),
        isNull,
      );
      expect(
        clientPhotoReportFromPendingRow({'image_path': '/tmp/a.jpg'}),
        isNull,
      );
    });
  });

  group('pendingPhotoReportsForClient', () {
    test('filters by client and maps usable rows', () {
      final mapped = pendingPhotoReportsForClient(
        [
          {
            'id': 1,
            'client_id': 9,
            'image_path': '/p/a.jpg',
            'caption': 'A',
            'created_at': '2026-11-22T09:00:00.000',
          },
          {
            'id': 2,
            'client_id': 3,
            'image_path': '/p/b.jpg',
            'caption': 'B',
            'created_at': '2026-11-22T09:01:00.000',
          },
          {
            'id': 3,
            'client_id': 9,
            'image_path': '',
            'caption': 'bad',
            'created_at': '2026-11-22T09:02:00.000',
          },
        ],
        clientId: 9,
      );
      expect(mapped.map((p) => p.id).toList(), [-1]);
      expect(mapped.single.caption, 'A');
    });
  });

  group('mergeServerAndPendingPhotoReports', () {
    test('keeps server and pending side by side without id clash', () {
      final apiLike = [
        const ClientPhotoReport(
          id: 55,
          imageUrl: 'https://cdn/x.jpg',
          createdAt: '2026-11-22T08:00:00.000',
        ),
      ];
      final pending = [
        clientPhotoReportFromPendingRow({
          'id': 4,
          'image_path': '/local/q.jpg',
          'created_at': '2026-11-22T11:00:00.000',
          'caption': 'queued',
        })!,
      ];
      final merged = mergeServerAndPendingPhotoReports(
        server: apiLike,
        pending: pending,
      );
      expect(merged.map((p) => p.id).toSet(), {-4, 55});
      // Pending (newer created_at) first.
      expect(merged.first.id, -4);
    });
  });

  group('isPendingLocalPhotoReport', () {
    test('negative id marks local queue entry', () {
      expect(isPendingLocalPhotoReport(-3), isTrue);
      expect(isPendingLocalPhotoReport(3), isFalse);
      expect(pendingPhotoQueueId(-3), 3);
    });
  });
}

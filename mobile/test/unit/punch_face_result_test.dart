import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/punch_face_result.dart';

void main() {
  test('FACE_MISMATCH layer passed → matched', () {
    final r = parsePunchFaceResult({
      'data': {
        'anti_fraud': {
          'ok': true,
          'layers': [
            {'code': 'FACE_MISMATCH', 'passed': true, 'detail': 'Face ID mosligi: 87.2%'},
          ],
        },
      },
    });
    expect(r.matched, isTrue);
    expect(r.scorePercent, closeTo(87.2, 0.01));
    expect(r.titleRu, contains('совпало'));
  });

  test('FACE_MISMATCH failed → not matched', () {
    final r = parsePunchFaceResult({
      'anti_fraud': {
        'ok': false,
        'failedCode': 'FACE_MISMATCH',
        'failedMessage': 'Yuz mos kelmadi (32.0% < 45%)',
        'layers': [
          {
            'code': 'FACE_MISMATCH',
            'passed': false,
            'detail': 'Yuz mos kelmadi (32.0% < 45%)',
          },
        ],
      },
    });
    expect(r.matched, isFalse);
    expect(r.scorePercent, closeTo(32.0, 0.01));
    expect(r.detailRu, contains('табель'));
  });

  test('isFaceMismatchError', () {
    expect(isFaceMismatchError(Exception('FACE_MISMATCH: Yuz mos kelmadi')), isTrue);
    expect(isFaceMismatchError(Exception('GPS timeout')), isFalse);
  });
}

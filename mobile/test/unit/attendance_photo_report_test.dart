import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:salesdoc_mobile/features/attendance/photo_report.dart';

Uint8List _solidJpeg({required int w, required int h, required int r, required int g, required int b}) {
  final im = img.Image(width: w, height: h);
  img.fill(im, color: img.ColorRgb8(r, g, b));
  return Uint8List.fromList(img.encodeJpg(im, quality: 90));
}

void main() {
  test('composePhotoReport builds collage with stamp', () async {
    final back = _solidJpeg(w: 800, h: 600, r: 20, g: 80, b: 160);
    final face = _solidJpeg(w: 200, h: 200, r: 220, g: 180, b: 140);
    final out = await composePhotoReport(
      backBytes: back,
      selfieBytes: face,
      stamp: 'Test stamp\n2026-11-07',
    );
    expect(out.length, greaterThan(1000));
    final decoded = img.decodeImage(out);
    expect(decoded, isNotNull);
    expect(decoded!.width, lessThanOrEqualTo(1600));
  });

  test('faceMatchSelfie shrinks to ~720 edge', () async {
    final big = _solidJpeg(w: 1600, h: 1200, r: 10, g: 10, b: 10);
    final out = await faceMatchSelfie(big);
    final decoded = img.decodeImage(out)!;
    expect(decoded.width <= 720 || decoded.height <= 720, isTrue);
  });
}

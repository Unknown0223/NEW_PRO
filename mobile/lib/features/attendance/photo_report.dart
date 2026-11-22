import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

const _maxEdge = 1600;

/// Orqa rasm asos, old selfie inset + pastki stamp (HR Hub photo_report).
Future<Uint8List> composePhotoReport({
  required Uint8List backBytes,
  required Uint8List selfieBytes,
  required String stamp,
}) {
  return compute(_compose, _ComposeArgs(backBytes, selfieBytes, stamp));
}

Future<Uint8List> composePhotoReportFromBase64({
  required String backBase64,
  required String selfieBase64,
  required String stamp,
}) {
  return composePhotoReport(
    backBytes: base64Decode(backBase64),
    selfieBytes: base64Decode(selfieBase64),
    stamp: stamp,
  );
}

Future<Uint8List> stampedFacePhoto({
  required Uint8List bytes,
  required String stamp,
}) {
  return compute(_stampOnly, _ComposeArgs(bytes, bytes, stamp));
}

Future<Uint8List> faceMatchSelfie(Uint8List selfieBytes) {
  return compute(_shrinkSelfie, selfieBytes);
}

class _ComposeArgs {
  const _ComposeArgs(this.back, this.selfie, this.stamp);
  final Uint8List back;
  final Uint8List selfie;
  final String stamp;
}

Uint8List _stampOnly(_ComposeArgs a) {
  final raw = img.decodeImage(a.back);
  if (raw == null) throw StateError('Не удалось прочитать фото');
  var base = img.bakeOrientation(raw);
  final longest = base.width > base.height ? base.width : base.height;
  if (longest > _maxEdge) {
    base = base.width >= base.height
        ? img.copyResize(base, width: _maxEdge)
        : img.copyResize(base, height: _maxEdge);
  }
  _drawStamp(base, a.stamp);
  return Uint8List.fromList(img.encodeJpg(base, quality: 85));
}

Uint8List _shrinkSelfie(Uint8List bytes) {
  final raw = img.decodeImage(bytes);
  if (raw == null) throw StateError('Не удалось прочитать фото');
  var face = img.bakeOrientation(raw);
  const edge = 720;
  if (face.width > edge || face.height > edge) {
    face = face.width >= face.height
        ? img.copyResize(face, width: edge)
        : img.copyResize(face, height: edge);
  }
  return Uint8List.fromList(img.encodeJpg(face, quality: 85));
}

Uint8List _compose(_ComposeArgs a) {
  final backRaw = img.decodeImage(a.back);
  final selfieRaw = img.decodeImage(a.selfie);
  if (backRaw == null || selfieRaw == null) {
    throw StateError('Не удалось прочитать фото');
  }
  var base = img.bakeOrientation(backRaw);
  final longest = base.width > base.height ? base.width : base.height;
  if (longest > _maxEdge) {
    base = base.width >= base.height
        ? img.copyResize(base, width: _maxEdge)
        : img.copyResize(base, height: _maxEdge);
  }

  final selfie = img.bakeOrientation(selfieRaw);
  final insetW = (base.width * 0.32).round();
  final inset = img.copyResize(selfie, width: insetW);
  final margin = (base.width * 0.03).round().clamp(12, 40);
  const border = 6;
  img.fillRect(
    base,
    x1: margin - border,
    y1: margin - border,
    x2: margin + inset.width + border,
    y2: margin + inset.height + border,
    color: img.ColorRgb8(255, 255, 255),
    radius: 10,
  );
  img.compositeImage(base, inset, dstX: margin, dstY: margin);
  _drawStamp(base, a.stamp);
  return Uint8List.fromList(img.encodeJpg(base, quality: 85));
}

void _drawStamp(img.Image base, String stamp) {
  final lines = stamp.split('\n');
  final font = base.width >= 1000 ? img.arial48 : img.arial24;
  final lineH = font.lineHeight + 6;
  final barH = lines.length * lineH + 16;
  img.fillRect(
    base,
    x1: 0,
    y1: base.height - barH,
    x2: base.width,
    y2: base.height,
    color: img.ColorRgba8(0, 0, 0, 150),
  );
  for (var i = 0; i < lines.length; i++) {
    img.drawString(
      base,
      lines[i],
      font: font,
      x: 18,
      y: base.height - barH + 8 + i * lineH,
      color: img.ColorRgb8(255, 255, 255),
    );
  }
}

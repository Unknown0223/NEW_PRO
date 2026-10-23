import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../config/mobile_config.dart';

/// Server bilan bir xil — 25 MiB gacha (siqilgan fayl ham shu limitda).
const clientPhotoMaxFileBytes = 25 * 1024 * 1024;

/// Base64 uzunligi (~33% kattaroq).
const clientPhotoMaxBase64Len = (clientPhotoMaxFileBytes * 4 + 2) ~/ 3;

/// Fotootchyot: polka/vitrina uchun yetarli, trafik/DB ni yemaydi.
const clientPhotoReportMaxSide = 1600;
const clientPhotoReportMaxQuality = 75;

class PhotoResult {
  final String filePath;
  final int sizeBytes;
  const PhotoResult({required this.filePath, required this.sizeBytes});
}

class PhotoService {
  PhotoService();

  Future<PhotoResult?> takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
    );
    if (picked == null) return null;
    final file = File(picked.path);
    final bytes = await file.length();
    return PhotoResult(filePath: picked.path, sizeBytes: bytes);
  }

  /// Mijoz / foto hisobot — kamera asl rezolyutsiyada (siqish encode bosqichida).
  Future<PhotoResult?> takeClientPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (picked == null) return null;
    final file = File(picked.path);
    final bytes = await file.length();
    return PhotoResult(filePath: picked.path, sizeBytes: bytes);
  }
}

final photoServiceProvider = Provider<PhotoService>((ref) => PhotoService());

String _b64FromBytes(List<int> bytes) => base64Encode(bytes);

/// Taxminiy base64 uzunligi — UI threadda to‘liq encode qilmaslik.
bool _fitsPhotoUploadBytes(int byteLen) {
  if (byteLen > clientPhotoMaxFileBytes) return false;
  final approxB64 = ((byteLen + 2) ~/ 3) * 4;
  return approxB64 <= clientPhotoMaxBase64Len;
}

int _encodeQuality(PhotoConfig cfg) {
  final q = cfg.jpegQuality > 0 ? cfg.jpegQuality : clientPhotoReportMaxQuality;
  return q.clamp(1, clientPhotoReportMaxQuality);
}

int _encodeMaxSide(PhotoConfig cfg) {
  final w = cfg.maxWidthPx > 0 ? cfg.maxWidthPx : clientPhotoReportMaxSide;
  final h = cfg.maxHeightPx > 0 ? cfg.maxHeightPx : clientPhotoReportMaxSide;
  return math.min(math.max(w, h), clientPhotoReportMaxSide).clamp(64, clientPhotoReportMaxSide);
}

Future<List<int>?> _compressJpeg(
  String filePath, {
  required int minSide,
  required int quality,
  bool keepExif = true,
}) async {
  final out = await FlutterImageCompress.compressWithFile(
    filePath,
    minWidth: minSide,
    minHeight: minSide,
    quality: quality,
    format: CompressFormat.jpeg,
    keepExif: keepExif,
  );
  if (out == null || out.isEmpty) return null;
  return out;
}

Future<List<int>?> _readRawFile(String filePath) async {
  final file = File(filePath);
  if (!await file.exists()) return null;
  return file.readAsBytes();
}

Future<String> _encodeB64Isolate(List<int> bytes) =>
    compute(_b64FromBytes, bytes);

/// Kamera faylini serverga — doim 1600 px / JPEG ≤75 gacha siqiladi (xom 3–8 MB yuborilmaydi).
Future<String?> encodeClientPhotoBase64(String filePath, {PhotoConfig? config}) async {
  final cfg = config ?? const PhotoConfig();
  final targetQuality = _encodeQuality(cfg);
  final targetSide = _encodeMaxSide(cfg);

  var compressed = await _compressJpeg(filePath, minSide: targetSide, quality: targetQuality);
  if (compressed != null && _fitsPhotoUploadBytes(compressed.length)) {
    return _encodeB64Isolate(compressed);
  }

  for (var side = targetSide; side >= 640; side -= 320) {
    for (var quality = targetQuality; quality >= 55; quality -= 10) {
      compressed = await _compressJpeg(filePath, minSide: side, quality: quality);
      if (compressed != null && _fitsPhotoUploadBytes(compressed.length)) {
        return _encodeB64Isolate(compressed);
      }
    }
  }

  final rawBytes = await _readRawFile(filePath);
  if (rawBytes != null && _fitsPhotoUploadBytes(rawBytes.length)) {
    return _encodeB64Isolate(rawBytes);
  }

  return null;
}

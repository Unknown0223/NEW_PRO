import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../config/mobile_config.dart';

/// Server bilan bir xil — 25 MiB gacha asl kamera fayli.
const clientPhotoMaxFileBytes = 25 * 1024 * 1024;

/// Base64 uzunligi (~33% kattaroq).
const clientPhotoMaxBase64Len = (clientPhotoMaxFileBytes * 4 + 2) ~/ 3;

/// Siqishda rezolyutsiyani pasaytirmaslik uchun yuqori chegara.
const _noResizeMinSide = 8192;

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

bool _fitsPhotoUpload(List<int> bytes) {
  if (bytes.length > clientPhotoMaxFileBytes) return false;
  // Base64 ~4/3 — bytes limit yetarli, lekin aniq tekshiruv saqlanadi.
  return _b64FromBytes(bytes).length <= clientPhotoMaxBase64Len;
}

int _encodeQuality(PhotoConfig cfg) =>
    cfg.jpegQuality > 0 ? cfg.jpegQuality.clamp(92, 98) : 95;

int _encodeMaxSide(PhotoConfig cfg) {
  final w = cfg.maxWidthPx > 0 ? cfg.maxWidthPx : 4032;
  final h = cfg.maxHeightPx > 0 ? cfg.maxHeightPx : 4032;
  return math.max(w, h);
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

/// Kamera faylini serverga yuklash uchun base64 — asl sifat saqlanadi, faqat limitdan oshsa siqiladi.
Future<String?> encodeClientPhotoBase64(String filePath, {PhotoConfig? config}) async {
  final cfg = config ?? const PhotoConfig();
  final targetQuality = _encodeQuality(cfg);
  final targetSide = _encodeMaxSide(cfg);

  final rawBytes = await _readRawFile(filePath);
  if (rawBytes != null && _fitsPhotoUpload(rawBytes)) {
    return _b64FromBytes(rawBytes);
  }

  // Avval faqat JPEG sifatini pasaytiramiz, rezolyutsiyani saqlab.
  for (var quality = targetQuality; quality >= 88; quality -= 2) {
    final reencoded = await _compressJpeg(
      filePath,
      minSide: _noResizeMinSide,
      quality: quality,
    );
    if (reencoded != null && _fitsPhotoUpload(reencoded)) {
      return _b64FromBytes(reencoded);
    }
  }

  // Hali ham katta — config chegarasigacha kichraytiramiz.
  var compressed = await _compressJpeg(filePath, minSide: targetSide, quality: targetQuality);
  if (compressed != null && _fitsPhotoUpload(compressed)) {
    return _b64FromBytes(compressed);
  }

  for (var side = targetSide; side >= 1920; side -= 512) {
    for (var quality = targetQuality; quality >= 85; quality -= 3) {
      compressed = await _compressJpeg(filePath, minSide: side, quality: quality);
      if (compressed != null && _fitsPhotoUpload(compressed)) {
        return _b64FromBytes(compressed);
      }
    }
  }

  return null;
}

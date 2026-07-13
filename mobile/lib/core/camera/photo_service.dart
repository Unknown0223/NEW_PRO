import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../auth/session.dart';
import '../config/mobile_config.dart';

/// Server bilan bir xil — 25 MiB gacha asl kamera fayli.
const clientPhotoMaxFileBytes = 25 * 1024 * 1024;

/// Base64 uzunligi (~33% kattaroq).
const clientPhotoMaxBase64Len = (clientPhotoMaxFileBytes * 4 + 2) ~/ 3;

class PhotoResult {
  final String filePath;
  final int sizeBytes;
  const PhotoResult({required this.filePath, required this.sizeBytes});
}

class PhotoService {
  final PhotoConfig _config;
  PhotoService(this._config);

  Future<PhotoResult?> takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera,
      maxWidth: _config.maxWidthPx > 0 ? _config.maxWidthPx.toDouble() : 1280,
      maxHeight: _config.maxHeightPx > 0 ? _config.maxHeightPx.toDouble() : 1280,
      imageQuality: _config.jpegQuality,);
    if (picked == null) return null;
    final file = File(picked.path);
    final bytes = await file.length();
    return PhotoResult(filePath: picked.path, sizeBytes: bytes);
  }

  /// Mijoz / foto hisobot — asl kamera fayli (pickImage siqishsiz).
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

final photoServiceProvider = Provider<PhotoService>((ref) {
  final cfg = ref.watch(mobileConfigProvider).photo;
  return PhotoService(cfg);
});

String _b64FromBytes(List<int> bytes) => base64Encode(bytes);

Future<List<int>?> _compressJpeg(String filePath, {required int side, required int quality}) async {
  final out = await FlutterImageCompress.compressWithFile(
    filePath,
    minWidth: side,
    minHeight: side,
    quality: quality,
    format: CompressFormat.jpeg,
    keepExif: true,
  );
  if (out == null || out.isEmpty) return null;
  return out;
}

Future<List<int>?> _readRawFile(String filePath) async {
  final file = File(filePath);
  if (!await file.exists()) return null;
  return file.readAsBytes();
}

/// Kamera faylini serverga yuklash uchun base64 — avval xom fayl, faqat limitdan oshsa siqiladi.
Future<String?> encodeClientPhotoBase64(String filePath, {PhotoConfig? config}) async {
  final cfg = config ?? const PhotoConfig();
  final rawBytes = await _readRawFile(filePath);
  if (rawBytes == null || rawBytes.isEmpty) return null;

  if (rawBytes.length <= clientPhotoMaxFileBytes) {
    final encoded = _b64FromBytes(rawBytes);
    if (encoded.length <= clientPhotoMaxBase64Len) return encoded;
  }

  final startSide = () {
    final w = cfg.maxWidthPx > 0 ? cfg.maxWidthPx : 4032;
    final h = cfg.maxHeightPx > 0 ? cfg.maxHeightPx : 4032;
    return math.max(w, h);
  }();
  final startQuality = cfg.jpegQuality > 0 ? cfg.jpegQuality.clamp(85, 100) : 98;

  for (var side = startSide; side >= 1920; side -= 512) {
    for (var quality = startQuality; quality >= 85; quality -= 3) {
      final compressed = await _compressJpeg(filePath, side: side, quality: quality);
      if (compressed == null) continue;
      if (compressed.length <= clientPhotoMaxFileBytes &&
          _b64FromBytes(compressed).length <= clientPhotoMaxBase64Len) {
        return _b64FromBytes(compressed);
      }
    }
  }

  return null;
}

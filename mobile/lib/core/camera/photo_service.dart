import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../config/mobile_config.dart';
import '../errors/error_reporter.dart';
import 'photo_capture_policy.dart';

export 'photo_capture_policy.dart' show PhotoCaptureException, photoCaptureUserMessage;

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
  PhotoService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<PhotoResult?> takePhoto() => _pickCamera();

  /// Mijoz / foto hisobot.
  /// `preferredCameraDevice: rear` emulyatorda bo‘sh kulrang preview beradi —
  /// tizim default kamerasini ochamiz (telefonda odatda orqa).
  Future<PhotoResult?> takeClientPhoto() => _pickCamera();

  Future<PhotoResult?> _pickCamera() async {
    try {
      final XFile? picked =
          await _picker.pickImage(source: ImageSource.camera);
      if (picked == null) return null;
      final file = File(picked.path);
      final bytes = await file.length();
      return PhotoResult(filePath: picked.path, sizeBytes: bytes);
    } on PlatformException catch (e, st) {
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.photos,
        code: e.code.isNotEmpty ? e.code : 'CameraPickFailed',
        message: 'Kamera: pickImage muvaffaqiyatsiz',
        path: 'image_picker/camera',
        payload: {
          'details': e.message,
        },
      );
      throw PhotoCaptureException(
        code: e.code,
        message: photoCaptureUserMessage(e.code, fallback: e.message),
      );
    } catch (e, st) {
      if (e is PhotoCaptureException) rethrow;
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.photos,
        code: 'CameraPickFailed',
        message: 'Kamera: kutilmagan xato',
        path: 'image_picker/camera',
      );
      throw PhotoCaptureException(
        code: 'camera_unavailable',
        message: photoCaptureUserMessage('camera_unavailable'),
      );
    }
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

Future<String> _encodeB64Isolate(List<int> bytes) =>
    compute(_b64FromBytes, bytes);

/// Kamera faylini serverga yuklash uchun base64 — asl sifat saqlanadi, faqat limitdan oshsa siqiladi.
Future<String?> encodeClientPhotoBase64(String filePath, {PhotoConfig? config}) async {
  final cfg = config ?? const PhotoConfig();
  final targetQuality = _encodeQuality(cfg);
  final targetSide = _encodeMaxSide(cfg);

  final rawBytes = await _readRawFile(filePath);
  if (rawBytes != null && _fitsPhotoUploadBytes(rawBytes.length)) {
    return _encodeB64Isolate(rawBytes);
  }

  for (var quality = targetQuality; quality >= 88; quality -= 2) {
    final reencoded = await _compressJpeg(
      filePath,
      minSide: _noResizeMinSide,
      quality: quality,
    );
    if (reencoded != null && _fitsPhotoUploadBytes(reencoded.length)) {
      return _encodeB64Isolate(reencoded);
    }
  }

  var compressed = await _compressJpeg(filePath, minSide: targetSide, quality: targetQuality);
  if (compressed != null && _fitsPhotoUploadBytes(compressed.length)) {
    return _encodeB64Isolate(compressed);
  }

  for (var side = targetSide; side >= 1920; side -= 512) {
    for (var quality = targetQuality; quality >= 85; quality -= 3) {
      compressed = await _compressJpeg(filePath, minSide: side, quality: quality);
      if (compressed != null && _fitsPhotoUploadBytes(compressed.length)) {
        return _encodeB64Isolate(compressed);
      }
    }
  }

  return null;
}

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'dio_client.dart';

/// Nisbiy `/uploads/...` yo‘lini to‘liq URL ga aylantiradi.
String resolveMediaUrl(String raw) {
  final u = raw.trim();
  if (u.isEmpty) return u;
  if (u.startsWith('data:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  final base = resolveApiBaseUrl().replaceAll(RegExp(r'/$'), '');
  if (u.startsWith('/')) return '$base$u';
  return '$base/$u';
}

bool _isLocalFileMediaPath(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return false;
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) {
    return false;
  }
  if (s.startsWith('/uploads')) return false;
  return s.contains('/') || s.contains('\\');
}

Uint8List? decodeDataImageUrl(String raw) {
  final u = raw.trim();
  if (!u.startsWith('data:image')) return null;
  try {
    final b64 = u.replaceFirst(RegExp(r'^data:image/\w+;base64,'), '');
    return base64Decode(b64);
  } catch (_) {
    return null;
  }
}

/// `data:image/...;base64,...` yoki tarmoq URL dan rasm ko‘rsatadi.
class MediaImage extends StatelessWidget {
  final String source;
  final double? width;
  final double? height;
  final BoxFit fit;
  final ImageErrorWidgetBuilder? errorBuilder;

  const MediaImage({
    super.key,
    required this.source,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.errorBuilder,
  });

  @override
  Widget build(BuildContext context) {
    final onError = errorBuilder ??
        (_, __, ___) => Container(
              width: width,
              height: height,
              color: const Color(0xFFE2E8F0),
              child: const Center(child: Icon(Icons.broken_image_outlined)),
            );

    final bytes = decodeDataImageUrl(source);
    if (bytes != null) {
      return Image.memory(
        bytes,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: onError,
      );
    }

    if (_isLocalFileMediaPath(source)) {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final cacheW = width != null ? (width! * dpr).round().clamp(1, 2048) : null;
      final cacheH = height != null ? (height! * dpr).round().clamp(1, 2048) : null;
      return Image.file(
        File(source),
        width: width,
        height: height,
        fit: fit,
        errorBuilder: onError,
        cacheWidth: cacheW,
        cacheHeight: cacheH,
        filterQuality: FilterQuality.low,
      );
    }

    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheW = width != null ? (width! * dpr).round().clamp(1, 2048) : null;
    final cacheH = height != null ? (height! * dpr).round().clamp(1, 2048) : null;

    return Image.network(
      resolveMediaUrl(source),
      width: width,
      height: height,
      fit: fit,
      errorBuilder: onError,
      cacheWidth: cacheW,
      cacheHeight: cacheH,
      filterQuality: FilterQuality.low,
    );
  }
}

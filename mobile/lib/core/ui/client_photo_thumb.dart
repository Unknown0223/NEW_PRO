import 'dart:io';

import 'package:flutter/material.dart';

import '../api/media_url.dart';
import '../theme/app_colors.dart';

bool isLocalClientPhotoPath(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return false;
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) {
    return false;
  }
  if (s.startsWith('/uploads')) return false;
  return s.contains('/') || s.contains('\\');
}

String? firstClientPhotoUrl(Map<String, dynamic> client) {
  for (final key in const ['photo_url', 'photo_path', 'image_url']) {
    final v = client[key]?.toString().trim();
    if (v != null && v.isNotEmpty) return v;
  }
  return null;
}

/// Savdo nuqtasi rasmi — fayl, data-URL yoki tarmoq.
class ClientPhotoThumb extends StatelessWidget {
  final String? source;
  final double size;
  final double radius;

  const ClientPhotoThumb({
    super.key,
    this.source,
    this.size = 43,
    this.radius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final s = source?.trim() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: size,
        height: size,
        child: s.isEmpty ? _placeholder() : _image(context, s),
      ),
    );
  }

  Widget _placeholder() {
    return ColoredBox(
      color: AppColors.surfaceVariant,
      child: Icon(
        Icons.storefront_outlined,
        color: AppColors.textSecondary,
        size: size * 0.48,
      ),
    );
  }

  Widget _image(BuildContext context, String s) {
    if (isLocalClientPhotoPath(s)) {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final px = (size * dpr).round().clamp(1, 512);
      return Image.file(
        File(s),
        fit: BoxFit.cover,
        cacheWidth: px,
        cacheHeight: px,
        filterQuality: FilterQuality.low,
        errorBuilder: (_, __, ___) => _placeholder(),
      );
    }
    return MediaImage(
      source: s,
      width: size,
      height: size,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _placeholder(),
    );
  }
}

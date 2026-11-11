import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'client_photo_thumb.dart';

/// Mahsulot rasmi — sync `image_url` yoki placeholder.
class ProductPhotoThumb extends StatelessWidget {
  final String? source;
  final double size;
  final double radius;

  const ProductPhotoThumb({
    super.key,
    this.source,
    this.size = 40,
    this.radius = 10,
  });

  @override
  Widget build(BuildContext context) {
    final url = source?.trim();
    if (url == null || url.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(
          Icons.inventory_2_outlined,
          size: size * 0.45,
          color: AppColors.textMuted,
        ),
      );
    }
    // ClientPhotoThumb media JWT / network ni qo‘llab-quvvatlaydi.
    return ClientPhotoThumb(source: url, size: size, radius: radius);
  }
}

String? productImageUrl(Map<String, dynamic> product) {
  for (final key in const ['image_url', 'photo_url', 'image']) {
    final v = product[key]?.toString().trim();
    if (v != null && v.isNotEmpty) return v;
  }
  return null;
}

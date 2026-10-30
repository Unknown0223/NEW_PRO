import 'dart:convert';
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
/// Baytlar bir marta ochiladi — ota vidjet qayta chizilganda rasm pirpiramaydi.
class MediaImage extends StatefulWidget {
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
  State<MediaImage> createState() => _MediaImageState();
}

class _MediaImageState extends State<MediaImage> {
  Uint8List? _bytes;

  @override
  void initState() {
    super.initState();
    _bytes = decodeDataImageUrl(widget.source);
  }

  @override
  void didUpdateWidget(MediaImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.source != widget.source) {
      _bytes = decodeDataImageUrl(widget.source);
    }
  }

  int? _cachePx(double? logical) {
    if (logical == null || !logical.isFinite || logical <= 0) return null;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return (logical * dpr).round().clamp(1, 2048);
  }

  @override
  Widget build(BuildContext context) {
    final onError = widget.errorBuilder ??
        (_, __, ___) => Container(
              width: widget.width,
              height: widget.height,
              color: const Color(0xFFE2E8F0),
              child: const Center(child: Icon(Icons.broken_image_outlined)),
            );

    if (_bytes != null) {
      return Image.memory(
        _bytes!,
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        gaplessPlayback: true,
        errorBuilder: onError,
      );
    }

    return Image.network(
      resolveMediaUrl(widget.source),
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      gaplessPlayback: true,
      errorBuilder: onError,
      cacheWidth: _cachePx(widget.width),
      cacheHeight: _cachePx(widget.height),
      filterQuality: FilterQuality.low,
    );
  }
}

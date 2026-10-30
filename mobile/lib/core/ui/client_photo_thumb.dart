import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/dio_client.dart';
import '../api/media_url.dart';
import '../theme/app_colors.dart';

final Map<String, Uint8List> _authPhotoCache = {};

bool isLocalClientPhotoPath(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return false;
  if (s.startsWith('data:') ||
      s.startsWith('http://') ||
      s.startsWith('https://') ||
      s.startsWith('/api/') ||
      s.startsWith('/uploads')) {
    return false;
  }
  return s.contains('/') || s.contains('\\');
}

String? firstClientPhotoUrl(Map<String, dynamic> client) {
  for (final key in const ['photo_url', 'photo_path', 'image_url']) {
    final v = client[key]?.toString().trim();
    if (v != null && v.isNotEmpty && v != 'null') return v;
  }
  return null;
}

/// Savdo nuqtasi rasmi — fayl, data-URL, tarmoq yoki autentifikatsiyali `/api/`.
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
        child: s.isEmpty || s == 'null' ? _placeholder() : _image(context, s),
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
    if (s.startsWith('/api/')) {
      return _AuthClientPhoto(path: s, size: size, placeholder: _placeholder());
    }
    if (isLocalClientPhotoPath(s)) {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final px = (size * dpr).round().clamp(1, 512);
      return Image.file(
        File(s),
        fit: BoxFit.cover,
        cacheWidth: px,
        cacheHeight: px,
        filterQuality: FilterQuality.low,
        gaplessPlayback: true,
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

class _AuthClientPhoto extends StatefulWidget {
  final String path;
  final double size;
  final Widget placeholder;

  const _AuthClientPhoto({
    required this.path,
    required this.size,
    required this.placeholder,
  });

  @override
  State<_AuthClientPhoto> createState() => _AuthClientPhotoState();
}

class _AuthClientPhotoState extends State<_AuthClientPhoto> {
  Uint8List? _bytes;
  bool _failed = false;
  String? _loadedPath;

  void _ensureLoaded() {
    if (_loadedPath == widget.path) return;
    _loadedPath = widget.path;
    final cached = _authPhotoCache[widget.path];
    if (cached != null) {
      _bytes = cached;
      _failed = false;
      return;
    }
    _bytes = null;
    _failed = false;
    _load(widget.path);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ensureLoaded();
  }

  @override
  void didUpdateWidget(covariant _AuthClientPhoto oldWidget) {
    super.didUpdateWidget(oldWidget);
    _ensureLoaded();
  }

  Future<void> _load(String path) async {
    try {
      final dio = ProviderScope.containerOf(context, listen: false).read(dioProvider);
      final res = await dio.get<List<int>>(
        path,
        options: Options(responseType: ResponseType.bytes, headers: {'Accept': 'image/jpeg'}),
      );
      final data = res.data;
      if (!mounted || path != widget.path) return;
      if (data == null || data.isEmpty) {
        setState(() => _failed = true);
        return;
      }
      final bytes = Uint8List.fromList(data);
      if (_authPhotoCache.length > 80) {
        _authPhotoCache.remove(_authPhotoCache.keys.first);
      }
      _authPhotoCache[path] = bytes;
      setState(() {
        _bytes = bytes;
        _failed = false;
      });
    } catch (_) {
      if (mounted && path == widget.path) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _bytes;
    if (_failed || bytes == null) return widget.placeholder;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final px = (widget.size * dpr).round().clamp(1, 512);
    return Image.memory(
      bytes,
      fit: BoxFit.cover,
      gaplessPlayback: true,
      cacheWidth: px,
      cacheHeight: px,
      errorBuilder: (_, __, ___) => widget.placeholder,
    );
  }
}

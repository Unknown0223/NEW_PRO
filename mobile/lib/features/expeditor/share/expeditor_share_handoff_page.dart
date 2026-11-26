import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/app_lock.dart';
import '../../../core/auth/session.dart';
import '../../../core/camera/photo_service.dart'
    show PhotoCaptureException, photoServiceProvider;
import '../../../core/config/app_product.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../shared/tezyuk_expeditor_chrome.dart';

class ExpeditorShareHandoffPage extends ConsumerStatefulWidget {
  final int requestId;
  const ExpeditorShareHandoffPage({super.key, required this.requestId});

  @override
  ConsumerState<ExpeditorShareHandoffPage> createState() =>
      _ExpeditorShareHandoffPageState();
}

class _ExpeditorShareHandoffPageState
    extends ConsumerState<ExpeditorShareHandoffPage> {
  bool _busy = false;
  String? _error;
  String? _photoKey;
  String? _photoPath;

  Future<void> _capturePhoto() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final cam = await Permission.camera.request();
      if (!cam.isGranted) {
        setState(() => _error = 'Kamera ruxsati kerak');
        return;
      }
      final photo = await withAppLockSuppressed(
        ref,
        () => ref.read(photoServiceProvider).takePhoto(),
      );
      if (photo == null) return;
      final bytes = await File(photo.filePath).readAsBytes();
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      final b64 = base64Encode(bytes);
      final key = await ref.read(expeditorShareApiProvider).uploadHandoffPhoto(
            slug,
            widget.requestId,
            imageBase64: b64,
          );
      setState(() {
        _photoPath = photo.filePath;
        _photoKey = key;
      });
    } on PhotoCaptureException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final photo = _photoKey;
    if (photo == null || photo.isEmpty) {
      setState(() => _error = 'Avval kamera orqali foto oling');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition();
      await ref.read(expeditorShareApiProvider).handoff(
            slug,
            widget.requestId,
            lat: pos.latitude,
            lng: pos.longitude,
            photoKey: photo,
          );
      if (!mounted) return;
      context.go('/exp-share/${widget.requestId}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: expeditorPageBackground(),
      appBar: AppBar(
        title: Text(expeditorLabel('Передача груза', 'Yuk topshirish')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            expeditorLabel(
              'GPS снимается автоматически; обе стороны ~150 м и фото с камеры обязательны.',
              'GPS avtomatik olinadi; ikkala tomon ~150 m ichida va kamera fotosi majburiy.',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            expeditorLabel(
              'Облачная загрузка фото для ulashish пока не подключена — ключ фиксирует факт съёмки.',
              'Ulashish uchun bulut yuklash hali yo‘q — kalit surat olinganini qayd etadi.',
            ),
            style: TextStyle(
              fontSize: 12,
              color: isTezyukProduct
                  ? TezyukColors.onSurfaceVariant
                  : Colors.black54,
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _busy ? null : _capturePhoto,
            icon: const Icon(Icons.photo_camera_outlined),
            label: Text(
              _photoKey == null
                  ? expeditorLabel('Сделать фото', 'Foto olish')
                  : expeditorLabel('Переснять', 'Qayta olish'),
            ),
          ),
          if (_photoPath != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.file(
                File(_photoPath!),
                height: 160,
                fit: BoxFit.cover,
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            style: isTezyukProduct
                ? FilledButton.styleFrom(
                    backgroundColor: TezyukColors.primary,
                    foregroundColor: TezyukColors.onPrimary,
                  )
                : null,
            child: Text(expeditorLabel('Отправить', 'Yuborish')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(
                color: isTezyukProduct ? TezyukColors.error : Colors.red,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

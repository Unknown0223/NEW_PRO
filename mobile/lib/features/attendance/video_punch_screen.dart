import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'video_punch_flow.dart';

/// HR Hub uslubidagi video-otmetka: oval preview, kunlik kod, 5–10 s yozish.
class VideoPunchScreen extends StatefulWidget {
  const VideoPunchScreen({
    super.key,
    required this.durationSec,
    required this.captureMode,
    this.dayCode,
    this.requireBack = false,
    this.title = 'Видео-отметка',
  });

  final int durationSec;
  final String captureMode;
  final int? dayCode;
  final bool requireBack;
  final String title;

  static Future<VideoPunchCapture?> open(
    BuildContext context, {
    required int durationSec,
    required String captureMode,
    int? dayCode,
    bool requireBack = false,
    String title = 'Видео-отметка',
  }) {
    return Navigator.of(context).push<VideoPunchCapture>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => VideoPunchScreen(
          durationSec: durationSec.clamp(5, 10),
          captureMode: captureMode,
          dayCode: dayCode,
          requireBack: requireBack,
          title: title,
        ),
      ),
    );
  }

  @override
  State<VideoPunchScreen> createState() => _VideoPunchScreenState();
}

class _VideoPunchScreenState extends State<VideoPunchScreen> {
  CameraController? _front;
  CameraController? _back;
  bool _busy = false;
  int _left = 0;
  String? _status;
  String? _error;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    unawaited(_prepare());
  }

  @override
  void dispose() {
    _tick?.cancel();
    _release(_front);
    _release(_back);
    super.dispose();
  }

  void _release(CameraController? c) {
    if (c == null) return;
    c.dispose();
  }

  Future<void> _prepare() async {
    setState(() {
      _status = 'Подготовка камер…';
      _error = null;
    });
    try {
      final cams = await availableCameras();
      CameraDescription? front;
      CameraDescription? back;
      for (final c in cams) {
        if (c.lensDirection == CameraLensDirection.front) front ??= c;
        if (c.lensDirection == CameraLensDirection.back) back ??= c;
      }
      front ??= cams.isEmpty ? null : cams.first;
      if (front == null) throw Exception('Камера не найдена');

      final fc = CameraController(front, ResolutionPreset.medium, enableAudio: true);
      await fc.initialize();

      CameraController? bc;
      if (back != null && back.name != front.name) {
        bc = CameraController(back, ResolutionPreset.low, enableAudio: false);
        try {
          await bc.initialize();
        } catch (_) {
          await bc.dispose();
          bc = null;
        }
      }

      if (!mounted) {
        await fc.dispose();
        await bc?.dispose();
        return;
      }
      setState(() {
        _front = fc;
        _back = bc;
        _status = null;
        if (widget.requireBack && bc == null) {
          _error = 'Нужна задняя камера. На эмуляторе добавьте 2-ю камеру или снимите требование.';
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _status = null;
        });
      }
    }
  }

  Future<void> _record() async {
    final front = _front;
    if (front == null || _busy) return;
    if (widget.requireBack && _back == null) {
      setState(() => _error = 'Задняя камера недоступна');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _left = widget.durationSec;
      _status = 'Запись… назовите код';
    });
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _left = (_left - 1).clamp(0, widget.durationSec);
      });
    });

    try {
      var mode = 'sequential';
      String? backPath;
      await front.startVideoRecording();
      final back = _back;
      if (back != null &&
          (widget.captureMode == 'simultaneous' || widget.captureMode == 'sequential')) {
        try {
          await back.startVideoRecording();
          mode = 'simultaneous';
        } catch (_) {}
      }
      await Future<void>.delayed(Duration(seconds: widget.durationSec));
      final frontFile = await front.stopVideoRecording();
      if (mode == 'simultaneous' && back != null) {
        backPath = (await back.stopVideoRecording()).path;
      } else if (back != null) {
        setState(() {
          _status = 'Задняя камера…';
          _left = widget.durationSec;
        });
        await back.startVideoRecording();
        await Future<void>.delayed(Duration(seconds: widget.durationSec));
        backPath = (await back.stopVideoRecording()).path;
        mode = 'sequential';
      }

      final frontB64 = base64Encode(await File(frontFile.path).readAsBytes());
      String? backB64;
      if (backPath != null) {
        backB64 = base64Encode(await File(backPath).readAsBytes());
      }
      if (widget.requireBack && (backB64 == null || backB64.isEmpty)) {
        throw Exception('Не записано видео с задней камеры');
      }
      if (!mounted) return;
      Navigator.pop(
        context,
        VideoPunchCapture(
          frontBase64: frontB64,
          backBase64: backB64,
          durationSec: widget.durationSec,
          captureMode: backB64 != null ? mode : 'front_only',
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _status = null;
        });
      }
    } finally {
      _tick?.cancel();
      if (mounted) {
        setState(() {
          _busy = false;
          _left = 0;
        });
      }
    }
  }

  Widget _ovalPreview(CameraController c) {
    return ClipOval(
      child: SizedBox(
        width: 280,
        height: 280,
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: c.value.previewSize?.height ?? 280,
            height: c.value.previewSize?.width ?? 280,
            child: CameraPreview(c),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.dayCode;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.title),
      ),
      body: _error != null && _front == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: _front == null
                      ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                      : Center(child: _ovalPreview(_front!)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                  child: Column(
                    children: [
                      if (code != null) ...[
                        const Text(
                          'Назовите код:',
                          style: TextStyle(color: Colors.white70, fontSize: 14),
                        ),
                        Text(
                          '$code',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 40,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 10,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Text(
                        _back != null
                            ? 'Обе камеры: фронт + рабочее место'
                            : 'Только передняя камера',
                        style: const TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                      if (_busy)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            _left > 0 ? '$_status  $_left с' : (_status ?? 'Запись…'),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                          ),
                        ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.redAccent),
                          ),
                        ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: FilledButton.icon(
                          onPressed: _busy || _front == null ? null : _record,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          icon: Icon(_busy ? Icons.fiber_manual_record : Icons.videocam_rounded),
                          label: Text(
                            _busy
                                ? 'Запись…'
                                : 'Записать ${widget.durationSec} с',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

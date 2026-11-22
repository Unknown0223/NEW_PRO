import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart' show WriteBuffer;
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../core/theme/app_colors.dart';
import 'attendance_models.dart';
import 'liveness_pose.dart';

class LivenessLiveResult {
  const LivenessLiveResult({required this.steps, required this.selfieBase64});
  final List<String> steps;
  final String selfieBase64;
}

/// Kamera preview + random strelkalar; bosh burish ML Kit bilan aniqlanadi.
class LivenessLiveScreen extends StatefulWidget {
  const LivenessLiveScreen({
    super.key,
    required this.directions,
    this.presetSequence,
  });

  final int directions;
  final List<String>? presetSequence;

  static Future<LivenessLiveResult?> open(
    BuildContext context, {
    required int directions,
    List<String>? presetSequence,
  }) {
    return Navigator.of(context).push<LivenessLiveResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => LivenessLiveScreen(
          directions: directions,
          presetSequence: presetSequence,
        ),
      ),
    );
  }

  @override
  State<LivenessLiveScreen> createState() => _LivenessLiveScreenState();
}

class _LivenessLiveScreenState extends State<LivenessLiveScreen> {
  CameraController? _controller;
  FaceDetector? _detector;
  late final List<String> _sequence;
  final List<String> _completed = [];
  int _holdFrames = 0;
  bool _busy = false;
  bool _initError = false;
  String? _status;
  int _sensorOrientation = 0;

  @override
  void initState() {
    super.initState();
    _sequence = widget.presetSequence ??
        buildRandomLivenessSequence(widget.directions == 8 ? 8 : 4);
    _boot();
  }

  Future<void> _boot() async {
    try {
      final cams = await availableCameras();
      final front = cams.where((c) => c.lensDirection == CameraLensDirection.front);
      final cam = front.isNotEmpty ? front.first : cams.first;
      _sensorOrientation = cam.sensorOrientation;
      final ctrl = CameraController(
        cam,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );
      await ctrl.initialize();
      _detector = FaceDetector(
        options: FaceDetectorOptions(
          performanceMode: FaceDetectorMode.accurate,
          enableTracking: true,
        ),
      );
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() => _controller = ctrl);
      await ctrl.startImageStream(_onFrame);
    } catch (e) {
      if (mounted) {
        setState(() {
          _initError = true;
          _status = 'Камера недоступна: $e';
        });
      }
    }
  }

  Future<void> _onFrame(CameraImage image) async {
    if (_busy || _detector == null || _completed.length >= _sequence.length) return;
    _busy = true;
    try {
      final input = _toInputImage(image);
      if (input == null) return;
      final faces = await _detector!.processImage(input);
      if (!mounted || faces.isEmpty) {
        _holdFrames = 0;
        return;
      }
      final face = faces.first;
      final dir = _sequence[_completed.length];
      final ok = headPoseMatchesChallenge(
        direction: dir,
        yaw: face.headEulerAngleY,
        pitch: face.headEulerAngleX,
      );
      if (ok) {
        _holdFrames++;
        if (_holdFrames >= 4) {
          _holdFrames = 0;
          await _completeCurrent(dir);
        }
      } else {
        _holdFrames = 0;
      }
    } catch (_) {
      _holdFrames = 0;
    } finally {
      _busy = false;
    }
  }

  Future<void> _completeCurrent(String dir) async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    if (ctrl.value.isStreamingImages) {
      await ctrl.stopImageStream();
    }
    setState(() {
      _completed.add(dir);
      _status = 'OK · ${_completed.length}/${_sequence.length}';
    });
    if (_completed.length >= _sequence.length) {
      try {
        final shot = await ctrl.takePicture();
        final bytes = await File(shot.path).readAsBytes();
        if (!mounted) return;
        Navigator.pop(
          context,
          LivenessLiveResult(steps: List.from(_completed), selfieBase64: base64Encode(bytes)),
        );
      } catch (e) {
        if (mounted) setState(() => _status = 'Не удалось сделать снимок: $e');
      }
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (mounted && _controller != null && _controller!.value.isInitialized) {
      await _controller!.startImageStream(_onFrame);
    }
  }

  InputImage? _toInputImage(CameraImage image) {
    final ctrl = _controller;
    if (ctrl == null) return null;
    final rotation = InputImageRotationValue.fromRawValue(_sensorOrientation) ??
        InputImageRotation.rotation0deg;

    if (Platform.isAndroid) {
      final bytes = image.planes.first.bytes;
      return InputImage.fromBytes(
        bytes: bytes,
        metadata: InputImageMetadata(
          size: Size(image.width.toDouble(), image.height.toDouble()),
          rotation: rotation,
          format: InputImageFormat.nv21,
          bytesPerRow: image.planes.first.bytesPerRow,
        ),
      );
    }

    final WriteBuffer all = WriteBuffer();
    for (final p in image.planes) {
      all.putUint8List(p.bytes);
    }
    return InputImage.fromBytes(
      bytes: all.done().buffer.asUint8List(),
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: InputImageFormat.bgra8888,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  @override
  void dispose() {
    final c = _controller;
    _controller = null;
    c?.dispose();
    _detector?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = _controller;
    final step = _completed.length.clamp(0, _sequence.length - 1);
    final dir = _sequence.isEmpty ? 'left' : _sequence[step];
    final label = LivenessHelper.labelsRu[dir] ?? dir;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('Живость ${_completed.length}/${_sequence.length}'),
      ),
      body: _initError
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_status ?? 'Ошибка камеры', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
              ),
            )
          : ctrl == null || !ctrl.value.isInitialized
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : Stack(
                  fit: StackFit.expand,
                  children: [
                    Center(child: CameraPreview(ctrl)),
                    Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Шаг ${_completed.length + 1}/${_sequence.length}',
                              style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              label,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (_status != null) ...[
                              const SizedBox(height: 6),
                              Text(_status!, style: const TextStyle(color: AppColors.primaryLight)),
                            ],
                          ],
                        ),
                      ),
                    ),
                    Align(
                      alignment: Alignment.center,
                      child: IgnorePointer(
                        child: Icon(
                          _arrowIcon(dir),
                          size: 96,
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  IconData _arrowIcon(String dir) {
    switch (dir) {
      case 'left':
        return Icons.arrow_back_rounded;
      case 'right':
        return Icons.arrow_forward_rounded;
      case 'up':
        return Icons.arrow_upward_rounded;
      case 'down':
        return Icons.arrow_downward_rounded;
      case 'up_left':
        return Icons.north_west;
      case 'up_right':
        return Icons.north_east;
      case 'down_left':
        return Icons.south_west;
      case 'down_right':
        return Icons.south_east;
      default:
        return Icons.face_retouching_natural;
    }
  }
}

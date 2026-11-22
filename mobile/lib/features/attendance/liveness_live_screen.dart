import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../core/theme/app_colors.dart';
import 'anime_face_guide.dart';
import 'liveness_camera_pick.dart';
import 'liveness_challenge.dart';
import 'liveness_live_widgets.dart';

class LivenessLiveResult {
  const LivenessLiveResult({required this.steps, required this.selfieBase64});
  final List<String> steps;
  final String selfieBase64;
}

/// HR Hub uslubidagi jonli liveness: markaz → random burish → markaz → selfie.
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

class _LivenessLiveScreenState extends State<LivenessLiveScreen>
    with SingleTickerProviderStateMixin {
  CameraController? _controller;
  CameraDescription? _camera;
  final _detector = FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.fast,
      enableTracking: true,
      minFaceSize: 0.2,
    ),
  );

  List<InputImageRotation> _rotations = const [];
  int _rotationIndex = 0;
  bool _rotationLocked = false;
  int _emptyFrames = 0;
  DateTime _lastFrameAt = DateTime.now();
  Timer? _watchdog;

  late final AnimationController _anim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat();

  late LivenessChallenge _challenge;
  bool _processing = false;
  bool _capturing = false;
  int _faces = 0;
  final List<bool> _sectors = List.filled(64, false);
  String? _error;

  @override
  void initState() {
    super.initState();
    _challenge = _buildChallenge();
    _start();
  }

  LivenessChallenge _buildChallenge() {
    final preset = widget.presetSequence;
    if (preset != null && preset.isNotEmpty) {
      return LivenessChallenge.fromApiNames(preset);
    }
    return LivenessChallenge.random(directions: widget.directions == 8 ? 8 : 4);
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    _releaseCamera();
    _detector.close();
    _anim.dispose();
    super.dispose();
  }

  void _releaseCamera() {
    final c = _controller;
    _controller = null;
    if (c != null) {
      if (c.value.isStreamingImages) c.stopImageStream().catchError((_) {});
      c.dispose();
    }
  }

  static List<InputImageRotation> _rotationOrder(int sensor) {
    final order = <int>[sensor, (360 - sensor) % 360, 0, 90, 180, 270];
    final seen = <int>{};
    final out = <InputImageRotation>[];
    for (final deg in order) {
      if (!seen.add(deg)) continue;
      final r = InputImageRotationValue.fromRawValue(deg);
      if (r != null) out.add(r);
    }
    return out;
  }

  Future<void> _start() async {
    try {
      final cams = await availableCameras();
      final picked = selectLivenessCamera(cams);
      if (picked == null) {
        throw Exception(
          'Камера не найдена. На эмуляторе включите VirtualScene / Webcam в Extended controls → Camera.',
        );
      }
      _camera = picked;
      _rotations = _rotationOrder(_camera!.sensorOrientation);
      _rotationIndex = 0;
      _rotationLocked = false;
      _emptyFrames = 0;
      final controller = CameraController(
        _camera!,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup:
            Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      _controller = controller;
      _lastFrameAt = DateTime.now();
      await controller.startImageStream(_onFrame);
      _watchdog?.cancel();
      _watchdog = Timer.periodic(const Duration(seconds: 2), (_) {
        final c = _controller;
        if (c == null || _capturing || !c.value.isStreamingImages) return;
        if (DateTime.now().difference(_lastFrameAt) > const Duration(seconds: 5)) {
          _restartCamera();
        }
      });
      setState(() => _error = null);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error =
              'Камера недоступна. Эмулятор: Camera → VirtualScene/Webcam. Или проверьте на телефоне.\n($e)';
        });
      }
    }
  }

  Future<void> _restartCamera() async {
    _watchdog?.cancel();
    _releaseCamera();
    _processing = false;
    _capturing = false;
    if (!mounted) return;
    setState(() => _error = null);
    await _start();
  }

  InputImage? _toInputImage(CameraImage image) {
    if (_camera == null || image.planes.isEmpty || _rotations.isEmpty) return null;
    final rotation = _rotations[_rotationIndex % _rotations.length];
    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;
    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  void _trackRotation(int faceCount) {
    if (_rotationLocked) return;
    if (faceCount > 0) {
      _rotationLocked = true;
      return;
    }
    if (++_emptyFrames >= 8) {
      _rotationIndex = (_rotationIndex + 1) % _rotations.length;
      _emptyFrames = 0;
    }
  }

  Future<void> _onFrame(CameraImage image) async {
    _lastFrameAt = DateTime.now();
    if (_processing || _capturing) return;
    _processing = true;
    try {
      final input = _toInputImage(image);
      if (input == null) return;
      final faces = await _detector.processImage(input).timeout(const Duration(seconds: 3));
      if (!mounted) return;
      _trackRotation(faces.length);
      final face = faces.length == 1 ? faces.first : null;
      _challenge.feed(
        face == null ? null : HeadPose(face.headEulerAngleY ?? 0, face.headEulerAngleX ?? 0),
        faces: faces.length,
        trackingId: face?.trackingId,
      );
      _markSectors();
      setState(() => _faces = faces.length);
      if (_challenge.phase == LivenessPhase.done) await _captureSelfie();
    } catch (_) {
      // frame drop
    } finally {
      _processing = false;
    }
  }

  void _markSectors() {
    final rel = _challenge.relativePose;
    if (rel != null) markFaceSectors(_sectors, rel.yaw, rel.pitch);
  }

  Future<void> _captureSelfie() async {
    final c = _controller;
    if (c == null || _capturing) return;
    _capturing = true;
    setState(() {});
    try {
      if (c.value.isStreamingImages) await c.stopImageStream();
      final file = await c.takePicture();
      final bytes = await File(file.path).readAsBytes();
      if (!mounted) return;
      Navigator.pop(
        context,
        LivenessLiveResult(
          steps: _challenge.apiSteps,
          selfieBase64: base64Encode(bytes),
        ),
      );
    } catch (e) {
      _capturing = false;
      if (mounted) setState(() => _error = 'Селфи не снято: $e');
    }
  }

  void _restartChallenge() {
    setState(() {
      _challenge = _buildChallenge();
      _error = null;
      for (var i = 0; i < _sectors.length; i++) {
        _sectors[i] = false;
      }
    });
  }

  (String, String, IconData) _instruction() {
    if (_faces == 0) {
      return ('Поместите лицо в рамку', 'Держите телефон на уровне лица', Icons.face_rounded);
    }
    if (_faces > 1) {
      return ('В кадре только вы', 'Другие люди должны выйти из кадра', Icons.group_off_rounded);
    }
    switch (_challenge.phase) {
      case LivenessPhase.center:
        return ('Смотрите прямо в камеру', 'Проверка начинается', Icons.center_focus_strong_rounded);
      case LivenessPhase.turn:
        final d = _challenge.current!;
        return (d.promptRu, 'Медленно поверните голову по стрелке', d.icon);
      case LivenessPhase.back:
        return ('Снова смотрите прямо', 'Верните голову в центр', Icons.center_focus_strong_rounded);
      case LivenessPhase.finalCenter:
        return ('Смотрите прямо', 'Фото сделается автоматически', Icons.photo_camera_front_rounded);
      case LivenessPhase.done:
        return ('Подтверждено', 'Сохраняем фото…', Icons.verified_rounded);
      case LivenessPhase.failed:
        return (
          _challenge.failReason ?? 'Проверка не пройдена',
          'Нажмите «Начать снова»',
          Icons.error_outline_rounded,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    final failed = _challenge.phase == LivenessPhase.failed;
    final (title, hint, icon) = _instruction();
    final tone = failed
        ? AppColors.error
        : _faces == 1
            ? AppColors.primary
            : AppColors.warning;
    final rel = _challenge.relativePose;
    final done = _challenge.phase == LivenessPhase.done
        ? _challenge.steps.length
        : _challenge.index.clamp(0, _challenge.steps.length);

    return Scaffold(
      backgroundColor: const Color(0xFF101218),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text('Живость $done/${_challenge.steps.length}'),
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: _error != null
            ? LivenessErrorPane(text: _error!, onRetry: _restartCamera)
            : c == null || !c.value.isInitialized
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : Column(
                    children: [
                      LivenessStepRail(challenge: _challenge, pulse: _anim),
                      const SizedBox(height: 12),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(28),
                          child: ColoredBox(
                            color: Colors.black,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                // cover emas — contain: chetlar kesilmasin (emulyator/webcam).
                                Center(
                                  child: AspectRatio(
                                    aspectRatio: c.value.aspectRatio == 0
                                        ? (3 / 4)
                                        : c.value.aspectRatio,
                                    child: CameraPreview(c),
                                  ),
                                ),
                                IgnorePointer(
                                  child: AnimatedBuilder(
                                    animation: _anim,
                                    builder: (_, __) => AnimeFaceGuide(
                                      t: _anim.value,
                                      tracked: _faces == 1 && !failed,
                                      yaw: rel?.yaw ?? 0,
                                      pitch: rel?.pitch ?? 0,
                                      sectors: _sectors,
                                      failed: failed,
                                    ),
                                  ),
                                ),
                                if (_capturing)
                                  const ColoredBox(color: Color(0x66FFFFFF)),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      LivenessInstructionCard(title: title, hint: hint, icon: icon, color: tone),
                      if (failed) ...[
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: FilledButton.icon(
                            onPressed: _restartChallenge,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Начать снова', style: TextStyle(fontWeight: FontWeight.w800)),
                          ),
                        ),
                      ],
                    ],
                  ),
      ),
    );
  }
}

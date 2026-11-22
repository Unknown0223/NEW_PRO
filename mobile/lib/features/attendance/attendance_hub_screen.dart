import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/auth/app_lock.dart';
import '../../core/face/face_daily_check_policy.dart';
import '../../core/face/face_gate_state.dart';
import '../../core/face/face_verification_flow.dart';
import '../../core/security/location_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/time/server_clock.dart';
import '../agent/shell/agent_app_bar.dart';
import 'attendance_api_service.dart';
import 'attendance_gate_page.dart';
import 'attendance_gate_steps.dart';
import 'attendance_models.dart';
import 'attendance_offline_queue.dart';
import 'dual_capture.dart';
import 'liveness_live_screen.dart';
import 'photo_report.dart';
import 'punch_face_result.dart';
import 'video_punch_flow.dart';

class AttendanceHubScreen extends ConsumerStatefulWidget {
  /// Birinchi kunlik kirish — chiqish faqat ПРИХОД dan keyin.
  final bool gateMode;

  const AttendanceHubScreen({super.key, this.gateMode = false});

  @override
  ConsumerState<AttendanceHubScreen> createState() => _AttendanceHubScreenState();
}

class _AttendanceHubScreenState extends ConsumerState<AttendanceHubScreen> {
  final _picker = ImagePicker();
  final _commentCtrl = TextEditingController();
  final _spokenCodeCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  List<String> _livenessSequence = [];
  List<String> _completedLiveness = [];
  bool _livenessSeeded = false;
  String? _frontPhotoB64;
  String? _backPhotoB64;
  String? _frontVideoB64;
  String? _backVideoB64;
  int? _videoDurationSec;
  String _videoCaptureMode = 'sequential';
  int? _selectedKioskUserId;
  String _reqType = 'vacation';
  bool _submitting = false;
  String? _statusBanner;
  bool _gateCleared = false;
  int _gateStepIndex = 0;
  PunchFaceResult? _gateFaceResult;

  @override
  void initState() {
    super.initState();
    LocationGuard.warmUp();
  }

  @override
  void dispose() {
    LocationGuard.stopWarmUp();
    _commentCtrl.dispose();
    _spokenCodeCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Tab _tabFor(AttendanceMethodTab kind) {
    switch (kind) {
      case AttendanceMethodTab.photo:
        return const Tab(icon: Icon(Icons.camera_front), text: 'Фото + Face ID');
      case AttendanceMethodTab.video:
        return const Tab(icon: Icon(Icons.videocam), text: 'Видео + 3-код');
      case AttendanceMethodTab.kiosk:
        return const Tab(icon: Icon(Icons.groups), text: 'Киоск бригады');
      case AttendanceMethodTab.requests:
        return const Tab(icon: Icon(Icons.event_note), text: 'Заявки');
    }
  }

  Widget _viewFor(AttendanceMethodTab kind, MobileAttendanceState st) {
    switch (kind) {
      case AttendanceMethodTab.photo:
        return _buildPhotoTab(st);
      case AttendanceMethodTab.video:
        return _buildVideoTab(st);
      case AttendanceMethodTab.kiosk:
        return _buildKioskTab(st);
      case AttendanceMethodTab.requests:
        return _buildRequestsTab(st);
    }
  }

  Widget _buildModeBlocked(MobileAttendanceState st) {
    final title = st.terminalOnly
        ? 'Отметка только через терминал Face ID'
        : 'Отметка для вашей роли отключена';
    final body = st.terminalOnly
        ? 'Администратор разрешил только терминал. Отметьтесь на устройстве Face ID в филиале.'
        : 'В настройках табеля для вашей роли не включён ни один способ отметки. Обратитесь к руководителю.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              st.terminalOnly ? Icons.fingerprint : Icons.block,
              size: 56,
              color: Colors.teal.shade700,
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 16),
            Text('Смена: ${st.shiftName} (${st.shiftStart} – ${st.shiftEnd})', style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Future<PreciseFix> _acquireGuardedPosition(double maxAcc) {
    return LocationGuard().acquire(
      maxAllowedAccuracyMeters: maxAcc,
      timeout: const Duration(seconds: 12),
    );
  }

  Future<void> _finishGateIfNeeded() async {
    if (!widget.gateMode || !mounted) return;
    setState(() => _gateCleared = true);
    ref.read(faceGateRequiredProvider.notifier).clearGate();
    if (!mounted) return;
    context.go('/home');
  }

  List<AttendanceGateStep> _gateStepsFor(MobileAttendanceState st) {
    return buildAttendanceGateSteps(
      photoEnabled: st.photoEnabled,
      videoEnabled: st.videoEnabled,
      kioskAllowed: st.kioskAllowed,
      livenessDirections: st.livenessDirections,
      requireDualCamera: st.requireDualCamera,
      livenessSequence: _livenessSequence.isEmpty ? null : _livenessSequence,
      videoCodeRequired: st.videoCodeRequired,
      dayCode: st.dayCode,
    );
  }

  Future<String?> _pickCameraPhoto({int maxWidth = 960, int quality = 78}) {
    return withAppLockSuppressed(ref, () async {
      final x = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: maxWidth.toDouble(),
        imageQuality: quality,
      );
      return x?.path;
    });
  }

  Future<void> _gateContinueIfSubmit(MobileAttendanceState st) async {
    if (!mounted) return;
    final steps = _gateStepsFor(st);
    if (_gateStepIndex >= steps.length) return;
    if (steps[_gateStepIndex].kind != AttendanceGateStepKind.submit) return;
    await _onGatePrimary(st);
  }

  Future<void> _onGatePrimary(MobileAttendanceState st) async {
    final steps = _gateStepsFor(st);
    if (steps.isEmpty || _submitting) return;
    final idx = _gateStepIndex.clamp(0, steps.length - 1);
    final step = steps[idx];

    switch (step.kind) {
      case AttendanceGateStepKind.liveness:
        if (!await _ensureFace(st)) return;
        if (!mounted) return;
        final live = await withAppLockSuppressed(ref, () {
          return LivenessLiveScreen.open(
            context,
            directions: st.livenessDirections,
            presetSequence: _livenessSequence.isEmpty ? null : _livenessSequence,
          );
        });
        if (live == null || !mounted) return;
        setState(() {
          _completedLiveness = live.steps;
          _frontPhotoB64 = live.selfieBase64;
          _livenessSequence = live.steps;
          _gateStepIndex = idx + 1;
          _statusBanner = st.requireDualCamera
              ? 'Живость OK — снимите рабочее место'
              : 'Сверяем Face ID с эталоном аккаунта…';
        });
        if (!mounted) return;
        await _onGatePrimary(st);
        return;
      case AttendanceGateStepKind.workplace:
        final path = await _pickCameraPhoto(maxWidth: 1280, quality: 78);
        if (path == null || !mounted) return;
        final b64 = base64Encode(await File(path).readAsBytes());
        setState(() {
          _backPhotoB64 = b64;
          _gateStepIndex = idx + 1;
          _statusBanner = 'Сверяем лицо с эталоном — только совпадение попадёт в табель';
        });
        await _gateContinueIfSubmit(st);
        return;
      case AttendanceGateStepKind.video:
        final cap = await VideoPunchFlow.captureInline(
          context,
          ref,
          maxSec: st.videoMaxSec.clamp(5, 10),
          captureMode: st.captureMode,
          dayCode: st.dayCode,
          requireBack: true,
        );
        if (cap == null || !mounted) return;
        if (cap.backBase64 == null || cap.backBase64!.isEmpty) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Нужны оба видео: фронт (с кодом) и задняя камера')),
          );
          return;
        }
        setState(() {
          _frontVideoB64 = cap.frontBase64;
          _backVideoB64 = cap.backBase64;
          _videoDurationSec = cap.durationSec;
          _videoCaptureMode = cap.captureMode;
          if (st.dayCode != null) _spokenCodeCtrl.text = '${st.dayCode}';
          _gateStepIndex = idx + 1;
          _statusBanner = 'Проверяем код и отправляем ПРИХОД…';
        });
        await _gateContinueIfSubmit(st);
        return;
      case AttendanceGateStepKind.submit:
        // Bitta asosiy usul: photo > video (tab/gate bilan bir xil).
        if (st.photoEnabled) {
          await _submitPhotoPunch(st, direction: 'IN');
        } else if (st.videoEnabled) {
          await _submitVideoPunch(st);
        } else {
          setState(() => _submitting = true);
          try {
            final ok = await FaceVerificationFlow.ensureDailyLogin(context, ref);
            if (ok && mounted) await _finishGateIfNeeded();
          } finally {
            if (mounted) setState(() => _submitting = false);
          }
        }
        return;
    }
  }

  Future<void> _runLiveness(MobileAttendanceState st) async {
    final live = await withAppLockSuppressed(ref, () {
      return LivenessLiveScreen.open(
        context,
        directions: st.livenessDirections,
        presetSequence: _livenessSequence.isEmpty ? null : _livenessSequence,
      );
    });
    if (live == null || !mounted) return;
    setState(() {
      _completedLiveness = live.steps;
      _frontPhotoB64 = live.selfieBase64;
      _livenessSequence = live.steps;
      _statusBanner = 'Liveness пройден (${live.steps.length}/${st.livenessDirections})';
    });
  }

  Future<void> _runDualCapture() async {
    final res = await DualCapture.run(
      context,
      ref,
      livenessSelfieBase64: _frontPhotoB64,
    );
    if (res == null || !mounted) return;
    setState(() {
      _backPhotoB64 = res.backBase64;
      _frontPhotoB64 = res.frontBase64;
      _statusBanner = 'Двойная съёмка готова (задняя + фронт)';
    });
  }

  Future<void> _runVideoCapture(MobileAttendanceState st) async {
    final res = await VideoPunchFlow.run(context, ref, st: st);
    if (res == null || !mounted) return;
    setState(() {
      _frontVideoB64 = res.frontBase64;
      _backVideoB64 = res.backBase64;
      _videoDurationSec = res.durationSec;
      _videoCaptureMode = res.captureMode;
      if (st.dayCode != null) _spokenCodeCtrl.text = '${st.dayCode}';
      _statusBanner = 'Видео записано (${res.durationSec} с)';
    });
  }

  Future<bool> _ensureFace(MobileAttendanceState st) async {
    if (st.faceEnrolled) return true;
    if (!mounted) return false;
    final ok = await FaceVerificationFlow.ensureReference(
      context,
      ref,
      title: 'Сначала загрузите эталонное фото лица',
    );
    if (ok) ref.invalidate(mobileAttendanceStateProvider);
    return ok;
  }

  Future<void> _submitPhotoPunch(
    MobileAttendanceState st, {
    required String direction,
  }) async {
    if (!st.photoEnabled) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Фото-отметка для вашей роли отключена')),
      );
      return;
    }
    final expected = st.todayPunches.isEmpty ? 'IN' : 'OUT';
    if (direction != expected) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            expected == 'IN'
                ? 'Сейчас доступен только ПРИХОД'
                : 'Сейчас доступен только УХОД',
          ),
        ),
      );
      return;
    }
    // Jonli challenge 3–4 qadam; server `liveness_directions` pool hajmi.
    if (_completedLiveness.isEmpty || _frontPhotoB64 == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Пройдите проверку живости (камера)')),
      );
      return;
    }
    if (!await _ensureFace(st)) return;
    if (!mounted) return;
    if (st.requireDualCamera && _backPhotoB64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Сделайте снимок рабочего места (задняя камера)')),
      );
      return;
    }
    setState(() {
      _submitting = true;
      _statusBanner = 'Определяем GPS…';
      _gateFaceResult = null;
    });
    try {
      final pos = await _acquireGuardedPosition(st.maxGpsAccuracyM).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw LocationGuardException(
          'GPS слишком долго отвечает — проверьте геолокацию и попробуйте снова.',
        ),
      );
      if (mounted) {
        setState(() => _statusBanner = 'Сверяем лицо с эталоном аккаунта…');
      }
      var frontB64 = _frontPhotoB64!;
      try {
        final shrunk = await faceMatchSelfie(base64Decode(frontB64));
        frontB64 = base64Encode(shrunk);
      } catch (_) {}
      final raw = await ref.read(attendanceApiProvider).submitPhotoPunch(
            lat: pos.latitude,
            lng: pos.longitude,
            accuracyM: pos.accuracy,
            isMockLocation: pos.isMocked,
            livenessSteps: _completedLiveness,
            photoFrontBase64: frontB64,
            photoBackBase64: _backPhotoB64,
            comment: _commentCtrl.text,
            direction: direction,
          );
      final face = parsePunchFaceResult(raw);
      ref.invalidate(mobileAttendanceStateProvider);
      if (!mounted) return;
      if (widget.gateMode && direction == 'IN') {
        setState(() {
          _gateFaceResult = face;
          _statusBanner = null;
        });
        // Mos keldi — darhol ilovaga; qayta urinish tugmasi mismatch da qoladi.
        if (face.matched) {
          await Future<void>.delayed(const Duration(milliseconds: 900));
          if (mounted) await _finishGateIfNeeded();
        }
      } else {
        setState(() => _statusBanner = face.detailRu);
        await _showFaceResultDialog(face);
      }
    } catch (e) {
      if (isFaceMismatchError(e)) {
        final face = faceMismatchFromError(e);
        if (mounted) {
          if (widget.gateMode) {
            setState(() {
              _gateFaceResult = face;
              _statusBanner = null;
            });
          } else {
            setState(() => _statusBanner = face.detailRu);
            await _showFaceResultDialog(face);
          }
        }
      } else {
        await _enqueueFailed('photo', st, e);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _showFaceResultDialog(PunchFaceResult face) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(face.titleRu),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              face.matched ? Icons.verified_rounded : Icons.face_retouching_off,
              size: 48,
              color: face.matched ? AppColors.success : AppColors.error,
            ),
            const SizedBox(height: 12),
            Text(face.detailRu),
            if (face.scorePercent != null) ...[
              const SizedBox(height: 8),
              Text(
                '${face.scorePercent!.toStringAsFixed(0)}%',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: face.matched ? AppColors.success : AppColors.error,
                ),
              ),
            ],
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(face.matched ? 'OK' : 'Понятно'),
          ),
        ],
      ),
    );
  }

  void _retryGateFace() {
    setState(() {
      _gateFaceResult = null;
      _gateStepIndex = 0;
      _completedLiveness = [];
      _frontPhotoB64 = null;
      _backPhotoB64 = null;
      _frontVideoB64 = null;
      _backVideoB64 = null;
      _statusBanner = null;
    });
  }

  Future<void> _submitVideoPunch(MobileAttendanceState st) async {
    if (!st.videoEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Видео-отметка отключена в настройках')),
      );
      return;
    }
    if (st.videoCodeRequired &&
        (int.tryParse(_spokenCodeCtrl.text.trim()) ?? 0) != (st.dayCode ?? -1)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Введите сегодняшний 3-значный код')),
      );
      return;
    }
    final code = int.tryParse(_spokenCodeCtrl.text.trim()) ?? st.dayCode ?? 0;
    if (_frontVideoB64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Запишите видео с фронтальной камеры (5–10 сек)')),
      );
      return;
    }
    setState(() {
      _submitting = true;
      _statusBanner = 'Определяем GPS…';
    });
    try {
      final pos = await _acquireGuardedPosition(st.maxGpsAccuracyM).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw LocationGuardException(
          'GPS слишком долго отвечает — проверьте геолокацию и попробуйте снова.',
        ),
      );
      await ref.read(attendanceApiProvider).submitVideoPunch(
            lat: pos.latitude,
            lng: pos.longitude,
            accuracyM: pos.accuracy,
            isMockLocation: pos.isMocked,
            durationSec: _videoDurationSec ?? st.videoMaxSec,
            spokenCode: code,
            captureMode: _videoCaptureMode,
            videoFrontBase64: _frontVideoB64!,
            videoBackBase64: _backVideoB64,
            comment: _commentCtrl.text,
          );
      setState(() => _statusBanner = 'Видео-отметка отправлена.');
      ref.invalidate(mobileAttendanceStateProvider);
      if (widget.gateMode) {
        await _finishGateIfNeeded();
      }
    } catch (e) {
      await _enqueueFailed('video', st, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _wrapGate(Widget child) {
    final canLeave = canLeaveAttendanceGate(
      gateMode: widget.gateMode,
      dayGateCleared: _gateCleared,
    );
    return PopScope(
      canPop: canLeave,
      child: child,
    );
  }

  Widget? _gateBanner() {
    if (!widget.gateMode || _gateCleared) return null;
    return Container(
      width: double.infinity,
      color: const Color(0xFF0F766E),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: const Text(
        'Первый вход за день — отметьте ПРИХОД (Face ID). После этого приложение откроется.',
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, height: 1.3),
      ),
    );
  }

  Future<void> _enqueueFailed(String kind, MobileAttendanceState st, Object error) async {
    try {
      if (kind == 'photo' && _frontPhotoB64 != null) {
        final front = await AttendanceOfflineQueue.persistBytes(base64Decode(_frontPhotoB64!), 'jpg');
        String? back;
        if (_backPhotoB64 != null) {
          back = await AttendanceOfflineQueue.persistBytes(base64Decode(_backPhotoB64!), 'jpg');
        }
        await AttendanceOfflineQueue.enqueue({
          'kind': 'photo',
          'lat': 0,
          'lng': 0,
          'accuracy_m': st.maxGpsAccuracyM,
          'is_mock_location': false,
          'liveness_steps': _completedLiveness,
          'photo_front_path': front,
          'photo_back_path': back,
          'comment': _commentCtrl.text,
          'client_timestamp': ServerClock.instance.bestEffortNowUtc().toIso8601String(),
        });
      } else if (kind == 'video' && _frontVideoB64 != null) {
        final front = await AttendanceOfflineQueue.persistBytes(base64Decode(_frontVideoB64!), 'mp4');
        await AttendanceOfflineQueue.enqueue({
          'kind': 'video',
          'lat': 0,
          'lng': 0,
          'accuracy_m': st.maxGpsAccuracyM,
          'is_mock_location': false,
          'duration_sec': _videoDurationSec ?? 8,
          'spoken_code': int.tryParse(_spokenCodeCtrl.text.trim()) ?? st.dayCode ?? 0,
          'capture_mode': _videoCaptureMode,
          'video_front_path': front,
          'comment': _commentCtrl.text,
        });
      }
    } catch (_) {}
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не отправлено, сохранено в очередь: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final stateAsync = ref.watch(mobileAttendanceStateProvider);
    final showBack = canLeaveAttendanceGate(
      gateMode: widget.gateMode,
      dayGateCleared: _gateCleared,
    );

    return stateAsync.when(
      loading: () => _wrapGate(Scaffold(
        backgroundColor: AppColors.background,
        appBar: AgentAppBar(title: 'Табель и Посещаемость', showBack: showBack),
        body: const Center(child: CircularProgressIndicator()),
      )),
      error: (err, _) => _wrapGate(Scaffold(
        backgroundColor: AppColors.background,
        appBar: AgentAppBar(title: 'Табель и Посещаемость', showBack: showBack),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Ошибка загрузки: $err', textAlign: TextAlign.center),
                if (widget.gateMode) ...[
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => ref.invalidate(mobileAttendanceStateProvider),
                    child: const Text('Повторить'),
                  ),
                ],
              ],
            ),
          ),
        ),
      )),
      data: (st) {
        if (!_livenessSeeded) {
          _livenessSeeded = true;
          _livenessSequence = LivenessHelper.buildSequence(st.livenessDirections);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(attendanceApiProvider).flushOfflineQueue();
          });
        }

        if (widget.gateMode) {
          return _wrapGate(Scaffold(
            backgroundColor: AppColors.background,
            appBar: AppBar(
              backgroundColor: AppColors.surface,
              foregroundColor: AppColors.textTitle,
              title: const Text('Приход · Face ID'),
              automaticallyImplyLeading: showBack,
            ),
            body: Column(
              children: [
                if (_gateBanner() != null) _gateBanner()!,
                Expanded(
                  child: (st.punchDisabled || st.terminalOnly)
                      ? _buildGateFaceOnly(st)
                      : AttendanceGatePage(
                          state: st,
                          steps: _gateStepsFor(st),
                          stepIndex: _gateStepIndex,
                          submitting: _submitting,
                          statusText: _statusBanner,
                          dayCode: st.dayCode,
                          faceResult: _gateFaceResult,
                          onPrimary: () => _onGatePrimary(st),
                          onContinueAfterResult: () {
                            if (_gateFaceResult?.matched == true) {
                              _finishGateIfNeeded();
                            }
                          },
                          onRetryAfterFail: _retryGateFace,
                        ),
                ),
              ],
            ),
          ));
        }

        if (st.punchDisabled || st.terminalOnly) {
          return _wrapGate(Scaffold(
            backgroundColor: AppColors.background,
            appBar: AgentAppBar(title: 'Табель и Посещаемость', showBack: showBack),
            body: _buildModeBlocked(st),
          ));
        }

        final tabs = st.visibleTabs();
        if (tabs.isEmpty) {
          return _wrapGate(Scaffold(
            backgroundColor: AppColors.background,
            appBar: AgentAppBar(title: 'Табель и Посещаемость', showBack: showBack),
            body: _buildModeBlocked(st),
          ));
        }
        return _wrapGate(DefaultTabController(
          key: ValueKey(tabs.map((e) => e.name).join(',')),
          length: tabs.length,
          child: Scaffold(
            backgroundColor: AppColors.background,
            appBar: AppBar(
              backgroundColor: AppColors.surface,
              foregroundColor: AppColors.textTitle,
              title: const Text('Табель и Посещаемость'),
              automaticallyImplyLeading: showBack,
              actions: const [],
              bottom: tabs.length > 1
                  ? TabBar(
                      isScrollable: true,
                      labelColor: AppColors.primary,
                      unselectedLabelColor: AppColors.textSecondary,
                      indicatorColor: AppColors.primary,
                      tabs: tabs.map(_tabFor).toList(),
                    )
                  : null,
            ),
            body: Column(
              children: [
                if (_statusBanner != null)
                  Container(
                    width: double.infinity,
                    color: AppColors.primarySoft,
                    padding: const EdgeInsets.all(10),
                    child: Text(
                      _statusBanner!,
                      style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w600),
                    ),
                  ),
                Expanded(
                  child: tabs.length == 1
                      ? _viewFor(tabs.first, st)
                      : TabBarView(
                          children: tabs.map((t) => _viewFor(t, st)).toList(),
                        ),
                ),
              ],
            ),
          ),
        ));
      },
    );
  }

  /// Terminal-only yoki punch o‘chirilgan — faqat kunlik Face selfie.
  Widget _buildGateFaceOnly(MobileAttendanceState st) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.face_retouching_natural, size: 56, color: Colors.teal.shade700),
            const SizedBox(height: 16),
            const Text(
              'Подтвердите лицо для входа в приложение',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              st.terminalOnly
                  ? 'Отметка через терминал. Для приложения — одно селфи Face ID.'
                  : 'Способ отметки отключён. Для входа подтвердите Face ID.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _submitting
                  ? null
                  : () async {
                      setState(() => _submitting = true);
                      try {
                        final ok = await FaceVerificationFlow.ensureDailyLogin(context, ref);
                        if (ok && mounted) await _finishGateIfNeeded();
                      } finally {
                        if (mounted) setState(() => _submitting = false);
                      }
                    },
              icon: const Icon(Icons.camera_alt),
              label: Text(_submitting ? 'Проверка…' : 'Открыть камеру'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoTab(MobileAttendanceState st) {
    final dirs = _livenessSequence.isEmpty
        ? LivenessHelper.buildSequence(st.livenessDirections)
        : _livenessSequence;
    final nextIsIn = st.todayPunches.isEmpty;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.schedule, color: Colors.teal),
            title: Text('Смена: ${st.shiftName} (${st.shiftStart} – ${st.shiftEnd})'),
            subtitle: Text(
              'Отметок сегодня: ${st.todayPunches.length} · Следующее: ${nextIsIn ? "ПРИХОД" : "УХОД"}',
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _PunchDirectionCard(
                title: 'ПРИХОД',
                subtitle: 'Начало смены',
                color: const Color(0xFF0F766E),
                icon: Icons.login_rounded,
                selected: nextIsIn,
                enabled: nextIsIn && !_submitting,
                onTap: () => _submitPhotoPunch(st, direction: 'IN'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _PunchDirectionCard(
                title: 'УХОД',
                subtitle: 'Конец смены',
                color: const Color(0xFFB45309),
                icon: Icons.logout_rounded,
                selected: !nextIsIn,
                enabled: !nextIsIn && !_submitting,
                onTap: () => _submitPhotoPunch(st, direction: 'OUT'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          '1. Проверка живости лица (${st.livenessDirections} поворота + селфи):',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: dirs
              .map((d) => Chip(
                    label: Text(LivenessHelper.labelsRu[d] ?? d, style: const TextStyle(fontSize: 11)),
                    backgroundColor: _completedLiveness.contains(d) ? Colors.teal.shade100 : null,
                  ))
              .toList(),
        ),
        FilledButton.tonalIcon(
          onPressed: () => _runLiveness(st),
          icon: const Icon(Icons.face_retouching_natural),
          label: Text(_completedLiveness.length >= st.livenessDirections
              ? 'Liveness OK — повторить'
              : 'Начать liveness (${_completedLiveness.length}/${st.livenessDirections})'),
        ),
        const SizedBox(height: 12),
        Text(
          '2. Двойная съёмка (задняя + фронт):',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        OutlinedButton.icon(
          onPressed: _runDualCapture,
          icon: const Icon(Icons.cameraswitch),
          label: Text(
            _backPhotoB64 != null && _frontPhotoB64 != null
                ? 'Двойная съёмка: OK'
                : 'Снять объект + селфи',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _commentCtrl,
          decoration: const InputDecoration(
            labelText: 'Комментарий (обязателен вне гео-зоны)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          nextIsIn
              ? 'Сначала пройдите шаги выше, затем нажмите зелёную кнопку ПРИХОД.'
              : 'Сначала пройдите шаги выше, затем нажмите оранжевую кнопку УХОД.',
          style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildVideoTab(MobileAttendanceState st) {
    if (!st.videoEnabled) {
      return const Center(child: Text('Видео-отметка отключена администратором.'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: Colors.indigo.shade50,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('Ваш дневной 3-значный код (произнесите на видео):'),
                const SizedBox(height: 6),
                Text(
                  '${st.dayCode ?? "---"}',
                  style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 6),
                ),
                Text('Длительность: ${st.videoMinSec}–${st.videoMaxSec} сек · Режим: ${st.captureMode}'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _spokenCodeCtrl,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Подтвердите 3-значный код (${st.dayCode ?? ""})',
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _runVideoCapture(st),
          icon: const Icon(Icons.videocam),
          label: Text(
            _frontVideoB64 != null
                ? 'Видео готово${_backVideoB64 != null ? " (фронт+зад)" : " (фронт)"} — перезаписать'
                : 'Записать видео (фронт → задняя)',
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _submitting ? null : () => _submitVideoPunch(st),
          icon: const Icon(Icons.send),
          label: Text(
            st.todayPunches.isEmpty
                ? 'Отправить видео · ПРИХОД'
                : 'Отправить видео · УХОД',
          ),
        ),
      ],
    );
  }

  Widget _buildKioskTab(MobileAttendanceState st) {
    if (!st.kioskAllowed) {
      return const Center(child: Text('Киоск доступен только руководителю.'));
    }
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref.read(attendanceApiProvider).fetchKioskTeam(),
      builder: (ctx, snap) {
        final members = snap.data ?? const [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Бригадный Киоск (отметка сотрудников руководителем по Face ID):',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: _selectedKioskUserId,
              items: members
                  .map((m) => DropdownMenuItem<int>(
                        value: (m['id'] as num).toInt(),
                        child: Text('${m['fio']}'),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selectedKioskUserId = v),
              decoration: const InputDecoration(
                labelText: 'Выберите сотрудника бригады',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () async {
                final path = await withAppLockSuppressed(ref, () async {
                  final x = await _picker.pickImage(
                    source: ImageSource.camera,
                    maxWidth: 960,
                    imageQuality: 78,
                  );
                  return x?.path;
                });
                if (path == null) return;
                var bytes = await File(path).readAsBytes();
                try {
                  final stamp =
                      '${st.todayYmd}\n${ServerClock.instance.bestEffortNowUtc().toIso8601String()}';
                  bytes = await stampedFacePhoto(bytes: bytes, stamp: stamp);
                } catch (_) {}
                setState(() => _frontPhotoB64 = base64Encode(bytes));
              },
              icon: const Icon(Icons.camera_alt),
              label: Text(_frontPhotoB64 != null ? 'Лицо сотрудника снято' : 'Сфотографировать сотрудника'),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: (_selectedKioskUserId == null || _frontPhotoB64 == null || _submitting)
                  ? null
                  : () async {
                      setState(() => _submitting = true);
                      try {
                        final pos = await _acquireGuardedPosition(st.maxGpsAccuracyM);
                        await ref.read(attendanceApiProvider).submitKioskPunch(
                              targetUserId: _selectedKioskUserId!,
                              lat: pos.latitude,
                              lng: pos.longitude,
                              accuracyM: pos.accuracy,
                              photoFrontBase64: _frontPhotoB64!,
                            );
                        setState(() => _statusBanner = 'Киоск-отметка принята.');
                        ref.invalidate(mobileAttendanceStateProvider);
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                        }
                      } finally {
                        if (mounted) setState(() => _submitting = false);
                      }
                    },
              icon: const Icon(Icons.how_to_reg),
              label: const Text('Отметить выбранного сотрудника'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildRequestsTab(MobileAttendanceState st) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref.read(attendanceApiProvider).fetchMyRequests(),
      builder: (ctx, snap) {
        final rows = snap.data ?? const [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              value: _reqType,
              items: const [
                DropdownMenuItem(value: 'vacation', child: Text('Отпуск')),
                DropdownMenuItem(value: 'sick', child: Text('Больничный')),
                DropdownMenuItem(value: 'trip', child: Text('Командировка')),
                DropdownMenuItem(value: 'overtime', child: Text('Сверхурочные')),
              ],
              onChanged: (v) => setState(() => _reqType = v ?? 'vacation'),
              decoration: const InputDecoration(labelText: 'Тип заявки', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(labelText: 'Причина', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _submitting
                  ? null
                  : () async {
                      setState(() => _submitting = true);
                      try {
                        final today = st.todayYmd;
                        await ref.read(attendanceApiProvider).createMyRequest(
                              type: _reqType,
                              fromDate: today,
                              toDate: today,
                              reason: _reasonCtrl.text,
                            );
                        setState(() => _statusBanner = 'Заявка отправлена.');
                        ref.invalidate(mobileAttendanceStateProvider);
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                        }
                      } finally {
                        if (mounted) setState(() => _submitting = false);
                      }
                    },
              child: const Text('Отправить заявку'),
            ),
            const Divider(height: 32),
            const Text('Мои заявки', style: TextStyle(fontWeight: FontWeight.bold)),
            ...rows.map(
              (r) => ListTile(
                dense: true,
                title: Text('${r['type'] ?? ''} · ${r['status'] ?? ''}'),
                subtitle: Text('${r['from_date'] ?? ''} → ${r['to_date'] ?? ''}'),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _PunchDirectionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color color;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  const _PunchDirectionCard({
    required this.title,
    required this.subtitle,
    required this.color,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bg = selected ? color : color.withValues(alpha: 0.12);
    final fg = selected ? Colors.white : color;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(
            children: [
              Icon(icon, size: 36, color: fg),
              const SizedBox(height: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: fg,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: selected ? Colors.white70 : color.withValues(alpha: 0.8),
                ),
              ),
              if (selected) ...[
                const SizedBox(height: 8),
                Text(
                  'Сейчас',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

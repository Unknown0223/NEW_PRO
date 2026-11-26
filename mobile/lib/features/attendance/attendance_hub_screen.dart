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
import '../../core/ui/agent_ui_extended.dart';
import '../auth/auth_provider.dart';
import '../expeditor/shared/tezyuk_expeditor_chrome.dart';
import 'attendance_api_service.dart';
import 'attendance_gate_page.dart';
import 'attendance_gate_steps.dart';
import 'attendance_hub_chrome.dart';
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
        return Tab(
          icon: const Icon(Icons.camera_front, size: 20),
          text: expeditorLabel('Фото + Face ID', 'Foto + Face ID'),
        );
      case AttendanceMethodTab.video:
        return Tab(
          icon: const Icon(Icons.videocam, size: 20),
          text: expeditorLabel('Видео + 3-код', 'Video + 3-kod'),
        );
      case AttendanceMethodTab.kiosk:
        return Tab(
          icon: const Icon(Icons.groups, size: 20),
          text: expeditorLabel('Киоск бригады', 'Brigada kioski'),
        );
      case AttendanceMethodTab.requests:
        return Tab(
          icon: const Icon(Icons.event_note, size: 20),
          text: expeditorLabel('Заявки', 'Arizalar'),
        );
    }
  }

  PreferredSizeWidget _hubAppBar({
    required bool showBack,
    String? shiftSubtitle,
    String? badge,
    PreferredSizeWidget? bottom,
  }) {
    return StitchAttendanceAppBar(
      title: attendanceHubTitle(),
      subtitle: shiftSubtitle,
      showBack: showBack,
      badgeLabel: badge,
      bottom: bottom,
    );
  }

  String? _statusBadgeFor(MobileAttendanceState st) {
    final hasIn = attendanceHasValidIn(st.todayPunches);
    if (!hasIn) return null;
    final out = attendancePunchClockLabel(st.todayPunches, direction: 'OUT');
    if (out != '—') return null;
    return expeditorLabel('На смене', 'Ishda');
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
              color: attendanceBrandPrimary(),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: attendanceOnSurface(),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(color: attendanceOnSurfaceVariant()),
            ),
            const SizedBox(height: 16),
            Text(
              '${expeditorLabel('Смена', 'Smena')}: ${st.shiftName} (${st.shiftStart} – ${st.shiftEnd})',
              style: TextStyle(
                fontSize: 13,
                color: attendanceOnSurfaceVariant(),
              ),
            ),
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
    if (!mounted) return;
    // clearGate + go birga — orada router refresh (Duplicate GlobalKeys) bo‘lmasin.
    ref.read(faceGateRequiredProvider.notifier).clearGate();
    context.go('/home');
  }

  /// Qabul qilingan PRIHOD: markazda galochka → asosiy sahifa.
  Future<void> _showGateAcceptedAndEnter([PunchFaceResult? face]) async {
    if (!widget.gateMode || !mounted) return;
    setState(() {
      _gateFaceResult = face ?? PunchFaceResult.acceptedIn;
      _statusBanner = null;
      _submitting = false;
      _gateCleared = true;
    });
    await Future<void>.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;
    // Avval clearGate qilib 1.4s kutish — Shell qayta mount / Duplicate GlobalKeys.
    ref.read(faceGateRequiredProvider.notifier).clearGate();
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
    // Gate: PRIHOD allaqachon tabelda — galochka + home (3/3 da qotib qolmasin).
    if (widget.gateMode && direction == 'IN' && attendanceHasValidIn(st.todayPunches)) {
      await _showGateAcceptedAndEnter();
      return;
    }
    final expected = st.todayPunches.isEmpty || !attendanceHasValidIn(st.todayPunches)
        ? 'IN'
        : 'OUT';
    if (direction != expected) {
      if (!mounted) return;
      if (widget.gateMode && direction == 'IN' && expected == 'OUT') {
        await _showGateAcceptedAndEnter();
        return;
      }
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
        if (face.matched) {
          await _showGateAcceptedAndEnter(face);
        } else {
          setState(() {
            _gateFaceResult = face;
            _statusBanner = null;
            _submitting = false;
          });
        }
        return;
      }
      setState(() => _statusBanner = face.detailRu);
      await _showFaceResultDialog(face);
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
        if (widget.gateMode && mounted) {
          ref.invalidate(mobileAttendanceStateProvider);
          try {
            final fresh = await ref.read(mobileAttendanceStateProvider.future);
            if (attendanceHasValidIn(fresh.todayPunches)) {
              await _showGateAcceptedAndEnter();
              return;
            }
          } catch (_) {}
          setState(() => _statusBanner = 'Ошибка отправки: $e');
        }
      }
    } finally {
      if (mounted && _gateFaceResult == null) setState(() => _submitting = false);
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
        await _showGateAcceptedAndEnter(
          const PunchFaceResult(
            matched: true,
            titleRu: 'ПРИХОД принят',
            detailRu: 'Видео-отметка в табеле. Открываем приложение…',
          ),
        );
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
        backgroundColor: attendancePageBg(),
        appBar: _hubAppBar(showBack: showBack),
        body: const Center(child: CircularProgressIndicator()),
      )),
      error: (err, _) => _wrapGate(Scaffold(
        backgroundColor: attendancePageBg(),
        appBar: _hubAppBar(showBack: showBack),
        body: AgentErrorPanel(
          error: err,
          onRetry: () => ref.invalidate(mobileAttendanceStateProvider),
          onLogin: () => ref.read(authStateProvider.notifier).logout(),
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

        final shiftSub =
            '${expeditorLabel('Смена', 'Smena')}: ${st.shiftStart}–${st.shiftEnd}';

        if (widget.gateMode) {
          return _wrapGate(Scaffold(
            backgroundColor: attendancePageBg(),
            appBar: StitchAttendanceAppBar(
              title: expeditorLabel('Приход · Face ID', 'Kelish · Face ID'),
              subtitle: shiftSub,
              showBack: showBack,
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
            backgroundColor: attendancePageBg(),
            appBar: _hubAppBar(
              showBack: showBack,
              shiftSubtitle: shiftSub,
            ),
            body: _buildModeBlocked(st),
          ));
        }

        final tabs = st.visibleTabs();
        if (tabs.isEmpty) {
          return _wrapGate(Scaffold(
            backgroundColor: attendancePageBg(),
            appBar: _hubAppBar(
              showBack: showBack,
              shiftSubtitle: shiftSub,
            ),
            body: _buildModeBlocked(st),
          ));
        }
        return _wrapGate(DefaultTabController(
          key: ValueKey(tabs.map((e) => e.name).join(',')),
          length: tabs.length,
          child: Scaffold(
            backgroundColor: attendancePageBg(),
            appBar: _hubAppBar(
              showBack: showBack,
              shiftSubtitle: shiftSub,
              badge: _statusBadgeFor(st),
              bottom: tabs.length > 1
                  ? attendanceStitchTabBar(tabs: tabs.map(_tabFor).toList())
                  : null,
            ),
            body: Column(
              children: [
                if (_statusBanner != null)
                  Container(
                    width: double.infinity,
                    color: AppColors.primarySoft,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    child: Text(
                      _statusBanner!,
                      style: TextStyle(
                        color: attendanceBrandPrimaryContainer(),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
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
            Icon(
              Icons.face_retouching_natural,
              size: 56,
              color: attendanceBrandPrimary(),
            ),
            const SizedBox(height: 16),
            Text(
              expeditorLabel(
                'Подтвердите лицо для входа в приложение',
                'Ilovaga kirish uchun yuzni tasdiqlang',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: attendanceOnSurface(),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              st.terminalOnly
                  ? expeditorLabel(
                      'Отметка через терминал. Для приложения — одно селфи Face ID.',
                      'Belgi terminal orqali. Ilova uchun bitta Face ID selfi.',
                    )
                  : expeditorLabel(
                      'Способ отметки отключён. Для входа подтвердите Face ID.',
                      'Belgi usuli o\'chirilgan. Kirish uchun Face ID tasdiqlang.',
                    ),
              textAlign: TextAlign.center,
              style: TextStyle(color: attendanceOnSurfaceVariant()),
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
              style: attendancePrimaryButtonStyle(),
              icon: const Icon(Icons.camera_alt),
              label: Text(
                _submitting
                    ? expeditorLabel('Проверка…', 'Tekshiruv…')
                    : expeditorLabel('Открыть камеру', 'Kamerani ochish'),
              ),
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
    final livenessDone = _completedLiveness.length >= st.livenessDirections;
    final dualDone = _backPhotoB64 != null && _frontPhotoB64 != null;
    final inColor = attendanceBrandPrimary();
    const outColor = Color(0xFFB45309);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        AttendanceShiftHero(
          shiftName: st.shiftName,
          shiftStart: st.shiftStart,
          shiftEnd: st.shiftEnd,
          marksToday: st.todayPunches.length,
          nextIsIn: nextIsIn,
          inTimeLabel:
              attendancePunchClockLabel(st.todayPunches, direction: 'IN'),
          outTimeLabel:
              attendancePunchClockLabel(st.todayPunches, direction: 'OUT'),
        ),
        const SizedBox(height: 16),
        AttendanceSectionCard(
          title: expeditorLabel('Дневная отметка', 'Kunlik otmetka'),
          subtitle: expeditorLabel(
            'Face ID + GPS проверка',
            'Face ID + GPS tekshiruvi',
          ),
          badge: 'Face ID',
          child: Row(
            children: [
              Expanded(
                child: AttendancePunchDirectionCard(
                  title: expeditorLabel('ПРИХОД', 'KELISH'),
                  subtitle: expeditorLabel('Начало смены', 'Smena boshi'),
                  color: inColor,
                  icon: Icons.login_rounded,
                  selected: nextIsIn,
                  enabled: nextIsIn && !_submitting,
                  onTap: () => _submitPhotoPunch(st, direction: 'IN'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AttendancePunchDirectionCard(
                  title: expeditorLabel('УХОД', 'KETISH'),
                  subtitle: expeditorLabel('Конец смены', 'Smena oxiri'),
                  color: outColor,
                  icon: Icons.logout_rounded,
                  selected: !nextIsIn,
                  enabled: !nextIsIn && !_submitting,
                  onTap: () => _submitPhotoPunch(st, direction: 'OUT'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AttendanceSectionCard(
          title: expeditorLabel(
            '1. Проверка живости (${st.livenessDirections} поворота + селфи)',
            '1. Liveness (${st.livenessDirections} burilish + selfi)',
          ),
          badge: livenessDone ? 'OK' : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: dirs
                    .map(
                      (d) => AttendanceLivenessChip(
                        label: LivenessHelper.labelsRu[d] ?? d,
                        done: _completedLiveness.contains(d),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => _runLiveness(st),
                style: attendancePrimaryButtonStyle(),
                icon: const Icon(Icons.face_retouching_natural, size: 20),
                label: Text(
                  livenessDone
                      ? expeditorLabel(
                          'Liveness OK — повторить',
                          'Liveness OK — qayta',
                        )
                      : expeditorLabel(
                          'Начать liveness (${_completedLiveness.length}/${st.livenessDirections})',
                          'Liveness boshlash (${_completedLiveness.length}/${st.livenessDirections})',
                        ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AttendanceSectionCard(
          title: expeditorLabel(
            '2. Двойная съёмка (задняя + фронт)',
            '2. Ikki kamera (orqa + front)',
          ),
          badge: dualDone ? 'OK' : null,
          child: OutlinedButton.icon(
            onPressed: _runDualCapture,
            style: attendanceSecondaryButtonStyle(),
            icon: const Icon(Icons.cameraswitch, size: 20),
            label: Text(
              dualDone
                  ? expeditorLabel('Двойная съёмка: OK', 'Ikki surat: OK')
                  : expeditorLabel(
                      'Снять объект + селфи',
                      'Ob\'ekt + selfi olish',
                    ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _commentCtrl,
          decoration: attendanceFieldDecoration(
            label: expeditorLabel(
              'Комментарий (обязателен вне гео-зоны)',
              'Izoh (geo-zonadan tashqarida majburiy)',
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          nextIsIn
              ? expeditorLabel(
                  'Сначала пройдите шаги выше, затем нажмите зелёную кнопку ПРИХОД.',
                  'Avval yuqoridagi qadamlarni bajaring, keyin yashil KELISH tugmasini bosing.',
                )
              : expeditorLabel(
                  'Сначала пройдите шаги выше, затем нажмите оранжевую кнопку УХОД.',
                  'Avval yuqoridagi qadamlarni bajaring, keyin apelsin KETISH tugmasini bosing.',
                ),
          style: TextStyle(
            color: attendanceOnSurfaceVariant(),
            fontSize: 12,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  Widget _buildVideoTab(MobileAttendanceState st) {
    if (!st.videoEnabled) {
      return Center(
        child: Text(
          expeditorLabel(
            'Видео-отметка отключена администратором.',
            'Video belgi admin tomonidan o\'chirilgan.',
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        AttendanceSectionCard(
          title: expeditorLabel('Видео + код', 'Video + kod'),
          subtitle: expeditorLabel(
            'Произнесите дневной код на видео',
            'Bugungi kodni videoda ayting',
          ),
          badge: 'Video',
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  expeditorLabel(
                    'Ваш дневной 3-значный код:',
                    'Bugungi 3-xonali kod:',
                  ),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: attendanceOnSurfaceVariant(),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${st.dayCode ?? "---"}',
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 6,
                    color: attendanceBrandPrimary(),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                Text(
                  expeditorLabel(
                    'Длительность: ${st.videoMinSec}–${st.videoMaxSec} сек · Режим: ${st.captureMode}',
                    'Davomiylik: ${st.videoMinSec}–${st.videoMaxSec} s · Rejim: ${st.captureMode}',
                  ),
                  style: TextStyle(
                    fontSize: 12,
                    color: attendanceOnSurfaceVariant(),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _spokenCodeCtrl,
          keyboardType: TextInputType.number,
          decoration: attendanceFieldDecoration(
            label: expeditorLabel(
              'Подтвердите 3-значный код (${st.dayCode ?? ""})',
              '3-xonali kodni tasdiqlang (${st.dayCode ?? ""})',
            ),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _runVideoCapture(st),
          style: attendanceSecondaryButtonStyle(),
          icon: const Icon(Icons.videocam, size: 20),
          label: Text(
            _frontVideoB64 != null
                ? expeditorLabel(
                    'Видео готово${_backVideoB64 != null ? " (фронт+зад)" : " (фронт)"} — перезаписать',
                    'Video tayyor — qayta yozish',
                  )
                : expeditorLabel(
                    'Записать видео (фронт → задняя)',
                    'Video yozish (front → orqa)',
                  ),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _submitting ? null : () => _submitVideoPunch(st),
          style: attendancePrimaryButtonStyle(),
          icon: const Icon(Icons.send, size: 20),
          label: Text(
            st.todayPunches.isEmpty
                ? expeditorLabel(
                    'Отправить видео · ПРИХОД',
                    'Video yuborish · KELISH',
                  )
                : expeditorLabel(
                    'Отправить видео · УХОД',
                    'Video yuborish · KETISH',
                  ),
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
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            AttendanceSectionCard(
              title: expeditorLabel('Новая заявка', 'Yangi ariza'),
              subtitle: expeditorLabel(
                'Отпуск, больничный и другие типы',
                'Tatil, kasallik va boshqa turlar',
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DropdownButtonFormField<String>(
                    value: _reqType,
                    items: [
                      DropdownMenuItem(
                        value: 'vacation',
                        child: Text(expeditorLabel('Отпуск', 'Tatil')),
                      ),
                      DropdownMenuItem(
                        value: 'sick',
                        child: Text(expeditorLabel('Больничный', 'Kasallik')),
                      ),
                      DropdownMenuItem(
                        value: 'trip',
                        child: Text(
                          expeditorLabel('Командировка', 'Xizmat safari'),
                        ),
                      ),
                      DropdownMenuItem(
                        value: 'overtime',
                        child: Text(
                          expeditorLabel('Сверхурочные', 'Qo\'shimcha ish'),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _reqType = v ?? 'vacation'),
                    decoration: attendanceFieldDecoration(
                      label: expeditorLabel('Тип заявки', 'Ariza turi'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _reasonCtrl,
                    decoration: attendanceFieldDecoration(
                      label: expeditorLabel('Причина', 'Sabab'),
                    ),
                  ),
                  const SizedBox(height: 12),
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
                              setState(() => _statusBanner = expeditorLabel(
                                    'Заявка отправлена.',
                                    'Ariza yuborildi.',
                                  ));
                              ref.invalidate(mobileAttendanceStateProvider);
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context)
                                    .showSnackBar(SnackBar(content: Text('$e')));
                              }
                            } finally {
                              if (mounted) setState(() => _submitting = false);
                            }
                          },
                    style: attendancePrimaryButtonStyle(),
                    child: Text(
                      expeditorLabel('Отправить заявку', 'Arizani yuborish'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AttendanceSectionCard(
              title: expeditorLabel('Мои заявки', 'Mening arizalarim'),
              child: rows.isEmpty
                  ? Text(
                      expeditorLabel(
                        'Пока нет заявок',
                        'Hali arizalar yo\'q',
                      ),
                      style: TextStyle(color: attendanceOnSurfaceVariant()),
                    )
                  : Column(
                      children: [
                        for (var i = 0; i < rows.length; i++) ...[
                          if (i > 0)
                            Divider(height: 1, color: attendanceOutline()),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            title: Text(
                              '${rows[i]['type'] ?? ''} · ${rows[i]['status'] ?? ''}',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: attendanceOnSurface(),
                              ),
                            ),
                            subtitle: Text(
                              '${rows[i]['from_date'] ?? ''} → ${rows[i]['to_date'] ?? ''}',
                              style: TextStyle(
                                color: attendanceOnSurfaceVariant(),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
            ),
          ],
        );
      },
    );
  }
}

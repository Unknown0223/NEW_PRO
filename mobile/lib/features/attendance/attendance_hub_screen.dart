import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/face/face_verification_flow.dart';
import '../../core/security/location_guard.dart';
import '../../core/time/server_clock.dart';
import 'attendance_api_service.dart';
import 'attendance_models.dart';
import 'attendance_offline_queue.dart';
import 'dual_capture.dart';
import 'liveness_camera_flow.dart';
import 'photo_report.dart';
import 'video_punch_flow.dart';

class AttendanceHubScreen extends ConsumerStatefulWidget {
  const AttendanceHubScreen({super.key});

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
    return LocationGuard().acquire(maxAllowedAccuracyMeters: maxAcc);
  }

  Future<void> _runLiveness(MobileAttendanceState st) async {
    final res = await LivenessCameraFlow.run(
      context,
      directions: st.livenessDirections,
      presetSequence: _livenessSequence.isEmpty ? null : _livenessSequence,
    );
    if (res == null || !mounted) return;
    setState(() {
      _completedLiveness = res.steps;
      _frontPhotoB64 = res.selfieBase64;
      _statusBanner = 'Liveness пройден (${res.steps.length}/${st.livenessDirections})';
    });
  }

  Future<void> _runDualCapture() async {
    final res = await DualCapture.run(
      context,
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
    final res = await VideoPunchFlow.run(context, st: st);
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

  Future<void> _submitPhotoPunch(MobileAttendanceState st) async {
    if (!st.photoEnabled) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Фото-отметка для вашей роли отключена')),
      );
      return;
    }
    if (_completedLiveness.length < st.livenessDirections) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Пройдите проверку живости (повороты головы + селфи)')),
      );
      return;
    }
    if (!await _ensureFace(st)) return;
    if (!mounted) return;
    if (_frontPhotoB64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Сначала сделайте селфи (фронтальная камера)')),
      );
      return;
    }
    if (st.requireDualCamera && _backPhotoB64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Сделайте снимок рабочего места (задняя камера)')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final pos = await _acquireGuardedPosition(st.maxGpsAccuracyM);
      var frontB64 = _frontPhotoB64!;
      try {
        final shrunk = await faceMatchSelfie(base64Decode(frontB64));
        frontB64 = base64Encode(shrunk);
      } catch (_) {}
      await ref.read(attendanceApiProvider).submitPhotoPunch(
            lat: pos.latitude,
            lng: pos.longitude,
            accuracyM: pos.accuracy,
            isMockLocation: pos.isMocked,
            livenessSteps: _completedLiveness,
            photoFrontBase64: frontB64,
            photoBackBase64: _backPhotoB64,
            comment: _commentCtrl.text,
          );
      setState(() => _statusBanner = 'Фото-отметка принята сервером.');
      ref.invalidate(mobileAttendanceStateProvider);
    } catch (e) {
      await _enqueueFailed('photo', st, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
    setState(() => _submitting = true);
    try {
      final pos = await _acquireGuardedPosition(st.maxGpsAccuracyM);
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
    } catch (e) {
      await _enqueueFailed('video', st, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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

    return stateAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Табель и Посещаемость')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (err, _) => Scaffold(
        appBar: AppBar(title: const Text('Табель и Посещаемость')),
        body: Center(child: Text('Ошибка загрузки: $err')),
      ),
      data: (st) {
        if (!_livenessSeeded) {
          _livenessSeeded = true;
          _livenessSequence = LivenessHelper.buildSequence(st.livenessDirections);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(attendanceApiProvider).flushOfflineQueue();
          });
        }

        if (st.punchDisabled || st.terminalOnly) {
          return Scaffold(
            appBar: AppBar(title: const Text('Табель и Посещаемость')),
            body: Column(
              children: [
                if (_statusBanner != null)
                  Container(
                    width: double.infinity,
                    color: Colors.teal.shade50,
                    padding: const EdgeInsets.all(10),
                    child: Text(
                      _statusBanner!,
                      style: TextStyle(color: Colors.teal.shade900, fontWeight: FontWeight.w600),
                    ),
                  ),
                Expanded(child: _buildModeBlocked(st)),
              ],
            ),
          );
        }

        final tabs = st.visibleTabs;
        return DefaultTabController(
          key: ValueKey(tabs.map((e) => e.name).join(',')),
          length: tabs.length,
          child: Scaffold(
            appBar: AppBar(
              title: const Text('Табель и Посещаемость'),
              bottom: TabBar(
                isScrollable: true,
                tabs: tabs.map(_tabFor).toList(),
              ),
            ),
            body: Column(
              children: [
                if (_statusBanner != null)
                  Container(
                    width: double.infinity,
                    color: Colors.teal.shade50,
                    padding: const EdgeInsets.all(10),
                    child: Text(
                      _statusBanner!,
                      style: TextStyle(color: Colors.teal.shade900, fontWeight: FontWeight.w600),
                    ),
                  ),
                Expanded(
                  child: TabBarView(
                    children: tabs.map((t) => _viewFor(t, st)).toList(),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPhotoTab(MobileAttendanceState st) {
    final dirs = _livenessSequence.isEmpty
        ? LivenessHelper.buildSequence(st.livenessDirections)
        : _livenessSequence;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.schedule, color: Colors.teal),
            title: Text('Смена: ${st.shiftName} (${st.shiftStart} – ${st.shiftEnd})'),
            subtitle: Text('Отметок сегодня: ${st.todayPunches.length} · Liveness: ${st.livenessDirections} напр.'),
          ),
        ),
        const SizedBox(height: 12),
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
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _submitting ? null : () => _submitPhotoPunch(st),
          icon: const Icon(Icons.verified_user),
          label: Text(st.todayPunches.isEmpty ? 'Отметить ПРИХОД' : 'Отметить УХОД'),
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
          label: const Text('Отправить видео-отметку в Табель и Telegram'),
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
                final x = await _picker.pickImage(
                  source: ImageSource.camera,
                  preferredCameraDevice: CameraDevice.front,
                  maxWidth: 960,
                  imageQuality: 78,
                );
                if (x == null) return;
                var bytes = await x.readAsBytes();
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

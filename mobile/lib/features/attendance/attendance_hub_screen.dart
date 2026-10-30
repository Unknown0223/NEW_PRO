import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/face/face_verification_flow.dart';
import 'attendance_api_service.dart';
import 'attendance_models.dart';
import 'attendance_offline_queue.dart';

class AttendanceHubScreen extends ConsumerStatefulWidget {
  const AttendanceHubScreen({super.key});

  @override
  ConsumerState<AttendanceHubScreen> createState() => _AttendanceHubScreenState();
}

class _AttendanceHubScreenState extends ConsumerState<AttendanceHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
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
  int? _selectedKioskUserId;
  String _reqType = 'vacation';
  bool _submitting = false;
  String? _statusBanner;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _commentCtrl.dispose();
    _spokenCodeCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<Position> _acquireGuardedPosition(double maxAcc) async {
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
    final guard = LocationIntegrityGuard(
      isMocked: pos.isMocked,
      accuracyMeters: pos.accuracy,
      maxAllowedAccuracyMeters: maxAcc,
      clientUtc: DateTime.now().toUtc(),
    );
    final err = guard.validate();
    if (err != null) throw Exception(err);
    return pos;
  }

  Future<void> _capturePhoto({required bool front}) async {
    final xfile = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: front ? CameraDevice.front : CameraDevice.rear,
      maxWidth: 960,
      imageQuality: 72,
    );
    if (xfile == null) return;
    final bytes = await xfile.readAsBytes();
    final b64 = base64Encode(bytes);
    setState(() {
      if (front) {
        _frontPhotoB64 = b64;
      } else {
        _backPhotoB64 = b64;
      }
    });
  }

  Future<void> _captureVideo({required bool front}) async {
    final xfile = await _picker.pickVideo(
      source: ImageSource.camera,
      preferredCameraDevice: front ? CameraDevice.front : CameraDevice.rear,
      maxDuration: const Duration(seconds: 10),
    );
    if (xfile == null) return;
    final bytes = await xfile.readAsBytes();
    final b64 = base64Encode(bytes);
    setState(() {
      if (front) {
        _frontVideoB64 = b64;
      } else {
        _backVideoB64 = b64;
      }
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
    if (_completedLiveness.length < st.livenessDirections) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Пройдите проверку живости (повороты головы)')),
      );
      return;
    }
    if (!await _ensureFace(st)) return;
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
      await ref.read(attendanceApiProvider).submitPhotoPunch(
            lat: pos.latitude,
            lng: pos.longitude,
            accuracyM: pos.accuracy,
            isMockLocation: pos.isMocked,
            livenessSteps: _completedLiveness,
            photoFrontBase64: _frontPhotoB64!,
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
            durationSec: 8,
            spokenCode: code,
            captureMode: st.captureMode,
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
          'client_timestamp': DateTime.now().toUtc().toIso8601String(),
        });
      } else if (kind == 'video' && _frontVideoB64 != null) {
        final front = await AttendanceOfflineQueue.persistBytes(base64Decode(_frontVideoB64!), 'mp4');
        await AttendanceOfflineQueue.enqueue({
          'kind': 'video',
          'lat': 0,
          'lng': 0,
          'accuracy_m': st.maxGpsAccuracyM,
          'is_mock_location': false,
          'duration_sec': 8,
          'spoken_code': int.tryParse(_spokenCodeCtrl.text.trim()) ?? st.dayCode ?? 0,
          'capture_mode': st.captureMode,
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Табель и Посещаемость'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.camera_front), text: 'Фото + Face ID'),
            Tab(icon: Icon(Icons.videocam), text: 'Видео + 3-код'),
            Tab(icon: Icon(Icons.groups), text: 'Киоск бригады'),
            Tab(icon: Icon(Icons.event_note), text: 'Заявки'),
          ],
        ),
      ),
      body: stateAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Ошибка загрузки: $err')),
        data: (st) {
          if (!_livenessSeeded) {
            _livenessSeeded = true;
            _livenessSequence = LivenessHelper.buildSequence(st.livenessDirections);
            WidgetsBinding.instance.addPostFrameCallback((_) {
              ref.read(attendanceApiProvider).flushOfflineQueue();
            });
          }
          return Column(
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
                controller: _tabs,
                children: [
                  _buildPhotoTab(st),
                  _buildVideoTab(st),
                  _buildKioskTab(st),
                  _buildRequestsTab(st),
                ],
              ),
            ),
          ],
        );
        },
      ),
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
          '1. Проверка живости лица (${st.livenessDirections} поворота головы):',
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
        OutlinedButton.icon(
          onPressed: () {
            final next = dirs.where((d) => !_completedLiveness.contains(d)).toList();
            if (next.isEmpty) return;
            setState(() => _completedLiveness = [..._completedLiveness, next.first]);
          },
          icon: const Icon(Icons.face_retouching_natural),
          label: Text(_completedLiveness.length >= st.livenessDirections
              ? 'Liveness подтверждён (${_completedLiveness.length}/${st.livenessDirections})'
              : 'Следующий поворот (${_completedLiveness.length}/${st.livenessDirections})'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _capturePhoto(front: true),
                icon: const Icon(Icons.camera_front),
                label: Text(_frontPhotoB64 != null ? 'Фронт: OK' : '1. Селфи (Фронт)'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _capturePhoto(front: false),
                icon: const Icon(Icons.camera_rear),
                label: Text(_backPhotoB64 != null ? 'Задняя: OK' : '2. Объект (Задняя)'),
              ),
            ),
          ],
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
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _captureVideo(front: true),
                icon: const Icon(Icons.videocam),
                label: Text(_frontVideoB64 != null ? 'Фронт видео: OK' : 'Видео (Фронт)'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _captureVideo(front: false),
                icon: const Icon(Icons.switch_video),
                label: Text(_backVideoB64 != null ? 'Задняя видео: OK' : 'Видео (Задняя)'),
              ),
            ),
          ],
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
                        child: Text('${m['fio']} (${m['role']})'),
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
              onPressed: () => _capturePhoto(front: true),
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
                        setState(() => _statusBanner = 'Сотрудник отмечен через Киоск.');
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка киоска: $e')));
                        }
                      } finally {
                        if (mounted) setState(() => _submitting = false);
                      }
                    },
              icon: const Icon(Icons.how_to_reg),
              label: const Text('Подтвердить отметку через Киоск'),
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
        final items = snap.data ?? const [];
        return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (items.isNotEmpty) ...[
          const Text('Мои заявки', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...items.take(8).map((it) => ListTile(
                dense: true,
                title: Text('${it['type'] ?? ''} · ${it['status'] ?? ''}'),
                subtitle: Text('${it['from_date'] ?? ''} — ${it['to_date'] ?? ''}'),
              )),
          const Divider(),
        ],
        const Text(
          'Подать заявку (Отпуск, Больничный, Командировка, Сверхурочные):',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _reqType,
          items: const [
            DropdownMenuItem(value: 'vacation', child: Text('Ежегодный отпуск')),
            DropdownMenuItem(value: 'sick', child: Text('Больничный лист')),
            DropdownMenuItem(value: 'trip', child: Text('Командировка')),
            DropdownMenuItem(value: 'overtime', child: Text('Сверхурочная работа')),
          ],
          onChanged: (v) => setState(() => _reqType = v ?? 'vacation'),
          decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Тип заявки'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _reasonCtrl,
          decoration: const InputDecoration(
            labelText: 'Причина / комментарий',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _submitting
              ? null
              : () async {
                  setState(() => _submitting = true);
                  try {
                    await ref.read(attendanceApiProvider).createMyRequest(
                          type: _reqType,
                          fromDate: st.todayYmd,
                          toDate: st.todayYmd,
                          hours: _reqType == 'overtime' ? 4 : null,
                          reason: _reasonCtrl.text,
                        );
                    _reasonCtrl.clear();
                    setState(() => _statusBanner = 'Заявка отправлена руководителю / HR.');
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка заявки: $e')));
                    }
                  } finally {
                    if (mounted) setState(() => _submitting = false);
                  }
                },
          icon: const Icon(Icons.add_task),
          label: const Text('Отправить заявку'),
        ),
      ],
    );
      },
    );
  }
}

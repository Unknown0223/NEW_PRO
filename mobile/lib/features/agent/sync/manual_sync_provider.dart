import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/app_lock.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/user_facing_error.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';
import '../home/sync_count_provider.dart';

enum ManualSyncStatus { idle, running, success, error }

enum SyncUiStepStatus { pending, running, done }

class SyncUiStep {
  final String label;
  final SyncUiStepStatus status;
  final String value;

  const SyncUiStep({
    required this.label,
    required this.status,
    required this.value,
  });
}

class ManualSyncState {
  final ManualSyncStatus status;
  final int phaseIndex;
  final bool full;
  /// Shablon «Rol kartasi» — BrandSync identity variant.
  final bool identity;
  final double progress;
  final int ordersSent;
  final int ordersPendingStart;
  final int photosSent;
  final int photosPendingStart;
  final int clientsLoaded;
  final int recordCount;
  final DateTime? finishedAt;
  final AgentSyncResult? result;
  final UserFacingError? errorInfo;

  const ManualSyncState({
    this.status = ManualSyncStatus.idle,
    this.phaseIndex = 0,
    this.full = false,
    this.identity = false,
    this.progress = 0,
    this.ordersSent = 0,
    this.ordersPendingStart = 0,
    this.photosSent = 0,
    this.photosPendingStart = 0,
    this.clientsLoaded = 0,
    this.recordCount = 0,
    this.finishedAt,
    this.result,
    this.errorInfo,
  });

  List<SyncUiStep> get uiSteps => [
        SyncUiStep(
          label: S.syncOrdersSent,
          status: _ordersStatus,
          value: _ordersValue,
        ),
        SyncUiStep(
          label: S.syncPhotosUpload,
          status: _photosStatus,
          value: _photosValue,
        ),
        SyncUiStep(
          label: S.syncClients,
          status: _clientsStatus,
          value: _clientsValue,
        ),
      ];

  SyncUiStepStatus get _ordersStatus {
    if (status == ManualSyncStatus.success || phaseIndex >= 1) {
      return SyncUiStepStatus.done;
    }
    if (status == ManualSyncStatus.running && phaseIndex == 0) {
      return SyncUiStepStatus.running;
    }
    return SyncUiStepStatus.pending;
  }

  String get _ordersValue {
    if (_ordersStatus == SyncUiStepStatus.pending) return '—';
    if (ordersPendingStart == 0 && ordersSent == 0) return '0';
    return '$ordersSent';
  }

  SyncUiStepStatus get _photosStatus {
    if (status == ManualSyncStatus.success || phaseIndex >= 3) {
      return SyncUiStepStatus.done;
    }
    if (status == ManualSyncStatus.running && phaseIndex >= 1) {
      return SyncUiStepStatus.running;
    }
    return SyncUiStepStatus.pending;
  }

  String get _photosValue {
    if (_photosStatus == SyncUiStepStatus.pending) return '—';
    if (photosPendingStart == 0) return '0';
    return '$photosSent/$photosPendingStart';
  }

  SyncUiStepStatus get _clientsStatus {
    if (status == ManualSyncStatus.success) return SyncUiStepStatus.done;
    if (status == ManualSyncStatus.running && phaseIndex >= 3) {
      return SyncUiStepStatus.running;
    }
    return SyncUiStepStatus.pending;
  }

  String get _clientsValue {
    if (_clientsStatus == SyncUiStepStatus.pending) return '—';
    if (clientsLoaded > 0) return '$clientsLoaded';
    return status == ManualSyncStatus.success ? '0' : '—';
  }

  /// Shablon `BrandSync` qadamlari — identity / quick / full.
  int get brandSyncStepCount {
    if (identity) return 4;
    return full ? 7 : 4;
  }

  /// UI qadam indeksi (0…count−1; success da barchasi belgilangan).
  int get brandSyncStepIndex {
    final n = brandSyncStepCount;
    if (status == ManualSyncStatus.success) return n;
    if (identity) {
      return phaseIndex.clamp(0, n - 1);
    }
    return (progress * n).floor().clamp(0, n - 1);
  }

  ManualSyncState copyWith({
    ManualSyncStatus? status,
    int? phaseIndex,
    bool? full,
    bool? identity,
    double? progress,
    int? ordersSent,
    int? ordersPendingStart,
    int? photosSent,
    int? photosPendingStart,
    int? clientsLoaded,
    int? recordCount,
    DateTime? finishedAt,
    AgentSyncResult? result,
    UserFacingError? errorInfo,
    bool clearError = false,
  }) =>
      ManualSyncState(
        status: status ?? this.status,
        phaseIndex: phaseIndex ?? this.phaseIndex,
        full: full ?? this.full,
        identity: identity ?? this.identity,
        progress: progress ?? this.progress,
        ordersSent: ordersSent ?? this.ordersSent,
        ordersPendingStart: ordersPendingStart ?? this.ordersPendingStart,
        photosSent: photosSent ?? this.photosSent,
        photosPendingStart: photosPendingStart ?? this.photosPendingStart,
        clientsLoaded: clientsLoaded ?? this.clientsLoaded,
        recordCount: recordCount ?? this.recordCount,
        finishedAt: finishedAt ?? this.finishedAt,
        result: result ?? this.result,
        errorInfo: clearError ? null : (errorInfo ?? this.errorInfo),
      );
}

class ManualSyncNotifier extends StateNotifier<ManualSyncState> {
  final Ref _ref;

  ManualSyncNotifier(this._ref) : super(const ManualSyncState());

  bool get isRunning => state.status == ManualSyncStatus.running;

  double _progressForPhase(int phase) {
    // Bosqichlar tekis o‘ssin — eski «18% da qotib qolish» hissi yo‘qoladi.
    if (phase <= 0) return 0.22;
    if (phase == 1) return 0.40;
    if (phase == 2) return 0.55;
    if (phase == 3) return 0.72;
    if (phase == 4) return 0.88;
    return 0.97;
  }

  Future<void> run({required bool full, bool identity = false}) async {
    if (isRunning) return;

    final suppression = _ref.read(appLockSuppressionProvider.notifier);
    suppression.begin();
    try {
      if (identity) {
        await _runIdentity();
      } else {
        await _runInner(full: full);
      }
    } finally {
      suppression.end();
    }
  }

  /// Shablon «Rol kartasi» — config yangilash + BrandSync identity animatsiya.
  Future<void> _runIdentity() async {
    state = const ManualSyncState(
      status: ManualSyncStatus.running,
      phaseIndex: 0,
      identity: true,
      progress: 0.05,
    );
    try {
      await _ref.read(authStateProvider.notifier).refreshMobileConfig();
    } catch (_) {
      // Animatsiya davom etadi — offline bo‘lsa ham UI yakunlanadi.
    }
    if (!mounted) return;
    const steps = 4;
    for (var i = 1; i <= steps; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 460));
      if (!mounted || state.status != ManualSyncStatus.running) return;
      state = state.copyWith(
        phaseIndex: i,
        progress: i / steps,
      );
    }
    if (!mounted) return;
    state = ManualSyncState(
      status: ManualSyncStatus.success,
      phaseIndex: steps,
      identity: true,
      progress: 1,
      finishedAt: DateTime.now(),
    );
  }

  Future<void> _runInner({required bool full}) async {
    final db = AppDatabase();
    final pendingOrders = await db.getPendingOrders();
    final photosPending = await db.pendingPhotoReportCount();

    state = ManualSyncState(
      status: ManualSyncStatus.running,
      phaseIndex: 0,
      full: full,
      progress: 0.06,
      ordersPendingStart: pendingOrders.length,
      photosPendingStart: photosPending,
    );

    final result = await _ref.read(authStateProvider.notifier).resync(
          full: full,
          refreshConfig: true,
          onPhase: (phase) {
            if (!mounted) return;
            if (state.status != ManualSyncStatus.running) return;
            final next = _progressForPhase(phase);
            state = state.copyWith(
              phaseIndex: phase,
              progress: next > state.progress ? next : state.progress,
            );
          },
        );

    if (!mounted) return;

    final ordersLeft = (await db.getPendingOrders()).length;
    final photosLeft = await db.pendingPhotoReportCount();
    final ordersSent = (state.ordersPendingStart - ordersLeft).clamp(0, state.ordersPendingStart);
    final photosSent = (state.photosPendingStart - photosLeft).clamp(0, state.photosPendingStart);
    final records = result.clients + result.products + result.prices + result.orders;

    // Auth chiqish — faqat Dio/interceptor aniq SESSION_REVOKED / INVALID_REFRESH da.
    // Matn heuristic («401», «Sessiya») oflayn xatolarda noto‘g‘ri logout qilardi.

    if (result.ok) {
      _ref.invalidate(syncCountTodayProvider);
      invalidateSyncedData(_ref.invalidate);
      state = ManualSyncState(
        status: ManualSyncStatus.success,
        phaseIndex: 5,
        full: full,
        progress: 1,
        ordersSent: ordersSent,
        ordersPendingStart: state.ordersPendingStart,
        photosSent: photosSent,
        photosPendingStart: state.photosPendingStart,
        clientsLoaded: result.clients,
        recordCount: records,
        finishedAt: DateTime.now(),
        result: result,
      );
      return;
    }

    state = ManualSyncState(
      status: ManualSyncStatus.error,
      phaseIndex: state.phaseIndex,
      full: full,
      progress: state.progress,
      ordersSent: ordersSent,
      ordersPendingStart: state.ordersPendingStart,
      photosSent: photosSent,
      photosPendingStart: state.photosPendingStart,
      clientsLoaded: result.clients,
      recordCount: records,
      result: result,
      errorInfo: result.errorInfo ??
          UserFacingError.tryParseLegacy(result.error) ??
          UserFacingError(
            title: 'Ошибка синхронизации',
            message: result.error ?? 'Не удалось обновить данные.',
          ),
    );
  }

  void reset() {
    state = const ManualSyncState();
  }
}

final manualSyncProvider = StateNotifierProvider<ManualSyncNotifier, ManualSyncState>((ref) {
  return ManualSyncNotifier(ref);
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/user_facing_error.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';
import '../home/sync_count_provider.dart';

enum ManualSyncStatus { idle, running, success, error }

class ManualSyncState {
  final ManualSyncStatus status;
  final int phaseIndex;
  final bool full;
  final AgentSyncResult? result;
  final UserFacingError? errorInfo;

  const ManualSyncState({
    this.status = ManualSyncStatus.idle,
    this.phaseIndex = 0,
    this.full = false,
    this.result,
    this.errorInfo,
  });

  ManualSyncState copyWith({
    ManualSyncStatus? status,
    int? phaseIndex,
    bool? full,
    AgentSyncResult? result,
    UserFacingError? errorInfo,
    bool clearError = false,
  }) =>
      ManualSyncState(
        status: status ?? this.status,
        phaseIndex: phaseIndex ?? this.phaseIndex,
        full: full ?? this.full,
        result: result ?? this.result,
        errorInfo: clearError ? null : (errorInfo ?? this.errorInfo),
      );
}

class ManualSyncNotifier extends StateNotifier<ManualSyncState> {
  final Ref _ref;

  ManualSyncNotifier(this._ref) : super(const ManualSyncState());

  bool get isRunning => state.status == ManualSyncStatus.running;

  Future<void> run({required bool full}) async {
    if (isRunning) return;
    state = ManualSyncState(status: ManualSyncStatus.running, phaseIndex: 0, full: full);

    final result = await _ref.read(authStateProvider.notifier).resync(
          full: full,
          onPhase: (phase) {
            if (!mounted) return;
            if (state.status != ManualSyncStatus.running) return;
            state = state.copyWith(phaseIndex: phase);
          },
        );

    if (!mounted) return;

    if (result.ok) {
      _ref.invalidate(syncCountTodayProvider);
      invalidateSyncedData(_ref.invalidate);
      state = ManualSyncState(
        status: ManualSyncStatus.success,
        phaseIndex: 5,
        full: full,
        result: result,
      );
      return;
    }

    state = ManualSyncState(
      status: ManualSyncStatus.error,
      phaseIndex: state.phaseIndex,
      full: full,
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

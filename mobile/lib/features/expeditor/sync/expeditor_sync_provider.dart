import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/user_facing_error.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';

enum ExpeditorSyncStatus { idle, running, success, error }

class ExpeditorSyncState {
  final ExpeditorSyncStatus status;
  final int phaseIndex;
  final bool full;
  final AgentSyncResult? result;
  final UserFacingError? errorInfo;

  const ExpeditorSyncState({
    this.status = ExpeditorSyncStatus.idle,
    this.phaseIndex = 0,
    this.full = false,
    this.result,
    this.errorInfo,
  });

  ExpeditorSyncState copyWith({
    ExpeditorSyncStatus? status,
    int? phaseIndex,
    bool? full,
    AgentSyncResult? result,
    UserFacingError? errorInfo,
    bool clearError = false,
  }) =>
      ExpeditorSyncState(
        status: status ?? this.status,
        phaseIndex: phaseIndex ?? this.phaseIndex,
        full: full ?? this.full,
        result: result ?? this.result,
        errorInfo: clearError ? null : (errorInfo ?? this.errorInfo),
      );
}

class ExpeditorSyncNotifier extends StateNotifier<ExpeditorSyncState> {
  final Ref _ref;

  ExpeditorSyncNotifier(this._ref) : super(const ExpeditorSyncState());

  bool get isRunning => state.status == ExpeditorSyncStatus.running;

  Future<void> run({required bool full}) async {
    if (isRunning) return;
    state = ExpeditorSyncState(
      status: ExpeditorSyncStatus.running,
      phaseIndex: 0,
      full: full,
    );

    final result = await _ref.read(authStateProvider.notifier).resync(
          full: full,
          refreshConfig: full,
          onPhase: (phase) {
            if (!mounted) return;
            if (state.status != ExpeditorSyncStatus.running) return;
            state = state.copyWith(phaseIndex: phase);
          },
        );

    if (!mounted) return;

    if (result.ok) {
      invalidateSyncedData(_ref.invalidate);
      state = ExpeditorSyncState(
        status: ExpeditorSyncStatus.success,
        phaseIndex: 6,
        full: full,
        result: result,
      );
      return;
    }

    state = ExpeditorSyncState(
      status: ExpeditorSyncStatus.error,
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

  void reset() => state = const ExpeditorSyncState();
}

final expeditorSyncProvider =
    StateNotifierProvider<ExpeditorSyncNotifier, ExpeditorSyncState>((ref) {
  return ExpeditorSyncNotifier(ref);
});

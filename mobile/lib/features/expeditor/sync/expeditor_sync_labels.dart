import '../../agent/sync/full_sync_view.dart';

/// «Полная синхронизация» — ekspeditor bosqichlari (shablon).
class ExpeditorSyncLabels {
  static const title = 'Полная синхронизация';

  static const phases = [
    'Файлы',
    'Синхронизировать данные локали',
    'Клиенты',
    'Заказы',
    'Библиотека',
    'Визиты',
    'Другие',
  ];

  static FullSyncViewModel viewModel({
    required bool isSuccess,
    required int phaseIndex,
  }) {
    if (isSuccess) {
      return FullSyncViewModel(
        progress: 1,
        isSuccess: true,
        title: title,
        items: phases
            .map((l) => FullSyncItemState(l, FullSyncItemStatus.done))
            .toList(),
      );
    }

    final active = phaseIndex.clamp(0, phases.length - 1);
    final items = <FullSyncItemState>[];
    for (var i = 0; i < phases.length; i++) {
      final st = i < active
          ? FullSyncItemStatus.done
          : i == active
              ? FullSyncItemStatus.loading
              : FullSyncItemStatus.pending;
      items.add(FullSyncItemState(phases[i], st));
    }

    const prep = 0.08;
    final syncProgress =
        prep + (1.0 - prep) * ((active + 0.35) / phases.length);

    return FullSyncViewModel(
      progress: syncProgress.clamp(0.0, 0.99),
      isSuccess: false,
      title: title,
      items: items,
    );
  }
}

import '../../features/agent/sync/full_sync_view.dart';

/// Bootstrap sinxronizatsiya — rol bo‘yicha sarlavha va bosqichlar.
class BootstrapSyncPlan {
  final String title;
  final List<String> phaseLabels;

  const BootstrapSyncPlan({
    required this.title,
    required this.phaseLabels,
  });

  int get phaseCount => phaseLabels.length;

  static BootstrapSyncPlan forRole(String? role) {
    switch (role) {
      case 'expeditor':
        return const BootstrapSyncPlan(
          title: 'Полная синхронизация',
          phaseLabels: [
            'Файлы',
            'Синхронизировать данные локали',
            'Клиенты',
            'Заказы',
            'Библиотека',
            'Визиты',
            'Другие',
          ],
        );
      case 'supervisor':
        return const BootstrapSyncPlan(
          title: 'Supervayzer ma\'lumotlari',
          phaseLabels: ['Dashboard', 'Vizitlar', 'Agentlar GPS', 'Tayyor'],
        );
      default:
        return BootstrapSyncPlan(
          title: 'Полная синхронизация',
          phaseLabels: List<String>.from(FullSyncView.progressLabels),
        );
    }
  }

  static bool isAgentRole(String? role) => role == null || role == 'agent';
}

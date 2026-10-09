import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/permissions/app_permissions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'auth_provider.dart';

/// Majburiy ruxsatlarsiz ilova ishlamaydi — barcha rollar uchun to‘siq ekrani.
class PermissionGatePage extends ConsumerWidget {
  const PermissionGatePage({super.key});

  IconData _icon(AppPermissionKind k) => switch (k) {
        AppPermissionKind.locationService => Icons.gps_fixed,
        AppPermissionKind.locationAlways => Icons.location_on_outlined,
        AppPermissionKind.preciseLocation => Icons.my_location,
        AppPermissionKind.battery => Icons.battery_charging_full,
        AppPermissionKind.camera => Icons.photo_camera_outlined,
        AppPermissionKind.notifications => Icons.notifications_active_outlined,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(appPermissionsProvider);
    final notifier = ref.read(appPermissionsProvider.notifier);
    final missing = st.missing;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Разрешения'),
          actions: [
            IconButton(
              tooltip: 'Проверить снова',
              icon: st.checking
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh),
              onPressed: st.checking ? null : notifier.refresh,
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text(
              'Без этих разрешений работа в приложении невозможна. '
              'Разрешите каждый пункт — после возврата из настроек статус обновится сам.',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            for (final item in st.items)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: Icon(_icon(item.kind), color: item.granted ? AppColors.success : AppColors.error),
                  title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(item.description),
                  isThreeLine: true,
                  trailing: item.granted
                      ? const Icon(Icons.check_circle, color: AppColors.success)
                      : FilledButton(
                          onPressed: () => notifier.request(item),
                          child: Text(item.permanentlyDenied ? 'Настройки' : 'Разрешить'),
                        ),
                ),
              ),
            const SizedBox(height: 8),
            if (missing.isNotEmpty)
              FilledButton.icon(
                onPressed: () => notifier.request(missing.first),
                icon: const Icon(Icons.verified_user_outlined),
                label: Text('Разрешить: ${missing.first.title}'),
              ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.read(authStateProvider.notifier).logout(),
              child: const Text('Выйти из аккаунта'),
            ),
          ],
        ),
      ),
    );
  }
}

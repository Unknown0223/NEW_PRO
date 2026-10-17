import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/supervisor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../shared/supervisor_ui.dart';

final _svNotificationsProvider =
    FutureProvider.autoDispose<({List<Map<String, dynamic>> data, int unread})>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return (data: <Map<String, dynamic>>[], unread: 0);
  return ref.read(supervisorApiProvider).listNotifications(slug);
});

/// SVR in-app bildirishnomalar (jumladan boshqa SVR koordinata o‘zgarishi).
class SupervisorNotificationsPage extends ConsumerWidget {
  const SupervisorNotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_svNotificationsProvider);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: 'Уведомления',
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_svNotificationsProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: AppColors.error))),
        data: (pack) {
          if (pack.data.isEmpty) {
            return const Center(child: Text('Нет уведомлений', style: AppTypography.bodyMedium));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: pack.data.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final n = pack.data[i];
              final id = (n['id'] as num?)?.toInt();
              final unread = n['read_at'] == null;
              return SvCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  leading: Icon(
                    unread ? Icons.notifications_active : Icons.notifications_none,
                    color: unread ? AppColors.supervisorAccent : AppColors.textMuted,
                  ),
                  title: Text(
                    n['title']?.toString() ?? '',
                    style: TextStyle(fontWeight: unread ? FontWeight.w800 : FontWeight.w600),
                  ),
                  subtitle: Text(n['body']?.toString() ?? ''),
                  onTap: id == null
                      ? null
                      : () async {
                          final href = n['link_href']?.toString().trim() ?? '';
                          if (href.startsWith('/tasks/')) context.push(href);
                          final slug = ref.read(sessionProvider).tenantSlug ?? '';
                          try {
                            await ref.read(supervisorApiProvider).markNotificationRead(slug, id);
                            ref.invalidate(_svNotificationsProvider);
                          } catch (_) {}
                        },
                ),
              );
            },
          );
        },
      ),
    );
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/mobile_api.dart';
import '../auth/session.dart';

class InAppNotificationRow {
  final int id;
  final String title;
  final String? body;
  final String? linkHref;
  final String? readAt;
  final String createdAt;

  const InAppNotificationRow({
    required this.id,
    required this.title,
    this.body,
    this.linkHref,
    this.readAt,
    required this.createdAt,
  });

  bool get isUnread => readAt == null || readAt!.isEmpty;

  factory InAppNotificationRow.fromJson(Map<String, dynamic> j) {
    return InAppNotificationRow(
      id: (j['id'] as num?)?.toInt() ?? 0,
      title: j['title']?.toString() ?? '',
      body: j['body']?.toString(),
      linkHref: j['link_href']?.toString(),
      readAt: j['read_at']?.toString(),
      createdAt: j['created_at']?.toString() ?? '',
    );
  }
}

final serverInAppNotificationsProvider =
    FutureProvider.autoDispose<List<InAppNotificationRow>>((ref) async {
  final session = ref.watch(sessionProvider);
  final slug = session.tenantSlug?.trim() ?? '';
  if (slug.isEmpty || session.user == null) return const [];
  final api = ref.watch(mobileApiProvider);
  try {
    final raw = await api.listInAppNotifications(slug);
    return raw.map(InAppNotificationRow.fromJson).where((e) => e.id > 0).toList();
  } catch (_) {
    return const [];
  }
});

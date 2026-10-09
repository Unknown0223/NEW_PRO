import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';

/// Bog'langan mijozlar — oxirgi agent-sync (SQLite).
final clientsListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  try {
    final cfg = ref.read(sessionProvider).mobileConfig?.client;
    final includePending = (cfg?.canCreate ?? false) || (cfg?.requireNewClientApproval ?? false);
    // SQLite allaqachon name COLLATE NOCASE ASC — qayta sort kerak emas.
    return AppDatabase().getAllClients(activeOnly: !includePending);
  } catch (e, st) {
    ErrorReporter.instance?.reportCaught(
      e,
      stack: st,
      module: ErrorModules.clients,
      code: 'ClientsListLocalFailed',
      message: 'Клиенты: локальный список не загрузился',
      path: '/mobile/clients',
    );
    return [];
  }
});

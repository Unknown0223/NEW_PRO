import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';

/// Bog'langan mijozlar — oxirgi agent-sync (SQLite).
final clientsListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  try {
    final cfg = ref.read(sessionProvider).mobileConfig?.client;
    final includePending = (cfg?.canCreate ?? false) || (cfg?.requireNewClientApproval ?? false);
    var rows = await AppDatabase().getAllClients(activeOnly: !includePending);
    final sortAlpha = ref.watch(agentLocalPrefsProvider).valueOrNull?.sortClientsAlphabetically ?? true;
    if (sortAlpha) {
      rows = List<Map<String, dynamic>>.from(rows)
        ..sort((a, b) => (a['name']?.toString() ?? '').toLowerCase().compareTo((b['name']?.toString() ?? '').toLowerCase()));
    }
    return rows;
  } catch (_) {
    return [];
  }
});

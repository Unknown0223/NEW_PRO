import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import 'quick_panel_prefs.dart';

String quickPanelRoleOf(SessionState session) {
  final role = (session.user?.role ?? 'agent').toLowerCase().trim();
  if (role.contains('exped')) return 'expeditor';
  if (role.contains('super')) return 'supervisor';
  if (role.contains('cash') || role.contains('kass')) return 'cashier';
  return 'agent';
}

final quickPanelItemsProvider =
    AsyncNotifierProvider<QuickPanelItemsNotifier, List<QuickPanelItem>>(
  QuickPanelItemsNotifier.new,
);

class QuickPanelItemsNotifier extends AsyncNotifier<List<QuickPanelItem>> {
  String get _role => quickPanelRoleOf(ref.read(sessionProvider));

  @override
  Future<List<QuickPanelItem>> build() {
    ref.watch(sessionProvider.select((s) => s.user?.role));
    return QuickPanelPrefs.load(_role);
  }

  Future<void> setItems(List<QuickPanelItem> items) async {
    await QuickPanelPrefs.save(_role, items);
    state = AsyncData(List<QuickPanelItem>.from(items));
  }

  Future<void> reset() async {
    await QuickPanelPrefs.reset(_role);
    state = AsyncData(QuickPanelPrefs.defaultsForRole(_role));
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = AsyncData(await QuickPanelPrefs.load(_role));
  }
}

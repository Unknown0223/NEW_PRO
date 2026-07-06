import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'agent_local_prefs.dart';

final agentLocalPrefsProvider =
    AsyncNotifierProvider<AgentLocalPrefsNotifier, AgentLocalPrefs>(AgentLocalPrefsNotifier.new);

class AgentLocalPrefsNotifier extends AsyncNotifier<AgentLocalPrefs> {
  @override
  Future<AgentLocalPrefs> build() => AgentLocalPrefs.load();

  Future<void> setPrefs(AgentLocalPrefs Function(AgentLocalPrefs current) fn) async {
    final current = state.valueOrNull ?? const AgentLocalPrefs();
    final next = fn(current);
    await next.save();
    state = AsyncData(next);
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = AsyncData(await AgentLocalPrefs.load());
  }
}

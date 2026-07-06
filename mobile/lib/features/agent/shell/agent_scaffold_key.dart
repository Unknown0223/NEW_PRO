import 'package:flutter/material.dart';

/// AgentShell dagi asosiy Scaffold (ichki sahifalar uchun drawer).
final GlobalKey<ScaffoldState> agentShellScaffoldKey = GlobalKey<ScaffoldState>();

/// ☰ Menyu — joriy sahifa drawer (root) yoki AgentShell drawer (tablar).
void openAgentMenu(BuildContext context) {
  final local = Scaffold.maybeOf(context);
  if (local?.hasDrawer == true) {
    local!.openDrawer();
    return;
  }
  agentShellScaffoldKey.currentState?.openDrawer();
}

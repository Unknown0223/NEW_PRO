import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/sync_window_countdown.dart';
import '../../../core/ui/agent_ui.dart';
import 'agent_scaffold_key.dart';

/// Agent sahifalari uchun TopBar (shablon Agent 2.0).
/// Sinхron oynasi taymeri har doim title yonida ko‘rinadi.
class AgentAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBack;
  final GlobalKey<ScaffoldState>? drawerScaffoldKey;
  final Widget? belowTitle;
  final Widget? titleTrailing;
  final VoidCallback? onBack;
  final int? menuBadge;
  final bool showSyncCountdown;

  const AgentAppBar({
    super.key,
    required this.title,
    this.actions,
    this.showBack = false,
    this.drawerScaffoldKey,
    this.belowTitle,
    this.titleTrailing,
    this.onBack,
    this.menuBadge,
    this.showSyncCountdown = true,
  });

  @override
  Size get preferredSize => Size.fromHeight(belowTitle != null ? 118 : 79);

  void _openMenu(BuildContext context) {
    final keyed = drawerScaffoldKey?.currentState;
    if (keyed != null) {
      keyed.openDrawer();
      return;
    }
    openAgentMenu(context);
  }

  void _goBack(BuildContext context) {
    if (onBack != null) {
      onBack!();
      return;
    }
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    context.go('/home');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final useMenuLeading = drawerScaffoldKey != null || !showBack;
    final syncCfg = ref.watch(sessionProvider).mobileConfig?.sync ?? const SyncConfig();

    Widget? trailing = titleTrailing;
    if (showSyncCountdown) {
      final timer = SyncWindowCountdownStrip(syncConfig: syncCfg, inline: true);
      trailing = trailing == null
          ? timer
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                timer,
                const SizedBox(width: 6),
                trailing,
              ],
            );
    }

    return AgentTopBar(
      title: title,
      onMenu: useMenuLeading ? () => _openMenu(context) : null,
      onBack: !useMenuLeading ? () => _goBack(context) : null,
      belowTitle: belowTitle,
      titleTrailing: trailing,
      menuBadge: menuBadge,
      actions: [
        if (showBack && useMenuLeading)
          AgentIconButton(icon: Icons.arrow_back, onPressed: () => _goBack(context)),
        ...?actions,
      ],
    );
  }
}

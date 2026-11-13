import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/sync_window_countdown.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/quick_panel_sheet.dart';
import '../../../design_system/design_system.dart';
import '../sync/sync_bottom_sheet.dart';
import 'agent_scaffold_key.dart';
import '../orders/create_order_exit_guard.dart';

/// Agent sahifalari uchun TopBar (shablon Agent 2.0).
/// Pastki nav saqlanadi; tezkor panel app bar da.
class AgentAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBack;
  final GlobalKey<ScaffoldState>? drawerScaffoldKey;
  /// Shell ichidagi sahifa: ☰ AgentShell drawer ni ochadi (ichki Scaffold
  /// drawer yo‘q bo‘lsa ham). Overlay (`/map`, `/draft`) da ishlatilmasin.
  final bool useShellDrawer;
  final Widget? belowTitle;
  final Widget? titleTrailing;
  final VoidCallback? onBack;
  final int? menuBadge;
  final bool showSyncCountdown;
  /// Shablon tezkor panel tugmasi.
  final bool showQuickPanel;
  /// GlobalChrome (brand · rol + sync) — ichki sahifalar uchun.
  final bool useGlobalChrome;
  final String roleLabel;

  const AgentAppBar({
    super.key,
    required this.title,
    this.actions,
    this.showBack = false,
    this.drawerScaffoldKey,
    this.useShellDrawer = false,
    this.belowTitle,
    this.titleTrailing,
    this.onBack,
    this.menuBadge,
    this.showSyncCountdown = true,
    this.showQuickPanel = true,
    this.useGlobalChrome = true,
    this.roleLabel = 'Agent',
  });

  @override
  Size get preferredSize => useGlobalChrome
      ? Size.fromHeight(
          // +2: text/scale overflow oldini olish (BOTTOM OVERFLOWED BY 1px)
          52 + SaScreenHead.heightFor(belowTitle: belowTitle) + 2,
        )
      : Size.fromHeight(belowTitle != null ? 118 : 79);

  void _openMenu(BuildContext context) {
    final keyed = drawerScaffoldKey?.currentState;
    if (keyed != null) {
      keyed.openDrawer();
      return;
    }
    if (useShellDrawer) {
      final shell = agentShellScaffoldKey.currentState;
      if (shell != null) {
        shell.openDrawer();
        return;
      }
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
    final router = GoRouter.of(context);
    final loc = GoRouterState.of(context).uri.path;
    final container = ProviderScope.containerOf(context);
    leaveCreateOrderThenGo(
      container: container,
      go: router.go,
      path: '/home',
      currentLocation: loc,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final useMenuLeading =
        drawerScaffoldKey != null || useShellDrawer || !showBack;
    // GlobalChrome o‘zida soat/sync bor — ScreenHead ga yana countdown qo‘ymaymiz.
    Widget? trailing = titleTrailing;
    if (showSyncCountdown && !useGlobalChrome) {
      final syncCfg =
          ref.watch(sessionProvider).mobileConfig?.sync ?? const SyncConfig();
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

    if (useGlobalChrome) {
      final now = TimeOfDay.now();
      final clock =
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

      Widget? headTrailing;
      final pageActions = <Widget>[
        if (titleTrailing != null) titleTrailing!,
        ...?actions,
      ];
      if (pageActions.isNotEmpty) {
        headTrailing = Row(
          mainAxisSize: MainAxisSize.min,
          children: pageActions,
        );
      }

      return Material(
        color: Colors.white,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SaGlobalChromeBar(
              roleLabel: roleLabel,
              menuBadge: menuBadge,
              syncClock: showSyncCountdown ? clock : null,
              syncReady: true,
              onMenu: useMenuLeading ? () => _openMenu(context) : null,
              onSync: () => SyncBottomSheet.show(context),
              onQuick: showQuickPanel ? () => showQuickPanelSheet(context) : null,
            ),
            SaScreenHead(
              title: title,
              belowTitle: belowTitle,
              onBack: showBack ? () => _goBack(context) : null,
              trailing: headTrailing,
            ),
          ],
        ),
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
          AgentIconButton(
            icon: Icons.arrow_back,
            onPressed: () => _goBack(context),
          ),
        if (showQuickPanel) const QuickPanelAction(),
        ...?actions,
      ],
    );
  }
}

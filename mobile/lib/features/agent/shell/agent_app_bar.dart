import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/ui/agent_ui.dart';
import 'agent_scaffold_key.dart';

/// Agent sahifalari uchun TopBar (shablon Agent 2.0).
class AgentAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBack;
  final GlobalKey<ScaffoldState>? drawerScaffoldKey;
  final Widget? belowTitle;
  final Widget? titleTrailing;
  final VoidCallback? onBack;
  final int? menuBadge;

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
  Widget build(BuildContext context) {
    final useMenuLeading = drawerScaffoldKey != null || !showBack;

    return AgentTopBar(
      title: title,
      onMenu: useMenuLeading ? () => _openMenu(context) : null,
      onBack: !useMenuLeading ? () => _goBack(context) : null,
      belowTitle: belowTitle,
      titleTrailing: titleTrailing,
      menuBadge: menuBadge,
      actions: [
        if (showBack && useMenuLeading)
          AgentIconButton(icon: Icons.arrow_back, onPressed: () => _goBack(context)),
        ...?actions,
      ],
    );
  }
}

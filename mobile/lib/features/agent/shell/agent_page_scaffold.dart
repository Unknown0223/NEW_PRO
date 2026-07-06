import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import 'agent_app_bar.dart';
import 'agent_drawer.dart';

/// Agent sahifasi: drawer + AppBar (root navigator va ichki sahifalar uchun).
class AgentPageScaffold extends StatefulWidget {
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final bool showBack;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  const AgentPageScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.showBack = false,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
  });

  @override
  State<AgentPageScaffold> createState() => _AgentPageScaffoldState();
}

class _AgentPageScaffoldState extends State<AgentPageScaffold> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      appBar: AgentAppBar(
        title: widget.title,
        showBack: widget.showBack,
        drawerScaffoldKey: _scaffoldKey,
        actions: widget.actions,
      ),
      body: widget.body,
      floatingActionButton: widget.floatingActionButton,
      floatingActionButtonLocation: widget.floatingActionButtonLocation,
    );
  }
}

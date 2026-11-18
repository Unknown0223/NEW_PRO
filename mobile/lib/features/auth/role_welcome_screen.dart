import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// RoleWelcome — brend splash olib tashlandi (orqani to‘smasligi uchun darhol home).
class RoleWelcomeScreen extends ConsumerStatefulWidget {
  final String? role;
  final VoidCallback onDone;
  final Color accent;

  const RoleWelcomeScreen({
    super.key,
    required this.onDone,
    this.role,
    this.accent = const Color(0xFF1F66D1),
  });

  @override
  ConsumerState<RoleWelcomeScreen> createState() => _RoleWelcomeScreenState();
}

class _RoleWelcomeScreenState extends ConsumerState<RoleWelcomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onDone();
    });
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

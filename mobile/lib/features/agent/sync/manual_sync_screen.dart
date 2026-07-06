import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'manual_sync_runner.dart';

/// Eski `/manual-sync` marshruti — bosh sahifaga qaytadi va overlay sinxronini ishga tushiradi.
class ManualSyncScreen extends ConsumerStatefulWidget {
  final bool full;

  const ManualSyncScreen({super.key, required this.full});

  @override
  ConsumerState<ManualSyncScreen> createState() => _ManualSyncScreenState();
}

class _ManualSyncScreenState extends ConsumerState<ManualSyncScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.go('/home');
      startManualSync(context, ref, full: widget.full);
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.transparent,
      body: SizedBox.shrink(),
    );
  }
}

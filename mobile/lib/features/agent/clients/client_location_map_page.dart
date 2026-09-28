import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/client_navigation.dart';
import '../shell/agent_app_bar.dart';
import 'client_map_holder.dart';

/// Mijoz koordinatasi — to‘liq ekran (root navigator), orqaga → mijoz kartasi.
class ClientLocationMapPage extends ConsumerStatefulWidget {
  final String clientName;
  final double latitude;
  final double longitude;

  const ClientLocationMapPage({
    super.key,
    required this.clientName,
    required this.latitude,
    required this.longitude,
  });

  @override
  ConsumerState<ClientLocationMapPage> createState() => _ClientLocationMapPageState();
}

class _ClientLocationMapPageState extends ConsumerState<ClientLocationMapPage> {
  bool _navBusy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(clientMapHolderProvider.notifier).showPoint(
            clientName: widget.clientName,
            latitude: widget.latitude,
            longitude: widget.longitude,
          );
    });
  }

  Future<void> _openDirections() async {
    if (_navBusy) return;
    setState(() => _navBusy = true);
    try {
      final ok = await openDirectionsToClient(
        latitude: widget.latitude,
        longitude: widget.longitude,
      );
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось открыть навигацию')),
        );
      }
    } finally {
      if (mounted) setState(() => _navBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final holder = ref.read(clientMapHolderProvider.notifier);
    final holderState = ref.watch(clientMapHolderProvider);
    final controller = holder.controller;

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AgentAppBar(title: widget.clientName, showBack: true),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _navBusy ? null : _openDirections,
          backgroundColor: AppColors.agentAccent,
          foregroundColor: Colors.white,
          icon: _navBusy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.directions),
          label: const Text('Маршрут'),
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Text(
                '${widget.latitude.toStringAsFixed(5)}, ${widget.longitude.toStringAsFixed(5)}',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
              ),
            ),
            Expanded(
              child: controller == null
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : Stack(
                      fit: StackFit.expand,
                      children: [
                        WebViewWidget(controller: controller),
                        if (!holderState.ready && !holderState.failed)
                          ColoredBox(
                            color: AppColors.background.withValues(alpha: 0.9),
                            child: const Center(
                              child: CircularProgressIndicator(color: AppColors.primary),
                            ),
                          ),
                        if (holderState.failed)
                          ColoredBox(
                            color: AppColors.background,
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.map_outlined, size: 48, color: AppColors.textMuted),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Не удалось загрузить карту',
                                    style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: 12),
                                  TextButton(
                                    onPressed: holder.retryLoad,
                                    child: const Text('Повторить'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../shell/agent_app_bar.dart';

/// Konfiguratsiya yoqilgan maxsus buyurtma turlari (almashinuv / polkadan qaytarish).
class AgentMiscOrdersPage extends ConsumerWidget {
  final String mode;

  const AgentMiscOrdersPage({super.key, required this.mode});

  bool get _isExchange => mode == 'exchange';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfg = ref.watch(sessionProvider).mobileConfig;
    final enabled = _isExchange
        ? cfg?.misc.allowExchangeRequest == true
        : cfg?.orders.allowReturnFromShelf == true;

    final title = _isExchange ? 'Almashinuv so\'rovi' : 'Polkadan qaytarish';
    final body = _isExchange
        ? 'Almashinuv buyurtmasini yangi zakaz yaratish orqali yuboring. Kommentda «Обмен» deb belgilang.'
        : 'Polkadan qaytarish buyurtmasini yangi zakaz yaratish orqali yuboring. Kommentda «Vozvrat s polki» deb belgilang.';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(title: title, showBack: true),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!enabled)
              const Text(
                'Bu funksiya konfiguratsiyada o\'chirilgan.',
                style: TextStyle(color: AppColors.textMuted),
              )
            else ...[
              Text(body, style: const TextStyle(fontSize: 15, height: 1.4)),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.push('/orders/create'),
                child: const Text('Yangi buyurtma'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

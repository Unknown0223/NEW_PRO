import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/prefs/agent_local_prefs.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';

/// «Настройки» — ekspeditor. Veb «Конфигурации» bilan to'liq bog'langan:
/// barcha qiymatlar `session.mobileConfig` (serverdan sinxron) dan o'qiladi,
/// faqat «модератор» o'zgartira oladi. Til — qurilma sozlamasi (lokal).
class ExpeditorSettingsPage extends ConsumerWidget {
  const ExpeditorSettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfg = ref.watch(sessionProvider.select((s) => s.mobileConfig));
    final prefsAsync = ref.watch(agentLocalPrefsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Настройки'),
        actions: [
          IconButton(
            tooltip: 'Обновить настройки',
            icon: const Icon(Icons.sync),
            onPressed: () => _refreshConfig(context, ref),
          ),
        ],
      ),
      body: prefsAsync.when(
        loading: () => const Center(
            child:
                CircularProgressIndicator(color: AppColors.expeditorAccent),),
        error: (e, _) => Center(child: Text('$e')),
        data: (prefs) => ListView(
          padding: const EdgeInsets.all(12),
          children: [
            _group('ОСНОВНЫЕ НАСТРОЙКИ', [
              _NavRow(
                label: 'Язык приложении',
                value: prefs.localeLabel,
                onTap: () => _pickLocale(context, ref, prefs),
              ),
            ]),
            _group('ЗАКАЗ', [
              _ToggleRow(
                label: 'Показывать предложение о бонусе',
                value: _bonusOfferOn(cfg),
              ),
              _ToggleRow(
                label: 'Изменение (частный возврат)',
                value: cfg?.orders.allowPartialReturnEdit ?? false,
              ),
              _ToggleRow(
                label: 'Догруз (С авто экспедитора)',
                value: cfg?.orders.allowReloadFromVehicle ?? false,
              ),
              _ToggleRow(
                label: 'Возврат с полки по заказу',
                value: cfg?.orders.allowReturnFromShelf ?? false,
              ),
              _ToggleRow(
                label: 'Причина возврата обязательна',
                value: cfg?.orders.returnReasonRequired ?? false,
              ),
            ]),
            _group('ОПЛАТА', [
              _ToggleRow(
                label: 'Принятие оплаты за заказ',
                value: cfg?.expeditor?.acceptPaymentForOrder ?? true,
              ),
              _ToggleRow(
                label: 'Принятие оплаты при доставке',
                value: cfg?.expeditor?.acceptPaymentOnDelivery ?? true,
              ),
              _ToggleRow(
                label: 'Принятие оплаты от должников',
                value: cfg?.expeditor?.acceptPaymentFromDebtors ?? false,
              ),
              _ToggleRow(
                label: 'Строгий способ оплаты при доставке',
                value: cfg?.expeditor?.deliveryPaymentMethodStrict ?? false,
              ),
              _ValueRow(
                label: 'Валюта',
                value: cfg?.expeditor?.currencySymbol ?? "so'm",
              ),
            ]),
            _group('НАКЛАДНЫЕ', [
              _ToggleRow(
                label: 'Отпечаток при подтверждении',
                value:
                    cfg?.expeditor?.fingerprintRequiredForShipmentConfirm ??
                        false,
              ),
            ]),
            _group('КЛИЕНТ', [
              _ToggleRow(
                label: 'Изменить местоположение клиента',
                value: cfg?.client.canChangeClientLocation ?? false,
              ),
              _ToggleRow(
                label: 'Показать баланс клиента',
                value: cfg?.client.showBalance ?? true,
              ),
            ]),
            _group('GPS', [
              _ValueRow(
                label: 'Интервал отслеживания местоположений',
                value: '${cfg?.gps.trackingIntervalSec ?? 300}',
              ),
              _ToggleRow(
                label: 'Всегда включен',
                value: cfg?.gps.alwaysOn ?? false,
              ),
              _ToggleRow(
                label: 'Отслеживание включено',
                value: cfg?.gps.trackingEnabled ?? false,
              ),
            ]),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                'Эти настройки может изменить только модератор в веб-конфигурации.',
                style: AppTypography.bodyMedium
                    .copyWith(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  /// «Показывать предложение о бонусе» — bonus to'ldirish rejimi `free` emas.
  bool _bonusOfferOn(MobileConfig? cfg) {
    final mode = cfg?.orders.bonusFillMode;
    if (mode == null || mode.isEmpty) return false;
    return mode != 'free';
  }

  Future<void> _refreshConfig(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    await ref.read(authStateProvider.notifier).refreshMobileConfig();
    messenger.showSnackBar(
      const SnackBar(content: Text('Настройки обновлены')),
    );
  }

  Future<void> _pickLocale(
    BuildContext context,
    WidgetRef ref,
    AgentLocalPrefs prefs,
  ) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Язык приложении',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),),
            ),
            ListTile(
              title: const Text('Русский'),
              trailing: prefs.locale == 'ru'
                  ? const Icon(Icons.check, color: AppColors.expeditorAccent)
                  : null,
              onTap: () => Navigator.pop(ctx, 'ru'),
            ),
            ListTile(
              title: const Text("O'zbek"),
              trailing: prefs.locale == 'uz'
                  ? const Icon(Icons.check, color: AppColors.expeditorAccent)
                  : null,
              onTap: () => Navigator.pop(ctx, 'uz'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null) {
      await ref
          .read(agentLocalPrefsProvider.notifier)
          .setPrefs((p) => p.copyWith(locale: picked));
    }
  }

  Widget _group(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AgentSurfaceCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: AppColors.textMuted,
                ),
              ),
            ),
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0)
                const Divider(height: 1, color: AppColors.divider),
              rows[i],
            ],
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;

  const _ToggleRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMuted,),
              ),
            ),
            Switch(
              value: value,
              onChanged: null,
              activeThumbColor: AppColors.expeditorAccent,
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueRow extends StatelessWidget {
  final String label;
  final String value;

  const _ValueRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600,),
              ),
            ),
            Text(
              value,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _NavRow({
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 56,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600,),
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800,),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

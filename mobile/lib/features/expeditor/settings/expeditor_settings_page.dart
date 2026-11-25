import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/app_product.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/prefs/agent_local_prefs.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../../auth/biometric_quick_login_tile.dart';
import '../shared/tezyuk_expeditor_chrome.dart';
import '../shell/expeditor_drawer.dart';

/// «Настройки» — ekspeditor. Veb «Конфигурации» bilan to'liq bog'langan:
/// barcha qiymatlar `session.mobileConfig` (serverdan sinxron) dan o'qiladi,
/// faqat «модератор» o'zgartira oladi. Til — qurilma sozlamasi (lokal).
class ExpeditorSettingsPage extends ConsumerWidget {
  const ExpeditorSettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfg = ref.watch(sessionProvider.select((s) => s.mobileConfig));
    final prefsAsync = ref.watch(agentLocalPrefsProvider);
    final accent = expeditorChromeAccent();

    return Scaffold(
      backgroundColor: expeditorPageBackground(),
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: Text(
          expeditorLabel('Настройки', 'Profil va sozlamalar'),
        ),
        actions: [
          IconButton(
            tooltip: expeditorLabel('Обновить настройки', 'Sozlamalarni yangilash'),
            icon: const Icon(Icons.sync),
            onPressed: () => _refreshConfig(context, ref),
          ),
        ],
      ),
      body: prefsAsync.when(
        loading: () => Center(child: CircularProgressIndicator(color: accent)),
        error: (e, _) => Center(child: Text('$e')),
        data: (prefs) => ListView(
          padding: const EdgeInsets.all(12),
          children: [
            _group(expeditorLabel('ОСНОВНЫЕ НАСТРОЙКИ', 'ASOSIY SOZLAMALAR'), [
              _NavRow(
                label: expeditorLabel('Язык приложении', 'Ilova tili'),
                value: prefs.localeLabel,
                onTap: () => _pickLocale(context, ref, prefs),
              ),
            ]),
            AgentSurfaceCard(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: BiometricQuickLoginTile(accentColor: accent),
            ),
            const SizedBox(height: 12),
            _group(expeditorLabel('ЗАКАЗ', 'BUYURTMA'), [
              _ToggleRow(
                label: expeditorLabel(
                  'Показывать предложение о бонусе',
                  'Bonus taklifini ko\'rsatish',
                ),
                value: _bonusOfferOn(cfg),
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Изменение (частный возврат)',
                  'O\'zgartirish (qisman qaytarish)',
                ),
                value: cfg?.orders.allowPartialReturnEdit ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Догруз (С авто экспедитора)',
                  'Qo\'shimcha yuklash (mashinadan)',
                ),
                value: cfg?.orders.allowReloadFromVehicle ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Возврат с полки по заказу',
                  'Buyurtma bo\'yicha javondan qaytarish',
                ),
                value: cfg?.orders.allowReturnFromShelf ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Причина возврата обязательна',
                  'Qaytarish sababi majburiy',
                ),
                value: cfg?.orders.returnReasonRequired ?? false,
                accent: accent,
              ),
            ]),
            _group(expeditorLabel('ОПЛАТА', 'TO\'LOV'), [
              _ToggleRow(
                label: expeditorLabel(
                  'Принятие оплаты за заказ',
                  'Buyurtma uchun to\'lov qabul qilish',
                ),
                value: cfg?.expeditor?.acceptPaymentForOrder ?? true,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Принятие оплаты при доставке',
                  'Yetkazishda to\'lov qabul qilish',
                ),
                value: cfg?.expeditor?.acceptPaymentOnDelivery ?? true,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Принятие оплаты от должников',
                  'Qarzdorlardan to\'lov qabul qilish',
                ),
                value: cfg?.expeditor?.acceptPaymentFromDebtors ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Строгий способ оплаты при доставке',
                  'Yetkazishda qat\'iy to\'lov usuli',
                ),
                value: cfg?.expeditor?.deliveryPaymentMethodStrict ?? false,
                accent: accent,
              ),
              _ValueRow(
                label: expeditorLabel('Валюта', 'Valyuta'),
                value: cfg?.expeditor?.currencySymbol ?? "so'm",
              ),
            ]),
            _group(expeditorLabel('НАКЛАДНЫЕ', 'YUKXATLAR'), [
              _ToggleRow(
                label: expeditorLabel(
                  'Face ID / отпечаток при важных действиях',
                  'Muhim amallarda Face ID / barmoq izi',
                ),
                value:
                    cfg?.expeditor?.fingerprintRequiredForShipmentConfirm ??
                        false,
                accent: accent,
              ),
            ]),
            _group(expeditorLabel('КЛИЕНТ', 'MIJOZ'), [
              _ToggleRow(
                label: expeditorLabel(
                  'Изменить местоположение клиента',
                  'Mijoz joylashuvini o\'zgartirish',
                ),
                value: cfg?.client.canChangeClientLocation ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Показать баланс клиента',
                  'Mijoz balansini ko\'rsatish',
                ),
                value: cfg?.client.showBalance ?? true,
                accent: accent,
              ),
            ]),
            _group('GPS', [
              _ValueRow(
                label: expeditorLabel(
                  'Интервал отслеживания местоположений',
                  'Joylashuvni kuzatish intervali',
                ),
                value: '${cfg?.gps.trackingIntervalSec ?? 300}',
              ),
              _ToggleRow(
                label: expeditorLabel('Всегда включен', 'Doim yoqilgan'),
                value: cfg?.gps.alwaysOn ?? false,
                accent: accent,
              ),
              _ToggleRow(
                label: expeditorLabel(
                  'Отслеживание включено',
                  'Kuzatish yoqilgan',
                ),
                value: cfg?.gps.trackingEnabled ?? false,
                accent: accent,
              ),
            ]),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                expeditorLabel(
                  'Эти настройки может изменить только модератор в веб-конфигурации.',
                  'Ushbu sozlamalarni faqat moderator veb konfiguratsiyada o\'zgartiradi.',
                ),
                style: AppTypography.bodyMedium.copyWith(
                  fontSize: 13,
                  color: isTezyukProduct
                      ? TezyukColors.onSurfaceVariant
                      : AppColors.textMuted,
                ),
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
      SnackBar(
        content: Text(
          expeditorLabel('Настройки обновлены', 'Sozlamalar yangilandi'),
        ),
      ),
    );
  }

  Future<void> _pickLocale(
    BuildContext context,
    WidgetRef ref,
    AgentLocalPrefs prefs,
  ) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: expeditorChromeSurface(),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                expeditorLabel('Язык приложении', 'Ilova tili'),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
            ),
            ListTile(
              title: const Text('Русский'),
              trailing: prefs.locale == 'ru'
                  ? Icon(Icons.check, color: expeditorChromeAccent())
                  : null,
              onTap: () => Navigator.pop(ctx, 'ru'),
            ),
            ListTile(
              title: const Text("O'zbek"),
              trailing: prefs.locale == 'uz'
                  ? Icon(Icons.check, color: expeditorChromeAccent())
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
  final Color accent;

  const _ToggleRow({
    required this.label,
    required this.value,
    required this.accent,
  });

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
              activeThumbColor: accent,
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

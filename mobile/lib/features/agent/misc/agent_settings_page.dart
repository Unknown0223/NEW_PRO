import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/prefs/agent_local_prefs.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../clients/clients_list_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import '../../auth/biometric_quick_login_tile.dart';
import '../shell/agent_app_bar.dart';
import '../sync/manual_sync_runner.dart';

class _SettingRow {
  final String id;
  final String label;
  final String? value;
  final bool? toggle;
  final bool readOnly;
  final bool chevron;
  final String? group;

  const _SettingRow({
    required this.id,
    required this.label,
    this.value,
    this.toggle,
    this.readOnly = false,
    this.chevron = false,
    this.group,
  });
}

/// Настройки — «Основные» (agent) + «Общие» (moderator / mobile_config).
class AgentSettingsPage extends ConsumerStatefulWidget {
  const AgentSettingsPage({super.key});

  @override
  ConsumerState<AgentSettingsPage> createState() => _AgentSettingsPageState();
}

class _AgentSettingsPageState extends ConsumerState<AgentSettingsPage> {
  int _tab = 0;

  List<_SettingRow> _mainRows(AgentLocalPrefs prefs) => [
        _SettingRow(
          id: 'locale',
          label: 'Ilova tili',
          value: prefs.localeLabel,
          chevron: true,
          group: 'ASOSIY SOZLAMALAR',
        ),
        const _SettingRow(
          id: 'quick_panel',
          label: 'Tezkor menyu (bo\'limlar)',
          chevron: true,
          group: 'NAVIGATSIYA',
        ),
        _SettingRow(
          id: 'full_sync_with_photo',
          label: 'Foto bilan to\'liq sinxronlash',
          toggle: prefs.fullSyncWithPhoto,
        ),
        _SettingRow(
          id: 'calendar_mode',
          label: 'Kalendar rejimi',
          toggle: prefs.calendarMode,
        ),
        _SettingRow(
          id: 'use_discount',
          label: 'Chegirmadan foydalanish',
          toggle: prefs.useDiscount,
        ),
        _SettingRow(
          id: 'show_bonus_offer',
          label: 'Bonus taklifini ko\'rsatish',
          toggle: prefs.showBonusOffer,
          group: 'BUYURTMA',
        ),
        _SettingRow(
          id: 'sort_clients',
          label: 'Mijozlarni alifbo tartibida saralash',
          toggle: prefs.sortClientsAlphabetically,
          group: 'FILTR SOZLAMALARI',
        ),
        _SettingRow(
          id: 'sort_products',
          label: 'Mahsulotlarni alifbo tartibida saralash',
          toggle: prefs.sortProductsAlphabetically,
        ),
        _SettingRow(
          id: 'show_boxes',
          label: 'Quti sonini ko\'rsatish',
          toggle: prefs.showBoxCount,
        ),
        _SettingRow(
          id: 'catalog_grid',
          label: 'Katalog: panjara (aks holda ro\'yxat)',
          toggle: prefs.catalogIsGrid,
          group: 'KATALOG',
        ),
      ];

  List<_SettingRow> _generalRows(MobileConfig? cfg) {
    final c = cfg?.client;
    final pl = cfg?.productList;
    bool fieldOn(String key) {
      final visible = c?.fieldsVisible;
      if (visible == null || visible.isEmpty) {
        return key == 'name' || key == 'phone' || key == 'address';
      }
      return visible[key] == true;
    }

    return [
      _SettingRow(
        id: 'can_create',
        label: 'Yangi savdo nuqtasi qo\'shish',
        toggle: c?.canCreate ?? false,
        readOnly: true,
        group: 'ASOSIY SOZLAMALAR',
      ),
      _SettingRow(
        id: 'consignment_new',
        label: 'Yangi mijoz uchun buyurtma (konsignatsiya emas)',
        toggle: pl?.allowSubmitForNewClient ?? false,
        readOnly: true,
      ),
      _SettingRow(
        id: 'show_balance',
        label: 'Mijoz balansini ko\'rsatish',
        toggle: c?.showBalance ?? true,
        readOnly: true,
      ),
      _SettingRow(
        id: 'phone_prefix',
        label: 'Telefon raqami prefiksi',
        value: c?.phonePrefix.isNotEmpty == true ? c!.phonePrefix : '+998',
        chevron: true,
        readOnly: true,
      ),
      _SettingRow(
        id: 'field_name',
        label: 'Nomi',
        toggle: fieldOn('name'),
        readOnly: true,
        group: 'TAHRIR UCHUN MAYDONLAR',
      ),
      _SettingRow(id: 'field_legal', label: 'Kompaniya nomi', toggle: fieldOn('legal_name'), readOnly: true),
      _SettingRow(id: 'field_category', label: 'Kategoriya', toggle: fieldOn('category'), readOnly: true),
      _SettingRow(id: 'field_territory', label: 'Hudud', toggle: fieldOn('territory'), readOnly: true),
      _SettingRow(id: 'field_inn', label: 'STIR', toggle: fieldOn('inn'), readOnly: true),
      _SettingRow(id: 'field_phone', label: 'Telefon', toggle: fieldOn('phone'), readOnly: true),
      _SettingRow(id: 'field_visit', label: 'Tashrif kunlari', toggle: fieldOn('visit_day'), readOnly: true),
      _SettingRow(id: 'field_address', label: 'Manzil', toggle: fieldOn('address'), readOnly: true),
      _SettingRow(
        id: 'bio_order',
        label: 'Buyurtma yuborishda Face ID / barmoq izi',
        toggle: cfg?.misc.biometricConfirmForOrderSubmit ?? false,
        readOnly: true,
        group: 'XAVFSIZLIK',
      ),
      _SettingRow(
        id: 'bio_payment',
        label: 'To\'lov qabulida Face ID / barmoq izi',
        toggle: cfg?.misc.biometricConfirmForPaymentAccept ?? false,
        readOnly: true,
      ),
      _SettingRow(
        id: 'face_verification',
        label: 'Yuz tekshiruvi (serverda selfie)',
        toggle: cfg?.misc.faceVerificationEnabled ?? false,
        readOnly: true,
        group: 'XAVFSIZLIK',
      ),
    ];
  }

  Future<void> _onMainRowTap(_SettingRow row, AgentLocalPrefs prefs) async {
    if (row.id == 'locale') {
      final picked = await showModalBottomSheet<String>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (ctx) => _LocalePickerSheet(current: prefs.locale),
      );
      if (picked != null) {
        await ref.read(agentLocalPrefsProvider.notifier).setPrefs((p) => p.copyWith(locale: picked));
      }
    } else if (row.id == 'quick_panel') {
      if (!mounted) return;
      context.push('/settings/quick');
    }
  }

  Future<void> _setMainToggle(String id, bool v, AgentLocalPrefs prefs) async {
    final n = ref.read(agentLocalPrefsProvider.notifier);
    switch (id) {
      case 'full_sync_with_photo':
        await n.setPrefs((p) => p.copyWith(fullSyncWithPhoto: v));
      case 'calendar_mode':
        await n.setPrefs((p) => p.copyWith(calendarMode: v));
        if (!v) ref.read(outletWeekdayTabProvider.notifier).state = 0;
      case 'use_discount':
        await n.setPrefs((p) => p.copyWith(useDiscount: v));
      case 'show_bonus_offer':
        await n.setPrefs((p) => p.copyWith(showBonusOffer: v));
      case 'sort_clients':
        await n.setPrefs((p) => p.copyWith(sortClientsAlphabetically: v));
        ref.invalidate(clientsListProvider);
      case 'sort_products':
        await n.setPrefs((p) => p.copyWith(sortProductsAlphabetically: v));
      case 'show_boxes':
        await n.setPrefs((p) => p.copyWith(showBoxCount: v));
      case 'catalog_grid':
        await n.setPrefs(
          (p) => p.copyWith(catalogViewMode: v ? 'grid' : 'list'),
        );
      default:
        break;
    }
    ref.invalidate(filteredClientsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(sessionProvider).mobileConfig;
    final prefsAsync = ref.watch(agentLocalPrefsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: 'Sozlamalar', showBack: true),
      body: prefsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(child: Text('$e')),
        data: (prefs) {
          final rows = _tab == 0 ? _mainRows(prefs) : _generalRows(cfg);
          return Column(
            children: [
              ColoredBox(
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  child: Row(
                    children: [
                      _tabChip('Asosiy sozlamalar', 0),
                      const SizedBox(width: 8),
                      _tabChip('Umumiy sozlamalar', 1),
                    ],
                  ),
                ),
              ),
              if (_tab == 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(
                    'Bu sozlamalarni faqat moderator o\'zgartirishi mumkin!',
                    style: AppTypography.bodyMedium.copyWith(fontSize: 13, color: AppColors.textMuted),
                  ),
                ),
              if (_tab == 0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => _runFullSyncWithPrefs(prefs),
                      icon: const Icon(Icons.sync, size: 20),
                      label: const Text('To\'liq sinxronlash'),
                    ),
                  ),
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
                  children: [
                    if (_tab == 0) ...[
                      SaEnter(
                        preset: SaMotionPreset.rise,
                        child: AgentSurfaceCard(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          child: const BiometricQuickLoginTile(),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    SaEnter(
                      delay: SaStaggerDelay.of(_tab == 0 ? 1 : 0),
                      preset: SaMotionPreset.rise,
                      child: _buildGrouped(
                        rows,
                        readOnly: _tab == 1,
                        prefs: prefs,
                        onRowTap: _tab == 0 ? (r) => _onMainRowTap(r, prefs) : null,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _runFullSyncWithPrefs(AgentLocalPrefs prefs) {
    startManualSync(context, ref, full: true);
  }

  Widget _tabChip(String label, int index) {
    final active = _tab == index;
    return Expanded(
      child: Material(
        color: active ? const Color(0xFFF0FDFA) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: () => setState(() => _tab = index),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: active ? AppColors.primary : AppColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGrouped(
    List<_SettingRow> rows, {
    required bool readOnly,
    required AgentLocalPrefs prefs,
    void Function(_SettingRow)? onRowTap,
  }) {
    final groups = <String, List<_SettingRow>>{};
    var current = '';
    for (final r in rows) {
      if (r.group != null) {
        current = r.group!;
        groups.putIfAbsent(current, () => []).add(r);
      } else {
        groups.putIfAbsent(current, () => []).add(r);
      }
    }

    return Column(
      children: groups.entries.map((entry) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: AgentSurfaceCard(
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (entry.key.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(
                      entry.key,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                for (var i = 0; i < entry.value.length; i++)
                  _rowTile(entry.value[i], i > 0, readOnly, prefs, onRowTap),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _rowTile(
    _SettingRow row,
    bool borderTop,
    bool readOnly,
    AgentLocalPrefs prefs,
    void Function(_SettingRow)? onRowTap,
  ) {
    final canToggle = row.toggle != null && !readOnly && !row.readOnly;
    return Column(
      children: [
        if (borderTop) const Divider(height: 1, color: AppColors.divider),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: row.chevron && onRowTap != null ? () => onRowTap(row) : null,
            child: SizedBox(
              height: 56,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        row.label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: readOnly || row.readOnly
                              ? AppColors.textMuted
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (row.toggle != null)
                      Switch(
                        value: row.toggle!,
                        onChanged: canToggle ? (v) => _setMainToggle(row.id, v, prefs) : null,
                        activeThumbColor: AppColors.primary,
                      ),
                    if (row.value != null)
                      Text(
                        row.value!,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    if (row.chevron)
                      const Icon(Icons.chevron_right, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _LocalePickerSheet extends StatelessWidget {
  final String current;
  const _LocalePickerSheet({required this.current});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AgentSheetHandle(),
          const Text('Ilova tili', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ListTile(
            title: const Text('Ruscha'),
            trailing: current == 'ru' ? const Icon(Icons.check, color: AppColors.primary) : null,
            onTap: () => Navigator.pop(context, 'ru'),
          ),
          ListTile(
            title: const Text("O'zbek"),
            trailing: current == 'uz' ? const Icon(Icons.check, color: AppColors.primary) : null,
            onTap: () => Navigator.pop(context, 'uz'),
          ),
        ],
      ),
    );
  }
}

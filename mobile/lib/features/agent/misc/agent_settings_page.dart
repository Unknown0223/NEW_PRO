import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/prefs/agent_local_prefs.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../clients/clients_list_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
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
          label: 'Язык приложения',
          value: prefs.localeLabel,
          chevron: true,
          group: 'ОСНОВНЫЕ НАСТРОЙКИ',
        ),
        _SettingRow(
          id: 'full_sync_with_photo',
          label: 'Полная синхронизация с фото',
          toggle: prefs.fullSyncWithPhoto,
        ),
        _SettingRow(
          id: 'calendar_mode',
          label: 'Использование календарного режима',
          toggle: prefs.calendarMode,
        ),
        _SettingRow(
          id: 'use_discount',
          label: 'Использование скидки',
          toggle: prefs.useDiscount,
        ),
        _SettingRow(
          id: 'show_bonus_offer',
          label: 'Показывать предложение о бонусе',
          toggle: prefs.showBonusOffer,
          group: 'ЗАКАЗ',
        ),
        _SettingRow(
          id: 'sort_clients',
          label: 'Сортировка клиентов в алфавитном порядке',
          toggle: prefs.sortClientsAlphabetically,
          group: 'НАСТРОЙКИ ФИЛЬТРА',
        ),
        _SettingRow(
          id: 'sort_products',
          label: 'Сортировка продуктов в алфавитном порядке',
          toggle: prefs.sortProductsAlphabetically,
        ),
        _SettingRow(
          id: 'show_boxes',
          label: 'Показать кол-во коробок',
          toggle: prefs.showBoxCount,
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
        label: 'Добавить новую торговую точку',
        toggle: c?.canCreate ?? false,
        readOnly: true,
        group: 'ОСНОВНЫЕ НАСТРОЙКИ',
      ),
      _SettingRow(
        id: 'consignment_new',
        label: 'Yangi mijozga buyurtma berish (konsignatsiya emas)',
        toggle: pl?.allowSubmitForNewClient ?? false,
        readOnly: true,
      ),
      _SettingRow(
        id: 'show_balance',
        label: 'Показать баланс клиента',
        toggle: c?.showBalance ?? true,
        readOnly: true,
      ),
      _SettingRow(
        id: 'phone_prefix',
        label: 'Префикс номера телефона',
        value: c?.phonePrefix.isNotEmpty == true ? c!.phonePrefix : '+998',
        chevron: true,
        readOnly: true,
      ),
      _SettingRow(
        id: 'field_name',
        label: 'Название',
        toggle: fieldOn('name'),
        readOnly: true,
        group: 'ДОСТУПНЫЕ ПОЛЯ ДЛЯ РЕДАКТИРОВАНИЯ',
      ),
      _SettingRow(id: 'field_legal', label: 'Название компании', toggle: fieldOn('legal_name'), readOnly: true),
      _SettingRow(id: 'field_category', label: 'Категория', toggle: fieldOn('category'), readOnly: true),
      _SettingRow(id: 'field_territory', label: 'Территория', toggle: fieldOn('territory'), readOnly: true),
      _SettingRow(id: 'field_inn', label: 'ИНН', toggle: fieldOn('inn'), readOnly: true),
      _SettingRow(id: 'field_phone', label: 'Телефон', toggle: fieldOn('phone'), readOnly: true),
      _SettingRow(id: 'field_visit', label: 'Дни посещения', toggle: fieldOn('visit_day'), readOnly: true),
      _SettingRow(id: 'field_address', label: 'Адрес', toggle: fieldOn('address'), readOnly: true),
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
      appBar: const AgentAppBar(title: 'Настройки', showBack: true),
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
                      _tabChip('Основные настройки', 0),
                      const SizedBox(width: 8),
                      _tabChip('Общие настройки', 1),
                    ],
                  ),
                ),
              ),
              if (_tab == 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(
                    'Эти настройки может изменить только модератор!',
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
                      label: const Text('Sinxronizatsiya (to\'liq)'),
                    ),
                  ),
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _buildGrouped(
                      rows,
                      readOnly: _tab == 1,
                      prefs: prefs,
                      onRowTap: _tab == 0 ? (r) => _onMainRowTap(r, prefs) : null,
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
          const Text('Язык приложения', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ListTile(
            title: const Text('Русский'),
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

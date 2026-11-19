import 'dart:convert';

import '../database/app_database.dart';

/// Agent «Основные настройки» — qurilmada saqlanadi (veb moderator emas).
class AgentLocalPrefs {
  static const storageKey = 'agent_local_prefs_v1';

  final String locale;
  final bool fullSyncWithPhoto;
  final bool calendarMode;
  final bool useDiscount;
  final bool showBonusOffer;
  final bool sortClientsAlphabetically;
  final bool sortProductsAlphabetically;
  final bool showBoxCount;
  /// `moving` | `stopped` — van_selling.allow_change_movement_status
  final String? vanMovementStatus;
  /// YYYY-MM-DD — mahalliy stock snapshot (server bilan sinxron)
  final String? stockSnapshotDay;

  const AgentLocalPrefs({
    this.locale = 'ru',
    this.fullSyncWithPhoto = true,
    this.calendarMode = true,
    this.useDiscount = true,
    this.showBonusOffer = true,
    this.sortClientsAlphabetically = true,
    this.sortProductsAlphabetically = true,
    this.showBoxCount = false,
    this.vanMovementStatus,
    this.stockSnapshotDay,
  });

  AgentLocalPrefs copyWith({
    String? locale,
    bool? fullSyncWithPhoto,
    bool? calendarMode,
    bool? useDiscount,
    bool? showBonusOffer,
    bool? sortClientsAlphabetically,
    bool? sortProductsAlphabetically,
    bool? showBoxCount,
    String? vanMovementStatus,
    String? stockSnapshotDay,
  }) =>
      AgentLocalPrefs(
        locale: locale ?? this.locale,
        fullSyncWithPhoto: fullSyncWithPhoto ?? this.fullSyncWithPhoto,
        calendarMode: calendarMode ?? this.calendarMode,
        useDiscount: useDiscount ?? this.useDiscount,
        showBonusOffer: showBonusOffer ?? this.showBonusOffer,
        sortClientsAlphabetically: sortClientsAlphabetically ?? this.sortClientsAlphabetically,
        sortProductsAlphabetically: sortProductsAlphabetically ?? this.sortProductsAlphabetically,
        showBoxCount: showBoxCount ?? this.showBoxCount,
        vanMovementStatus: vanMovementStatus ?? this.vanMovementStatus,
        stockSnapshotDay: stockSnapshotDay ?? this.stockSnapshotDay,
      );

  Map<String, dynamic> toJson() => {
        'locale': locale,
        'full_sync_with_photo': fullSyncWithPhoto,
        'calendar_mode': calendarMode,
        'use_discount': useDiscount,
        'show_bonus_offer': showBonusOffer,
        'sort_clients_alphabetically': sortClientsAlphabetically,
        'sort_products_alphabetically': sortProductsAlphabetically,
        'show_box_count': showBoxCount,
        if (vanMovementStatus != null) 'van_movement_status': vanMovementStatus,
        if (stockSnapshotDay != null) 'stock_snapshot_day': stockSnapshotDay,
      };

  factory AgentLocalPrefs.fromJson(Map<String, dynamic> j) => AgentLocalPrefs(
        locale: j['locale']?.toString() == 'uz' ? 'uz' : 'ru',
        fullSyncWithPhoto: j['full_sync_with_photo'] != false,
        calendarMode: j['calendar_mode'] != false,
        useDiscount: j['use_discount'] != false,
        showBonusOffer: j['show_bonus_offer'] != false,
        sortClientsAlphabetically: j['sort_clients_alphabetically'] != false,
        sortProductsAlphabetically: j['sort_products_alphabetically'] != false,
        showBoxCount: j['show_box_count'] == true,
        vanMovementStatus: j['van_movement_status']?.toString(),
        stockSnapshotDay: j['stock_snapshot_day']?.toString(),
      );

  static Future<AgentLocalPrefs> load() async {
    final db = AppDatabase();
    final raw = await db.getSyncMeta(storageKey);
    if (raw == null || raw.isEmpty) return const AgentLocalPrefs();
    try {
      return AgentLocalPrefs.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const AgentLocalPrefs();
    }
  }

  Future<void> save() async {
    await AppDatabase().setSyncMeta(storageKey, jsonEncode(toJson()));
  }

  String get localeLabel => locale == 'uz' ? "O'zbek" : 'Русский';
}

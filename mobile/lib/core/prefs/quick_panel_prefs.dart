import 'dart:convert';

import '../database/app_database.dart';

/// Tezkor panel bandi — sozlamalarda tartiblanadi.
class QuickPanelItem {
  final String id;
  final String label;
  final String route;
  final String icon; // Material icon name key

  const QuickPanelItem({
    required this.id,
    required this.label,
    required this.route,
    this.icon = 'chevron_right',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'route': route,
        'icon': icon,
      };

  factory QuickPanelItem.fromJson(Map<String, dynamic> j) => QuickPanelItem(
        id: j['id']?.toString() ?? '',
        label: j['label']?.toString() ?? '',
        route: j['route']?.toString() ?? '',
        icon: j['icon']?.toString() ?? 'chevron_right',
      );
}

/// Rol bo‘yicha tezkor panel — SharedPreferences o‘rniga sync_meta.
class QuickPanelPrefs {
  static String storageKey(String role) => 'quick_panel_items_$role';

  /// Agent default (pastki nav + foydali yo‘llar).
  static List<QuickPanelItem> defaultsForRole(String role) {
    switch (role) {
      case 'expeditor':
        return const [
          QuickPanelItem(id: 'home', label: 'Главная', route: '/home', icon: 'home'),
          QuickPanelItem(id: 'deliveries', label: 'Доставки', route: '/deliveries', icon: 'local_shipping'),
          QuickPanelItem(id: 'debtors', label: 'Должники', route: '/debtors', icon: 'account_balance_wallet'),
          QuickPanelItem(id: 'payments', label: 'Оплаты', route: '/payments', icon: 'payments'),
          QuickPanelItem(id: 'notifications', label: 'Уведомления', route: '/notifications', icon: 'notifications'),
          QuickPanelItem(id: 'profile', label: 'Профиль', route: '/profile', icon: 'person'),
        ];
      case 'supervisor':
        return const [
          QuickPanelItem(id: 'home', label: 'Главная', route: '/home', icon: 'home'),
          QuickPanelItem(id: 'agents', label: 'Агенты', route: '/agents', icon: 'groups'),
          QuickPanelItem(id: 'visits', label: 'Визиты', route: '/sv-visits', icon: 'place'),
          QuickPanelItem(id: 'gps', label: 'GPS', route: '/sv-gps', icon: 'my_location'),
          QuickPanelItem(id: 'notifications', label: 'Уведомления', route: '/sv-notifications', icon: 'notifications'),
          QuickPanelItem(id: 'profile', label: 'Профиль', route: '/profile', icon: 'person'),
        ];
      case 'cashier':
        return const [
          QuickPanelItem(id: 'home', label: 'Главная', route: '/home', icon: 'home'),
          QuickPanelItem(id: 'inbox', label: 'Inbox', route: '/bank-transfers', icon: 'inbox'),
          QuickPanelItem(id: 'tasks', label: 'Задачи', route: '/tasks', icon: 'task_alt'),
          QuickPanelItem(id: 'profile', label: 'Профиль', route: '/profile', icon: 'person'),
        ];
      default:
        return const [
          QuickPanelItem(id: 'home', label: 'Главная', route: '/home', icon: 'home'),
          QuickPanelItem(id: 'visits', label: 'Визиты', route: '/visits', icon: 'place'),
          QuickPanelItem(id: 'clients', label: 'Клиенты', route: '/clients', icon: 'storefront'),
          QuickPanelItem(id: 'orders', label: 'Заказы', route: '/orders', icon: 'receipt_long'),
          QuickPanelItem(id: 'order_create', label: 'Новый заказ', route: '/orders/create', icon: 'add_shopping_cart'),
          QuickPanelItem(id: 'kpi', label: 'KPI', route: '/kpi', icon: 'insights'),
          QuickPanelItem(id: 'notifications', label: 'Уведомления', route: '/notifications', icon: 'notifications'),
          QuickPanelItem(id: 'profile', label: 'Профиль', route: '/profile', icon: 'person'),
        ];
    }
  }

  /// Sozlamada qo‘shish mumkin bo‘lgan barcha agent bandlari.
  static List<QuickPanelItem> catalogForRole(String role) {
    if (role != 'agent') {
      return defaultsForRole(role);
    }
    return const [
      QuickPanelItem(id: 'home', label: 'Главная', route: '/home', icon: 'home'),
      QuickPanelItem(id: 'visits', label: 'Визиты', route: '/visits', icon: 'place'),
      QuickPanelItem(id: 'clients', label: 'Торговые точки', route: '/clients', icon: 'storefront'),
      QuickPanelItem(id: 'clients_new', label: 'Новая точка', route: '/clients/new', icon: 'add_business'),
      QuickPanelItem(id: 'orders', label: 'Заказы', route: '/orders', icon: 'receipt_long'),
      QuickPanelItem(id: 'order_create', label: 'Новый заказ', route: '/orders/create', icon: 'add_shopping_cart'),
      QuickPanelItem(id: 'kpi', label: 'KPI', route: '/kpi', icon: 'insights'),
      QuickPanelItem(id: 'route', label: 'Дневной план', route: '/kpi/route', icon: 'route'),
      QuickPanelItem(id: 'report', label: 'Отчёты', route: '/report', icon: 'bar_chart'),
      QuickPanelItem(id: 'debtors', label: 'Должники', route: '/debtors', icon: 'account_balance_wallet'),
      QuickPanelItem(id: 'debtors_orders', label: 'Должники по заказам', route: '/debtors-by-orders', icon: 'request_quote'),
      QuickPanelItem(id: 'warehouse', label: 'Остатки', route: '/warehouse-stock', icon: 'inventory_2'),
      QuickPanelItem(id: 'draft', label: 'Черновик', route: '/draft', icon: 'draft'),
      QuickPanelItem(id: 'tasks', label: 'Задачи', route: '/tasks', icon: 'task_alt'),
      QuickPanelItem(id: 'map', label: 'Карта', route: '/map', icon: 'map'),
      QuickPanelItem(id: 'tabel', label: 'Табель', route: '/tabel', icon: 'calendar_month'),
      QuickPanelItem(id: 'attendance', label: 'Посещаемость', route: '/attendance', icon: 'face'),
      QuickPanelItem(id: 'bonuses', label: 'Мои бонусы', route: '/bonuses', icon: 'card_giftcard'),
      QuickPanelItem(id: 'search', label: 'Поиск', route: '/search', icon: 'search'),
      QuickPanelItem(id: 'notifications', label: 'Уведомления', route: '/notifications', icon: 'notifications'),
      QuickPanelItem(id: 'settings', label: 'Настройки', route: '/settings', icon: 'settings'),
      QuickPanelItem(id: 'profile', label: 'Профиль', route: '/profile', icon: 'person'),
    ];
  }

  static Future<List<QuickPanelItem>> load(String role) async {
    final raw = await AppDatabase().getSyncMeta(storageKey(role));
    if (raw == null || raw.isEmpty) return defaultsForRole(role);
    try {
      final list = jsonDecode(raw) as List;
      final items = list
          .whereType<Map>()
          .map((e) => QuickPanelItem.fromJson(Map<String, dynamic>.from(e)))
          .where((e) => e.id.isNotEmpty && e.route.isNotEmpty)
          .toList();
      return items.isEmpty ? defaultsForRole(role) : items;
    } catch (_) {
      return defaultsForRole(role);
    }
  }

  static Future<void> save(String role, List<QuickPanelItem> items) async {
    await AppDatabase().setSyncMeta(
      storageKey(role),
      jsonEncode(items.map((e) => e.toJson()).toList()),
    );
  }

  static Future<void> reset(String role) async {
    await save(role, defaultsForRole(role));
  }
}

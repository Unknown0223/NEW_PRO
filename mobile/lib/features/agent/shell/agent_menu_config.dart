import 'package:flutter/material.dart';

import '../../../core/config/mobile_config.dart';

/// Menyu bandi — shablon `MenuScreen` / `MENU_ITEMS`.
class AgentMenuItem {
  final String label;
  final String sub;
  final String route;
  final IconData icon;
  final String group;
  final bool soon;
  final String? badge;
  final bool Function(MobileConfig? config)? visible;

  const AgentMenuItem({
    required this.label,
    required this.sub,
    required this.route,
    required this.icon,
    required this.group,
    this.soon = false,
    this.badge,
    this.visible,
  });
}

/// Shablon `GlobalChrome` — bo‘lim sarlavhalari.
const kAgentMenuGroupOrder = <String>[
  'Asosiy',
  'Savdo va buyurtma',
  'KPI va marshrut',
  'Moliya',
  'Jarayon',
  'Tizim',
];

/// Shablon tartibida menyu.
List<AgentMenuItem> agentMenuItems(MobileConfig? config) {
  final items = <AgentMenuItem>[
    const AgentMenuItem(
      label: 'Bosh sahifa',
      sub: 'Kunlik reja va faol vizit',
      route: '/home',
      icon: Icons.home_outlined,
      group: 'Asosiy',
    ),
    const AgentMenuItem(
      label: 'Yangi nuqta qo‘shish',
      sub: 'GPS + INN bilan ro‘yxatga olish',
      route: '/clients/new',
      icon: Icons.person_add_alt_1_outlined,
      group: 'Savdo va buyurtma',
    ),
    AgentMenuItem(
      label: 'Almashtirish so‘rovi',
      sub: 'Tovarni boshqasiga almashtirish',
      route: '/orders/special?mode=exchange',
      icon: Icons.swap_horiz_outlined,
      group: 'Savdo va buyurtma',
      visible: (c) => c?.misc.allowExchangeRequest == true,
    ),
    AgentMenuItem(
      label: 'Polkadan qaytarish',
      sub: 'Возврат с полки · muddati/brak',
      route: '/orders/special?mode=shelf-return',
      icon: Icons.undo_outlined,
      badge: 'S polki',
      group: 'Savdo va buyurtma',
      visible: (c) => c?.orders.allowReturnFromShelf == true,
    ),
    const AgentMenuItem(
      label: 'Savdo nuqtalari',
      sub: 'Mijozlar · qarz nazorati',
      route: '/clients',
      icon: Icons.storefront_outlined,
      group: 'Savdo va buyurtma',
    ),
    const AgentMenuItem(
      label: 'KPI ko‘rsatkichlar',
      sub: 'Bugungi va oylik bonus zinapoyasi',
      route: '/kpi',
      icon: Icons.auto_awesome_outlined,
      group: 'KPI va marshrut',
    ),
    const AgentMenuItem(
      label: 'Mening bonuslarim',
      sub: 'Bonus zinapoyasi va hisob',
      route: '/bonuses',
      icon: Icons.card_giftcard_outlined,
      group: 'KPI va marshrut',
    ),
    const AgentMenuItem(
      label: 'Kunlik marshrut rejasi',
      sub: 'Дневной план · vizitlar',
      route: '/kpi/route',
      icon: Icons.map_outlined,
      group: 'KPI va marshrut',
    ),
    const AgentMenuItem(
      label: 'Hisobotlar',
      sub: 'Savdo, qaytarish, balans',
      route: '/report',
      icon: Icons.description_outlined,
      group: 'KPI va marshrut',
    ),
    const AgentMenuItem(
      label: 'Qarzdorlar',
      sub: 'Mijozlar qarzi va to‘lovlar',
      route: '/debtors',
      icon: Icons.people_outline,
      group: 'Moliya',
    ),
    const AgentMenuItem(
      label: 'Buyurtma bo‘yicha qarzlar',
      sub: 'Nakladnoy kesimida',
      route: '/debtors-by-orders',
      icon: Icons.person_outline,
      group: 'Moliya',
    ),
    const AgentMenuItem(
      label: 'Ombor qoldiqlari',
      sub: 'Остатки на складе',
      route: '/warehouse-stock',
      icon: Icons.warehouse_outlined,
      group: 'Moliya',
    ),
    const AgentMenuItem(
      label: 'Qoralama',
      sub: 'Tugallanmagan buyurtmalar',
      route: '/draft',
      icon: Icons.inbox_outlined,
      group: 'Moliya',
    ),
    const AgentMenuItem(
      label: 'Vazifalar',
      sub: 'Supervayzer topshiriqlari',
      route: '/tasks',
      icon: Icons.task_alt_outlined,
      group: 'Jarayon',
    ),
    const AgentMenuItem(
      label: 'Mening lokatsiyam',
      sub: 'GPS xarita va geofence',
      route: '/map',
      icon: Icons.my_location_outlined,
      group: 'Jarayon',
    ),
    const AgentMenuItem(
      label: 'Tabel',
      sub: '1 / 0.5 / 0 / В / О / Б / К',
      route: '/tabel',
      icon: Icons.calendar_month_outlined,
      badge: 'Yangi',
      group: 'Jarayon',
    ),
    const AgentMenuItem(
      label: 'Davomat',
      sub: 'Face ID / Selfie · kelish-ketish',
      route: '/attendance',
      icon: Icons.face_retouching_natural,
      group: 'Jarayon',
    ),
    const AgentMenuItem(
      label: 'Maosh',
      sub: 'Hisoblangan oylik va avans',
      route: '',
      soon: true,
      icon: Icons.payments_outlined,
      group: 'Tizim',
    ),
    const AgentMenuItem(
      label: 'Sozlamalar',
      sub: 'Tema, sinxron, til, PIN',
      route: '/settings',
      icon: Icons.settings_outlined,
      group: 'Tizim',
    ),
  ];
  return items.where((it) => it.visible?.call(config) ?? true).toList();
}

/// Pastki nav yashiriladigan sahifalar (shablon).
bool agentShellHidesBottomNav(String location) {
  if (location == '/kpi' ||
      location == '/kpi/route' ||
      location.startsWith('/kpi/route?')) {
    return false;
  }
  if (location.startsWith('/clients/new')) return true;
  if (RegExp(r'^/clients/\d+').hasMatch(location)) return true;
  if (location.startsWith('/orders/create')) return true;
  if (location.startsWith('/orders/special')) return true;
  if (location == '/route' || location.startsWith('/route/')) return true;
  if (location.startsWith('/map')) return true;
  if (location.startsWith('/search')) return true;
  if (location.startsWith('/settings')) return true;
  if (location.startsWith('/debtors-by-orders')) return true;
  if (location.startsWith('/visits/start')) return true;
  if (location.startsWith('/visits/active')) return true;
  if (location.startsWith('/kpi/calc')) return true;
  if (location.startsWith('/kpi/route/days')) return true;
  return false;
}

const agentNavigationPages = <String>[
  '/home',
  '/visits',
  '/orders',
  '/kpi',
  '/kpi/route',
  '/report',
  '/clients',
  '/clients/new',
  '/debtors',
  '/debtors-by-orders',
  '/warehouse-stock',
  '/draft',
  '/map',
  '/settings',
  '/tabel',
  '/attendance',
  '/profile',
  '/notifications',
  '/orders/create',
  '/orders/special',
  '/search',
  '/route',
  '/tasks',
  '/bonuses',
  '/settings/quick',
];

const agentShellTabPaths = <String>[
  '/home',
  '/visits',
  '/orders',
  '/kpi',
  '/kpi/route',
];

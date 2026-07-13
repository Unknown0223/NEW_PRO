import '../../../core/config/mobile_config.dart';

/// Menyu bandi (develop-flutter-mobile-frontend shablon MenuScreen).
class AgentMenuItem {
  final String label;
  final String route;
  final bool soon;
  final bool Function(MobileConfig? config)? visible;

  const AgentMenuItem({
    required this.label,
    required this.route,
    this.soon = false,
    this.visible,
  });
}

/// Shablon tartibida menyu — backend/API ulanishi route orqali.
List<AgentMenuItem> agentMenuItems(MobileConfig? config) {
  final items = <AgentMenuItem>[
    const AgentMenuItem(label: 'Главная', route: '/home'),
    const AgentMenuItem(
      label: 'Добавить новую торговую точку',
      route: '/clients/new',
    ),
    const AgentMenuItem(label: 'Заказы', route: '/orders'),
    AgentMenuItem(
      label: 'Almashinuv so\'rovi',
      route: '/orders/special?mode=exchange',
      visible: (c) => c?.misc.allowExchangeRequest == true,
    ),
    AgentMenuItem(
      label: 'Polkadan qaytarish',
      route: '/orders/special?mode=shelf-return',
      visible: (c) => c?.orders.allowReturnFromShelf == true,
    ),
    const AgentMenuItem(label: 'KPI', route: '', soon: true),
    const AgentMenuItem(label: 'Зарплата', route: '', soon: true),
    const AgentMenuItem(label: 'Диагностика', route: '', soon: true),
    const AgentMenuItem(label: 'Должники', route: '/debtors'),
    const AgentMenuItem(label: 'Должники по заказам', route: '/debtors-by-orders'),
    const AgentMenuItem(label: 'Остатки на складе', route: '/warehouse-stock'),
    const AgentMenuItem(label: 'Черновик', route: '/draft'),
    const AgentMenuItem(label: 'Задачи', route: '', soon: true),
    const AgentMenuItem(label: 'Моя локация', route: '/map'),
    const AgentMenuItem(label: 'Настройки', route: '/settings'),
  ];
  return items.where((it) => !it.soon && (it.visible?.call(config) ?? true)).toList();
}

/// Pastki nav yashiriladigan sahifalar (shablon).
bool agentShellHidesBottomNav(String location) {
  if (location.startsWith('/clients/new')) return true;
  if (RegExp(r'^/clients/\d+').hasMatch(location)) return true;
  if (location.startsWith('/orders/create')) return true;
  if (location.startsWith('/orders/special')) return true;
  if (location.startsWith('/route')) return true;
  if (location.startsWith('/map')) return true;
  if (location.startsWith('/search')) return true;
  if (location.startsWith('/settings')) return true;
  if (location.startsWith('/debtors-by-orders')) return true;
  if (location.startsWith('/profile')) return true;
  return false;
}

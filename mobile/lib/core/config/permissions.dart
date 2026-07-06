class PermissionSet {
  final Set<String> keys;
  const PermissionSet(this.keys);
  static const empty = PermissionSet({});

  bool has(String key) => keys.contains(key);
  bool hasAny(List<String> perms) => perms.any(keys.contains);

  bool get canViewOrders => hasAny(['orders.view', 'orders.zakaz.prosmotr_zakaza']);
  bool get canCreateOrders => hasAny(['orders.create', 'orders.zakaz.sozdanie_zakaza']);
  bool get canViewClients => hasAny(['clients.spisok_klientov', 'clients.view']);
  bool get canViewDashboard => hasAny(['dashboard.view', 'dashboard.supervayzer']);

  factory PermissionSet.fromList(List<String> list) => PermissionSet(Set.from(list));
}

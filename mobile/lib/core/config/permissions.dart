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

  /// Bank Transfer Inbox (мобильный / веб).
  bool get canViewBankTransfers =>
      hasAny(['cash.perechisleniya.view', 'cash.perechisleniya']);
  bool get canUpdateBankTransfers =>
      hasAny(['cash.perechisleniya.update', 'cash.perechisleniya']);
  /// Confirm pending payment (`POST /payments/:id/confirm`).
  bool get canConfirmClientPayments =>
      hasAny(['cash.oplaty_klientov.update', 'cash.oplaty_klientov']);

  factory PermissionSet.fromList(List<String> list) => PermissionSet(Set.from(list));
}

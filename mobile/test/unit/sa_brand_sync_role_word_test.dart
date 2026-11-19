import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/design_system/design_system.dart';

/// Seam: role → BrandSync / RoleWelcome wordmark suffix (katalog SPLASH_META.word).
void main() {
  test('saBrandSyncRoleWord maps each role to catalog word', () {
    expect(saBrandSyncRoleWord('agent'), 'Agent');
    expect(saBrandSyncRoleWord('expeditor'), 'Dastavka');
    expect(saBrandSyncRoleWord('supervisor'), 'Nazorat');
    expect(saBrandSyncRoleWord('cashier'), 'Kassa');
  });

  test('saBrandSyncRoleWord defaults unknown/null to Agent', () {
    expect(saBrandSyncRoleWord(null), 'Agent');
    expect(saBrandSyncRoleWord(''), 'Agent');
    expect(saBrandSyncRoleWord('ADMIN'), 'Agent');
  });
}

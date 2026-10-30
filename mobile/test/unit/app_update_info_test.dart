import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/update/app_update_info.dart';
import 'package:salesdoc_mobile/core/update/app_update_installer.dart';

void main() {
  group('AppUpdateInfo', () {
    const requiredUpdate = AppUpdateInfo(
      required: true,
      optional: false,
      currentVersion: '3.1.21',
      minVersion: '3.1.0',
      latestVersion: '3.1.22',
      apkUrl: 'https://example.test/api/mobile/apk-download?slug=test1',
    );

    test('hasAction follows required/optional flags', () {
      expect(requiredUpdate.hasAction, isTrue);
      const idle = AppUpdateInfo(
        required: false,
        optional: false,
        currentVersion: '3.1.22',
        latestVersion: '3.1.22',
      );
      expect(idle.hasAction, isFalse);
    });

    test('uses APK URL for in-app installation', () {
      expect(requiredUpdate.effectiveApkUrl, contains('apk-download'));
    });
  });

  test('signature mismatch exception is recognizable', () {
    final e = AppUpdateSignatureException('SIGNATURE_MISMATCH', apkPath: '/tmp/x.apk');
    expect(e.toString(), contains('SIGNATURE_MISMATCH'));
    expect(e.apkPath, '/tmp/x.apk');
  });
}

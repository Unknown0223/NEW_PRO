import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/prefs/agent_local_prefs.dart';

void main() {
  test('AgentLocalPrefs roundtrip json', () {
    const p = AgentLocalPrefs(
      locale: 'uz',
      fullSyncWithPhoto: false,
      calendarMode: false,
      showBonusOffer: true,
      showBoxCount: true,
    );
    final restored = AgentLocalPrefs.fromJson(p.toJson());
    expect(restored.locale, 'uz');
    expect(restored.fullSyncWithPhoto, isFalse);
    expect(restored.calendarMode, isFalse);
    expect(restored.showBonusOffer, isTrue);
    expect(restored.showBoxCount, isTrue);
  });

  test('showBonusOffer defaults true when key missing', () {
    final restored = AgentLocalPrefs.fromJson({'locale': 'ru'});
    expect(restored.showBonusOffer, isTrue);
  });
}

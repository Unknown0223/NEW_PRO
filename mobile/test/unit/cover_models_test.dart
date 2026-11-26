import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/cover/cover_models.dart';

void main() {
  test('coverStatusLabel maps known statuses', () {
    expect(coverStatusLabel('faol'), 'Faol');
    expect(coverStatusLabel('kutilmoqda'), 'Kutilmoqda');
  });

  test('coverIsActive', () {
    expect(coverIsActive({'status': 'faol'}), isTrue);
    expect(coverIsActive({'status': 'kutilmoqda'}), isFalse);
    expect(coverIsActive(null), isFalse);
  });

  test('coverPersonLabel shows name only', () {
    expect(
      coverPersonLabel({'agent_name': 'Jakbarova Muslima'}, 'agent_name'),
      'Jakbarova Muslima',
    );
    expect(coverPersonLabel({'agent_name': ''}, 'agent_name'), '—');
  });

  test('coverPairSubtitle', () {
    expect(
      coverPairSubtitle({
        'agent_name': 'Agent A',
        'svr_name': 'SVR B',
      }),
      'Agent A ↔ SVR B',
    );
    expect(coverPairSubtitle(null), 'Agent ↔ SVR');
  });
}

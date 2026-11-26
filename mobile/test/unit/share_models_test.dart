import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/share/share_models.dart';

void main() {
  test('ShareRequestSummary.fromJson reads status and orders', () {
    final s = ShareRequestSummary.fromJson({
      'id': 5,
      'status': 'kutilmoqda',
      'sender_user_id': 1,
      'receiver_user_id': 2,
      'sender_name': 'Aliyev Anvar',
      'receiver_name': 'Karimov Botir',
      'orders': [
        {'order_id': 10},
        {'order_id': 11},
      ],
    });
    expect(s.id, 5);
    expect(s.status, 'kutilmoqda');
    expect(s.orderCount, 2);
    expect(s.counterpartLabel(inbox: true), 'Aliyev Anvar');
    expect(s.counterpartLabel(inbox: false), 'Karimov Botir');
    expect(shareStatusLabel('faol'), 'Faol');
  });
}

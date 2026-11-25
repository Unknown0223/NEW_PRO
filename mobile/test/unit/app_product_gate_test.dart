import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/app_product.dart';

void main() {
  test('parseAppProduct defaults to salesdoc', () {
    expect(parseAppProduct(null), AppProduct.salesdoc);
  });

  test('parseAppProduct accepts tezyuk', () {
    expect(parseAppProduct('tezyuk'), AppProduct.tezyuk);
    expect(parseAppProduct('TEZYUK'), AppProduct.tezyuk);
  });

  test('parseAppProduct treats salesdoc flavor string as salesdoc', () {
    expect(parseAppProduct('salesdoc'), AppProduct.salesdoc);
  });

  test('tezyukAllowsRole only expeditor', () {
    expect(tezyukAllowsRole('expeditor'), isTrue);
    expect(tezyukAllowsRole('agent'), isFalse);
    expect(tezyukAllowsRole('supervisor'), isFalse);
  });

  test('salesdoc allows any role string for gate helper', () {
    expect(productAllowsRole(AppProduct.salesdoc, 'agent'), isTrue);
    expect(productAllowsRole(AppProduct.tezyuk, 'expeditor'), isTrue);
    expect(productAllowsRole(AppProduct.tezyuk, 'agent'), isFalse);
  });
}

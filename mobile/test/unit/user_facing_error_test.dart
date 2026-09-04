import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/api/api_exceptions.dart';
import 'package:salesdoc_mobile/core/errors/user_facing_error.dart';

void main() {
  test('ApiException.toString is the user message only', () {
    const e = ApiException(
      message: 'Нет доступа к этому действию. Обратитесь к администратору.',
      statusCode: 403,
      code: 'ForbiddenPermission',
    );
    expect(e.toString(), isNot(contains('ApiException')));
    expect(e.toString(), isNot(contains('ForbiddenPermission')));
    expect(e.toString(), contains('Нет доступа'));
  });

  test('ForbiddenPermission maps to a human sentence', () {
    final mapped = mapDioException(
      DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 403,
          data: {'error': 'ForbiddenPermission'},
        ),
        type: DioExceptionType.badResponse,
      ),
    );
    expect(mapped.message, contains('администратору'));
    expect(mapped.message.toLowerCase(), isNot(contains('forbidden')));
    expect(UserFacingError.toast(mapped, action: 'Не удалось загрузить фотоотчёты'), isNot(contains('ApiException')));
    expect(UserFacingError.toast(mapped, action: 'Не удалось загрузить фотоотчёты'), isNot(contains('403')));
  });

  test('stripTechnical removes dumped exception wrappers', () {
    expect(
      UserFacingError.stripTechnical(
        'Фотоотчёты не загрузились: ApiException (403): ForbiddenPermission!: Mobil ruxsatlar yo\'q',
      ),
      isNot(contains('ApiException')),
    );
  });
}

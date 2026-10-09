import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  /// Backend `error` code (e.g. INVALID_CREDENTIALS, SESSION_LIMIT).
  final String? code;
  const ApiException({required this.message, this.statusCode, this.code});
  @override
  String toString() => message;

  factory ApiException.fromStatusCode(int statusCode, String message, {String? code}) {
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return InvalidCredentialsException(message: message);
      case 'SESSION_LIMIT':
        return SessionLimitException(message: message);
      case 'SESSION_REVOKED':
        return SessionRevokedException(message: message);
      case 'APP_ACCESS_DENIED':
        return const AppAccessDeniedException();
      case 'USER_NOT_ON_SLOT':
        return UserNotOnSlotException(message: message);
    }
    switch (statusCode) {
      case 401:
        return UnauthorizedException(message: message, code: code);
      case 403:
        return ForbiddenException(message: message, code: code);
      case 404:
        return NotFoundException(message: message, code: code);
      default:
        return ApiException(message: message, statusCode: statusCode, code: code);
    }
  }
}

/// Backend `{ error, message? }` va Dio xabarlarini foydalanuvchi tiliga.
ApiException mapDioException(DioException e, {Map<String, String>? extraCodes}) {
  if (e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout) {
    return const NetworkException();
  }

  final status = e.response?.statusCode ?? 0;
  final data = e.response?.data;
  var apiCode = '';
  var apiMessage = '';
  if (data is Map) {
    apiCode = data['error']?.toString() ?? '';
    apiMessage = data['message']?.toString() ?? '';
  }

  const known = {
    'Unauthorized': 'Сессия истекла. Войдите снова.',
    'Invalid or expired access token': 'Сессия истекла. Войдите снова.',
    'ValidationError': 'Отправлены некорректные данные',
    'InsufficientStock': 'Недостаточно остатка на складе',
    'NoPrice': 'Цена товара не найдена — проверьте тип цены',
    'BadProduct': 'Товар не найден или недоступен для агента',
    'BadClient': 'Клиент не найден или не привязан к агенту',
    'ClientInactive':
        'Клиент неактивен — акции и заказы недоступны до подтверждения оператором',
    'PhotoReportRequired': 'Для заказа нужен сегодняшний фотоотчёт',
    'BadWarehouse': 'Склад не найден',
    'BadAgent': 'Агент не найден',
    'OrderRestricted': 'Ограничение на заказ — обратитесь к администратору',
    'AgentNotOnSlot':
        'Агент не на рабочем месте — новый заказ запрещён (только сбор долга)',
    'CreditLimitExceeded': 'Превышен кредитный лимит',
    'OrderBlockedByDebt':
        'Обычный заказ запрещён: у клиента есть долг. Снимите долг или обратитесь к администратору',
    'ConsignmentClientDisabled':
        'Консигнация для этого клиента запрещена администратором',
    'ConsignmentBlockedByDebt':
        'Консигнация запрещена: у клиента есть долг по консигнации',
    'ConsignmentRequiresAgent': 'Для консигнации нужен агент',
    'ConsignmentAgentDisabled': 'Консигнация для агента отключена',
    'ConsignmentLimitExceeded': 'Превышен лимит консигнации',
    'BadConsignmentDueDate': 'Неверная дата оплаты по консигнации',
    'EmptyItems': 'Корзина пуста — для расчёта бонуса добавьте товары',
    'BadBonusGiftOverride': 'Неверный выбор бонусного подарка — откройте заново или выберите автобонус',
    'APP_ACCESS_DENIED': 'Доступ к приложению отключён',
    'USER_NOT_ON_SLOT':
        'Не назначен на рабочее место. Обратитесь к администратору.',
    'WORKDAY_OFF':
        'Сегодня нерабочий день по графику «Рабочие дни» — пользоваться системой нельзя.',
    'ForbiddenRole': 'Это действие недоступно для вашей роли. Обратитесь к администратору.',
    'ForbiddenPermission': 'Нет доступа к этому действию. Обратитесь к администратору.',
    'DuplicatePhone': 'Этот телефон уже используется',
    'DuplicateName': 'Клиент с таким названием уже существует',
    'DuplicateClientCode': 'Этот код клиента уже занят',
    'DuplicateInn': 'Этот ИНН уже занят — такой клиент уже существует',
    'DuplicatePinfl': 'Этот ПИНФЛ уже занят — такой клиент уже существует',
    'DuplicateClient': 'Такой клиент уже существует (территория, название, ИНН/ПИНФЛ)',
    'DuplicateInactive': 'Такой клиент уже существует, его статус — неактивен.',
    'TENANT_NOT_FOUND': 'Неверный код компании',
    'TenantNotFound': 'Неверный код компании',
    'INVALID_CREDENTIALS': 'Неверный логин или пароль',
    'SESSION_LIMIT':
        'Лимит активных сессий исчерпан. Завершите вход на другом устройстве или обратитесь к администратору.',
    'SESSION_REVOKED': 'Сессия завершена. Войдите снова.',
  };

  final limitMsg = _formatLimitError(apiCode, data is Map ? data : null);
  if (limitMsg != null) {
    return ApiException.fromStatusCode(status, limitMsg, code: apiCode.isEmpty ? null : apiCode);
  }

  final merged = {...known, ...?extraCodes};
  final key = apiMessage.isNotEmpty ? apiMessage : apiCode;
  if (merged.containsKey(key)) {
    return ApiException.fromStatusCode(status, merged[key]!, code: apiCode.isEmpty ? null : apiCode);
  }
  if (apiCode.isNotEmpty && merged.containsKey(apiCode)) {
    return ApiException.fromStatusCode(status, merged[apiCode]!, code: apiCode);
  }
  if (apiMessage.isNotEmpty) {
    return ApiException.fromStatusCode(status, apiMessage, code: apiCode.isEmpty ? null : apiCode);
  }
  if (apiCode.isNotEmpty) {
    return ApiException.fromStatusCode(status, apiCode, code: apiCode);
  }

  final routeMsg = data is Map ? data['message']?.toString() ?? '' : '';
  if (status == 404 &&
      (routeMsg.contains('bonus-preview') || routeMsg.contains('Route POST'))) {
    return const ApiException(
      message: 'Устаревшая версия сервера — перезапустите backend (npm run dev)',
      statusCode: 404,
    );
  }

  final dioMsg = e.message ?? '';
  if (dioMsg.contains('status code of')) {
    return ApiException(
      message: status == 400
          ? 'Ошибка запроса — проверьте данные'
          : 'Ошибка сервера ($status)',
      statusCode: status > 0 ? status : null,
    );
  }
  if (dioMsg.isEmpty) {
    final kind = e.type.name;
    if (e.type == DioExceptionType.cancel) {
      return const ApiException(message: 'Запрос отменён — попробуйте ещё раз');
    }
    if (e.type == DioExceptionType.badResponse) {
      return ApiException(
        message: status > 0 ? 'Некорректный ответ сервера ($status)' : 'Некорректный ответ сервера',
        statusCode: status > 0 ? status : null,
      );
    }
    if (e.type == DioExceptionType.unknown) {
      return ApiException(
        message: 'Связь с сетью или сервером прервана ($kind)',
        statusCode: status > 0 ? status : null,
      );
    }
    return ApiException(
      message: 'Синхронизация прервана — проверьте интернет и попробуйте ещё раз',
      statusCode: status > 0 ? status : null,
    );
  }
  return ApiException(message: dioMsg, statusCode: status > 0 ? status : null);
}

String? _formatLimitError(String apiCode, Map<dynamic, dynamic>? data) {
  if (data == null) return null;
  String? pick(String key) {
    final v = data[key];
    if (v == null) return null;
    final s = v.toString().trim();
    return s.isEmpty ? null : s;
  }

  if (apiCode == 'CreditLimitExceeded') {
    final limit = pick('credit_limit');
    final outstanding = pick('outstanding');
    final orderTotal = pick('order_total');
    final parts = <String>[];
    if (limit != null) parts.add('лимит: $limit');
    if (outstanding != null) parts.add('долг: $outstanding');
    if (orderTotal != null) parts.add('заказ: $orderTotal');
    return parts.isEmpty ? 'Превышен кредитный лимит' : 'Превышен кредитный лимит (${parts.join(', ')})';
  }
  if (apiCode == 'ConsignmentLimitExceeded') {
    final limit = pick('consignment_limit');
    final outstanding = pick('outstanding');
    final orderTotal = pick('order_total');
    final parts = <String>[];
    if (limit != null) parts.add('лимит: ${_fmtMoneyPlain(limit)}');
    if (outstanding != null) parts.add('долг: ${_fmtMoneyPlain(outstanding)}');
    if (limit != null && outstanding != null && orderTotal != null) {
      final lim = double.tryParse(limit.replaceAll(' ', '').replaceAll(',', '.'));
      final out = double.tryParse(outstanding.replaceAll(' ', '').replaceAll(',', '.'));
      if (lim != null && out != null) {
        parts.add('доступно: ${_fmtMoneyPlain((lim - out).toString())}');
      }
    }
    if (orderTotal != null) parts.add('заказ: ${_fmtMoneyPlain(orderTotal)}');
    return parts.isEmpty ? 'Превышен лимит консигнации' : 'Превышен лимит консигнации (${parts.join(', ')})';
  }
  return null;
}

String _fmtMoneyPlain(String raw) {
  final cleaned = raw.trim().replaceAll(' ', '').replaceAll(',', '.');
  final v = double.tryParse(cleaned);
  if (v == null) return raw.trim();
  final n = v.round();
  final s = n.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return n < 0 ? '-$buf' : buf.toString();
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    super.message = 'Сессия истекла. Войдите снова.',
    super.code,
  }) : super(statusCode: 401);
}

/// Login: noto‘g‘ri login/parol (401 INVALID_CREDENTIALS).
class InvalidCredentialsException extends UnauthorizedException {
  const InvalidCredentialsException({
    super.message = 'Неверный логин или пароль',
  }) : super(code: 'INVALID_CREDENTIALS');
}

/// Login: faol sessiyalar limiti (403 SESSION_LIMIT).
class SessionLimitException extends ApiException {
  const SessionLimitException({
    super.message =
        'Лимит активных сессий исчерпан. Завершите вход на другом устройстве или обратитесь к администратору.',
  }) : super(statusCode: 403, code: 'SESSION_LIMIT');
}

/// Sessiya admin tomonidan yoki boshqa qurilmadan yopilgan (401 SESSION_REVOKED).
class SessionRevokedException extends UnauthorizedException {
  const SessionRevokedException({
    super.message = 'Сессия завершена. Войдите снова.',
  }) : super(code: 'SESSION_REVOKED');
}

class ForbiddenException extends ApiException {
  const ForbiddenException({
    super.message = 'Нет доступа',
    super.code,
  }) : super(statusCode: 403);
}

class NotFoundException extends ApiException {
  const NotFoundException({
    super.message = 'Не найдено',
    super.code,
  }) : super(statusCode: 404);
}

class NetworkException extends ApiException {
  const NetworkException({super.message = 'Нет связи с сервером'});
}

class RoleNotAllowedException extends ApiException {
  const RoleNotAllowedException({super.message = 'Нет доступа к мобильному приложению'});
}

class AppAccessDeniedException extends ApiException {
  const AppAccessDeniedException({
    super.message = 'Доступ к приложению отключён',
  }) : super(statusCode: 403, code: 'APP_ACCESS_DENIED');
}

class UserNotOnSlotException extends ApiException {
  const UserNotOnSlotException({
    super.message =
        'Не назначен на рабочее место. Обратитесь к администратору.',
  }) : super(statusCode: 403, code: 'USER_NOT_ON_SLOT');
}

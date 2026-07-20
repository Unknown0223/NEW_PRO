import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  /// Backend `error` code (e.g. INVALID_CREDENTIALS, SESSION_LIMIT).
  final String? code;
  const ApiException({required this.message, this.statusCode, this.code});
  @override
  String toString() => 'ApiException($statusCode${code != null ? ', $code' : ''}): $message';

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
    'Unauthorized': 'Sessiya tugadi. Qayta kiring.',
    'Invalid or expired access token': 'Sessiya tugadi. Qayta kiring.',
    'ValidationError': 'Noto\'g\'ri ma\'lumot yuborildi',
    'InsufficientStock': 'Omborda yetarli qoldiq yo\'q',
    'NoPrice': 'Mahsulot narxi topilmadi — narx turini tekshiring',
    'BadProduct': 'Mahsulot topilmadi yoki agent uchun ruxsat yo\'q',
    'BadClient': 'Mijoz topilmadi yoki bog\'lanmagan',
    'PhotoReportRequired': 'Buyurtma uchun bugungi fotoотчет kerak',
    'BadWarehouse': 'Ombor topilmadi',
    'BadAgent': 'Agent topilmadi',
    'OrderRestricted': 'Buyurtma cheklovi — administrator bilan bog\'laning',
    'AgentNotOnSlot':
        'Агент не на рабочем месте — новый заказ запрещён (только сбор долга)',
    'CreditLimitExceeded': 'Kredit limiti oshdi',
    'OrderBlockedByDebt':
        'Обычный заказ запрещён: у клиента есть долг. Снимите долг или обратитесь к администратору',
    'ConsignmentClientDisabled':
        'Консигнация для этого клиента запрещена администратором',
    'ConsignmentBlockedByDebt':
        'Консигнация запрещена: у клиента есть долг по консигнации',
    'ConsignmentRequiresAgent': 'Konsignatsiya uchun agent kerak',
    'ConsignmentAgentDisabled': 'Agent uchun konsignatsiya o\'chirilgan',
    'ConsignmentLimitExceeded': 'Konsignatsiya limiti oshdi',
    'BadConsignmentDueDate': 'Konsignatsiya to\'lov sanasi noto\'g\'ri',
    'EmptyItems': 'Savat bo\'sh — bonus hisoblash uchun mahsulot kerak',
    'BadBonusGiftOverride': 'Bonus sovg\'a tanlovi noto\'g\'ri — qayta oching yoki avto bonusni tanlang',
    'APP_ACCESS_DENIED': 'Ilova kirish o\'chirilgan',
    'USER_NOT_ON_SLOT':
        'Не назначен на рабочее место. Обратитесь к администратору.',
    'ForbiddenRole': 'Ruxsat yo\'q',
    'ForbiddenPermission': 'Mobil ruxsatlar yo\'q',
    'DuplicatePhone': 'Bu telefon allaqachon mavjud',
    'DuplicateName': 'Shu nomdagi mijoz mavjud',
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
      message: 'Server eski versiya — backend ni qayta ishga tushiring (npm run dev)',
      statusCode: 404,
    );
  }

  final dioMsg = e.message ?? '';
  if (dioMsg.contains('status code of')) {
    return ApiException(
      message: status == 400
          ? 'So\'rov xato — ma\'lumotlarni tekshiring'
          : 'Server xato ($status)',
      statusCode: status > 0 ? status : null,
    );
  }
  return ApiException(message: dioMsg.isEmpty ? 'Noma\'lum xato' : dioMsg, statusCode: status > 0 ? status : null);
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
    if (limit != null) parts.add('limit: $limit');
    if (outstanding != null) parts.add('qarz: $outstanding');
    if (orderTotal != null) parts.add('buyurtma: $orderTotal');
    return parts.isEmpty ? 'Kredit limiti oshdi' : 'Kredit limiti oshdi (${parts.join(', ')})';
  }
  if (apiCode == 'ConsignmentLimitExceeded') {
    final limit = pick('consignment_limit');
    final outstanding = pick('outstanding');
    final orderTotal = pick('order_total');
    final parts = <String>[];
    if (limit != null) parts.add('limit: ${_fmtMoneyPlain(limit)}');
    if (outstanding != null) parts.add('qarz: ${_fmtMoneyPlain(outstanding)}');
    if (limit != null && outstanding != null && orderTotal != null) {
      final lim = double.tryParse(limit.replaceAll(' ', '').replaceAll(',', '.'));
      final out = double.tryParse(outstanding.replaceAll(' ', '').replaceAll(',', '.'));
      if (lim != null && out != null) {
        parts.add('mavjud: ${_fmtMoneyPlain((lim - out).toString())}');
      }
    }
    if (orderTotal != null) parts.add('buyurtma: ${_fmtMoneyPlain(orderTotal)}');
    return parts.isEmpty ? 'Konsignatsiya limiti oshdi' : 'Konsignatsiya limiti oshdi (${parts.join(', ')})';
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
    super.message = 'Sessiya tugadi. Qayta login qiling.',
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
    super.message = 'Ruxsat yo\'q',
    super.code,
  }) : super(statusCode: 403);
}

class NotFoundException extends ApiException {
  const NotFoundException({
    super.message = 'Topilmadi',
    super.code,
  }) : super(statusCode: 404);
}

class NetworkException extends ApiException {
  const NetworkException({super.message = 'Нет связи с сервером'});
}

class RoleNotAllowedException extends ApiException {
  const RoleNotAllowedException({super.message = 'Mobil ilovaga ruxsat yo\'q'});
}

class AppAccessDeniedException extends ApiException {
  const AppAccessDeniedException({
    super.message = 'Ilova kirish o\'chirilgan',
  }) : super(statusCode: 403, code: 'APP_ACCESS_DENIED');
}

class UserNotOnSlotException extends ApiException {
  const UserNotOnSlotException({
    super.message =
        'Не назначен на рабочее место. Обратитесь к администратору.',
  }) : super(statusCode: 403, code: 'USER_NOT_ON_SLOT');
}

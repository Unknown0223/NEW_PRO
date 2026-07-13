import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException({required this.message, this.statusCode});
  @override
  String toString() => 'ApiException($statusCode): $message';

  factory ApiException.fromStatusCode(int statusCode, String message) {
    switch (statusCode) {
      case 401:
        return UnauthorizedException(message: message);
      case 403:
        return ForbiddenException(message: message);
      case 404:
        return NotFoundException(message: message);
      default:
        return ApiException(message: message, statusCode: statusCode);
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
    'CreditLimitExceeded': 'Kredit limiti oshdi',
    'ConsignmentRequiresAgent': 'Konsignatsiya uchun agent kerak',
    'ConsignmentAgentDisabled': 'Agent uchun konsignatsiya o\'chirilgan',
    'ConsignmentLimitExceeded': 'Konsignatsiya limiti oshdi',
    'BadConsignmentDueDate': 'Konsignatsiya to\'lov sanasi noto\'g\'ri',
    'EmptyItems': 'Savat bo\'sh — bonus hisoblash uchun mahsulot kerak',
    'BadBonusGiftOverride': 'Bonus sovg\'a tanlovi noto\'g\'ri — qayta oching yoki avto bonusni tanlang',
    'APP_ACCESS_DENIED': 'Ilova kirish o\'chirilgan',
    'ForbiddenRole': 'Ruxsat yo\'q',
    'ForbiddenPermission': 'Mobil ruxsatlar yo\'q',
    'DuplicatePhone': 'Bu telefon allaqachon mavjud',
    'DuplicateName': 'Shu nomdagi mijoz mavjud',
    'TENANT_NOT_FOUND': 'Неверный код компании',
    'TenantNotFound': 'Неверный код компании',
    'INVALID_CREDENTIALS': 'Неверный логин или пароль',
  };

  final limitMsg = _formatLimitError(apiCode, data is Map ? data : null);
  if (limitMsg != null) {
    return ApiException.fromStatusCode(status, limitMsg);
  }

  final merged = {...known, ...?extraCodes};
  final key = apiMessage.isNotEmpty ? apiMessage : apiCode;
  if (merged.containsKey(key)) {
    return ApiException.fromStatusCode(status, merged[key]!);
  }
  if (apiCode.isNotEmpty && merged.containsKey(apiCode)) {
    return ApiException.fromStatusCode(status, merged[apiCode]!);
  }
  if (apiMessage.isNotEmpty) {
    return ApiException.fromStatusCode(status, apiMessage);
  }
  if (apiCode.isNotEmpty) {
    return ApiException.fromStatusCode(status, apiCode);
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
    if (limit != null) parts.add('limit: $limit');
    if (outstanding != null) parts.add('qarz: $outstanding');
    if (orderTotal != null) parts.add('buyurtma: $orderTotal');
    return parts.isEmpty ? 'Konsignatsiya limiti oshdi' : 'Konsignatsiya limiti oshdi (${parts.join(', ')})';
  }
  return null;
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({super.message = 'Sessiya tugadi. Qayta login qiling.'})
      : super(statusCode: 401);
}

class ForbiddenException extends ApiException {
  const ForbiddenException({super.message = 'Ruxsat yo\'q'});
}

class NotFoundException extends ApiException {
  const NotFoundException({super.message = 'Topilmadi'});
}

class NetworkException extends ApiException {
  const NetworkException({super.message = 'Нет связи с сервером'});
}

class RoleNotAllowedException extends ApiException {
  const RoleNotAllowedException({super.message = 'Mobil ilovaga ruxsat yo\'q'});
}

class AppAccessDeniedException extends ApiException {
  const AppAccessDeniedException({super.message = 'Ilova kirish o\'chirilgan'});
}

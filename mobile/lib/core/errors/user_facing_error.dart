import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:sqflite/sqflite.dart';

import '../api/api_exceptions.dart';
import '../api/dio_client.dart';
import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Foydalanuvchi uchun tushunarli xato (texnik URL alohida).
class UserFacingError {
  final String title;
  final String message;
  final List<String> steps;
  final String? technicalDetail;

  const UserFacingError({
    required this.title,
    required this.message,
    this.steps = const [],
    this.technicalDetail,
  });

  /// Toast / qisqa xabar.
  String get summary => title;

  static UserFacingError serverUnreachable({String? context}) {
    return UserFacingError(
      title: 'Нет связи с сервером',
      message: context ?? 'Не удалось связаться с сервером SALESDOC.',
      steps: const [
        'Проверьте интернет на телефоне (Wi‑Fi или мобильная сеть)',
        'Убедитесь, что сервер запущен на компьютере (npm run dev в папке backend)',
        'На эмуляторе Android сервер должен слушать порт 18080',
        'Нажмите «Повторить» или перезапустите приложение',
      ],
      technicalDetail: 'Адрес API: ${resolveApiBaseUrl()}',
    );
  }

  static UserFacingError timeout({String? context}) {
    return UserFacingError(
      title: 'Сервер не отвечает',
      message: context ?? 'Запрос выполнялся слишком долго.',
      steps: const [
        'Проверьте скорость интернета',
        'Убедитесь, что сервер не перегружен',
        'Попробуйте повторить через несколько секунд',
      ],
      technicalDetail: 'Адрес API: ${resolveApiBaseUrl()}',
    );
  }

  static UserFacingError localDatabase({String? context, String? technicalDetail}) {
    return UserFacingError(
      title: 'Ошибка локальной базы',
      message: context ?? 'Не удалось сохранить данные на устройстве.',
      steps: const [
        'Полностью закройте и снова откройте приложение',
        'Освободите память на телефоне',
        'Повторите синхронизацию',
        'Если не помогло — переустановите приложение',
      ],
      technicalDetail: technicalDetail,
    );
  }

  static UserFacingError invalidServerResponse() {
    return const UserFacingError(
      title: 'Ошибка данных сервера',
      message: 'Сервер вернул неожиданный ответ. Возможно, версия backend устарела.',
      steps: [
        'Перезапустите backend (npm run dev)',
        'Обновите приложение до последней версии',
        'Обратитесь к администратору, если ошибка повторяется',
      ],
    );
  }

  static UserFacingError fromApi(ApiException e) {
    return UserFacingError(
      title: 'Не удалось выполнить операцию',
      message: e.message,
      steps: () {
        final code = e.statusCode;
        if (code == 401) return const ['Выйдите и войдите снова'];
        if (code == 403) return const ['Обратитесь к администратору за доступом'];
        if (code == 404) return const ['Проверьте код компании и адрес сервера'];
        if (code != null && code >= 500) {
          return const ['Подождите и повторите', 'Если не помогло — сообщите администратору'];
        }
        return const ['Проверьте данные и повторите попытку'];
      }(),
      technicalDetail: e.statusCode != null ? 'Код ответа: ${e.statusCode}' : null,
    );
  }

  static UserFacingError from(Object e, {String? context}) {
    if (e is UserFacingError) return e;
    if (e is DatabaseException) {
      return localDatabase(context: context, technicalDetail: e.toString());
    }
    if (e is NetworkException) {
      return serverUnreachable(context: context);
    }
    if (e is ApiException) {
      return fromApi(e);
    }
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return timeout(context: context);
      }
      if (e.type == DioExceptionType.connectionError) {
        return serverUnreachable(context: context);
      }
    }
    final s = e.toString();
    if (s.contains('DatabaseException') || s.contains('SQLite')) {
      return localDatabase(context: context, technicalDetail: s);
    }
    if (s.contains('SocketException') ||
        s.contains('connection error') ||
        s.contains('Connection refused') ||
        s.contains('Failed host lookup')) {
      return serverUnreachable(context: context);
    }
    if (s.contains('type ') && s.contains('is not a subtype')) {
      return invalidServerResponse();
    }
    final short = s.length > 160 ? '${s.substring(0, 160)}…' : s;
    return UserFacingError(
      title: 'Произошла ошибка',
      message: context ?? 'Операция не завершена.',
      steps: const ['Повторите попытку', 'Если ошибка повторяется — обратитесь к администратору'],
      technicalDetail: short,
    );
  }

  /// Eski matndan (fallback).
  static UserFacingError? tryParseLegacy(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (raw.contains('10.0.2.2') ||
        raw.contains('127.0.0.1') ||
        raw.contains('localhost') ||
        raw.contains('подключения к серверу') ||
        raw.contains('Serverga ulanib')) {
      return serverUnreachable();
    }
    return UserFacingError(title: 'Ошибка', message: raw);
  }

  /// Dialog (login, sync va h.k.).
  static Future<void> showDialog(BuildContext context, UserFacingError error, {VoidCallback? onRetry}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(12, 0, 12, MediaQuery.paddingOf(ctx).bottom + 12),
        child: UserFacingErrorCard(
          error: error,
          onRetry: onRetry == null
              ? null
              : () {
                  Navigator.pop(ctx);
                  onRetry();
                },
        ),
      ),
    );
  }
}

/// Bootstrap va boshqa ekranlarda batafsil xato kartasi.
class UserFacingErrorCard extends StatelessWidget {
  final UserFacingError error;
  final VoidCallback? onRetry;
  final String retryLabel;

  const UserFacingErrorCard({
    super.key,
    required this.error,
    this.onRetry,
    this.retryLabel = S.retry,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(12),
      color: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline, color: AppColors.error, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    error.title,
                    style: AppTypography.bodyMedium.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.error,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              error.message,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textPrimary, height: 1.35),
            ),
            if (error.steps.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Что можно сделать:',
                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              ...error.steps.map(
                (step) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('• ', style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                      Expanded(
                        child: Text(
                          step,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (error.technicalDetail != null) ...[
              const SizedBox(height: 8),
              Text(
                error.technicalDetail!,
                style: AppTypography.caption.copyWith(color: AppColors.textMuted, fontSize: 11),
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: Text(retryLabel)),
            ],
          ],
        ),
      ),
    );
  }
}

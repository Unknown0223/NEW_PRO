import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../ui/agent_ui.dart';
import '../update/app_update_info.dart';

/// Mahalliy bildirishnomalar: sinхron oynasi va ilova yangilanishi.
class MobileLocalNotificationService {
  MobileLocalNotificationService._();
  static final MobileLocalNotificationService instance = MobileLocalNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  String? _tenMinAlertKey;
  void Function(String? payload)? onNotificationTap;

  static const _syncChannelId = 'sync_window_urgent';
  static const _syncNotificationId = 91001;
  static const _appUpdateChannelId = 'app_update';
  static const _appUpdateNotificationId = 91002;
  static const _appUpdatePayloadPrefix = 'app_update';
  static const _heldOrdersChannelId = 'held_orders';
  static const _heldOrdersWarnNotificationId = 91003;
  static const _heldOrdersSentNotificationId = 91004;
  static const heldOrdersPayloadPrefix = 'held_orders';

  Future<void> init() async {
    if (_initialized) return;

    const android = AndroidInitializationSettings('@drawable/ic_stat_sales_arena');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: _onNotificationResponse,
      onDidReceiveBackgroundNotificationResponse: _onBackgroundNotificationResponse,
    );

    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _syncChannelId,
        'Синхронизация',
        description: 'Напоминание до окончания окна синхронизации',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ),
    );
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _appUpdateChannelId,
        'Обновление приложения',
        description: 'Доступна новая версия Sales Arena',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ),
    );
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _heldOrdersChannelId,
        'Заказы в ожидании',
        description: 'Таймер отправки заказа на сервер',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ),
    );

    _initialized = true;
  }

  static void _onNotificationResponse(NotificationResponse response) {
    instance.onNotificationTap?.call(response.payload);
  }

  @pragma('vm:entry-point')
  static void _onBackgroundNotificationResponse(NotificationResponse response) {
    instance.onNotificationTap?.call(response.payload);
  }

  /// Bildirishnoma ruxsati.
  Future<bool> ensureNotificationPermission({bool requestIfNeeded = true}) async {
    await init();
    var status = await Permission.notification.status;
    if (status.isGranted) return true;
    if (!requestIfNeeded) return false;
    if (status.isPermanentlyDenied) return false;
    status = await Permission.notification.request();
    return status.isGranted;
  }

  bool get _inForeground =>
      WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;

  /// Sinхron oynasi tugashiga 10 daqiqa qolganda.
  Future<void> onTenMinutesLeft({
    BuildContext? context,
    required String windowKey,
  }) async {
    final dayKey = '${DateTime.now().toIso8601String().substring(0, 10)}|$windowKey';
    if (_tenMinAlertKey == dayKey) return;
    _tenMinAlertKey = dayKey;

    if (_inForeground && context != null && context.mounted) {
      HapticFeedback.heavyImpact();
      try {
        await SystemSound.play(SystemSoundType.alert);
      } catch (_) {}
      showAgentToast(
        context,
        S.syncWindowTenMinAlert,
        accentColor: AppColors.warning,
      );
      return;
    }

    final granted = await ensureNotificationPermission();
    if (!granted) return;

    await _plugin.show(
      _syncNotificationId,
      S.syncWindowAlertTitle,
      S.syncWindowTenMinAlert,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _syncChannelId,
          'Синхронизация',
          channelDescription: 'Напоминание до окончания окна синхронизации',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          enableVibration: true,
          icon: '@drawable/ic_stat_sales_arena',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          presentBadge: false,
        ),
      ),
    );
  }

  /// Yangi versiya mavjud — ilova fonda yoki dialog ko‘rinmaganida.
  Future<void> notifyAppUpdateAvailable({
    required AppUpdateInfo info,
    bool afterSync = false,
  }) async {
    await init();

    final latest = info.latestVersion?.trim();
    final title = info.required ? S.appUpdateTitleRequired : S.appUpdateTitle;
    final body = afterSync
        ? S.appUpdateNotificationAfterSync(latest ?? '')
        : S.appUpdateNotificationBody(latest ?? '', info.currentVersion);

    await _showAppUpdateNotification(title: title, body: body, payloadSuffix: latest ?? info.currentVersion);
  }

  /// Qo‘lda tekshirish: versiya yangilangan.
  Future<void> notifyAppUpdateUpToDate(String currentVersion) async {
    await _showAppUpdateNotification(
      title: 'Обновление',
      body: S.appUpdateAlreadyLatest(currentVersion),
      payloadSuffix: 'up_to_date|$currentVersion',
      playSound: false,
    );
  }

  /// Qo‘lda tekshirish: xato.
  Future<void> notifyAppUpdateCheckFailed(String message) async {
    await _showAppUpdateNotification(
      title: 'Обновление',
      body: message,
      payloadSuffix: 'check_failed',
      playSound: false,
    );
  }

  Future<void> _showAppUpdateNotification({
    required String title,
    required String body,
    required String payloadSuffix,
    bool playSound = true,
  }) async {
    await init();
    final granted = await ensureNotificationPermission(requestIfNeeded: false);
    if (!granted) return;

    final payload = '$_appUpdatePayloadPrefix|$payloadSuffix';
    await _plugin.show(
      _appUpdateNotificationId,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _appUpdateChannelId,
          'Обновление приложения',
          channelDescription: 'Доступна новая версия Sales Arena',
          importance: Importance.high,
          priority: Priority.high,
          playSound: playSound,
          enableVibration: playSound,
          icon: '@drawable/ic_stat_sales_arena',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: playSound,
          presentBadge: false,
        ),
      ),
      payload: payload,
    );
  }

  static bool isAppUpdatePayload(String? payload) =>
      payload != null && payload.startsWith(_appUpdatePayloadPrefix);

  static bool isHeldOrdersPayload(String? payload) =>
      payload != null && payload.startsWith(heldOrdersPayloadPrefix);

  /// Kunlik inbox yangilanganda: sinxron / held warn+sent tray yozuvlari.
  /// App-update bildirishnomasi saqlanadi. Held buyurtmalar DB da qoladi.
  Future<void> clearDayScopedTrayNotifications() async {
    await init();
    _tenMinAlertKey = null;
    await _plugin.cancel(_syncNotificationId);
    await _plugin.cancel(_heldOrdersWarnNotificationId);
    await _plugin.cancel(_heldOrdersSentNotificationId);
  }

  /// Kechiktirilgan zakaz yuborishiga ~1 daqiqa qolganda.
  /// Faqat ilova fonda bo‘lganda (foydalanuvchi ichida bo‘lmasa).
  Future<void> notifyHeldOrderEndingSoon({
    required int heldOrderId,
    required String clientName,
    required String countdown,
    required int pendingCount,
  }) async {
    await init();
    if (_inForeground) return;
    final granted = await ensureNotificationPermission();
    if (!granted) return;

    final title = pendingCount > 1
        ? 'Ожидают отправки: $pendingCount'
        : 'Заказ скоро уйдёт на сервер';
    final body = pendingCount > 1
        ? '$clientName · осталось $countdown. Всего черновиков ожидания: $pendingCount'
        : '$clientName · осталось $countdown. Можно изменить или отменить в «Заказы» / «Уведомления».';

    await _plugin.show(
      _heldOrdersWarnNotificationId,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _heldOrdersChannelId,
          'Заказы в ожидании',
          channelDescription: 'Таймер отправки заказа на сервер',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          enableVibration: true,
          icon: '@drawable/ic_stat_sales_arena',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          presentBadge: false,
        ),
      ),
      payload: '$heldOrdersPayloadPrefix|warn|$heldOrderId',
    );
  }

  /// Timer tugab, zakaz serverga yuborildi — lokal navbatdan tozalandi.
  /// Ilova ochiq (foreground) bo‘lsa tizim bildirishnomasi chiqmaydi.
  Future<void> notifyHeldOrderSent({
    required String clientName,
    required String orderNumber,
  }) async {
    await init();
    if (_inForeground) return;
    final granted = await ensureNotificationPermission(requestIfNeeded: false);
    if (!granted) return;

    final numLabel = orderNumber.trim().isEmpty ? '' : ' №$orderNumber';
    await _plugin.show(
      _heldOrdersSentNotificationId,
      'Заказ отправлен',
      '$clientName$numLabel — отправлен на сервер, локальная копия удалена.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _heldOrdersChannelId,
          'Заказы в ожидании',
          channelDescription: 'Таймер отправки заказа на сервер',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
          playSound: false,
          enableVibration: false,
          icon: '@drawable/ic_stat_sales_arena',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: false,
          presentBadge: false,
        ),
      ),
      payload: '$heldOrdersPayloadPrefix|sent',
    );
  }
}

/// Eski importlar uchun alias.
typedef SyncWindowAlertService = MobileLocalNotificationService;

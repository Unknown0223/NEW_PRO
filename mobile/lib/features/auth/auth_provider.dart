import 'dart:async';

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBinding;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exceptions.dart';
import '../../core/api/auth_api.dart';
import '../../core/auth/app_pin_store.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/auth/biometric_preferences.dart';
import '../../core/auth/session_expired.dart';
import '../../core/device/mobile_device_info.dart';
import '../../core/sync/sync_data_refresh.dart';
import '../../core/api/dio_client.dart';
import '../../core/api/mobile_api.dart';
import '../../core/api/permissions_api.dart';
import '../../core/api/expeditor_api.dart';
import '../../core/api/supervisor_api.dart';
import '../../features/expeditor/cache/expeditor_deliveries_cache.dart';
import '../../core/auth/session.dart';
import '../../core/config/app_env.dart';
import '../../core/config/mobile_config.dart';
import '../../core/config/mobile_config_policy.dart';
import '../../core/database/app_database.dart';
import '../../core/gps/gps_tracker.dart';
import '../../core/push/fcm_service.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/sync/bootstrap_sync_labels.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/sync/sync_payload_parser.dart';
import '../../core/time/work_region_time.dart';
import '../../core/notifications/mobile_local_notification_service.dart';
import '../../core/l10n/app_strings_ru.dart';
import '../../core/update/app_update_info.dart';
import '../../core/update/app_update_installer.dart';

enum AuthStatus { initial, loading, authenticated, pinSetup, bootstrapping, syncComplete, ready, locked, error }

class BootstrapStep {
  final int idx;
  final String label;
  const BootstrapStep(this.idx, this.label);
  static const auth = BootstrapStep(0, 'Autentifikatsiya');
  static const permissions = BootstrapStep(1, 'Ruxsatlar yuklanmoqda');
  static const config = BootstrapStep(2, 'Konfiguratsiya');
  static const sync = BootstrapStep(3, 'Ma\'lumotlar sinxronlanmoqda');
  static const push = BootstrapStep(4, 'Push sozlanmoqda');
  static const done = BootstrapStep(5, 'Tayyor!');
  static const values = [auth, permissions, config, sync, push, done];
}

/// Qo'lda sinxron natijasi (muvaffaqiyat ekrani uchun).
class AgentSyncResult {
  final bool ok;
  final String? error;
  final UserFacingError? errorInfo;
  final int clients;
  final int products;
  final int prices;
  final int orders;

  const AgentSyncResult({
    required this.ok,
    this.error,
    this.errorInfo,
    this.clients = 0,
    this.products = 0,
    this.prices = 0,
    this.orders = 0,
  });
}

class AuthState {
  final AuthStatus status;
  final String? error;
  final UserFacingError? errorInfo;
  final BootstrapStep bootstrapStep;
  /// Bootstrap sync bosqichida UI (0=Товары … 5=Библиотека).
  final int? syncPhaseIndex;
  final AppUpdateInfo? pendingAppUpdate;
  /// Sinхрон tugagach ko‘rsatiladigan yangilash dialogi.
  final bool appUpdateAfterSync;

  const AuthState({
    this.status = AuthStatus.initial,
    this.error,
    this.errorInfo,
    this.bootstrapStep = BootstrapStep.auth,
    this.syncPhaseIndex,
    this.pendingAppUpdate,
    this.appUpdateAfterSync = false,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? error,
    UserFacingError? errorInfo,
    BootstrapStep? bootstrapStep,
    int? syncPhaseIndex,
    AppUpdateInfo? pendingAppUpdate,
    bool? appUpdateAfterSync,
    bool clearSyncPhase = false,
    bool clearError = false,
    bool clearPendingAppUpdate = false,
    bool clearAppUpdateAfterSync = false,
  }) =>
      AuthState(
        status: status ?? this.status,
        error: clearError ? null : (error ?? this.error),
        errorInfo: clearError ? null : (errorInfo ?? this.errorInfo),
        bootstrapStep: bootstrapStep ?? this.bootstrapStep,
        syncPhaseIndex: clearSyncPhase ? null : (syncPhaseIndex ?? this.syncPhaseIndex),
        pendingAppUpdate:
            clearPendingAppUpdate ? null : (pendingAppUpdate ?? this.pendingAppUpdate),
        appUpdateAfterSync:
            clearAppUpdateAfterSync ? false : (appUpdateAfterSync ?? this.appUpdateAfterSync),
      );

  double get bootstrapProgress {
    if (status == AuthStatus.ready || status == AuthStatus.syncComplete) return 1.0;
    final n = BootstrapStep.values.length;
    return (bootstrapStep.idx + 1) / n;
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthApi _authApi;
  final MobileApi _mobileApi;
  final PermissionsApi _permsApi;
  final SessionManager _session;
  final Ref _ref;
  Completer<bool>? _appUpdateGate;
  AppUpdateInfo? _deferredAppUpdate;
  bool _deferredAfterSync = false;
  int _pinFailCount = 0;

  AuthNotifier(this._authApi, this._mobileApi, this._permsApi, this._session, this._ref)
    : super(const AuthState()) {
    _ref.read(sessionExpiredBridgeProvider).register(sessionExpired);
    _ref.read(appAccessDeniedBridgeProvider).register(appAccessRevoked);
  }

  void _setError(UserFacingError info, {AuthStatus status = AuthStatus.error}) {
    state = AuthState(status: status, error: info.summary, errorInfo: info);
  }

  Future<bool> _canAppLock() async {
    if (!await _ref.read(appPinStoreProvider).isSet()) return false;
    final storage = _ref.read(secureStorageProvider);
    final refresh = await storage.read(key: 'refresh_token');
    if (refresh == null || refresh.isEmpty) return false;
    if (_session.state.user == null) {
      final restored = await _session.restore();
      if (!restored) return false;
    }
    return true;
  }

  Future<bool> _canBiometricLock() async {
    if (!await _ref.read(biometricPreferencesProvider).isEnabled()) return false;
    return await _canAppLock() && await _ref.read(biometricServiceProvider).isAvailable();
  }

  /// Ilova fonda bo‘lgandan qaytganda qulflash (PIN majburiy).
  Future<void> lockAppOnResume() async {
    if (state.status != AuthStatus.ready) return;
    await _lockForApp();
  }

  /// @deprecated Faqat `MobileSessionGuard` orqali `lockAppOnResume` ishlatiladi.
  Future<void> lockAppWhenBackgrounded() async {
    if (state.status != AuthStatus.ready) return;
    await _lockForApp();
  }

  Future<bool> _lockForApp() async {
    if (!await _canAppLock()) return false;
    _ref.read(accessTokenProvider.notifier).state = null;
    _pinFailCount = 0;
    state = const AuthState(status: AuthStatus.locked);
    return true;
  }

  Future<void> completePinSetup(String pin) async {
    if (pin.length < 4) return;
    state = const AuthState(status: AuthStatus.loading);
    await _ref.read(appPinStoreProvider).setPin(pin);
    await _ref.read(biometricPreferencesProvider).setPendingOffer(true);
    await _bootstrap();
  }

  Future<void> unlockWithPin(String pin) async {
    final ok = await _ref.read(appPinStoreProvider).verifyPin(pin);
    if (!ok) {
      _pinFailCount += 1;
      if (_pinFailCount >= 5) {
        await logout();
        return;
      }
      state = AuthState(
        status: AuthStatus.locked,
        error: 'Неверный PIN (${5 - _pinFailCount} попыток)',
      );
      return;
    }
    _pinFailCount = 0;
    await _finishLocalUnlock();
  }

  Future<bool> _needsPinSetup() async => !(await _ref.read(appPinStoreProvider).isSet());

  /// Biometrik tez kirish — faqat telefon secure storage da, serverga yuborilmaydi.
  Future<bool> enableBiometricLock() async {
    final bio = _ref.read(biometricServiceProvider);
    if (!await bio.isAvailable()) return false;
    final ok = await bio.authenticate(
      reason: 'Подтвердите биометрию для быстрого входа в Sales Arena',
      biometricOnly: false,
    );
    if (!ok) return false;
    await _ref.read(biometricPreferencesProvider).setEnabled(true);
    await _ref.read(biometricPreferencesProvider).clearPendingOffer();
    return true;
  }

  Future<void> disableBiometricLock() async {
    await _ref.read(biometricPreferencesProvider).setEnabled(false);
  }

  Future<void> declineBiometricSetup() async {
    await _ref.read(biometricPreferencesProvider).setOfferDeclined(true);
  }

  Future<bool> isBiometricLockEnabled() => _ref.read(biometricPreferencesProvider).isEnabled();

  /// Biometrik qulfdan ochish. `false` = bekor qilindi yoki xato (PIN fallback).
  Future<bool> unlockWithBiometric() async {
    if (!await _canBiometricLock()) return false;
    final bio = _ref.read(biometricServiceProvider);
    final ok = await bio.authenticate(
      reason: 'Вход в Sales Arena',
      biometricOnly: true,
    );
    if (!ok) {
      state = state.copyWith(status: AuthStatus.locked, clearError: true);
      return false;
    }
    _pinFailCount = 0;
    await _finishLocalUnlock();
    return true;
  }

  /// Mahalliy qulfdan tez ochish — API chaqiruvlari fonda.
  Future<void> _finishLocalUnlock() async {
    if (_session.state.bootstrapped && _session.state.user != null) {
      await restoreTokens(_ref);
      _resumeAfterRestore();
      state = const AuthState(status: AuthStatus.ready);
      unawaited(_backgroundAfterUnlock());
      return;
    }
    state = const AuthState(status: AuthStatus.loading);
    await _unlockSessionAfterLocalAuth();
  }

  Future<void> _backgroundAfterUnlock() async {
    try {
      await ensureAuthTokens(_ref);
      final storage = _ref.read(secureStorageProvider);
      final refresh = await storage.read(key: 'refresh_token');
      if (refresh == null || refresh.isEmpty) return;

      final me = await _tryFetchMe(refresh);
      if (me?.appAccess == false) {
        await _wipeLocalAuth();
        state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
        return;
      }
      if (me != null) {
        final slug = _session.state.tenantSlug ?? me.tenantSlug ?? '';
        final prev = _session.state.user;
        await _session.setUser(
          AuthUser(
            id: me.id,
            name: me.name.trim().isNotEmpty ? me.name : (prev?.name ?? me.name),
            login: me.login,
            role: me.role,
            tenantId: me.tenantId,
            tenantSlug: me.tenantSlug ?? slug,
            tenantName: me.tenantName,
            workSlotCode: me.workSlotCode ?? prev?.workSlotCode,
            workSlotId: me.workSlotId ?? prev?.workSlotId,
            code: me.code ?? prev?.code,
            appAccess: me.appAccess,
          ),
          slug: slug,
          tenantName: me.tenantName,
        );
      }

      unawaited(_safeRefreshMobileConfigAfterUnlock());
      unawaited(_reportDevicePresence());
      if (_session.state.user?.role == 'agent') {
        unawaited(_refreshAgentClientsFromServer());
      }
    } catch (_) {}
  }

  Future<void> _safeRefreshMobileConfigAfterUnlock() async {
    try {
      await refreshMobileConfig(gateUpdate: true);
    } on UnauthorizedException {
      await sessionExpired();
    } on ApiException {
      // Majburiy yangilash yoki boshqa API xatosi — PIN ochiq qoladi.
    } catch (_) {}
  }

  Future<void> _unlockSessionAfterLocalAuth() async {
    try {
      await restoreTokens(_ref);
      await _session.restore();

      final storage = _ref.read(secureStorageProvider);
      final refresh = await storage.read(key: 'refresh_token');
      if (refresh == null || refresh.isEmpty) {
        await _wipeLocalAuth();
        state = const AuthState();
        return;
      }

      var me = await _tryFetchMe(refresh);
      if (me == null) {
        if (_session.state.bootstrapped && _session.state.user != null) {
          me = _session.state.user!;
        } else {
          await _wipeLocalAuth();
          state = const AuthState(status: AuthStatus.error, error: 'Sessiya tugadi. Qayta kiring.');
          return;
        }
      }

      if (me.appAccess == false) {
        await _wipeLocalAuth();
        state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
        return;
      }

      final slug = _session.state.tenantSlug ?? me.tenantSlug ?? '';
      final prev = _session.state.user;
      await _session.setUser(
        AuthUser(
          id: me.id,
          name: me.name.trim().isNotEmpty ? me.name : (prev?.name ?? me.name),
          login: me.login,
          role: me.role,
          tenantId: me.tenantId,
          tenantSlug: me.tenantSlug ?? slug,
          tenantName: me.tenantName,
          workSlotCode: me.workSlotCode ?? prev?.workSlotCode,
          workSlotId: me.workSlotId ?? prev?.workSlotId,
          code: me.code ?? prev?.code,
          appAccess: me.appAccess,
        ),
        slug: slug,
        tenantName: me.tenantName,
      );
      if (me.tenantName != null && me.tenantName!.trim().isNotEmpty) {
        await _session.setTenantName(me.tenantName!);
      }

      if (_session.state.bootstrapped) {
        _resumeAfterRestore();
        unawaited(_reportDevicePresence());
        if (_session.state.user?.role == 'agent') {
          unawaited(_refreshAgentClientsFromServer());
        }
        state = const AuthState(status: AuthStatus.ready);
        unawaited(_backgroundAfterUnlock());
      } else {
        await _bootstrap();
      }
    } on AppAccessDeniedException {
      await _wipeLocalAuth();
      state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
    } on NetworkException {
      if (_session.state.bootstrapped) {
        _resumeAfterRestore();
        state = const AuthState(status: AuthStatus.ready);
      } else {
        state = const AuthState(status: AuthStatus.locked, error: 'Нет интернета');
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.locked, error: 'Qayta urinib ko\'ring');
    }
  }

  /// Avval saqlangan access token; faqat 401 da refresh (biometrik ma’lumot serverga ketmaydi).
  Future<AuthUser?> _tryFetchMe(String refreshToken) async {
    try {
      return await _authApi.me();
    } on UnauthorizedException {
      try {
        final tokens = await _authApi.refresh(refreshToken);
        await saveTokens(
          _ref,
          tokens.accessToken,
          tokens.refreshToken.isNotEmpty ? tokens.refreshToken : refreshToken,
        );
        return await _authApi.me();
      } on UnauthorizedException {
        return null;
      }
    } on NetworkException {
      return _session.state.user;
    }
  }

  Future<void> checkSession() async {
    state = const AuthState(status: AuthStatus.loading);
    try {
      await _ref.read(appPinStoreProvider).warmCache();
      final hasTokens = await restoreTokens(_ref);
      if (!hasTokens) {
        if (await _session.restore()) {
          await _wipeLocalAuth();
        } else {
          final storedEnv = await _ref.read(secureStorageProvider).read(key: 'api_env_key');
          final currentEnv = resolveApiEnvKey();
          if (storedEnv != null && storedEnv.isNotEmpty && storedEnv != currentEnv) {
            await _wipeLocalAuth();
          }
        }
        state = const AuthState();
        return;
      }
      final restored = await _session.restore();
      if (!restored) {
        await clearAuthTokens(_ref);
        state = const AuthState();
        return;
      }
      if (_session.state.bootstrapped) {
        if (await _canAppLock()) {
          await _lockForApp();
          return;
        }
        if (await _needsPinSetup()) {
          state = const AuthState(status: AuthStatus.pinSetup);
          return;
        }
        state = const AuthState(status: AuthStatus.loading);
        try {
          final me = await _authApi.me();
          if (me.appAccess == false) {
            await _wipeLocalAuth();
            state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
            return;
          }
        } on UnauthorizedException catch (e) {
          if (await _lockForApp()) return;
          await _wipeLocalAuth();
          state = AuthState(status: AuthStatus.error, error: e.message);
          return;
        } on AppAccessDeniedException catch (e) {
          await _wipeLocalAuth();
          state = AuthState(status: AuthStatus.error, error: e.message);
          return;
        } on NetworkException {
          // Oflayn — saqlangan sessiya bilan davom etamiz
        } catch (_) {}
        _resumeAfterRestore();
        state = const AuthState(status: AuthStatus.ready);
        unawaited(_backgroundAfterUnlock());
      } else {
        if (await _needsPinSetup()) {
          state = const AuthState(status: AuthStatus.pinSetup);
          return;
        }
        await _bootstrap();
      }
    } catch (_) {
      await _wipeLocalAuth();
      state = const AuthState();
    }
  }

  Future<void> login({required String slug, required String login, required String password}) async {
    state = const AuthState(status: AuthStatus.loading);
    try {
      final apkVersion = await MobileDeviceInfo.apkVersion;
      try {
        final preUpdate = await _mobileApi.fetchAppRelease(slug.trim(), apkVersion);
        final preBlocked = await _gateAppUpdate(preUpdate);
        if (preBlocked) {
          state = const AuthState(
            status: AuthStatus.error,
            error: 'Ilovani yangilang va qayta kiring',
          );
          return;
        }
      } on NetworkException {
        // Login davom etadi — oflayn rejim
      }

      final device = await MobileDeviceInfo.authPayload();
      final r = await _authApi.login(
        slug: slug,
        login: login,
        password: password,
        deviceName: device['device_name'],
        userAgent: device['user_agent'],
        apkVersion: device['apk_version'],
      );
      await saveTokens(_ref, r.accessToken, r.refreshToken);
      await _session.setUser(r.user, slug: slug, tenantName: r.user.tenantName);
      if (!r.user.isMobileRole) {
        await _wipeLocalAuth();
        state = const AuthState(status: AuthStatus.error, error: 'Mobil ilovaga ruxsat yo\'q');
        return;
      }
      if (r.user.appAccess == false) {
        await _wipeLocalAuth();
        state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
        return;
      }
      state = const AuthState(status: AuthStatus.authenticated);
      await _reportDevicePresence();
      final blocked = await _gateAppUpdate(r.appUpdate);
      if (blocked) {
        state = const AuthState(
          status: AuthStatus.error,
          error: 'Ilovani yangilang va qayta kiring',
        );
        return;
      }
      if (await _needsPinSetup()) {
        state = const AuthState(status: AuthStatus.pinSetup);
        return;
      }
      await _bootstrap();
    } on NetworkException {
      _setError(UserFacingError.serverUnreachable(context: 'Не удалось войти в систему.'));
    } on UnauthorizedException {
      await _wipeLocalAuth();
      _setError(const UserFacingError(
        title: 'Неверный логин или пароль',
        message: 'Проверьте код компании, логин и пароль.',
        steps: ['Убедитесь, что Caps Lock выключен', 'Обратитесь к администратору, если забыли пароль'],
      ),);
    } on AppAccessDeniedException {
      await _wipeLocalAuth();
      _setError(const UserFacingError(
        title: 'Доступ к приложению отключён',
        message: 'Администратор запретил вход с этого аккаунта.',
        steps: ['Обратитесь к администратору для включения доступа'],
      ),);
    } on ApiException catch (e) {
      _setError(UserFacingError.fromApi(e));
    }
  }

  /// Versiya dialogi — UI `AppUpdateListener` orqali.
  /// Oldin barcha kutilayotgan ma’lumotlar serverga yuboriladi.
  Future<bool> _gateAppUpdate(AppUpdateInfo? info, {bool afterSync = false}) async {
    if (info == null || !info.hasAction) return false;
    final hasTarget =
        (info.launchUrl != null && info.launchUrl!.isNotEmpty) ||
        AppUpdateInstaller.canInstallInApp(info) ||
        (info.effectiveApkUrl != null && info.effectiveApkUrl!.isNotEmpty);
    if (info.required && !hasTarget) {
      if (kDebugMode) {
        debugPrint(
          '[SalesDoc] Dev: majburiy yangilanish (${info.latestVersion}), APK URL yo\'q — login ruxsat',
        );
        return false;
      }
      return true;
    }

    await _flushPendingBeforeAppUpdate();

    final inForeground = WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    if (!inForeground) {
      unawaited(
        MobileLocalNotificationService.instance.notifyAppUpdateAvailable(
          info: info,
          afterSync: afterSync,
        ),
      );
      if (!info.required) return false;
      _deferredAppUpdate = info;
      _deferredAfterSync = afterSync;
      return true;
    }

    _appUpdateGate?.complete(false);
    _appUpdateGate = Completer<bool>();
    state = state.copyWith(pendingAppUpdate: info, appUpdateAfterSync: afterSync);
    final proceed = await _appUpdateGate!.future;
    state = state.copyWith(clearPendingAppUpdate: true, clearAppUpdateAfterSync: true);
    _appUpdateGate = null;
    if (info.required && !proceed) return true;
    return false;
  }

  /// Fondan qaytish yoki bildirishnoma bosilganda — kechiktirilgan yangilash dialogi.
  Future<void> resumeDeferredAppUpdate() async {
    final info = _deferredAppUpdate;
    if (info == null || !info.hasAction) return;
    final afterSync = _deferredAfterSync;
    _deferredAppUpdate = null;
    _deferredAfterSync = false;
    await _gateAppUpdate(info, afterSync: afterSync);
  }

  /// Yangilashdan oldin offline navbat va server pending — ma’lumot yo‘qolmasin.
  Future<void> _flushPendingBeforeAppUpdate() async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      await ensureAuthTokens(_ref);
      final se = _ref.read(syncEngineProvider);
      if (se != null) {
        final photoCfg = _session.state.mobileConfig?.photo;
        if (_dataSyncAllowed) {
          await se.flushPendingPhotoReports(photoConfig: photoCfg);
          await se.flushOfflineQueue(policySync: _syncCfg);
          await se.flushServerPending(policySync: _syncCfg);
        } else {
          await se.flushPendingPhotoReports(photoConfig: photoCfg);
        }
      }
    } catch (_) {}
  }

  /// Bildirishnoma bosilganda — yangilash dialogi.
  Future<void> openAppUpdateFromNotification() async {
    if (_deferredAppUpdate != null) {
      await resumeDeferredAppUpdate();
      return;
    }
    await checkForAppUpdate();
  }

  /// Qo‘lda yangilashni tekshirish (menyu / sinхрон tugagach).
  Future<void> checkForAppUpdate({bool afterSync = false}) async {
    await _checkForAppUpdateInternal(afterSync: afterSync, notifyUpToDate: false);
  }

  /// Menyudan: loader + toast + bildirishnoma.
  Future<AppUpdateManualCheckResult> checkForAppUpdateManual() async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) {
      return const AppUpdateCheckFailed('Компания не выбрана');
    }
    try {
      final version = await MobileDeviceInfo.apkVersion;
      final info = await _mobileApi.fetchAppRelease(slug, version);
      if (info == null || !info.hasAction) {
        unawaited(
          MobileLocalNotificationService.instance.notifyAppUpdateUpToDate(version),
        );
        return AppUpdateUpToDate(version);
      }
      unawaited(MobileLocalNotificationService.instance.ensureNotificationPermission());
      await _gateAppUpdate(info, afterSync: false);
      return const AppUpdateOffered();
    } on ApiException catch (e) {
      final message = e.message.trim().isEmpty ? S.appUpdateCheckFailed : e.message;
      unawaited(
        MobileLocalNotificationService.instance.notifyAppUpdateCheckFailed(message),
      );
      return AppUpdateCheckFailed(message);
    } catch (_) {
      unawaited(
        MobileLocalNotificationService.instance.notifyAppUpdateCheckFailed(S.appUpdateCheckFailed),
      );
      return const AppUpdateCheckFailed(S.appUpdateCheckFailed);
    }
  }

  Future<void> _checkForAppUpdateInternal({
    required bool afterSync,
    required bool notifyUpToDate,
  }) async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      final version = await MobileDeviceInfo.apkVersion;
      final info = await _mobileApi.fetchAppRelease(slug, version);
      if (info == null || !info.hasAction) {
        if (notifyUpToDate) {
          unawaited(
            MobileLocalNotificationService.instance.notifyAppUpdateUpToDate(version),
          );
        }
        state = state.copyWith(
          status: state.status,
          error: null,
        );
        return;
      }
      unawaited(MobileLocalNotificationService.instance.ensureNotificationPermission());
      await _gateAppUpdate(info, afterSync: afterSync);
    } catch (_) {}
  }

  void resolveAppUpdateGate({required bool proceed}) {
    if (_appUpdateGate != null && !_appUpdateGate!.isCompleted) {
      _appUpdateGate!.complete(proceed);
    }
  }

  SyncConfig get _syncCfg => _session.state.mobileConfig?.sync ?? const SyncConfig();

  bool get _dataSyncAllowed => evaluateSyncPolicy(_syncCfg).allowed;

  /// Web «Агент» jadvali uchun qurilma ma’lumotini yuborish (xato bo‘lsa jim).
  Future<void> _reportDevicePresence() async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      await ensureAuthTokens(_ref);
      final device = await MobileDeviceInfo.authPayload();
      await _mobileApi.reportPresence(slug, device);
    } catch (_) {}
  }

  /// Agent: serverdan bog‘langan mijozlar; xato bo‘lsa SQLite dagi kesh saqlanadi.
  Future<void> _refreshAgentClientsFromServer() async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty || _session.state.user?.role != 'agent') return;
    if (!_dataSyncAllowed) return;
    await ensureAuthTokens(_ref);
    try {
      final syncEngine = _ref.read(syncEngineProvider);
      if (syncEngine != null) {
        final payload = await syncEngine.pullSync(lastSyncAt: _session.state.lastSyncAt);
        await _session.setLastSyncAt(payload.syncAt);
      } else {
        final syncResult = await _mobileApi.syncFull(
          slug,
          lastSyncAt: _session.state.lastSyncAt,
          device: await MobileDeviceInfo.syncPayload(),
        );
        await _persistSyncResult(syncResult, lastSyncAt: _session.state.lastSyncAt);
      }
    } catch (_) {
      // Offline / 401 — mavjud ro‘yxatni o‘chirmaymiz
    }
  }

  Future<void> _bootstrap() async {
    state = const AuthState(status: AuthStatus.bootstrapping, bootstrapStep: BootstrapStep.auth);
    try {
      await restoreTokens(_ref);
      final user = _session.state.user;
      if (user == null) throw const UnauthorizedException();

      final slug = _session.state.tenantSlug ?? '';
      if (slug.isEmpty) throw const ApiException(message: 'Tenant slug topilmadi');

      // Step 3: GET /auth/me
      state = state.copyWith(bootstrapStep: BootstrapStep.auth);
      final meUser = await _authApi.me();
      final prev = _session.state.user;
      final mergedName = meUser.name.trim().isNotEmpty ? meUser.name : (prev?.name ?? meUser.name);
      await _session.setUser(
        AuthUser(
          id: meUser.id,
          name: mergedName,
          login: meUser.login,
          role: meUser.role,
          tenantId: meUser.tenantId,
          tenantSlug: meUser.tenantSlug ?? slug,
          tenantName: meUser.tenantName,
          workSlotCode: meUser.workSlotCode ?? prev?.workSlotCode,
          workSlotId: meUser.workSlotId ?? prev?.workSlotId,
          code: meUser.code ?? prev?.code,
          appAccess: meUser.appAccess,
        ),
        slug: slug,
        tenantName: meUser.tenantName,
      );
      if (meUser.tenantName != null && meUser.tenantName!.trim().isNotEmpty) {
        await _session.setTenantName(meUser.tenantName!);
      }
      if (meUser.appAccess == false) {
        await _wipeLocalAuth();
        throw const AppAccessDeniedException();
      }

      // Step 4: permissions
      state = state.copyWith(bootstrapStep: BootstrapStep.permissions);
      final perms = await _permsApi.getMyPermissions(slug);
      await _session.setPermissions(perms);

      // Step 5: config
      state = state.copyWith(bootstrapStep: BootstrapStep.config);
      final config = await _mobileApi.getAgentConfig(slug);
      if (config.tenantName != null && config.tenantName!.trim().isNotEmpty) {
        await _session.setTenantName(config.tenantName!);
      }
      final configBlocked = await _gateAppUpdate(config.appUpdate);
      if (configBlocked) {
        throw const ApiException(message: 'Ilovani yangilash majburiy');
      }
      await _session.setMobileConfig(
        MobileConfig.fromJson(config.mobileConfig),
        raw: config.mobileConfig,
        priceTypes: config.priceTypes,
        tenantReferences: config.tenantReferences,
        agentLimits: config.agentLimits,
        agentCities: config.agentCities,
      );
      final u = _session.state.user;
      if (u != null && (config.workSlotCode != null || config.workSlotId != null)) {
        await _session.setUser(
          AuthUser(
            id: u.id,
            name: u.name,
            login: u.login,
            role: u.role,
            tenantId: u.tenantId,
            tenantSlug: u.tenantSlug ?? slug,
            workSlotCode: config.workSlotCode ?? u.workSlotCode,
            workSlotId: config.workSlotId ?? u.workSlotId,
            code: u.code,
            appAccess: u.appAccess,
          ),
          slug: slug,
        );
      }

      // Step 6: sync — rol bo‘yicha (agent: to‘liq katalog; ekspeditor/supervisor: yengil, sync policy dan mustaqil)
      state = state.copyWith(bootstrapStep: BootstrapStep.sync, syncPhaseIndex: 0);
      final role = _session.state.user?.role ?? 'agent';
      if (role == 'expeditor') {
        await _bootstrapExpeditorSync();
      } else if (role == 'supervisor') {
        await _bootstrapSupervisorSync();
      } else if (_dataSyncAllowed && BootstrapSyncPlan.isAgentRole(role)) {
        await _bootstrapAgentSync();
      } else {
        _session.markBootstrapped();
      }

      // FCM / GPS / offline flush — UI bloklamasdan fonda (ANR oldini olish)
      await AppDatabase().recordSyncToday();
      _session.markBootstrapped();
      state = state.copyWith(bootstrapStep: BootstrapStep.done, status: AuthStatus.syncComplete);
      unawaited(_bootstrapPostSyncServices());
    } on UnauthorizedException catch (e) {
      if (await _lockForApp()) return;
      await _wipeLocalAuth();
      _setError(UserFacingError.fromApi(e));
    } on AppAccessDeniedException catch (e) {
      await _wipeLocalAuth();
      _setError(UserFacingError.fromApi(e));
    } on NetworkException {
      _session.markBootstrapped();
      state = AuthState(
        status: AuthStatus.ready,
        error: 'Нет интернета — данные обновятся позже',
        errorInfo: UserFacingError.serverUnreachable(
          context: 'Вход выполнен, но синхронизация отложена.',
        ),
      );
    } on ApiException catch (e) {
      _setError(UserFacingError.fromApi(e));
    } catch (e) {
      _setError(UserFacingError.from(e, context: 'Не удалось синхронизировать данные (товары, клиенты, заказы).'));
    }
  }

  void _setSyncPhase(int phase) {
    if (state.bootstrapStep != BootstrapStep.sync) return;
    final current = state.syncPhaseIndex ?? 0;
    if (phase < current) return;
    state = state.copyWith(syncPhaseIndex: phase);
  }

  Future<void> _bootstrapAgentSync() async {
    final slug = _session.state.tenantSlug ?? '';
    final se = _ref.read(syncEngineProvider);
    if (se != null) {
      final payload = await se.pullSync(
        lastSyncAt: _session.state.lastSyncAt,
        onPhase: _setSyncPhase,
      );
      await _session.setLastSyncAt(payload.syncAt);
    } else {
      _setSyncPhase(0);
      final syncResult = await _mobileApi.syncFull(
        slug,
        lastSyncAt: _session.state.lastSyncAt,
        device: await MobileDeviceInfo.syncPayload(),
      );
      await _persistSyncResult(syncResult, lastSyncAt: _session.state.lastSyncAt);
      await _session.setLastSyncAt(syncResult.syncAt);
    }
    _session.markBootstrapped();
  }

  /// Login bootstrap tugagach — push, GPS, offline navbat (asosiy oqimdan tashqari).
  Future<void> _bootstrapPostSyncServices() async {
    try {
      final fcm = _ref.read(fcmServiceProvider);
      if (fcm != null) {
        try {
          await fcm.initialize();
        } catch (_) {}
      }

      final gpsConfig = _session.state.mobileConfig?.gps;
      if (gpsConfig?.trackingEnabled == true) {
        try {
          await _ref
              .read(gpsTrackerProvider.notifier)
              .startTracking()
              .timeout(const Duration(seconds: 8), onTimeout: () {});
        } catch (_) {}
      }

      if (_dataSyncAllowed) {
        final se = _ref.read(syncEngineProvider);
        if (se != null) {
          try {
            await se.flushOfflineQueue(policySync: _syncCfg);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  Future<void> _bootstrapExpeditorSync() async {
    await _resyncExpeditor(onPhase: _setSyncPhase, full: true);
    _session.markBootstrapped();
  }

  Future<void> _bootstrapSupervisorSync() async {
    final slug = _session.state.tenantSlug ?? '';
    final api = _ref.read(supervisorApiProvider);
    _setSyncPhase(0);
    await api.getSummary(slug);
    _setSyncPhase(1);
    await api.getVisits(slug, limit: 50);
    _setSyncPhase(2);
    await api.getAgentLocations(slug);
    _setSyncPhase(3);
    await _session.setLastSyncAt(serverNowUtcIso());
    _session.markBootstrapped();
  }

  Future<void> _resyncExpeditor({
    void Function(int phase)? onPhase,
    bool full = false,
  }) async {
    final slug = _session.state.tenantSlug ?? '';
    final api = _ref.read(expeditorApiProvider);

    void phase(int i) => _reportSyncPhase(i, onPhase: onPhase);

    phase(0);
    await _reportDevicePresence();

    phase(1);

    phase(2);
    if (full) {
      try {
        await api.listDebtors(slug);
      } catch (_) {}
    }

    phase(3);
    final r = await api.listDeliveries(slug, limit: 200);
    await ExpeditorDeliveriesCache().save(slug, r.data);

    phase(4);
    if (full) {
      try {
        await api.getVehicleStock(slug);
      } catch (_) {}
      try {
        await api.listWarehouses(slug);
      } catch (_) {}
    }

    phase(5);
    if (full) {
      try {
        await api.listVisits(slug, tab: 'active');
      } catch (_) {}
    }

    phase(6);
    try {
      await api.getDashboard(slug);
    } catch (_) {}
    if (full) {
      try {
        await Future.wait([
          api.listShipmentDocuments(slug, type: 'shipping'),
          api.listShipmentDocuments(slug, type: 'return'),
          api.listPaymentsSummary(slug),
        ]);
      } catch (_) {}
    }

    await _session.setLastSyncAt(serverNowUtcIso());
  }

  Future<void> _resyncSupervisor() async {
    final slug = _session.state.tenantSlug ?? '';
    final api = _ref.read(supervisorApiProvider);
    await Future.wait([
      api.getSummary(slug),
      api.getVisits(slug, limit: 50),
      api.getAgentLocations(slug),
    ]);
    await _session.setLastSyncAt(serverNowUtcIso());
  }

  void _reportSyncPhase(int phase, {void Function(int phase)? onPhase}) {
    onPhase?.call(phase);
    _setSyncPhase(phase);
  }

  Future<void> _persistSyncPayload(
    ParsedSyncPayload payload, {
    void Function(int phase)? onPhase,
    String? lastSyncAt,
    bool forceClientCatalog = false,
  }) async {
    final role = _session.state.user?.role;
    final replaceCatalog = role == 'agent' &&
        (SyncEngine.isFullCatalogSync(lastSyncAt) || forceClientCatalog);

    _reportSyncPhase(0, onPhase: onPhase);
    _reportSyncPhase(3, onPhase: onPhase);
    await AppDatabase().persistSync(
      replaceProductCatalog: replaceCatalog,
      replaceClients: payload.clientsReplaceAll,
      markAgentClientsSynced: role == 'agent' && payload.clientsReplaceAll,
      products: payload.products,
      prices: payload.prices,
      clients: payload.clients,
      orders: payload.orders,
      syncAt: payload.syncAt,
    );
    _reportSyncPhase(5, onPhase: onPhase);
  }

  Future<void> _persistSyncResult(
    SyncFullResult syncResult, {
    void Function(int phase)? onPhase,
    String? lastSyncAt,
  }) async {
    await _persistSyncPayload(
      ParsedSyncPayload(
        syncAt: syncResult.syncAt,
        clientsReplaceAll: syncResult.clientsReplaceAll,
        clients: syncResult.clients.map((c) => c.toMap()).toList(),
        products: syncResult.products.map((p) => p.toMap()).toList(),
        prices: syncResult.prices
            .map((p) => {
                  'product_id': p.productId,
                  'price_type': p.priceType ?? 'default',
                  'price': p.price,
                },)
            .toList(),
        orders: syncResult.orders.map((o) => o.toMap()).toList(),
      ),
      onPhase: onPhase,
      lastSyncAt: lastSyncAt,
    );
  }

  void _resumeAfterRestore() {
    final gpsConfig = _session.state.mobileConfig?.gps;
    if (gpsConfig?.trackingEnabled == true) {
      try {
        _ref.read(gpsTrackerProvider.notifier).startTracking();
      } catch (_) {}
    }
  }

  /// Serverdan konfig yangilab, sinxron siyosatini qayta baholaydi (vaqt oynasi kengaytirilganda).
  Future<SyncPolicyEvaluation> refreshConfigAndEvaluateSyncPolicy() async {
    await refreshMobileConfig();
    return evaluateSyncPolicy(_syncCfg);
  }

  /// Mobil konfiguratsiyani serverdan qayta yuklash (menyu/ruxsatlar yangilanishi).
  Future<void> refreshMobileConfig({bool gateUpdate = false}) async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) return;
    await ensureAuthTokens(_ref);
    try {
      final config = await _mobileApi.getAgentConfig(slug);
      if (config.tenantName != null && config.tenantName!.trim().isNotEmpty) {
        await _session.setTenantName(config.tenantName!);
      }
      if (gateUpdate) {
        final blocked = await _gateAppUpdate(config.appUpdate);
        if (blocked) {
          throw const ApiException(message: 'Ilovani yangilash majburiy');
        }
      }
      await _session.setMobileConfig(
        MobileConfig.fromJson(config.mobileConfig),
        raw: config.mobileConfig,
        priceTypes: config.priceTypes,
        tenantReferences: config.tenantReferences,
        agentLimits: config.agentLimits,
        agentCities: config.agentCities,
      );
    } on UnauthorizedException {
      await sessionExpired();
    } catch (e) {
      if (gateUpdate && e is ApiException) rethrow;
    }
  }

  /// Agent F.I.O va smart kodini serverdan yangilash (menyu sarlavhasi).
  Future<void> refreshAgentIdentity() async {
    final slug = _session.state.tenantSlug ?? '';
    final prev = _session.state.user;
    if (slug.isEmpty || prev == null) return;
    await ensureAuthTokens(_ref);
    try {
      final meUser = await _authApi.me();
      final mergedName = meUser.name.trim().isNotEmpty ? meUser.name : prev.name;
      await _session.setUser(
        AuthUser(
          id: meUser.id,
          name: mergedName,
          login: meUser.login,
          role: meUser.role,
          tenantId: meUser.tenantId,
          tenantSlug: meUser.tenantSlug ?? slug,
          tenantName: meUser.tenantName,
          workSlotCode: meUser.workSlotCode ?? prev.workSlotCode,
          workSlotId: meUser.workSlotId ?? prev.workSlotId,
          code: meUser.code ?? prev.code,
          appAccess: meUser.appAccess,
        ),
        slug: slug,
        tenantName: meUser.tenantName,
      );
      if (meUser.tenantName != null && meUser.tenantName!.trim().isNotEmpty) {
        await _session.setTenantName(meUser.tenantName!);
      }
    } catch (_) {}
  }

  /// Qo'lda sinxronizatsiya — to'liq (full) yoki oddiy (oxirgi vaqt bilan).
  Future<AgentSyncResult> resync({
    bool full = false,
    bool forceClientCatalog = false,
    bool refreshConfig = false,
    void Function(int phase)? onPhase,
  }) async {
    final slug = _session.state.tenantSlug ?? '';
    if (slug.isEmpty) {
      return const AgentSyncResult(ok: false, error: 'Tenant topilmadi');
    }

    await ensureAuthTokens(_ref);
    onPhase?.call(0);

    try {
      if (refreshConfig) {
        try {
          final config = await _mobileApi.getAgentConfig(slug);
          if (config.tenantName != null && config.tenantName!.trim().isNotEmpty) {
            await _session.setTenantName(config.tenantName!);
          }
          await _session.setMobileConfig(
            MobileConfig.fromJson(config.mobileConfig),
            raw: config.mobileConfig,
            priceTypes: config.priceTypes,
            tenantReferences: config.tenantReferences,
            agentLimits: config.agentLimits,
            agentCities: config.agentCities,
          );
          final u = _session.state.user;
          if (u != null && (config.workSlotCode != null || config.workSlotId != null)) {
            await _session.setUser(
              AuthUser(
                id: u.id,
                name: u.name,
                login: u.login,
                role: u.role,
                tenantId: u.tenantId,
                tenantSlug: u.tenantSlug ?? slug,
                workSlotCode: config.workSlotCode ?? u.workSlotCode,
                workSlotId: config.workSlotId ?? u.workSlotId,
                code: u.code,
                appAccess: u.appAccess,
              ),
              slug: slug,
            );
          }
          final gpsConfig = _session.state.mobileConfig?.gps;
          if (gpsConfig?.trackingEnabled == true) {
            try {
              await _ref.read(gpsTrackerProvider.notifier).startTracking();
            } catch (_) {}
          }
        } catch (_) {}
      }

      final role = _session.state.user?.role ?? 'agent';
      if (role == 'expeditor') {
        await _resyncExpeditor(onPhase: onPhase, full: full);
        await AppDatabase().recordSyncToday();
        await checkForAppUpdate(afterSync: true);
        return const AgentSyncResult(ok: true, orders: 1);
      }
      if (role == 'supervisor') {
        await _resyncSupervisor();
        await AppDatabase().recordSyncToday();
        await checkForAppUpdate(afterSync: true);
        return const AgentSyncResult(ok: true);
      }

      var policy = evaluateSyncPolicy(_syncCfg);
      if (!policy.allowed) {
        await refreshMobileConfig();
        policy = evaluateSyncPolicy(_syncCfg);
      }
      if (!policy.allowed) {
        return AgentSyncResult(ok: false, error: policy.denialMessage);
      }

      final lastAt = full ? null : _session.state.lastSyncAt;
      final forceCatalog = forceClientCatalog ||
          (role == 'agent' && await AppDatabase().needsFullClientCatalogResync());
      int clients = 0;
      int products = 0;
      int prices = 0;
      int orders = 0;
      final syncEngine = _ref.read(syncEngineProvider);
      if (syncEngine != null) {
        final payload = await syncEngine.pullSync(
          lastSyncAt: lastAt,
          onPhase: onPhase,
          forceClientsCatalog: forceCatalog,
        );
        await _session.setLastSyncAt(payload.syncAt);
        clients = payload.clients.length;
        products = payload.products.length;
        prices = payload.prices.length;
        orders = payload.orders.length;
      } else {
        onPhase?.call(0);
        final payload = await _mobileApi.syncFullParsed(
          slug,
          lastSyncAt: lastAt,
          device: await MobileDeviceInfo.syncPayload(),
          forceClientsCatalog: forceCatalog,
        );
        await _persistSyncPayload(
          payload,
          onPhase: onPhase,
          lastSyncAt: lastAt,
          forceClientCatalog: forceCatalog,
        );
        await _session.setLastSyncAt(payload.syncAt);
        clients = payload.clients.length;
        products = payload.products.length;
        prices = payload.prices.length;
        orders = payload.orders.length;
      }

      await AppDatabase().recordSyncToday();
      await checkForAppUpdate(afterSync: true);
      return AgentSyncResult(
        ok: true,
        error: null,
        clients: clients,
        products: products,
        prices: prices,
        orders: orders,
      );
    } on UnauthorizedException catch (e) {
      final info = UserFacingError.fromApi(e);
      return AgentSyncResult(ok: false, error: info.summary, errorInfo: info);
    } on NetworkException catch (e) {
      final info = UserFacingError.from(e, context: 'Синхронизация прервана — данные не обновлены.');
      return AgentSyncResult(ok: false, error: info.summary, errorInfo: info);
    } on ApiException catch (e) {
      final info = UserFacingError.fromApi(e);
      return AgentSyncResult(ok: false, error: info.summary, errorInfo: info);
    } catch (e) {
      final info = UserFacingError.from(e, context: 'Синхронизация не завершена.');
      return AgentSyncResult(ok: false, error: info.summary, errorInfo: info);
    }
  }

  Future<void> _wipeLocalAuth() async {
    _ref.read(gpsTrackerProvider.notifier).stopTracking();
    await clearAuthTokens(_ref);
    await _ref.read(appPinStoreProvider).clear();
    await AppDatabase().clearAgentScopedCache();
    await _session.clear();
    invalidateAuthScopedData(_ref.invalidate);
  }

  /// Sinxron muvaffaqiyat ekranidan keyin asosiy ilovaga o‘tish.
  void finishBootstrap() {
    if (state.status != AuthStatus.syncComplete) return;
    state = state.copyWith(status: AuthStatus.ready);
  }

  Future<void> logout() async {
    state = const AuthState();
    _session.state = const SessionState();

    final rt = _ref.read(refreshTokenProvider);
    try {
      if (rt != null) await _authApi.logout(rt);
    } catch (_) {}

    await _wipeLocalAuth();
    state = const AuthState();
  }

  /// Web «Завершить все сессии» yoki sessiya muddati — login ekraniga.
  Future<void> validateActiveSession() async {
    if (state.status != AuthStatus.ready) return;
    if (_session.state.user == null) return;
    try {
      await ensureAuthTokens(_ref);
      await _authApi.me();
    } on UnauthorizedException {
      await sessionExpired();
    } on AppAccessDeniedException {
      await appAccessRevoked();
    } on NetworkException {
      // Oflayn — mahalliy kesh bilan davom
    } catch (_) {}
  }

  /// Web panel «Доступ к приложению» o‘chirilganda — login ekraniga.
  Future<void> appAccessRevoked() async {
    state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
    _session.state = const SessionState();
    await _wipeLocalAuth();
    state = const AuthState(status: AuthStatus.error, error: 'Ilova kirish o\'chirilgan');
  }

  /// JWT/refresh tugagan — login ekraniga (PIN qulfi emas).
  Future<void> sessionExpired({bool forceLogout = false}) async {
    if (!forceLogout && state.status == AuthStatus.ready) {
      try {
        await ensureAuthTokens(_ref);
        await _authApi.me();
        return;
      } on UnauthorizedException {
        // pastda to‘liq chiqish
      } on NetworkException {
        return;
      } catch (_) {
        return;
      }
    }
    state = const AuthState(status: AuthStatus.error, error: 'Sessiya tugadi. Qayta kiring.');
    _session.state = const SessionState();
    await _wipeLocalAuth();
    state = const AuthState(status: AuthStatus.error, error: 'Sessiya tugadi. Qayta kiring.');
  }
}

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authApiProvider), ref.read(mobileApiProvider),
    ref.read(permissionsApiProvider), ref.read(sessionProvider.notifier), ref,);
});

final isLoggedInProvider = Provider<bool>((ref) {
  final s = ref.watch(authStateProvider).status;
  return s == AuthStatus.ready || s == AuthStatus.authenticated;
});

import 'dart:async';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

/// Ilova ishlashi uchun majburiy ruxsatlar (barcha rollar).
enum AppPermissionKind { locationService, locationAlways, preciseLocation, battery, camera, notifications }

class AppPermissionItem {
  final AppPermissionKind kind;
  final bool granted;
  final bool permanentlyDenied;

  const AppPermissionItem({required this.kind, required this.granted, this.permanentlyDenied = false});

  String get title => switch (kind) {
        AppPermissionKind.locationService => 'Геолокация (GPS) включена',
        AppPermissionKind.locationAlways => 'Доступ к геолокации «Всегда»',
        AppPermissionKind.preciseLocation => 'Точное местоположение',
        AppPermissionKind.battery => 'Работа без ограничений батареи',
        AppPermissionKind.camera => 'Камера (фронтальная и основная)',
        AppPermissionKind.notifications => 'Уведомления',
      };

  String get description => switch (kind) {
        AppPermissionKind.locationService => 'Включите GPS в шторке или настройках телефона.',
        AppPermissionKind.locationAlways =>
          'Нужно для визитов и трека маршрута в фоне. В настройках выберите «Разрешить всегда».',
        AppPermissionKind.preciseLocation => 'Без точной геолокации нельзя проверить радиус клиента.',
        AppPermissionKind.battery =>
          'Чтобы телефон не останавливал трек GPS. Выберите «Без ограничений» / «Не оптимизировать».',
        AppPermissionKind.camera => 'Фотоотчёты, фото клиента и проверка лица (Face ID).',
        AppPermissionKind.notifications => 'Задачи, заказы и напоминания о визитах.',
      };
}

class AppPermissionsState {
  final List<AppPermissionItem> items;
  final bool checkedOnce;
  final bool checking;

  const AppPermissionsState({this.items = const [], this.checkedOnce = false, this.checking = false});

  bool get allGranted => checkedOnce && items.every((i) => i.granted);

  List<AppPermissionItem> get missing => items.where((i) => !i.granted).toList();

  AppPermissionsState copyWith({List<AppPermissionItem>? items, bool? checkedOnce, bool? checking}) =>
      AppPermissionsState(
        items: items ?? this.items,
        checkedOnce: checkedOnce ?? this.checkedOnce,
        checking: checking ?? this.checking,
      );
}

Future<AppPermissionItem> _fromStatus(AppPermissionKind kind, Future<PermissionStatus> status) async {
  final s = await status;
  return AppPermissionItem(kind: kind, granted: s.isGranted, permanentlyDenied: s.isPermanentlyDenied);
}

Future<List<AppPermissionItem>> checkAppPermissions() async {
  final android = Platform.isAndroid;
  final serviceOn = await Geolocator.isLocationServiceEnabled();
  final whenInUse = await Permission.locationWhenInUse.status;
  var precise = false;
  if (whenInUse.isGranted) {
    try {
      precise = await Geolocator.getLocationAccuracy() == LocationAccuracyStatus.precise;
    } catch (_) {}
  }
  return [
    AppPermissionItem(kind: AppPermissionKind.locationService, granted: serviceOn),
    await _fromStatus(AppPermissionKind.locationAlways, Permission.locationAlways.status),
    AppPermissionItem(
      kind: AppPermissionKind.preciseLocation,
      granted: precise,
      permanentlyDenied: whenInUse.isPermanentlyDenied,
    ),
    if (android) await _fromStatus(AppPermissionKind.battery, Permission.ignoreBatteryOptimizations.status),
    await _fromStatus(AppPermissionKind.camera, Permission.camera.status),
    await _fromStatus(AppPermissionKind.notifications, Permission.notification.status),
  ];
}

/// Bitta ruxsatni so‘rash: rad etilgan bo‘lsa tizim sozlamalari ochiladi.
Future<void> requestAppPermission(AppPermissionItem item) async {
  switch (item.kind) {
    case AppPermissionKind.locationService:
      await Geolocator.openLocationSettings();
    case AppPermissionKind.locationAlways:
      final base = await Permission.locationWhenInUse.request();
      if (!base.isGranted) {
        if (base.isPermanentlyDenied) await openAppSettings();
        return;
      }
      final always = await Permission.locationAlways.request();
      if (!always.isGranted) await openAppSettings();
    case AppPermissionKind.preciseLocation:
      final r = await Permission.locationWhenInUse.request();
      var precise = false;
      if (r.isGranted) {
        try {
          precise = await Geolocator.getLocationAccuracy() == LocationAccuracyStatus.precise;
        } catch (_) {}
      }
      if (!precise) await openAppSettings();
    case AppPermissionKind.battery:
      final r = await Permission.ignoreBatteryOptimizations.request();
      if (!r.isGranted) await openAppSettings();
    case AppPermissionKind.camera:
      final r = await Permission.camera.request();
      if (r.isPermanentlyDenied) await openAppSettings();
    case AppPermissionKind.notifications:
      final r = await Permission.notification.request();
      if (r.isPermanentlyDenied) await openAppSettings();
  }
}

class AppPermissionsNotifier extends StateNotifier<AppPermissionsState> with WidgetsBindingObserver {
  AppPermissionsNotifier() : super(const AppPermissionsState()) {
    WidgetsBinding.instance.addObserver(this);
    unawaited(refresh());
  }

  bool _disposed = false;

  Future<void> refresh() async {
    if (_disposed) return;
    state = state.copyWith(checking: true);
    try {
      final items = await checkAppPermissions();
      if (_disposed) return;
      state = AppPermissionsState(items: items, checkedOnce: true);
    } catch (_) {
      if (!_disposed) state = state.copyWith(checking: false, checkedOnce: true);
    }
  }

  Future<void> request(AppPermissionItem item) async {
    await requestAppPermission(item);
    await refresh();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

final appPermissionsProvider = StateNotifierProvider<AppPermissionsNotifier, AppPermissionsState>(
  (ref) => AppPermissionsNotifier(),
);

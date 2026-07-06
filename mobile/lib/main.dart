import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/api/api_base_url.dart';
import 'core/auth/mobile_session_guard.dart';
import 'core/config/env_loader.dart';
import 'core/database/app_database.dart';
import 'core/notifications/mobile_local_notification_service.dart';
import 'core/theme/app_theme.dart';
import 'core/sync/sync_engine.dart';
import 'core/time/server_clock.dart';
import 'core/time/work_region_time.dart';
import 'core/update/app_update_listener.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/biometric_setup_listener.dart';
import 'routing/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');
  await loadAppEnv();
  await MobileLocalNotificationService.instance.init();
  await _initServerClockPersistence();

  if (!kIsWeb && Platform.isAndroid) {
    final info = await DeviceInfoPlugin().androidInfo;
    configureApiHostForAndroidEmulator(!info.isPhysicalDevice);
    debugPrint('[SalesDoc] API (resolved): ${resolveApiBaseUrl()}');
  }

  runApp(const ProviderScope(child: SalesDocApp()));
}

/// Server-langarlangan soatni diskdagi «floor» bilan bog‘laymiz:
/// restartdan keyin ham ishonchli vaqt orqaga ketmaydi (qurilma soati
/// orqaga surilsa ham aldab bo‘lmaydi).
Future<void> _initServerClockPersistence() async {
  try {
    final db = AppDatabase();
    final floorIso = await db.getSyncMeta('server_clock_floor_utc');
    final floorDevIso = await db.getSyncMeta('server_clock_floor_dev_utc');
    ServerClock.instance.loadPersisted(
      parseUtcIso(floorIso),
      parseUtcIso(floorDevIso),
    );
    ServerClock.instance.configurePersistence((serverUtc, deviceUtc) {
      db.setSyncMeta('server_clock_floor_utc', serverUtc.toIso8601String());
      db.setSyncMeta('server_clock_floor_dev_utc', deviceUtc.toIso8601String());
    });
  } catch (_) {
    // Saqlash mavjud bo‘lmasa — soat baribir jonli langar bilan ishlaydi.
  }
}

class SalesDocApp extends ConsumerStatefulWidget {
  const SalesDocApp({super.key});

  @override
  ConsumerState<SalesDocApp> createState() => _SalesDocAppState();
}

class _SalesDocAppState extends ConsumerState<SalesDocApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).checkSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.read(appRouterProvider);

    // Keep autoFlush alive by reading it in build
    ref.watch(autoFlushProvider);

    return MobileSessionGuard(
      child: MaterialApp.router(
        title: 'SalesDoc',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        routerConfig: router,
        builder: (context, child) => AppUpdateListener(
          child: BiometricSetupListener(
            child: child ?? const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

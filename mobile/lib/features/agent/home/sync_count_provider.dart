import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/app_database.dart';

final syncCountTodayProvider = FutureProvider<int>((ref) => AppDatabase().getSyncCountToday());

final pendingPhotoCountProvider =
    FutureProvider<int>((ref) => AppDatabase().pendingPhotoReportCount());

final syncedPhotoCountTodayProvider =
    FutureProvider<int>((ref) => AppDatabase().getPhotosSyncedToday());

final failedPhotoCountProvider =
    FutureProvider<int>((ref) => AppDatabase().failedPhotoReportCount());
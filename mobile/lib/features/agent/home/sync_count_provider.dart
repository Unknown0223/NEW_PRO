import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/app_database.dart';

final syncCountTodayProvider = FutureProvider<int>((ref) => AppDatabase().getSyncCountToday());

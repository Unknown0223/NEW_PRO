import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import 'mobile_config.dart';
import 'mobile_config_policy.dart';

/// Joriy sessiyadagi sinxron siyosati (UI va sync engine uchun).
final syncPolicyProvider = Provider<SyncPolicyEvaluation>((ref) {
  final sync = ref.watch(
    sessionProvider.select((s) => s.mobileConfig?.sync ?? const SyncConfig()),
  );
  return evaluateSyncPolicy(sync);
});

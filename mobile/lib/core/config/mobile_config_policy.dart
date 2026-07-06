import 'mobile_config.dart';
import '../time/server_clock.dart';
import '../time/work_region_time.dart';

/// Vebda oyna bo‘sh qoldirilganda — standart ish vaqti (taymer va sinхron siyosati).
const String kDefaultSyncWindowFrom = '06:00';
const String kDefaultSyncWindowTo = '22:00';

bool syncWindowConfigured(SyncConfig sync) {
  final from = sync.allowedWindowFrom?.trim();
  final to = sync.allowedWindowTo?.trim();
  return (from != null && from.isNotEmpty) || (to != null && to.isNotEmpty);
}

SyncConfig effectiveSyncConfig(SyncConfig sync) {
  if (syncWindowConfigured(sync)) return sync;
  return SyncConfig(
    mandatorySyncCount: sync.mandatorySyncCount,
    blockSync: sync.blockSync,
    allowedWindowFrom: kDefaultSyncWindowFrom,
    allowedWindowTo: kDefaultSyncWindowTo,
  );
}

/// Barcha pull/flush sinxron yo‘llari uchun yagona qaror (block_sync + vaqt oynasi).
class SyncPolicyEvaluation {
  final bool allowed;
  final String? denialMessage;

  const SyncPolicyEvaluation({required this.allowed, this.denialMessage});

  static const allowedNow = SyncPolicyEvaluation(allowed: true);
}

SyncPolicyEvaluation evaluateSyncPolicy(SyncConfig sync) {
  sync = effectiveSyncConfig(sync);
  if (sync.blockSync) {
    return const SyncPolicyEvaluation(
      allowed: false,
      denialMessage: 'Sinxronizatsiya bloklangan',
    );
  }
  // Vaqt oynasi qo‘yilgan bo‘lsa — qaror faqat serverdan langarlangan ishonchli
  // vaqtga tayanadi. Server bilan hali bog‘lanmagan bo‘lsa, qurilma soatiga
  // ishonmaymiz va sinxronni rad etamiz (telefon soati/mintaqasi bilan aldab
  // bo‘lmasin). Login/refresh serverga so‘rov bo‘lgani uchun amalda langar tez
  // o‘rnatiladi.
  if (syncWindowConfigured(sync) && !ServerClock.instance.hasAnchor) {
    return const SyncPolicyEvaluation(
      allowed: false,
      denialMessage: 'Vaqt server bilan tasdiqlanmagan. Internetga ulanib, qayta urinib ko‘ring.',
    );
  }
  if (!isSyncAllowedNow(sync)) {
    return SyncPolicyEvaluation(allowed: false, denialMessage: syncWindowMessage(sync));
  }
  return SyncPolicyEvaluation.allowedNow;
}

/// Sinxron faqat `allowed_window_from` … `allowed_window_to` oralig‘ida (HH:mm, mahalliy vaqt).
bool isSyncAllowedNow(SyncConfig sync, [DateTime? at]) {
  sync = effectiveSyncConfig(sync);
  final from = sync.allowedWindowFrom?.trim();
  final to = sync.allowedWindowTo?.trim();
  if ((from == null || from.isEmpty) && (to == null || to.isEmpty)) {
    return true;
  }
  final now = syncWindowClockNow(at);
  final minutes = syncWindowMinutesOfDay(now);
  final fromM = from != null && from.isNotEmpty ? _parseHm(from) : null;
  final toM = to != null && to.isNotEmpty ? _parseHm(to) : null;
  if (fromM == null && toM == null) return true;
  if (fromM != null && toM != null) {
    if (fromM <= toM) return minutes >= fromM && minutes <= toM;
    return minutes >= fromM || minutes <= toM;
  }
  if (fromM != null) return minutes >= fromM;
  return minutes <= (toM ?? 24 * 60);
}

int? _parseHm(String hm) {
  final p = hm.split(':');
  if (p.length < 2) return null;
  final h = int.tryParse(p[0]);
  final m = int.tryParse(p[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

bool needsMandatorySync(SyncConfig sync, int syncCountToday) {
  final need = sync.mandatorySyncCount;
  if (need <= 0) return false;
  return syncCountToday < need;
}

String syncWindowMessage(SyncConfig sync) {
  final effective = effectiveSyncConfig(sync);
  final from = effective.allowedWindowFrom ?? '—';
  final to = effective.allowedWindowTo ?? '—';
  return 'Sinxron faqat $from – $to oralig‘ida mumkin';
}

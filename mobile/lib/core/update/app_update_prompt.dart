import 'app_update_info.dart';

const kOptionalUpdateSnooze = Duration(hours: 24);

String? appUpdatePromptVersion(AppUpdateInfo info) {
  final latest = info.latestVersion?.trim();
  if (latest != null && latest.isNotEmpty) return latest;
  final current = info.currentVersion.trim();
  return current.isEmpty ? null : current;
}

bool shouldSkipOptionalUpdate({
  required AppUpdateInfo info,
  required bool forcePrompt,
  String? sessionPromptedVersion,
  String? snoozedVersion,
  DateTime? snoozedUntil,
  DateTime? now,
}) {
  if (forcePrompt || info.required) return false;
  if (!info.optional && !info.hasAction) return false;
  final v = appUpdatePromptVersion(info);
  if (v == null || v.isEmpty) return false;
  if (sessionPromptedVersion == v) return true;
  if (snoozedVersion == v &&
      snoozedUntil != null &&
      (now ?? DateTime.now()).isBefore(snoozedUntil)) {
    return true;
  }
  return false;
}

String encodeAppUpdateSnooze(String version, DateTime until) =>
    '$version|${until.toUtc().toIso8601String()}';

({String version, DateTime until})? parseAppUpdateSnooze(String? raw) {
  final s = raw?.trim() ?? '';
  if (s.isEmpty) return null;
  final i = s.indexOf('|');
  if (i <= 0 || i >= s.length - 1) return null;
  final version = s.substring(0, i).trim();
  final until = DateTime.tryParse(s.substring(i + 1).trim());
  if (version.isEmpty || until == null) return null;
  return (version: version, until: until.toUtc());
}

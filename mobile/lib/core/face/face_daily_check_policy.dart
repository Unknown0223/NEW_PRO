// Kunlik Face / tabel gate — unit-testable qoidalar.

bool shouldAutoPromptDailyFace({
  required bool force,
  required bool doneThisSession,
  required bool alreadyPrompted,
}) {
  if (force) return true;
  if (doneThisSession) return false;
  if (alreadyPrompted) return false;
  return true;
}

/// Soft «Позже» — majburiy Face ID da hech qachon.
bool allowSoftSkipDailyFace({
  required bool hardBlockRequired,
  required bool userChoseLater,
}) {
  if (hardBlockRequired) return false;
  return userChoseLater;
}

/// Birinchi kirish: qora overlay o‘rniga /attendance?gate=1.
bool shouldOpenAttendanceGate({
  required bool needsDailyLogin,
  required bool alreadyNavigated,
  required String currentPath,
}) {
  if (!needsDailyLogin) return false;
  if (alreadyNavigated) return false;
  if (currentPath.startsWith('/attendance')) return false;
  return true;
}

/// Gate ekranidan chiqish mumkinmi.
bool canLeaveAttendanceGate({
  required bool gateMode,
  required bool dayGateCleared,
}) {
  if (!gateMode) return true;
  return dayGateCleared;
}

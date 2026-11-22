// Kunlik yuz tekshiruvi — qachon avto-dialog / soft-skip (unit-testable).

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

/// Soft «Позже» — faqat hard-block o‘chirilganda. Majburiy Face ID da hech qachon.
bool allowSoftSkipDailyFace({
  required bool hardBlockRequired,
  required bool userChoseLater,
}) {
  if (hardBlockRequired) return false;
  return userChoseLater;
}

// Kunlik yuz tekshiruvi — qachon avto-dialog ochiladi (unit-testable).
// force: tugma; alreadyPrompted: shu bloklashda dialog bir marta ochilgan.
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

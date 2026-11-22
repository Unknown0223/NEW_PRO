/// GoRouter redirect — Face/tabel gate. Loop bo‘lmasligi uchun sof funksiya.
///
/// Qoida: `/attendance` da hech qachon `/home` ga qaytarmaymiz (roleRedirect ham emas).
/// Gate yoqilganda boshqa joydan faqat `/attendance?gate=1` ga yuboramiz.
String? faceGateReadyRedirect({
  required String matchedLocation,
  required bool gateRequired,
}) {
  final onAttendance = matchedLocation.startsWith('/attendance');
  if (onAttendance) return null;
  if (gateRequired) return '/attendance?gate=1';
  return null;
}

/// Bootstrap/login/splash → bitta target (home flash + qayta gate yo‘q).
String readyEntryPath({required bool gateRequired}) =>
    gateRequired ? '/attendance?gate=1' : '/home';

/// Biometric / update dialog — Face gate tugaguncha kutadi.
bool shouldDeferAppOpenOverlay({required bool faceGateRequired}) =>
    faceGateRequired;

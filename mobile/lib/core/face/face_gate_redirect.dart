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

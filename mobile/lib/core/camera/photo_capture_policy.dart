// Kamera xatolari — UI toast matni (unit-testable).

class PhotoCaptureException implements Exception {
  final String code;
  final String message;
  const PhotoCaptureException({required this.code, required this.message});

  @override
  String toString() => 'PhotoCaptureException($code: $message)';
}

/// PlatformException.code → foydalanuvchi matni.
String photoCaptureUserMessage(String? code, {String? fallback}) {
  switch ((code ?? '').trim()) {
    case 'camera_access_denied':
    case 'camera_access_permanently_denied':
      return 'Kamera ruxsati yo‘q — sozlamalardan yoqing';
    case 'no_available_camera':
      return 'Kamera topilmadi — emulyatorda Back kamerani yoqing yoki qurilmani tekshiring';
    case 'already_active':
      return 'Kamera band — oynani yoping va qayta urinib ko‘ring';
    case 'camera_unavailable':
      return 'Kamera band yoki ishlamayapti — qayta urinib ko‘ring';
    default:
      return (fallback != null && fallback.trim().isNotEmpty)
          ? fallback.trim()
          : 'Kamerani ochib bo‘lmadi — qayta urinib ko‘ring';
  }
}

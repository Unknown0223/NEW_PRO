/// Login ekranidagi Face ID / biometriya urinishi natijasi.
enum BiometricLoginAttempt {
  success,
  /// Telefonda Face ID / barmoq izi yoqilmagan yoki qo‘llab-quvvatlanmaydi.
  notAvailable,
  /// Sozlamalarda tez kirish o‘chirilgan.
  notEnabled,
  /// Saqlangan sessiya yo‘q — avval parol bilan kirish kerak.
  noSession,
  /// Foydalanuvchi bekor qildi yoki skan muvaffaqiyatsiz.
  failed,
}

extension BiometricLoginAttemptMessage on BiometricLoginAttempt {
  /// Pastki bildirishnoma matni (o‘zbekcha).
  String get toastUz {
    switch (this) {
      case BiometricLoginAttempt.success:
        return '';
      case BiometricLoginAttempt.notAvailable:
        return 'Face ID / biometriya telefonda yoqilmagan';
      case BiometricLoginAttempt.notEnabled:
        return 'Face ID tez kirish o‘chirilgan. Sozlamalarda yoqing';
      case BiometricLoginAttempt.noSession:
        return 'Avval login va parol bilan kiring, keyin Face ID yoqing';
      case BiometricLoginAttempt.failed:
        return 'Face ID tasdiqlanmadi. Qayta urinib ko‘ring yoki parol bilan kiring';
    }
  }
}

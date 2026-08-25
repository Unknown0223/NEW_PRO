import 'mobile_config.dart';

/// Agent: muhim amallar uchun biometrik/PIN tasdiq (web `misc.*` config).
class SecurityConfigPolicy {
  final MiscConfig misc;

  const SecurityConfigPolicy(this.misc);

  factory SecurityConfigPolicy.fromMobileConfig(MobileConfig? mc) =>
      SecurityConfigPolicy(mc?.misc ?? const MiscConfig());

  bool get confirmOrderSubmit => misc.biometricConfirmForOrderSubmit;
  bool get confirmPaymentAccept => misc.biometricConfirmForPaymentAccept;
}

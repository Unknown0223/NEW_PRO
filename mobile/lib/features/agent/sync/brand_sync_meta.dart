import '../../auth/entrance/role_welcome_meta.dart';

/// Shablon BrandSync.tsx — `quick` / `full` (identity keyinroq).
enum BrandSyncVariant { quick, full }

class BrandSyncStepMeta {
  final String label;
  final String kb;
  const BrandSyncStepMeta(this.label, this.kb);
}

class BrandSyncMeta {
  final String title;
  final String hint;
  final List<BrandSyncStepMeta> steps;
  const BrandSyncMeta({
    required this.title,
    required this.hint,
    required this.steps,
  });
}

BrandSyncMeta brandSyncMeta(BrandSyncVariant variant) {
  switch (variant) {
    case BrandSyncVariant.quick:
      return const BrandSyncMeta(
        title: 'Oddiy sinxronlash',
        hint: 'Faqat o‘zgargan yozuvlar yuboriladi',
        steps: [
          BrandSyncStepMeta('Farqni topish', '3 yozuv'),
          BrandSyncStepMeta('Buyurtmalar', '2 ta'),
          BrandSyncStepMeta('Foto hisobotlar', '1.4 MB'),
          BrandSyncStepMeta('Tasdiq qabul qilish', 'ok'),
        ],
      );
    case BrandSyncVariant.full:
      return const BrandSyncMeta(
        title: 'To‘liq sinxronlash',
        hint: 'Kesh to‘liq yangilanadi',
        steps: [
          BrandSyncStepMeta('Savdo nuqtalari', '342'),
          BrandSyncStepMeta('Katalog va narxlar', '1 208'),
          BrandSyncStepMeta('Ombor qoldiqlari', '3 ombor'),
          BrandSyncStepMeta('Bonus va skidka', '6 qoida'),
          BrandSyncStepMeta('Buyurtmalar', '24 ta'),
          BrandSyncStepMeta('Foto hisobotlar', '8 ta'),
          BrandSyncStepMeta('Marshrut va tabel', '12 vizit'),
        ],
      );
  }
}

BrandSyncVariant brandSyncVariantFromFull(bool full) =>
    full ? BrandSyncVariant.full : BrandSyncVariant.quick;

/// Gibrid: real progress → vizual bosqich (0..n).
/// Success bo‘lguncha oxirgi bosqich «now» qoladi — CTA faqat success da.
int brandSyncVisualStep({
  required double progress,
  required bool success,
  required int stepCount,
}) {
  if (stepCount <= 0) return 0;
  if (success) return stepCount;
  final p = progress.clamp(0.0, 0.999);
  return (p * stepCount).floor().clamp(0, stepCount - 1);
}

String brandSyncRoleWord(String? role) => roleWelcomeMeta(role).word;

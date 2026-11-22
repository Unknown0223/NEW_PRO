import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/sync/brand_sync_meta.dart';

void main() {
  test('quick and full meta match BrandSync.tsx step counts', () {
    expect(brandSyncMeta(BrandSyncVariant.quick).steps.length, 4);
    expect(brandSyncMeta(BrandSyncVariant.full).steps.length, 7);
    expect(brandSyncVariantFromFull(true), BrandSyncVariant.full);
    expect(brandSyncVariantFromFull(false), BrandSyncVariant.quick);
  });

  test('brandSyncVisualStep maps progress hybrid', () {
    expect(
      brandSyncVisualStep(progress: 0, success: false, stepCount: 4),
      0,
    );
    expect(
      brandSyncVisualStep(progress: 0.5, success: false, stepCount: 4),
      2,
    );
    // Progress 1 lekin success yo‘q — oxirgi bosqich «now», CTA ochilmaydi.
    expect(
      brandSyncVisualStep(progress: 1, success: false, stepCount: 4),
      3,
    );
    expect(
      brandSyncVisualStep(progress: 0.2, success: true, stepCount: 7),
      7,
    );
  });
}

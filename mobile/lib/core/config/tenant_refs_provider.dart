import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import 'territory_cascade.dart';
import 'tenant_references.dart';

/// Rad sabablari — bootstrap `tenant_references` yoki seed.
final photoCategoryEntriesProvider = Provider<List<RefEntry>>((ref) {
  return ref.watch(sessionProvider).tenantReferences?.photoCategoryEntries ?? const [];
});

final refusalReasonsProvider = Provider<List<RefEntry>>((ref) {
  final fromSession = ref.watch(sessionProvider).tenantReferences?.refusalReasonEntries ?? [];
  if (fromSession.isNotEmpty) return fromSession;
  return const [
    RefEntry(id: 'seed-ref-client', name: 'Mijoz rad etdi'),
    RefEntry(id: 'seed-ref-quality', name: 'Sifat / muddati'),
    RefEntry(id: 'seed-ref-price', name: 'Narx kelishmovchiligi'),
  ];
});

final paymentMethodsProvider = Provider<List<PaymentMethodRef>>((ref) {
  return ref.watch(sessionProvider).tenantReferences?.paymentMethods ?? const [];
});

/// Mijoz formasi uchun tenant spravochniklari.
class ClientFormTenantRefs {
  final List<String> clientCategories;
  final List<String> clientTypeCodes;
  final List<String> salesChannels;
  final List<String> regions;
  final List<String> zones;
  final List<String> cities;
  final TerritoryCascadeIndex? territoryCascade;

  const ClientFormTenantRefs({
    this.clientCategories = const [],
    this.clientTypeCodes = const [],
    this.salesChannels = const [],
    this.regions = const [],
    this.zones = const [],
    this.cities = const [],
    this.territoryCascade,
  });

  /// Hot reload dan keyin ham xavfsiz (eski instanslarda null bo‘lishi mumkin).
  TerritoryCascadeIndex get cascadeIndex => territoryCascade ?? const TerritoryCascadeIndex();
}

final sessionTenantRefsProvider = Provider<ClientFormTenantRefs>((ref) {
  final refs = ref.watch(sessionProvider).tenantReferences;
  return ClientFormTenantRefs(
    clientCategories: refs?.clientCategories ?? const [],
    clientTypeCodes: refs?.clientTypeCodes ?? const [],
    salesChannels: refs?.salesChannels ?? const [],
    regions: refs?.regions ?? const [],
    zones: refs?.zonesList ?? const [],
    cities: refs?.citiesList ?? const [],
    territoryCascade: resolveTerritoryCascade(
      cascadeJson: refs?.territoryCascadeJson,
      nodes: refs?.territoryNodesList ?? const [],
    ),
  );
});

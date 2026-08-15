import 'price_type_labels.dart';
import 'territory_cascade.dart';

/// Tenant spravochniklari (agent-config `tenant_references`).
class RefEntry {
  final String id;
  final String name;
  final String? code;
  const RefEntry({required this.id, required this.name, this.code});

  factory RefEntry.fromJson(Map<String, dynamic> j) => RefEntry(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString(),
      );
}

class PaymentMethodRef {
  final String id;
  final String name;
  final String paymentType;
  final String? code;
  const PaymentMethodRef({
    required this.id,
    required this.name,
    required this.paymentType,
    this.code,
  });

  factory PaymentMethodRef.fromJson(Map<String, dynamic> j) => PaymentMethodRef(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        paymentType: j['payment_type']?.toString() ?? '',
        code: j['code']?.toString(),
      );
}

class TenantReferences {
  final List<RefEntry> refusalReasonEntries;
  final List<RefEntry> photoCategoryEntries;
  final List<PaymentMethodRef> paymentMethods;
  /// create-context / agent-config `price_type_options` — id → label.
  final Map<String, String> priceTypeLabels;
  final List<String> clientCategories;
  final List<String> clientTypeCodes;
  final List<String> salesChannels;
  final List<String> regions;
  final List<String>? zones;
  final List<String>? cities;
  final List<TerritoryNode>? territoryNodes;
  final Map<String, dynamic>? territoryCascadeJson;

  const TenantReferences({
    this.refusalReasonEntries = const [],
    this.photoCategoryEntries = const [],
    this.paymentMethods = const [],
    this.priceTypeLabels = const {},
    this.clientCategories = const [],
    this.clientTypeCodes = const [],
    this.salesChannels = const [],
    this.regions = const [],
    this.zones,
    this.cities,
    this.territoryNodes,
    this.territoryCascadeJson,
  });

  List<String> get zonesList => zones ?? const [];
  List<String> get citiesList => cities ?? const [];
  List<TerritoryNode> get territoryNodesList => territoryNodes ?? const [];

  Map<String, dynamic> toJson() => {
        'refusal_reason_entries': refusalReasonEntries
            .map((e) => {'id': e.id, 'name': e.name, 'code': e.code})
            .toList(),
        'photo_category_entries': photoCategoryEntries
            .map((e) => {'id': e.id, 'name': e.name, 'code': e.code})
            .toList(),
        'payment_methods': paymentMethods
            .map((e) => {
                  'id': e.id,
                  'name': e.name,
                  'payment_type': e.paymentType,
                  'code': e.code,
                },)
            .toList(),
        'price_type_options': priceTypeLabels.entries
            .map((e) => {'id': e.key, 'label': e.value})
            .toList(),
        'client_categories': clientCategories,
        'client_type_codes': clientTypeCodes,
        'sales_channels': salesChannels,
        'regions': regions,
        if (zones != null) 'zones': zones,
        if (cities != null) 'cities': cities,
        if (territoryNodes != null && territoryNodes!.isNotEmpty)
          'territory_nodes': territoryNodes!
              .map((n) => _territoryNodeToJson(n))
              .toList(),
        if (territoryCascadeJson != null) 'territory_cascade': territoryCascadeJson,
      };

  factory TenantReferences.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const TenantReferences();
    final refusal = (j['refusal_reason_entries'] as List?)
            ?.map((e) => RefEntry.fromJson(Map<String, dynamic>.from(e as Map)))
            .where((e) => e.id.isNotEmpty)
            .toList() ??
        [];
    final photoCats = (j['photo_category_entries'] as List?)
            ?.map((e) => RefEntry.fromJson(Map<String, dynamic>.from(e as Map)))
            .where((e) => e.name.isNotEmpty)
            .toList() ??
        [];
    final methods = (j['payment_methods'] as List?)
            ?.map((e) => PaymentMethodRef.fromJson(Map<String, dynamic>.from(e as Map)))
            .where((e) => e.id.isNotEmpty)
            .toList() ??
        [];
    final priceTypeLabels = priceTypeLabelsFromOptions(
      j['price_type_options'] as List? ?? j['price_type_entries'] as List?,
    );
    List<String> strList(dynamic raw) => (raw as List?)
            ?.map((e) => e.toString().trim())
            .where((s) => s.isNotEmpty)
            .toList() ??
        const [];
    final nodes = parseTerritoryNodes(j['territory_nodes']);
    return TenantReferences(
      refusalReasonEntries: refusal,
      photoCategoryEntries: photoCats,
      paymentMethods: methods,
      priceTypeLabels: priceTypeLabels,
      clientCategories: strList(j['client_categories']),
      clientTypeCodes: strList(j['client_type_codes']),
      salesChannels: strList(j['sales_channels']),
      regions: strList(j['regions']),
      zones: strList(j['zones']),
      cities: strList(j['cities']),
      territoryNodes: nodes,
      territoryCascadeJson: j['territory_cascade'] is Map
          ? Map<String, dynamic>.from(j['territory_cascade'] as Map)
          : null,
    );
  }
}

Map<String, dynamic> _territoryNodeToJson(TerritoryNode n) => {
      'name': n.name,
      'active': n.active,
      if (n.children.isNotEmpty)
        'children': n.children.map(_territoryNodeToJson).toList(),
    };

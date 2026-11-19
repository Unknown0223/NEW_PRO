import '../clients/client_outlet_filters.dart';
import 'client_field_keys.dart';
import 'mobile_config.dart';

/// Veb `fields_visible` bo‘sh bo‘lsa — mobil uchun standart maydonlar.
const _defaultVisible = <String, bool>{
  'name': true,
  'phone': true,
  'address': true,
};

/// Backend `CLIENT_FIELD_KEYS` bilan bir xil tartib (address, notes qo‘shilgan).
const clientFormFieldOrder = [
  'name',
  'legal_name',
  'category',
  'client_type',
  'sales_channel',
  'territory',
  'inn',
  'phone',
  'address',
  'visit_day',
  'coordinates',
  'client_pc',
  'bank',
  'mfo',
  'oked',
  'pinfl',
  'agreement_number',
  'notes',
];

bool isClientFieldVisible(ClientConfig client, String key) {
  final v = client.fieldsVisible;
  if (v.isEmpty) return _defaultVisible[key] ?? false;
  return v[key] ?? false;
}

bool isClientFieldRequired(ClientConfig client, String key) {
  return client.fieldsRequired[key] == true;
}

const clientFieldApiKey = <String, String>{
  'name': 'name',
  'phone': 'phone',
  'address': 'address',
  'legal_name': 'legal_name',
  'inn': 'inn',
  'category': 'category',
  'sales_channel': 'sales_channel',
  'client_type': 'client_type_code',
  'territory': 'region',
  'visit_day': 'visit_date',
  'client_pc': 'client_code',
  'bank': 'bank_name',
  'mfo': 'bank_mfo',
  'oked': 'oked',
  'pinfl': 'client_pinfl',
  'agreement_number': 'contract_number',
  'notes': 'notes',
};

const clientApiKeyToFormKey = <String, String>{
  'name': 'name',
  'phone': 'phone',
  'address': 'address',
  'legal_name': 'legal_name',
  'inn': 'inn',
  'category': 'category',
  'sales_channel': 'sales_channel',
  'client_type_code': 'client_type',
  'region': 'territory',
  'visit_date': 'visit_day',
  'client_code': 'client_pc',
  'bank_name': 'bank',
  'bank_mfo': 'mfo',
  'oked': 'oked',
  'client_pinfl': 'pinfl',
  'contract_number': 'agreement_number',
  'notes': 'notes',
};

List<String> clientFormFieldKeys(ClientConfig client) {
  return clientFormFieldOrder.where((k) {
    if (k == 'coordinates') return isClientFieldVisible(client, k);
    return isClientFieldVisible(client, k);
  }).toList();
}

bool showCoordinatesField(ClientConfig client) =>
    isClientFieldVisible(client, 'coordinates') && client.canChangeClientLocation;

bool showCoordinatesHintOnly(ClientConfig client) =>
    isClientFieldVisible(client, 'coordinates') && !client.canChangeClientLocation;

String normalizePhoneWithPrefix(ClientConfig client, String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  final prefix = client.phonePrefix.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  if (prefix.isEmpty) return '+$digits';
  if (digits.startsWith(prefix)) return '+$digits';
  if (digits.startsWith('0') && digits.length >= 9) {
    return '${client.phonePrefix}${digits.substring(1)}';
  }
  return '${client.phonePrefix}$digits';
}

bool isNewClientBlockedForOrder(
  Map<String, dynamic> client,
  ClientConfig clientCfg,
  ProductListConfig productList,
) {
  if (productList.allowSubmitForNewClient) return false;
  final active = client['is_active'];
  if (active == 0 || active == false) return true;
  if (clientCfg.requireNewClientApproval && active != 1 && active != true) return true;
  return false;
}

String clientFieldLabel(String key) => kClientFieldLabelsRu[key] ?? key;

/// API yaratishda `name` majburiy — UI da yashirin bo‘lsa `legal_name` dan olinadi.
String resolveClientCreateName(ClientConfig client, Map<String, String> values) {
  final name = values['name']?.trim() ?? '';
  if (name.length >= 3) return name;
  final legal = values['legal_name']?.trim() ?? '';
  if (legal.length >= 3) return legal;
  return name;
}

/// Forma kaliti → mijoz yozuvidagi qiymat (API yoki lokal kalitlar).
Object? clientFieldRawValue(Map<String, dynamic> client, String formKey) {
  final apiKey = clientFieldApiKey[formKey];
  if (apiKey != null && client[apiKey] != null) return client[apiKey];
  return client[formKey];
}

String? clientFieldDisplayText(Map<String, dynamic> client, String formKey) {
  if (formKey == 'coordinates') {
    final lat = (client['latitude'] as num?)?.toDouble();
    final lng = (client['longitude'] as num?)?.toDouble();
    if (lat != null && lng != null && (lat != 0 || lng != 0)) {
      return '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
    }
    return null;
  }
  if (formKey == 'visit_day') {
    return formatClientVisitDaysDisplay(client);
  }
  final raw = clientFieldRawValue(client, formKey);
  if (raw == null) return null;
  final text = raw.toString().trim();
  return text.isEmpty ? null : text;
}

/// Mijoz kartasida ko‘rsatiladigan maydonlar (sarlavha va telefon alohida).
List<String> clientDetailFieldKeys(ClientConfig client) {
  return clientFormFieldKeys(client).where((k) {
    if (k == 'name' || k == 'phone' || k == 'coordinates') return false;
    return true;
  }).toList();
}

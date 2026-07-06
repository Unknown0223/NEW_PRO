/// Mijoz formasi maydonlari — tur, min/max va validatsiya (backend schema bilan mos).
enum ClientFieldKind { text, digits, phoneLocal, date, multiline }

class ClientFieldConstraint {
  final ClientFieldKind kind;
  final int minLen;
  final int maxLen;
  final int? exactDigits;
  final String? hint;

  const ClientFieldConstraint({
    required this.kind,
    this.minLen = 0,
    required this.maxLen,
    this.exactDigits,
    this.hint,
  });
}

const clientFieldConstraints = <String, ClientFieldConstraint>{
  'name': ClientFieldConstraint(kind: ClientFieldKind.text, minLen: 3, maxLen: 255),
  'phone': ClientFieldConstraint(
    kind: ClientFieldKind.phoneLocal,
    minLen: 9,
    maxLen: 9,
    exactDigits: 9,
    hint: '9 raqam (masalan 901234567)',
  ),
  'address': ClientFieldConstraint(kind: ClientFieldKind.multiline, maxLen: 2000),
  'legal_name': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 512),
  'inn': ClientFieldConstraint(
    kind: ClientFieldKind.digits,
    minLen: 9,
    maxLen: 9,
    exactDigits: 9,
    hint: '9 raqam',
  ),
  'category': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 255),
  'client_type': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 128),
  'sales_channel': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 255),
  'territory': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 255),
  'visit_day': ClientFieldConstraint(
    kind: ClientFieldKind.text,
    maxLen: 32,
    hint: 'Например: ПН, СР, ПТ',
  ),
  'client_pc': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 32, hint: 'Maks. 32 belgi'),
  'bank': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 255),
  'mfo': ClientFieldConstraint(
    kind: ClientFieldKind.digits,
    minLen: 5,
    maxLen: 5,
    exactDigits: 5,
    hint: '5 raqam',
  ),
  'oked': ClientFieldConstraint(
    kind: ClientFieldKind.digits,
    minLen: 5,
    maxLen: 5,
    exactDigits: 5,
    hint: '5 raqam',
  ),
  'pinfl': ClientFieldConstraint(
    kind: ClientFieldKind.digits,
    minLen: 14,
    maxLen: 14,
    exactDigits: 14,
    hint: '14 raqam',
  ),
  'agreement_number': ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 128),
  'notes': ClientFieldConstraint(kind: ClientFieldKind.multiline, maxLen: 4000),
};

ClientFieldConstraint constraintForField(String key) =>
    clientFieldConstraints[key] ?? const ClientFieldConstraint(kind: ClientFieldKind.text, maxLen: 255);

String _digitsOnly(String raw) => raw.replaceAll(RegExp(r'\D'), '');

/// Bitta maydon qiymatini tekshiradi; xato bo‘lsa xabar qaytaradi.
String? validateClientFieldValue(String key, String raw, {required bool required}) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    return required ? '${_label(key)} majburiy' : null;
  }

  final c = constraintForField(key);

  switch (c.kind) {
    case ClientFieldKind.phoneLocal:
      final d = _digitsOnly(trimmed);
      if (d.isEmpty || !RegExp(r'^\d+$').hasMatch(d)) {
        return '${_label(key)}: faqat raqamlar';
      }
      if (c.exactDigits != null && d.length != c.exactDigits) {
        return '${_label(key)}: ${c.exactDigits} raqam bo‘lishi kerak';
      }
      if (d.length < c.minLen) return '${_label(key)}: kamida ${c.minLen} raqam';
      return null;
    case ClientFieldKind.digits:
      final d = _digitsOnly(trimmed);
      if (d.isEmpty) return '${_label(key)}: faqat raqamlar';
      if (c.exactDigits != null && d.length != c.exactDigits) {
        return '${_label(key)}: ${c.exactDigits} raqam bo‘lishi kerak';
      }
      if (d.length < c.minLen) return '${_label(key)}: kamida ${c.minLen} raqam';
      if (d.length > c.maxLen) return '${_label(key)}: maksimum ${c.maxLen} raqam';
      return null;
    case ClientFieldKind.date:
      if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(trimmed)) {
        return '${_label(key)}: YYYY-MM-DD formatida kiriting';
      }
      final parts = trimmed.split('-');
      final y = int.tryParse(parts[0]) ?? 0;
      final m = int.tryParse(parts[1]) ?? 0;
      final d = int.tryParse(parts[2]) ?? 0;
      final dt = DateTime(y, m, d);
      if (dt.year != y || dt.month != m || dt.day != d) {
        return '${_label(key)}: noto‘g‘ri sana';
      }
      return null;
    case ClientFieldKind.text:
    case ClientFieldKind.multiline:
      if (trimmed.length < c.minLen) {
        return '${_label(key)}: kamida ${c.minLen} belgi';
      }
      if (trimmed.length > c.maxLen) {
        return '${_label(key)}: maksimum ${c.maxLen} belgi';
      }
      return null;
  }
}

String _label(String key) {
  const labels = {
    'name': 'Nomi',
    'phone': 'Telefon',
    'address': 'Manzil',
    'legal_name': 'Yuridik nomi',
    'inn': 'INN',
    'category': 'Kategoriya',
    'client_type': 'Mijoz turi',
    'sales_channel': 'Savdo kanali',
    'territory': 'Hudud',
    'visit_day': 'Tashrif kuni',
    'client_pc': 'Mijoz PK',
    'bank': 'Bank',
    'mfo': 'MFO',
    'oked': 'OKED',
    'pinfl': 'PINFL',
    'agreement_number': 'Shartnoma raqami',
    'notes': 'Izoh',
  };
  return labels[key] ?? key;
}

/// Formadagi barcha ko‘rinadigan maydonlarni tekshiradi.
String? validateClientFormFields(
  List<String> visibleKeys,
  Map<String, String> values,
  Map<String, bool> requiredKeys,
) {
  for (final key in visibleKeys) {
    if (key == 'coordinates') continue;
    final err = validateClientFieldValue(
      key,
      values[key] ?? '',
      required: requiredKeys[key] == true || key == 'name' || key == 'phone',
    );
    if (err != null) return err;
  }
  return null;
}

/// API ga yuborishdan oldin raqamli maydonlarni tozalash.
String sanitizeClientFieldForApi(String key, String raw) {
  final c = constraintForField(key);
  if (c.kind == ClientFieldKind.digits || c.kind == ClientFieldKind.phoneLocal) {
    return _digitsOnly(raw);
  }
  return raw.trim();
}

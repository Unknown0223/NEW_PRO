/// Lokal SQLite katalogida mijoz dublikatini aniqlash (server tekshiruviga qo‘shimcha).

String _norm(String? v) => (v ?? '').trim().toLowerCase();

bool territoriesMatchLocal({
  String? regionA,
  String? zoneA,
  String? cityA,
  String? regionB,
  String? zoneB,
  String? cityB,
}) {
  return _norm(regionA) == _norm(regionB) &&
      _norm(zoneA) == _norm(zoneB) &&
      _norm(cityA) == _norm(cityB);
}

bool isSameClientIdentityLocal({
  required String nameA,
  String? innA,
  String? pinflA,
  String? regionA,
  String? zoneA,
  String? cityA,
  required String nameB,
  String? innB,
  String? pinflB,
  String? regionB,
  String? zoneB,
  String? cityB,
}) {
  final nA = _norm(nameA);
  final nB = _norm(nameB);
  if (nA.isEmpty || nA != nB) return false;
  if (!territoriesMatchLocal(
    regionA: regionA,
    zoneA: zoneA,
    cityA: cityA,
    regionB: regionB,
    zoneB: zoneB,
    cityB: cityB,
  )) {
    return false;
  }
  final iA = _norm(innA);
  final iB = _norm(innB);
  final pA = _norm(pinflA);
  final pB = _norm(pinflB);
  if (iA.isNotEmpty && iB.isNotEmpty && iA == iB) return true;
  if (pA.isNotEmpty && pB.isNotEmpty && pA == pB) return true;
  if (iA.isEmpty && iB.isEmpty && pA.isEmpty && pB.isEmpty) return true;
  return false;
}

String? _phoneDigits(String? raw) {
  final d = (raw ?? '').replaceAll(RegExp(r'\D'), '');
  return d.length >= 7 ? d : null;
}

/// Oxirgi 9 raqam yoki to‘liq raqam bo‘yicha telefon mosligi.
bool _phonesMatch(String? a, String? b) {
  final da = _phoneDigits(a);
  final db = _phoneDigits(b);
  if (da == null || db == null) return false;
  if (da == db) return true;
  final sa = da.length > 9 ? da.substring(da.length - 9) : da;
  final sb = db.length > 9 ? db.substring(db.length - 9) : db;
  return sa.length >= 9 && sa == sb;
}

bool _hasTerritory(String? region, String? zone, String? city) =>
    _norm(region).isNotEmpty || _norm(zone).isNotEmpty || _norm(city).isNotEmpty;

/// Topilgan dublikat uchun foydalanuvchi xabari; yo‘q bo‘lsa null.
String? findLocalClientDuplicateMessage(
  List<Map<String, dynamic>> clients, {
  required String name,
  String? phone,
  String? inn,
  String? clientPinfl,
  String? clientCode,
  String? region,
  String? zone,
  String? city,
  int? excludeClientId,
}) {
  final nameN = _norm(name);
  final innN = _norm(inn);
  final pinflN = _norm(clientPinfl);
  final codeN = _norm(clientCode);
  final scopeByTerritory = _hasTerritory(region, zone, city);

  for (final c in clients) {
    final id = (c['id'] as num?)?.toInt();
    if (excludeClientId != null && id == excludeClientId) continue;

    if (_phonesMatch(phone, c['phone']?.toString())) {
      return 'Bu telefon allaqachon mavjud';
    }

    final otherCode = _norm(c['client_code']?.toString());
    if (codeN.isNotEmpty && otherCode.isNotEmpty && codeN == otherCode) {
      return 'Bu klient kodi band';
    }

    final otherInn = _norm(c['inn']?.toString());
    if (innN.isNotEmpty && otherInn.isNotEmpty && innN == otherInn) {
      return 'Bu STIR (INN) band — bu mijoz allaqachon mavjud';
    }

    final otherPinfl = _norm(c['client_pinfl']?.toString());
    if (pinflN.isNotEmpty && otherPinfl.isNotEmpty && pinflN == otherPinfl) {
      return 'Bu JSHSHIR (PINFL) band — bu mijoz allaqachon mavjud';
    }

    if (nameN.isEmpty) continue;

    final sameTerritory = territoriesMatchLocal(
      regionA: region,
      zoneA: zone,
      cityA: city,
      regionB: c['region']?.toString(),
      zoneB: c['zone']?.toString(),
      cityB: c['city']?.toString(),
    );

    if (isSameClientIdentityLocal(
      nameA: name,
      innA: inn,
      pinflA: clientPinfl,
      regionA: region,
      zoneA: zone,
      cityA: city,
      nameB: c['name']?.toString() ?? '',
      innB: c['inn']?.toString(),
      pinflB: c['client_pinfl']?.toString(),
      regionB: c['region']?.toString(),
      zoneB: c['zone']?.toString(),
      cityB: c['city']?.toString(),
    )) {
      return 'Bu mijoz allaqachon mavjud (hudud, nom, INN/PINFL)';
    }

    final otherName = _norm(c['name']?.toString());
    if (otherName != nameN) continue;
    if (scopeByTerritory && !sameTerritory) continue;
    if (!scopeByTerritory) {
      return 'Shu nomdagi mijoz mavjud';
    }
    if (sameTerritory) {
      return 'Shu nomdagi mijoz shu hududda mavjud';
    }
  }
  return null;
}

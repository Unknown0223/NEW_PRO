import 'package:url_launcher/url_launcher.dart';

String normalizePhoneForDial(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return '';
  final hasPlus = trimmed.startsWith('+');
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  return hasPlus ? '+$digits' : digits;
}

bool hasDialablePhone(String? raw) => normalizePhoneForDial(raw ?? '').isNotEmpty;

bool hasClientMapTarget({
  double? latitude,
  double? longitude,
  String? address,
}) {
  if (latitude != null && longitude != null && latitude != 0 && longitude != 0) {
    return true;
  }
  return (address ?? '').trim().isNotEmpty;
}

bool hasValidLatLng(double? latitude, double? longitude) =>
    latitude != null && longitude != null && latitude != 0 && longitude != 0;

Future<bool> launchPhoneCall(String rawPhone) async {
  final phone = normalizePhoneForDial(rawPhone);
  if (phone.isEmpty) return false;
  return _launchExternal(Uri.parse('tel:$phone'));
}

/// Faqat pin (nuqta) — yo‘nalishsiz.
Future<bool> launchClientLocation({
  double? latitude,
  double? longitude,
  String? address,
  String? label,
}) async {
  final lat = latitude;
  final lng = longitude;
  if (hasValidLatLng(lat, lng)) {
    final caption = (label ?? '').trim();

    final yandexApp = Uri.parse(
      'yandexmaps://maps.yandex.ru/?ll=$lng,$lat&z=16&pt=$lng,$lat'
      '${caption.isNotEmpty ? '&text=${Uri.encodeComponent(caption)}' : ''}',
    );
    if (await _launchExternal(yandexApp)) return true;

    final yandexWeb = Uri.parse(
      'https://yandex.ru/maps/?pt=$lng,$lat&z=16&l=map'
      '${caption.isNotEmpty ? '&text=${Uri.encodeComponent(caption)}' : ''}',
    );
    if (await _launchExternal(yandexWeb)) return true;

    return _launchExternal(Uri.parse('geo:$lat,$lng?q=$lat,$lng'));
  }

  final addr = (address ?? '').trim();
  if (addr.isEmpty) return false;

  final query = label != null && label.trim().isNotEmpty ? '${label.trim()}, $addr' : addr;

  final yandexApp =
      Uri.parse('yandexmaps://maps.yandex.ru/?text=${Uri.encodeComponent(query)}');
  if (await _launchExternal(yandexApp)) return true;

  final yandex = Uri.parse('https://yandex.ru/maps/?text=${Uri.encodeComponent(query)}');
  if (await _launchExternal(yandex)) return true;

  return _launchExternal(
    Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(query)}'),
  );
}

/// Turn-by-turn: joriy GPS (yoki [fromLat]/[fromLng]) → mijoz.
Future<bool> launchClientDirections({
  required double latitude,
  required double longitude,
  double? fromLatitude,
  double? fromLongitude,
}) async {
  if (!hasValidLatLng(latitude, longitude)) return false;

  final uris = buildClientDirectionsUris(
    toLat: latitude,
    toLng: longitude,
    fromLat: fromLatitude,
    fromLng: fromLongitude,
  );
  for (final uri in uris) {
    if (await _launchExternal(uri)) return true;
  }
  return false;
}

/// Tashqi navigatsiya URI lar — unit-test uchun pure.
List<Uri> buildClientDirectionsUris({
  required double toLat,
  required double toLng,
  double? fromLat,
  double? fromLng,
}) {
  final hasFrom = hasValidLatLng(fromLat, fromLng);
  final uris = <Uri>[];

  // Yandex Maps app: rtext=from~to (lat,lon)
  if (hasFrom) {
    uris.add(
      Uri.parse(
        'yandexmaps://maps.yandex.ru/?rtext=$fromLat,$fromLng~$toLat,$toLng&rtt=auto',
      ),
    );
  } else {
    uris.add(
      Uri.parse('yandexmaps://maps.yandex.ru/?rtext=~$toLat,$toLng&rtt=auto'),
    );
  }

  // Yandex build_route deep link
  if (hasFrom) {
    uris.add(
      Uri.parse(
        'yandexmaps://build_route_on_map?lat_from=$fromLat&lon_from=$fromLng'
        '&lat_to=$toLat&lon_to=$toLng',
      ),
    );
  } else {
    uris.add(
      Uri.parse('yandexmaps://build_route_on_map?lat_to=$toLat&lon_to=$toLng'),
    );
  }

  // Google Navigation (Android)
  uris.add(Uri.parse('google.navigation:q=$toLat,$toLng&mode=d'));

  // Google Maps app (iOS / ba’zi Android)
  final daddr = '$toLat,$toLng';
  if (hasFrom) {
    uris.add(
      Uri.parse(
        'comgooglemaps://?saddr=$fromLat,$fromLng&daddr=$daddr&directionsmode=driving',
      ),
    );
  } else {
    uris.add(Uri.parse('comgooglemaps://?daddr=$daddr&directionsmode=driving'));
  }

  // Yandex web
  if (hasFrom) {
    uris.add(
      Uri.parse(
        'https://yandex.ru/maps/?rtext=$fromLat,$fromLng~$toLat,$toLng&rtt=auto',
      ),
    );
  } else {
    uris.add(Uri.parse('https://yandex.ru/maps/?rtext=~$toLat,$toLng&rtt=auto'));
  }

  // Google Maps web
  final g = StringBuffer(
    'https://www.google.com/maps/dir/?api=1&destination=$toLat,$toLng&travelmode=driving',
  );
  if (hasFrom) g.write('&origin=$fromLat,$fromLng');
  uris.add(Uri.parse(g.toString()));

  // geo: fallback
  uris.add(Uri.parse('geo:$toLat,$toLng?q=$toLat,$toLng'));

  return uris;
}

Future<bool> _launchExternal(Uri uri) async {
  try {
    final ok = await canLaunchUrl(uri);
    if (!ok) return false;
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

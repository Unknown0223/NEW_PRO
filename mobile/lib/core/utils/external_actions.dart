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

Future<bool> launchPhoneCall(String rawPhone) async {
  final phone = normalizePhoneForDial(rawPhone);
  if (phone.isEmpty) return false;
  return _launchExternal(Uri.parse('tel:$phone'));
}

Future<bool> launchClientLocation({
  double? latitude,
  double? longitude,
  String? address,
  String? label,
}) async {
  final lat = latitude;
  final lng = longitude;
  if (lat != null && lng != null && lat != 0 && lng != 0) {
    final caption = (label ?? '').trim();

    // 1) Yandex Maps app (deep link) — manifestda `yandexmaps` scheme e'lon qilingan.
    final yandexApp = Uri.parse(
      'yandexmaps://maps.yandex.ru/?ll=$lng,$lat&z=16&pt=$lng,$lat'
      '${caption.isNotEmpty ? '&text=${Uri.encodeComponent(caption)}' : ''}',
    );
    if (await _launchExternal(yandexApp)) return true;

    // 2) Yandex web (ilova bo'lmasa, brauzer / applink orqali Yandex).
    final yandexWeb = Uri.parse(
      'https://yandex.ru/maps/?pt=$lng,$lat&z=16&l=map'
      '${caption.isNotEmpty ? '&text=${Uri.encodeComponent(caption)}' : ''}',
    );
    if (await _launchExternal(yandexWeb)) return true;

    // 3) Oxirgi chora — umumiy geo: (qurilma standart xaritasi).
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

  return _launchExternal(Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(query)}'));
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

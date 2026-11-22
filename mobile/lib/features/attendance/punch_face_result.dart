/// Punch javobidan Face ID natijasi (unit-test).
class PunchFaceResult {
  const PunchFaceResult({
    required this.matched,
    required this.titleRu,
    required this.detailRu,
    this.scorePercent,
  });

  final bool matched;
  final String titleRu;
  final String detailRu;
  final double? scorePercent;

  /// Gate: qabul qilingan PRIHOD — markaziy galochka.
  static const acceptedIn = PunchFaceResult(
    matched: true,
    titleRu: 'ПРИХОД принят',
    detailRu: 'Отметка в табеле. Открываем приложение…',
  );
}

/// Bugungi punchlar ichida haqiqiy IN bormi (gate allaqachon yopilishi mumkin).
bool attendanceHasValidIn(List<Map<String, dynamic>> punches) {
  for (final p in punches) {
    final valid = p['is_valid'] != false;
    if (!valid) continue;
    final dir = (p['direction'] ?? p['dir'] ?? '').toString().toUpperCase();
    final role = (p['role_in_day'] ?? '').toString().toLowerCase();
    if (dir == 'IN' || role == 'in') return true;
  }
  return false;
}

/// Sof: server punch / anti_fraud → odam o‘qiydigan natija.
PunchFaceResult parsePunchFaceResult(Map<String, dynamic>? response) {
  if (response == null || response.isEmpty) {
    return const PunchFaceResult(
      matched: true,
      titleRu: 'ПРИХОД принят',
      detailRu: 'Отметка сохранена на сервере.',
    );
  }

  // API ko‘pincha `{ data: { anti_fraud, punch } }` qaytaradi.
  final root = response['data'] is Map
      ? Map<String, dynamic>.from(response['data'] as Map)
      : response;

  final anti = root['anti_fraud'];
  if (anti is Map && anti['ok'] == false) {
    final code = anti['failedCode']?.toString() ?? '';
    final detail = anti['failedMessage']?.toString() ?? '';
    final pct = _percentFromDetail(detail);
    final faceFail = code == 'FACE_MISMATCH' || detail.toLowerCase().contains('yuz') || detail.toLowerCase().contains('лиц');
    return PunchFaceResult(
      matched: false,
      titleRu: faceFail ? 'Лицо не совпало с аккаунтом' : 'Отметка отклонена',
      detailRu: pct != null
          ? 'Совпадение ${pct.toStringAsFixed(0)}% — в табель не принято'
          : (detail.isNotEmpty ? detail : 'Сервер отклонил ПРИХОД'),
      scorePercent: pct,
    );
  }

  final layers = anti is Map && anti['layers'] is List ? anti['layers'] as List : const [];
  for (final raw in layers) {
    if (raw is! Map) continue;
    if (raw['code']?.toString() != 'FACE_MISMATCH') continue;
    final passed = raw['passed'] == true;
    final detail = raw['detail']?.toString() ?? '';
    final pct = _percentFromDetail(detail);
    if (passed) {
      return PunchFaceResult(
        matched: true,
        titleRu: 'Лицо совпало с аккаунтом',
        detailRu: pct != null
            ? 'Совпадение ${(pct).toStringAsFixed(0)}% · ПРИХОД в табеле'
            : 'Эталон Face ID подтверждён · ПРИХОД в табеле',
        scorePercent: pct,
      );
    }
    return PunchFaceResult(
      matched: false,
      titleRu: 'Лицо не совпало с аккаунтом',
      detailRu: pct != null
          ? 'Совпадение ${(pct).toStringAsFixed(0)}% — чужое лицо, в табель не принято'
          : (detail.isNotEmpty ? detail : 'Селфи не совпало с эталоном аккаунта'),
      scorePercent: pct,
    );
  }

  final punch = root['punch'];
  final score = punch is Map ? (punch['face_score'] as num?)?.toDouble() : null;
  if (score != null) {
    final pct = (score * 100).clamp(0, 100).toDouble();
    final ok = score >= 0.45;
    return PunchFaceResult(
      matched: ok,
      titleRu: ok ? 'Лицо совпало с аккаунтом' : 'Лицо не совпало с аккаунтом',
      detailRu: ok
          ? 'Совпадение ${pct.toStringAsFixed(0)}% · ПРИХОД в табеле'
          : 'Совпадение ${pct.toStringAsFixed(0)}% — в табель не принято',
      scorePercent: pct,
    );
  }

  // anti_fraud.ok == true yoki qatlam yo‘q — server qabul qilgan.
  if (anti is Map && anti['ok'] == true) {
    return const PunchFaceResult(
      matched: true,
      titleRu: 'ПРИХОД принят',
      detailRu: 'Отметка в табеле. Face ID подтверждён на сервере.',
    );
  }

  return const PunchFaceResult(
    matched: true,
    titleRu: 'ПРИХОД принят',
    detailRu: 'Отметка сохранена на сервере.',
  );
}

/// Sof: xato matnidan Face mismatch ekanini aniqlash.
bool isFaceMismatchError(Object error) {
  final s = error.toString().toLowerCase();
  return s.contains('face_mismatch') ||
      s.contains('facemismatch') ||
      s.contains('yuz mos') ||
      s.contains('лицо не совп') ||
      s.contains('mos kelmadi') ||
      s.contains('не совпало');
}

PunchFaceResult faceMismatchFromError(Object error) {
  final detail = error.toString().replaceFirst('Exception: ', '');
  final pct = _percentFromDetail(detail);
  return PunchFaceResult(
    matched: false,
    titleRu: 'Лицо не совпало с аккаунтом',
    detailRu: pct != null
        ? 'Совпадение ${pct.toStringAsFixed(0)}% — отметьтесь своим лицом'
        : (detail.isNotEmpty ? detail : 'Селфи не совпало с эталоном на сервере'),
    scorePercent: pct,
  );
}

double? _percentFromDetail(String detail) {
  final m = RegExp(r'(\d+(?:[.,]\d+)?)\s*%').firstMatch(detail);
  if (m == null) return null;
  return double.tryParse(m.group(1)!.replaceAll(',', '.'));
}

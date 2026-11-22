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

  final anti = response['anti_fraud'];
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
            ? 'Совпадение ${(pct).toStringAsFixed(0)}% · ПРИХОД принят'
            : 'Эталон Face ID подтверждён · ПРИХОД принят',
        scorePercent: pct,
      );
    }
    return PunchFaceResult(
      matched: false,
      titleRu: 'Лицо не совпало',
      detailRu: pct != null
          ? 'Совпадение ${(pct).toStringAsFixed(0)}% — это не ваш эталон'
          : (detail.isNotEmpty ? detail : 'Селфи не совпало с эталоном аккаунта'),
      scorePercent: pct,
    );
  }

  final punch = response['punch'];
  final score = punch is Map ? (punch['face_score'] as num?)?.toDouble() : null;
  if (score != null) {
    final pct = (score * 100).clamp(0, 100).toDouble();
    final ok = score >= 0.45;
    return PunchFaceResult(
      matched: ok,
      titleRu: ok ? 'Лицо совпало с аккаунтом' : 'Лицо не совпало',
      detailRu: ok
          ? 'Совпадение ${pct.toStringAsFixed(0)}% · ПРИХОД принят'
          : 'Совпадение ${pct.toStringAsFixed(0)}% — эталон не подтверждён',
      scorePercent: pct,
    );
  }

  return const PunchFaceResult(
    matched: true,
    titleRu: 'ПРИХОД принят',
    detailRu: 'Отметка сохранена. Face ID проверен на сервере.',
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

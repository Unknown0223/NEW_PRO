import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Kunlik Face/tabel gate ochiqmi (router redirect uchun sync bayroq).
class FaceGateNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void requireGate() => state = true;

  void clearGate() => state = false;
}

final faceGateRequiredProvider =
    NotifierProvider<FaceGateNotifier, bool>(FaceGateNotifier.new);

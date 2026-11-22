/// Bosh yo‘nalishi (ML Kit euler) ↔ liveness challenge.
///
/// [yaw] = headEulerAngleY (chap/o‘ng), [pitch] = headEulerAngleX (yuqori/past).
bool headPoseMatchesChallenge({
  required String direction,
  required double? yaw,
  required double? pitch,
  double yawThreshold = 14,
  double pitchThreshold = 10,
}) {
  if (yaw == null || pitch == null) return false;
  switch (direction) {
    case 'left':
      return yaw >= yawThreshold;
    case 'right':
      return yaw <= -yawThreshold;
    case 'up':
      return pitch <= -pitchThreshold;
    case 'down':
      return pitch >= pitchThreshold;
    case 'up_left':
      return yaw >= yawThreshold * 0.7 && pitch <= -pitchThreshold * 0.7;
    case 'up_right':
      return yaw <= -yawThreshold * 0.7 && pitch <= -pitchThreshold * 0.7;
    case 'down_left':
      return yaw >= yawThreshold * 0.7 && pitch >= pitchThreshold * 0.7;
    case 'down_right':
      return yaw <= -yawThreshold * 0.7 && pitch >= pitchThreshold * 0.7;
    default:
      return false;
  }
}

/// Random ketma-ketlik (seed → deterministik, unit-test).
List<String> buildRandomLivenessSequence(int count, {int? seed}) {
  final base = List<String>.from(count == 8 ? _eight : _four);
  var s = seed ?? DateTime.now().microsecondsSinceEpoch;
  for (var i = base.length - 1; i > 0; i--) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    final j = s % (i + 1);
    final tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  return base;
}

const _four = ['left', 'right', 'up', 'down'];
const _eight = [
  'left',
  'right',
  'up',
  'down',
  'up_left',
  'up_right',
  'down_left',
  'down_right',
];

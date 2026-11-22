import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/liveness_pose.dart';

void main() {
  group('headPoseMatchesChallenge', () {
    test('null → false', () {
      expect(headPoseMatchesChallenge(direction: 'left', yaw: null, pitch: 0), isFalse);
    });

    test('left / right / up / down', () {
      expect(headPoseMatchesChallenge(direction: 'left', yaw: 20, pitch: 0), isTrue);
      expect(headPoseMatchesChallenge(direction: 'left', yaw: 5, pitch: 0), isFalse);
      expect(headPoseMatchesChallenge(direction: 'right', yaw: -20, pitch: 0), isTrue);
      expect(headPoseMatchesChallenge(direction: 'up', yaw: 0, pitch: -15), isTrue);
      expect(headPoseMatchesChallenge(direction: 'down', yaw: 0, pitch: 15), isTrue);
    });
  });

  group('buildRandomLivenessSequence', () {
    test('seed bir xil tartib', () {
      expect(buildRandomLivenessSequence(4, seed: 42), buildRandomLivenessSequence(4, seed: 42));
      expect(buildRandomLivenessSequence(4, seed: 1), isNot(buildRandomLivenessSequence(4, seed: 2)));
    });
  });
}

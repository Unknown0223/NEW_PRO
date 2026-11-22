import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/liveness_challenge.dart';

const _poses = {
  HeadDirection.left: HeadPose(30, 0),
  HeadDirection.right: HeadPose(-30, 0),
  HeadDirection.up: HeadPose(0, 20),
  HeadDirection.down: HeadPose(0, -18),
  HeadDirection.upLeft: HeadPose(20, 16),
  HeadDirection.upRight: HeadPose(-20, 16),
  HeadDirection.downLeft: HeadPose(20, -14),
  HeadDirection.downRight: HeadPose(-20, -14),
};

void main() {
  test('random challenge 3–4 distinct', () {
    final rng = Random(1);
    for (var i = 0; i < 100; i++) {
      final c = LivenessChallenge.random(rng: rng);
      expect(c.steps.length, inInclusiveRange(3, 4));
      expect(c.steps.toSet().length, c.steps.length);
    }
  });

  test('4-direction mode — diagonalsiz', () {
    final rng = Random(2);
    for (var i = 0; i < 100; i++) {
      final c = LivenessChallenge.random(directions: 4, rng: rng);
      expect(c.steps.any((s) => s.isDiagonal), isFalse);
    }
  });

  test('each pose matches only its direction', () {
    _poses.forEach((dir, pose) {
      for (final other in HeadDirection.values) {
        expect(pose.matches(other), other == dir, reason: '$dir vs $other');
      }
    });
  });

  test('center → turn → back → next', () {
    final t0 = DateTime(2026, 1, 1, 9);
    var t = t0;
    final c = LivenessChallenge([HeadDirection.left, HeadDirection.right], now: t0);
    void f(HeadPose p) {
      t = t.add(const Duration(milliseconds: 120));
      c.feed(p, faces: 1, trackingId: 1, now: t);
    }

    for (var i = 0; i < 2; i++) {
      f(const HeadPose(0, 0));
    }
    expect(c.phase, LivenessPhase.turn);
    for (var i = 0; i < 2; i++) {
      f(const HeadPose(18, 0));
    }
    expect(c.phase, LivenessPhase.back);
    for (var i = 0; i < 2; i++) {
      f(const HeadPose(0, 0));
    }
    expect(c.phase, LivenessPhase.turn);
    expect(c.current, HeadDirection.right);
  });

  test('yumshoq chegaralar — kichik burish ham yetadi', () {
    expect(const HeadPose(16, 0).matches(HeadDirection.left), isTrue);
    expect(const HeadPose(-16, 0).matches(HeadDirection.right), isTrue);
    expect(const HeadPose(0, 12).matches(HeadDirection.up), isTrue);
    expect(const HeadPose(0, -10).matches(HeadDirection.down), isTrue);
  });

  test('faces != 1 resets hold', () {
    final t0 = DateTime(2026, 1, 1, 9);
    final c = LivenessChallenge([HeadDirection.up], now: t0);
    c.feed(const HeadPose(0, 0), faces: 1, trackingId: 1, now: t0);
    c.feed(const HeadPose(0, 0), faces: 2, trackingId: 1, now: t0.add(const Duration(milliseconds: 100)));
    expect(c.phase, LivenessPhase.center);
  });
}

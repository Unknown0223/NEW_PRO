/// AuthScreen kirish bosqichlari — shablon `AuthScreen.tsx` stage + waveTop.
enum SaAuthEntranceStage {
  /// Logo markazda, to‘lqin pastda yashirin.
  launch,

  /// Logo tepaga joylashadi, forma ochiladi, to‘lqin ~71%.
  form,

  /// Muvaffaqiyat: to‘lqin ekranni qoplaydi, keyin bootstrap.
  cover,
}

/// CSS `waveTop`: launch `100%`, form `71%`, cover flood `0`.
double saAuthEntranceWaveTop(SaAuthEntranceStage stage) => switch (stage) {
      SaAuthEntranceStage.launch => 1.0,
      SaAuthEntranceStage.form => 0.71,
      SaAuthEntranceStage.cover => 0.0,
    };

/// AuthScreen: launch → form (fast ? 150 : 1600).
const Duration saAuthEntranceLaunchHold = Duration(milliseconds: 1600);

/// AuthScreen: cover → bootstrap (fast ? 150 : 900).
const Duration saAuthEntranceCoverHold = Duration(milliseconds: 900);

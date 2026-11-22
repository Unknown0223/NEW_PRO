import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'role_road_scene.dart';
import 'role_welcome_meta.dart';
import 'role_welcome_parts.dart';
import 'template_auth_entrance.dart';

/// Shablon RoleWelcome — avval to‘liq ko‘k cover, keyin rol sahnasi (ustma-ust emas).
class RoleWelcomeView extends StatefulWidget {
  final String? role;
  final String? displayName;
  final bool isSuccess;
  final VoidCallback? onContinue;

  const RoleWelcomeView({
    super.key,
    required this.role,
    required this.displayName,
    required this.isSuccess,
    this.onContinue,
  });

  @override
  State<RoleWelcomeView> createState() => _RoleWelcomeViewState();
}

class _RoleWelcomeViewState extends State<RoleWelcomeView> {
  /// Cover hali to‘liq ochiq (rol UI yashirin).
  bool _coverOn = true;
  /// Cover fade tugadi — rol sahna / checklist boshlanadi.
  bool _sceneLive = false;
  bool _leaving = false;
  int _step = 0;
  Timer? _revealTimer;
  Timer? _coverFadeTimer;
  Timer? _stepTimer;
  Timer? _leaveTimer;

  List<RoleWelcomeBootItem> get _items => roleWelcomeBootItems(widget.role);

  @override
  void initState() {
    super.initState();
    // 1) Ko‘k oyna to‘liq turadi → 2) fade → 3) rol animatsiyasi.
    _revealTimer = Timer(roleWelcomeRevealHold, () {
      if (!mounted || !_coverOn) return;
      setState(() => _coverOn = false);
      _coverFadeTimer = Timer(authEntranceWaveMove, () {
        if (!mounted || _sceneLive) return;
        setState(() => _sceneLive = true);
        _tickSteps();
      });
    });
  }

  @override
  void didUpdateWidget(covariant RoleWelcomeView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_leaving && widget.isSuccess && !oldWidget.isSuccess) {
      _finishSoon();
      return;
    }
    if (widget.isSuccess &&
        !_leaving &&
        _sceneLive &&
        _step >= _items.length) {
      _armLeave();
    }
  }

  @override
  void dispose() {
    _revealTimer?.cancel();
    _coverFadeTimer?.cancel();
    _stepTimer?.cancel();
    _leaveTimer?.cancel();
    super.dispose();
  }

  void _tickSteps() {
    _stepTimer?.cancel();
    if (!_sceneLive || _leaving) return;
    final n = _items.length;
    if (_step >= n) {
      _armLeave();
      return;
    }
    final wait = _step == 0 ? roleWelcomeFirstStepHold : roleWelcomeStepHold;
    _stepTimer = Timer(wait, () {
      if (!mounted || _leaving) return;
      setState(() => _step = (_step + 1).clamp(0, n));
      _tickSteps();
    });
  }

  void _armLeave() {
    _stepTimer?.cancel();
    if (_leaving) return;
    _stepTimer = Timer(roleWelcomeDoneHold, () {
      if (!mounted || _leaving) return;
      if (!widget.isSuccess) {
        setState(() {});
        return;
      }
      _beginLeave();
    });
  }

  void _onPrimary() {
    final n = _items.length;
    if (_step < n) {
      _stepTimer?.cancel();
      setState(() => _step = n);
    }
    if (widget.isSuccess) {
      _beginLeave();
    } else {
      setState(() {});
    }
  }

  void _beginLeave() {
    if (_leaving) return;
    setState(() {
      _leaving = true;
      _step = _items.length;
    });
    if (widget.isSuccess) _finishSoon();
  }

  void _finishSoon() {
    _leaveTimer?.cancel();
    _leaveTimer = Timer(roleWelcomeLeaveHold, () {
      if (!mounted || !widget.isSuccess) return;
      widget.onContinue?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final meta = roleWelcomeMeta(widget.role);
    final accent = roleWelcomeAccent(widget.role);
    final first = roleWelcomeFirstName(widget.displayName);
    final items = _items;
    final n = items.length;
    final doneUi = _step >= n;
    final pct = n == 0 ? 100 : ((_step.clamp(0, n) / n) * 100).round();
    final h = MediaQuery.sizeOf(context).height;
    // Cover ochiq: to‘liq ko‘k. Fade: pastga. Scene: to‘liq ochiq.
    final waveTop = _coverOn ? -0.18 : 1.0;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Rol UI — faqat cover tugagach (ustma-ust bo‘lmasin).
          if (_sceneLive)
            Column(
              children: [
                SafeArea(
                  bottom: false,
                  child: RoleWelcomeHeader(
                    roleLabel: meta.roleLabel,
                    accent: accent,
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, -28),
                  child: SizedBox(
                    height: h * 0.40,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Color.lerp(accent, Colors.white, 0.70)!,
                                Colors.white,
                              ],
                            ),
                          ),
                        ),
                        RoleRoadScene(
                          role: widget.role,
                          accent: accent,
                          leaving: _leaving,
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 500),
                    opacity: _leaving ? 0 : 1,
                    child: AnimatedSlide(
                      duration: const Duration(milliseconds: 500),
                      offset: _leaving ? const Offset(0, -0.04) : Offset.zero,
                      child: Column(
                        children: [
                          RoleWelcomeGreeting(
                            firstName: first,
                            word: meta.word,
                            tagline: meta.tagline,
                            accent: accent,
                          ),
                          const SizedBox(height: 10),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                children: [
                                  Row(
                                    children: [
                                      if (doneUi)
                                        Icon(
                                          Icons.check_rounded,
                                          size: 14,
                                          color: accent,
                                        )
                                      else
                                        SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: accent,
                                          ),
                                        ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          doneUi
                                              ? 'Ish joyingiz tayyor'
                                              : 'Ish joyingiz tayyorlanmoqda',
                                          style: AppTypography.bodyMedium.copyWith(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '$pct%',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          color: accent,
                                          fontFeatures: const [
                                            FontFeature.tabularFigures(),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(999),
                                    child: TweenAnimationBuilder<double>(
                                      tween: Tween(begin: 0, end: pct / 100),
                                      duration: const Duration(milliseconds: 500),
                                      builder: (_, v, __) => LinearProgressIndicator(
                                        value: v,
                                        minHeight: 4,
                                        backgroundColor: const Color(0xFFEEF1F5),
                                        color: accent,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  RoleWelcomeChecklist(
                                    items: items,
                                    step: _step,
                                    accent: accent,
                                    revealed: _sceneLive,
                                    done: doneUi,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Spacer(),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                            child: SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: doneUi && !widget.isSuccess
                                    ? null
                                    : _onPrimary,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: accent,
                                  disabledBackgroundColor: const Color(0xFFCBD5E1),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  textStyle: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                child: Text(
                                  doneUi
                                      ? (widget.isSuccess ? 'Boshlash' : 'Sinxron…')
                                      : 'O‘tkazib yuborish',
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            )
          else
            const ColoredBox(color: Colors.white),

          // Ko‘k qatlam: cover + fade (rol UI ostida emas — ustida yoki yolg‘iz).
          Positioned.fill(
            child: IgnorePointer(
              child: AuthBrandWave(topFraction: waveTop, animate: true),
            ),
          ),
          // To‘liq opaq ko‘k — wave yumshoq chetida rol «ko‘rinib» qolmasin.
          if (_coverOn || !_sceneLive)
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedOpacity(
                  duration: authEntranceWaveMove,
                  opacity: _coverOn ? 1 : 0,
                  child: const ColoredBox(color: authBrandBlue),
                ),
              ),
            ),
          IgnorePointer(
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 450),
              opacity: _coverOn ? 1 : 0,
              child: RoleWelcomeCoverBrand(roleLabel: meta.roleLabel),
            ),
          ),
        ],
      ),
    );
  }
}

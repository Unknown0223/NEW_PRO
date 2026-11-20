import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/sync/full_sync_view.dart';
import 'role_road_scene.dart';
import 'role_welcome_meta.dart';
import 'role_welcome_parts.dart';
import 'template_auth_entrance.dart';

/// Shablon RoleWelcome — cover drain → rol sahnasi → checklist → home.
class RoleWelcomeView extends StatefulWidget {
  final String? role;
  final String? displayName;
  final bool isSuccess;
  final double progress;
  final List<FullSyncItemState> items;
  final VoidCallback? onContinue;

  const RoleWelcomeView({
    super.key,
    required this.role,
    required this.displayName,
    required this.isSuccess,
    required this.progress,
    required this.items,
    this.onContinue,
  });

  @override
  State<RoleWelcomeView> createState() => _RoleWelcomeViewState();
}

class _RoleWelcomeViewState extends State<RoleWelcomeView> {
  bool _revealed = false;
  bool _leaving = false;
  int _step = 0;
  Timer? _revealTimer;
  Timer? _stepTimer;
  Timer? _leaveTimer;

  @override
  void initState() {
    super.initState();
    _revealTimer = Timer(roleWelcomeRevealHold, () {
      if (!mounted) return;
      setState(() => _revealed = true);
      _scheduleStep();
    });
  }

  @override
  void didUpdateWidget(covariant RoleWelcomeView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_leaving && widget.isSuccess && !oldWidget.isSuccess) {
      _finishSoon();
      return;
    }
    if (!_revealed || _leaving) return;
    _scheduleStep();
  }

  @override
  void dispose() {
    _revealTimer?.cancel();
    _stepTimer?.cancel();
    _leaveTimer?.cancel();
    super.dispose();
  }

  void _scheduleStep() {
    _stepTimer?.cancel();
    if (!_revealed || _leaving) return;
    final n = widget.items.length;
    if (n == 0) {
      if (widget.isSuccess) _beginLeave();
      return;
    }
    var doneCount = 0;
    for (final it in widget.items) {
      if (it.status == FullSyncItemStatus.done) doneCount++;
    }
    final target = widget.isSuccess ? n : doneCount.clamp(0, n);
    if (_step < target) {
      final wait =
          _step == 0 ? roleWelcomeFirstStepHold : roleWelcomeStepHold;
      _stepTimer = Timer(wait, () {
        if (!mounted || _leaving) return;
        setState(() => _step = (_step + 1).clamp(0, n));
        _scheduleStep();
      });
      return;
    }
    if (widget.isSuccess && _step >= n) {
      _stepTimer = Timer(roleWelcomeDoneHold, () {
        if (!mounted || _leaving) return;
        _beginLeave();
      });
    }
  }

  void _beginLeave() {
    if (_leaving) return;
    setState(() => _leaving = true);
    _finishSoon();
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
    final pct = (widget.progress.clamp(0.0, 1.0) * 100).round();
    final doneUi = widget.isSuccess;
    final waveTop = _revealed ? 1.0 : -0.18;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          SafeArea(
            bottom: false,
            child: Column(
              children: [
                RoleWelcomeHeader(roleLabel: meta.roleLabel, accent: accent),
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.34,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Color.lerp(accent, Colors.white, 0.7)!,
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
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 500),
                  opacity: _leaving ? 0 : 1,
                  child: RoleWelcomeGreeting(
                    firstName: first,
                    word: meta.word,
                    tagline: meta.tagline,
                    accent: accent,
                  ),
                ),
                const SizedBox(height: 12),
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 500),
                  opacity: _leaving ? 0 : 1,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
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
                              Icon(Icons.check_rounded, size: 14, color: accent)
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
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Text(
                              '$pct%',
                              style: TextStyle(
                                fontSize: 12,
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
                          child: LinearProgressIndicator(
                            value: widget.progress.clamp(0.0, 1.0),
                            minHeight: 4,
                            backgroundColor: const Color(0xFFEEF1F5),
                            color: accent,
                          ),
                        ),
                        const SizedBox(height: 10),
                        RoleWelcomeChecklist(
                          items: widget.items,
                          step: _step,
                          accent: accent,
                          revealed: _revealed,
                          done: doneUi,
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 500),
                  opacity: _leaving ? 0 : 1,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: widget.isSuccess ? _beginLeave : null,
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
                        child: Text(doneUi ? 'Boshlash' : 'Tayyorlanmoqda…'),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned.fill(
            child: AuthBrandWave(topFraction: waveTop, animate: true),
          ),
          IgnorePointer(
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 400),
              opacity: _revealed ? 0 : 1,
              child: RoleWelcomeCoverBrand(roleLabel: meta.roleLabel),
            ),
          ),
        ],
      ),
    );
  }
}

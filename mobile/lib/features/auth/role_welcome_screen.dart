import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session.dart';
import '../../design_system/design_system.dart';

/// Shablon `RoleWelcome.tsx` — wave drain → road → greeting → boot checklist.
class RoleWelcomeScreen extends ConsumerStatefulWidget {
  final String? role;
  final VoidCallback onDone;
  final Color accent;

  const RoleWelcomeScreen({
    super.key,
    required this.onDone,
    this.role,
    this.accent = SaBrand.blue,
  });

  @override
  ConsumerState<RoleWelcomeScreen> createState() => _RoleWelcomeScreenState();
}

class _RoleWelcomeScreenState extends ConsumerState<RoleWelcomeScreen> {
  static const _boot = <String, List<({String label, String count})>>{
    'agent': [
      (label: 'Savdo nuqtalari', count: '342'),
      (label: 'Katalog va narxlar', count: '1 208'),
      (label: 'Ombor qoldiqlari', count: '3 ombor'),
      (label: 'Bonus va skidka', count: '6 qoida'),
      (label: 'Kunlik marshrut', count: '12 vizit'),
      (label: 'Tabel va KPI', count: 'oy'),
    ],
    'expeditor': [
      (label: 'Mashina profili', count: '01 A 777'),
      (label: 'Nakladnoylar', count: '12 ta'),
      (label: 'Yetkazish marshruti', count: '21 km'),
      (label: 'Qarz kitobi', count: '48 mijoz'),
      (label: 'Qaytarish turlari', count: '3 tur'),
      (label: 'Chek printeri', count: 'ulandi'),
    ],
    'supervisor': [
      (label: 'Hudud va jamoa', count: 'Sharq'),
      (label: 'Agentlar', count: '12 ta'),
      (label: 'GPS va geofence', count: '24 soat'),
      (label: 'Tasdiq kutmoqda', count: '8 vizit'),
      (label: 'Hudud KPI', count: '142 mln'),
      (label: 'Yangi mijozlar', count: '2 ta'),
    ],
    'cashier': [
      (label: 'Kassa sozlamalari', count: 'Markaz'),
      (label: 'Bank inbox', count: '24 ta'),
      (label: "Buyurtmaga moslash", count: '22 / 24'),
      (label: "Ekspeditor topshirig'i", count: '6 / 6'),
      (label: 'Eksport shablonlari', count: 'Excel'),
      (label: 'Audit jurnali', count: 'OK'),
    ],
  };

  bool _revealed = false;
  bool _leaving = false;
  int _step = 0;
  Timer? _stepTimer;
  Timer? _leaveTimer;

  String get _roleKey => (widget.role ?? 'agent').toLowerCase();

  List<({String label, String count})> get _items =>
      _boot[_roleKey] ?? _boot['agent']!;

  String get _tagline => switch (_roleKey) {
        'expeditor' => 'Yetkazish marshruti va nakladnoylar tayyorlanmoqda',
        'supervisor' => 'Jamoa GPS va hudud KPI ochilmoqda',
        'cashier' => 'Kassa va bank inbox tayyorlanmoqda',
        _ => 'Savdo nuqtalari va kunlik marshrut ochilmoqda',
      };

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(
      const Duration(milliseconds: 1150),
      () {
        if (!mounted) return;
        setState(() => _revealed = true);
        _scheduleStep();
      },
    );
  }

  void _scheduleStep() {
    _stepTimer?.cancel();
    if (_leaving) return;
    final items = _items;
    if (_step >= items.length) {
      _stepTimer = Timer(const Duration(milliseconds: 800), () {
        if (!mounted || _leaving) return;
        setState(() => _leaving = true);
        _leaveTimer = Timer(const Duration(milliseconds: 900), () {
          if (mounted) widget.onDone();
        });
      });
      return;
    }
    final delay = _step == 0 ? 1300 : 430;
    _stepTimer = Timer(Duration(milliseconds: delay), () {
      if (!mounted || _leaving) return;
      setState(() => _step++);
      _scheduleStep();
    });
  }

  void _skip() {
    _stepTimer?.cancel();
    _leaveTimer?.cancel();
    if (_leaving) {
      widget.onDone();
      return;
    }
    setState(() => _leaving = true);
    _leaveTimer = Timer(const Duration(milliseconds: 700), () {
      if (mounted) widget.onDone();
    });
  }

  @override
  void dispose() {
    _stepTimer?.cancel();
    _leaveTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final name = ref.watch(sessionProvider).user?.name.trim() ?? '';
    final first = name.isEmpty
        ? saBrandSyncRoleWord(widget.role)
        : name.split(RegExp(r'\s+')).first;
    final word = saBrandSyncRoleWord(widget.role);
    final roleTitle = switch (_roleKey) {
      'expeditor' => 'Ekspeditor',
      'supervisor' => 'Supervayzer',
      'cashier' => 'Kassir',
      _ => 'Agent',
    };
    final items = _items;
    final done = _step >= items.length;
    final pct =
        ((math.min(_step, items.length) / items.length) * 100).round();
    final accent = widget.accent;
    final wordColor = Color.lerp(accent, const Color(0xFF0E1420), 0.45)!;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Brand flood (login wave) → drain
          if (!_revealed)
            Positioned.fill(
              child: IgnorePointer(
                child: ColoredBox(
                  color: SaBrand.blue,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SaBrandMark(size: 84, draw: true),
                      const SizedBox(height: 10),
                      const SaBrandWordmark(
                        size: 24,
                        tone: SaBrandTone.onBrand,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$roleTitle ish joyi ochilmoqda…',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          AnimatedOpacity(
            duration: const Duration(milliseconds: 420),
            opacity: _revealed ? 1 : 0,
            child: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Row(
                      children: [
                        const SaBrandMark(size: 22, draw: false),
                        const SizedBox(width: 6),
                        const SaBrandWordmark(size: 13),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                roleTitle,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: Color.lerp(
                                    accent,
                                    const Color(0xFF0E1420),
                                    0.35,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Road — shablon: ~40% height, frameless (kartochka emas)
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
                        AnimatedSlide(
                          duration: const Duration(milliseconds: 700),
                          curve: Curves.easeInCubic,
                          offset: _leaving ? const Offset(0.35, -0.04) : Offset.zero,
                          child: AnimatedOpacity(
                            duration: const Duration(milliseconds: 500),
                            opacity: _leaving ? 0.35 : 1,
                            child: SaBrandSyncRoadScene(
                              role: widget.role,
                              accent: accent,
                              leaving: _leaving,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 350),
                    opacity: _leaving ? 0 : 1,
                    child: AnimatedTranslateY(
                      leaving: _leaving,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          children: [
                            const Text(
                              'Xush kelibsiz,',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF677386),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              first,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.8,
                                height: 1.05,
                                color: Color(0xFF0E1420),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const SaBrandWordmark(size: 12),
                                Text(
                                  ' · $word',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: wordColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _tagline,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 11,
                                height: 1.35,
                                color: Color(0xFF677386),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Boot checklist card
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 350),
                    opacity: _leaving ? 0 : 1,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE4E8EF)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                if (done)
                                  Icon(Icons.check_rounded,
                                      size: 14, color: accent)
                                else
                                  SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 1.8,
                                      color: accent,
                                    ),
                                  ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    done
                                        ? 'Ish joyingiz tayyor'
                                        : 'Ish joyingiz tayyorlanmoqda',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF0E1420),
                                    ),
                                  ),
                                ),
                                Text(
                                  '$pct%',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    fontFamily: 'monospace',
                                    color: accent,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: pct / 100,
                                minHeight: 4,
                                backgroundColor: const Color(0xFFEEF1F5),
                                valueColor:
                                    AlwaysStoppedAnimation(accent),
                              ),
                            ),
                            const SizedBox(height: 10),
                            LayoutBuilder(
                              builder: (context, c) {
                                return Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    for (var i = 0; i < items.length; i++)
                                      SizedBox(
                                        width: (c.maxWidth - 8) / 2,
                                        child: _BootRow(
                                          label: items[i].label,
                                          count: items[i].count,
                                          ok: i < _step,
                                          now: i == _step && !done,
                                          accent: accent,
                                        ),
                                      ),
                                  ],
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const Spacer(),

                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 300),
                    opacity: _leaving ? 0 : 1,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      child: SaPressable(
                        pressedScale: 0.985,
                        onTap: _skip,
                        borderRadius: BorderRadius.circular(28),
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(28),
                            gradient: LinearGradient(
                              colors: [
                                accent,
                                Color.lerp(accent, const Color(0xFF0E1420), 0.2)!,
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.35),
                                blurRadius: 18,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Text(
                            done ? 'Boshlash' : "O'tkazib yuborish",
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AnimatedTranslateY extends StatelessWidget {
  final bool leaving;
  final Widget child;

  const AnimatedTranslateY({
    super.key,
    required this.leaving,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      duration: const Duration(milliseconds: 350),
      offset: leaving ? const Offset(0, -0.08) : Offset.zero,
      child: child,
    );
  }
}

class _BootRow extends StatelessWidget {
  final String label;
  final String count;
  final bool ok;
  final bool now;
  final Color accent;

  const _BootRow({
    required this.label,
    required this.count,
    required this.ok,
    required this.now,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          width: 14,
          height: 14,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: ok ? accent : const Color(0xFFEEF1F5),
            shape: BoxShape.circle,
            boxShadow: now
                ? [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.28),
                      blurRadius: 0,
                      spreadRadius: 2.5,
                    ),
                  ]
                : null,
          ),
          child: ok
              ? const Icon(Icons.check_rounded, size: 9, color: Colors.white)
              : null,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: ok || now
                  ? const Color(0xFF0E1420)
                  : const Color(0xFF677386),
            ),
          ),
        ),
        Text(
          ok ? count : '···',
          style: TextStyle(
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: FontWeight.w700,
            color: ok ? accent : const Color(0xFF9AA3B2),
          ),
        ),
      ],
    );
  }
}

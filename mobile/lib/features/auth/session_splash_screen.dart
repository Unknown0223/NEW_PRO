import 'package:flutter/material.dart';

import '../../design_system/design_system.dart';

/// Cold start — shablon Auth launch (qulf/spinner o‘rniga BrandMark draw).
/// LoginScreen ochilganda to‘liq launch→wave ketma-ketligi davom etadi.
class SessionSplashScreen extends StatelessWidget {
  const SessionSplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: SaLaunchZoom(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(painter: SaDotGridPainter()),
              ),
            ),
            // To‘lqin hali past — AuthScreen launch `waveTop: 100%`.
            Positioned.fill(
              child: SaBrandWave(topFraction: 1.0, animate: false),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SaBrandMark(size: 72, draw: true),
                  SizedBox(height: 12),
                  SaBrandWordmark(size: 26),
                  SizedBox(height: 10),
                  Text(
                    'Savdo jamoasi uchun mobil ilova',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF677386),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

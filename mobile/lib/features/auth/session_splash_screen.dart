import 'package:flutter/material.dart';

import 'entrance/template_auth_entrance.dart';

/// Cold start — shablon Auth launch (qulf/spinner o‘rniga BrandMark draw).
class SessionSplashScreen extends StatelessWidget {
  const SessionSplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: AuthLaunchZoom(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(painter: AuthDotGridPainter()),
              ),
            ),
            Positioned.fill(
              child: AuthBrandWave(topFraction: 1.0, animate: false),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AuthBrandMark(size: 72, draw: true),
                  SizedBox(height: 12),
                  AuthBrandWordmark(size: 26),
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

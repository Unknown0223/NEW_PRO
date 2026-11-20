import 'dart:math' as math;
import 'dart:ui' show Canvas, Color, Size;

/// SplashArt RoadScene konstantalari.
const double roleRoadPeriod = 160;
const double roleRoadAngleDeg = -32;
/// `-32°` in radians (SplashArt ANGLE).
const double roleRoadAngleRad = -32 * 3.141592653589793 / 180;
const double roleRoadPinY = -47;
const Color roleRoadInk = Color(0xFF1A1F28);
const Color roleRoadGlass = Color(0xFF1E3A55);

double roleRoadClamp01(double x) => x.clamp(0.0, 1.0);
double roleRoadEaseOut(double x) => 1 - math.pow(1 - x, 3).toDouble();
double roleRoadEaseIn(double x) => x * x * x;

/// SVG `viewBox 0 0 300 300` + `preserveAspectRatio="xMidYMin meet"`.
void roleRoadApplyViewBox(Canvas canvas, Size size) {
  final scale = math.min(size.width / 300, size.height / 300);
  final ox = (size.width - 300 * scale) / 2;
  canvas
    ..translate(ox, 0)
    ..scale(scale)
    ..translate(150, 150);
}

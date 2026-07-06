import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'yandex_maps_config.dart';
import 'route_map_stop.dart';
import 'yandex_web_map_html.dart';

/// Agent marshrut xaritasi — web bilan bir xil Yandex Maps JS API (kalitsiz ishlaydi).
class AgentYandexMap extends StatefulWidget {
  final List<RouteMapStop> stops;
  final List<RouteMapStop>? routeLine;
  final RouteMapStop? routeStart;
  final bool drawRoutePolyline;
  final void Function(RouteMapStop stop)? onStopTap;

  const AgentYandexMap({
    super.key,
    required this.stops,
    this.routeLine,
    this.routeStart,
    this.drawRoutePolyline = true,
    this.onStopTap,
  });

  @override
  State<AgentYandexMap> createState() => AgentYandexMapState();
}

class AgentYandexMapState extends State<AgentYandexMap> {
  WebViewController? _controller;
  bool _loading = true;
  bool _failed = false;
  bool _mapReady = false;
  Timer? _dataPushDebounce;

  String? _failReason;

  List<RouteMapStop> get _validStops =>
      capMapDisplayStops(widget.stops.where((s) => s.hasCoords).toList(growable: false));

  String? get _optionalApiKey => resolveYandexMapsJsApiKey();

  @override
  void initState() {
    super.initState();
    _initController();
  }

  @override
  void dispose() {
    _dataPushDebounce?.cancel();
    super.dispose();
  }

  static bool _stopsChanged(List<RouteMapStop> a, List<RouteMapStop> b) {
    if (identical(a, b)) return false;
    if (a.length != b.length) return true;
    for (var i = 0; i < a.length; i++) {
      final x = a[i];
      final y = b[i];
      if (x.clientId != y.clientId ||
          x.latitude != y.latitude ||
          x.longitude != y.longitude ||
          x.visited != y.visited ||
          x.name != y.name ||
          x.orderIndex != y.orderIndex) {
        return true;
      }
    }
    return false;
  }

  static bool _routeStartChanged(RouteMapStop? a, RouteMapStop? b) {
    if (a == null && b == null) return false;
    if (a == null || b == null) return true;
    return a.latitude != b.latitude || a.longitude != b.longitude || a.name != b.name;
  }

  @override
  void didUpdateWidget(covariant AgentYandexMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final changed = _stopsChanged(oldWidget.stops, widget.stops) ||
        _stopsChanged(oldWidget.routeLine ?? const [], widget.routeLine ?? const []) ||
        _routeStartChanged(oldWidget.routeStart, widget.routeStart) ||
        oldWidget.drawRoutePolyline != widget.drawRoutePolyline;
    if (!changed) return;

    final needsRouterReload = !oldWidget.drawRoutePolyline &&
        widget.drawRoutePolyline &&
        (widget.routeLine?.where((s) => s.hasCoords).length ?? 0) > 1;
    if (!_mapReady || needsRouterReload) {
      _reloadMap();
      return;
    }
    _scheduleDataPush();
  }

  YandexMapRuntimeData _runtimeData() => computeYandexMapRuntimeData(
        stops: _validStops,
        routeLine: widget.routeLine?.where((s) => s.hasCoords).toList(),
        routeStart: widget.routeStart?.hasCoords == true ? widget.routeStart : null,
        drawRoutePolyline: widget.drawRoutePolyline,
      );

  String _buildHtml() => buildYandexWebMapHtml(
        stops: _validStops,
        routeLine: widget.routeLine?.where((s) => s.hasCoords).toList(),
        routeStart: widget.routeStart?.hasCoords == true ? widget.routeStart : null,
        apiKey: _optionalApiKey,
        drawRoutePolyline: widget.drawRoutePolyline,
      );

  void _scheduleDataPush() {
    _dataPushDebounce?.cancel();
    _dataPushDebounce = Timer(const Duration(milliseconds: 180), () {
      if (!mounted || !_mapReady) return;
      unawaited(_controller?.runJavaScript(yandexMapUpdateJs(_runtimeData())));
    });
  }

  void _initController() {
    final html = _buildHtml();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.background)
      ..addJavaScriptChannel(
        'StopTap',
        onMessageReceived: (msg) {
          try {
            final data = jsonDecode(msg.message) as Map<String, dynamic>;
            final stop = RouteMapStop(
              clientId: (data['clientId'] as num?)?.toInt(),
              name: data['name']?.toString() ?? 'Mijoz',
              latitude: 0,
              longitude: 0,
            );
            widget.onStopTap?.call(stop);
          } catch (_) {}
        },
      )
      ..addJavaScriptChannel(
        'MapReady',
        onMessageReceived: (msg) {
          if (!mounted) return;
          final text = msg.message;
          if (text == 'ok') {
            setState(() {
              _mapReady = true;
              _loading = false;
              _failed = false;
              _failReason = null;
            });
            return;
          }
          if (text.startsWith('error')) {
            setState(() {
              _mapReady = false;
              _loading = false;
              _failed = true;
              _failReason = text.contains(':') ? text.split(':').skip(1).join(':') : text;
            });
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (err) {
            if (mounted && !_mapReady && err.isForMainFrame == true) {
              setState(() {
                _loading = false;
                _failed = true;
                _failReason = 'script_error';
              });
            }
          },
        ),
      )
      ..loadHtmlString(html, baseUrl: 'https://api-maps.yandex.ru/');

    if (controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      android.setMediaPlaybackRequiresUserGesture(false);
      android.setMixedContentMode(MixedContentMode.alwaysAllow);
      unawaited(android.setUserAgent(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),);
    }

    _controller = controller;
  }

  void _reloadMap() {
    setState(() {
      _loading = true;
      _failed = false;
      _mapReady = false;
      _failReason = null;
    });
    _controller?.loadHtmlString(_buildHtml(), baseUrl: 'https://api-maps.yandex.ru/');
  }

  Future<void> focusStop(RouteMapStop stop) async {
    if (!stop.hasCoords) return;
    await _controller?.runJavaScript(
      'window.focusStop && window.focusStop(${stop.latitude}, ${stop.longitude});',
    );
  }

  Future<void> refitBounds() async {
    await _controller?.runJavaScript('window.refit && window.refit();');
  }

  Future<void> zoomIn() async {
    await _controller?.runJavaScript('window.zoomIn && window.zoomIn();');
  }

  Future<void> zoomOut() async {
    await _controller?.runJavaScript('window.zoomOut && window.zoomOut();');
  }

  Future<void> goToUserLocation() async {
    final granted = await Permission.location.request().isGranted;
    if (!granted) return;
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        await _controller?.runJavaScript(
          'window.panTo && window.panTo(${last.latitude}, ${last.longitude}, 15);',
        );
      }
      final fix = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );
      await _controller?.runJavaScript(
        'window.panTo && window.panTo(${fix.latitude}, ${fix.longitude}, 15);',
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        WebViewWidget(controller: controller),
        if (_loading)
          ColoredBox(
            color: AppColors.background.withOpacity(0.92),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: AppColors.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Yandex xarita yuklanmoqda…',
                    style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ),
        if (_failed && !_loading)
          ColoredBox(
            color: AppColors.background,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.map_outlined, size: 48, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    Text(
                      'Yandex xarita yuklanmadi',
                      textAlign: TextAlign.center,
                      style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _failHint(),
                      textAlign: TextAlign.center,
                      style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 16),
                    TextButton(onPressed: _reloadMap, child: const Text('Qayta urinish')),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _failHint() {
    switch (_failReason) {
      case 'invalid_key':
        return 'API kalit noto\'g\'ri. Yandex kabinetida "JavaScript API" kalitini oching (Static API emas).';
      case 'script_error':
        return 'Yandex skript yuklanmadi — internet yoki firewall tekshiring.';
      case 'timeout':
        return 'Xarita yuklanishi juda uzoq davom etdi. Qayta urinib ko\'ring.';
      default:
        return 'Internet aloqasini tekshiring';
    }
  }
}

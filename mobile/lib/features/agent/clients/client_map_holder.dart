import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../../core/map/yandex_maps_config.dart';
import '../../../core/map/yandex_single_point_map_html.dart';

/// Bitta mijoz xaritasi — WebView oldindan yuklanadi, sahifa root navigatorda ochiladi.
class ClientMapHolder extends StateNotifier<ClientMapHolderState> {
  ClientMapHolder() : super(const ClientMapHolderState());

  WebViewController? _controller;
  bool _mapReady = false;
  bool _mapFailed = false;
  double? _pendingLat;
  double? _pendingLng;
  String? _pendingName;

  WebViewController? get controller => _controller;
  bool get mapReady => _mapReady;
  bool get mapFailed => _mapFailed;

  void ensureInitialized() {
    if (_controller != null) return;
    final html = buildYandexSinglePointMapHtml(apiKey: resolveYandexMapsJsApiKey());
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF8FAFC))
      ..addJavaScriptChannel(
        'MapReady',
        onMessageReceived: (msg) {
          final text = msg.message;
          if (text == 'ok') {
            _mapReady = true;
            _mapFailed = false;
            _flushPendingPoint();
            state = const ClientMapHolderState(ready: true, failed: false);
            return;
          }
          if (text.startsWith('error')) {
            _mapReady = false;
            _mapFailed = true;
            state = const ClientMapHolderState(ready: false, failed: true);
          }
        },
      )
      ..loadHtmlString(html, baseUrl: 'https://api-maps.yandex.ru/');

    if (controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      android.setMixedContentMode(MixedContentMode.alwaysAllow);
      unawaited(android.setUserAgent(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),);
    }

    _controller = controller;
    state = const ClientMapHolderState(ready: false, failed: false);
  }

  void _flushPendingPoint() {
    final lat = _pendingLat;
    final lng = _pendingLng;
    final name = _pendingName;
    if (lat == null || lng == null || name == null || !_mapReady) return;
    unawaited(_controller?.runJavaScript(singlePointMapJs(lat, lng, name)));
    _pendingLat = null;
    _pendingLng = null;
    _pendingName = null;
  }

  void showPoint({
    required String clientName,
    required double latitude,
    required double longitude,
  }) {
    ensureInitialized();
    if (!_mapReady) {
      _pendingLat = latitude;
      _pendingLng = longitude;
      _pendingName = clientName;
      return;
    }
    unawaited(_controller?.runJavaScript(singlePointMapJs(latitude, longitude, clientName)));
  }

  void retryLoad() {
    final c = _controller;
    if (c == null) return;
    _mapReady = false;
    _mapFailed = false;
    state = const ClientMapHolderState(ready: false, failed: false);
    c.loadHtmlString(
      buildYandexSinglePointMapHtml(apiKey: resolveYandexMapsJsApiKey()),
      baseUrl: 'https://api-maps.yandex.ru/',
    );
  }
}

class ClientMapHolderState {
  final bool ready;
  final bool failed;

  const ClientMapHolderState({this.ready = false, this.failed = false});
}

final clientMapHolderProvider = StateNotifierProvider<ClientMapHolder, ClientMapHolderState>((ref) {
  return ClientMapHolder();
});

/// Agent shell — xarita WebView ni fon rejimida oldindan yuklaydi.
class ClientMapPreloadHost extends ConsumerStatefulWidget {
  final Widget child;

  const ClientMapPreloadHost({super.key, required this.child});

  @override
  ConsumerState<ClientMapPreloadHost> createState() => _ClientMapPreloadHostState();
}

class _ClientMapPreloadHostState extends ConsumerState<ClientMapPreloadHost> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(clientMapHolderProvider.notifier).ensureInitialized();
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

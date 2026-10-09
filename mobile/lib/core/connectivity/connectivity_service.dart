import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ConnectivityService {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription? _subscription;

  /// Check if device is online
  Future<bool> isOnline() async {
    final results = await _connectivity.checkConnectivity();
    return !results.contains(ConnectivityResult.none);
  }

  /// GPS monitoring uchun qisqa label: 4G / WiFi / —
  Future<String?> networkTypeLabel() async {
    try {
      final results = await _connectivity.checkConnectivity();
      if (results.contains(ConnectivityResult.none) || results.isEmpty) return '—';
      if (results.contains(ConnectivityResult.wifi)) return 'WiFi';
      if (results.contains(ConnectivityResult.ethernet)) return 'WiFi';
      if (results.contains(ConnectivityResult.mobile)) return '4G';
      if (results.contains(ConnectivityResult.vpn)) {
        if (results.contains(ConnectivityResult.wifi)) return 'WiFi';
        if (results.contains(ConnectivityResult.mobile)) return '4G';
      }
      return '4G';
    } catch (_) {
      return null;
    }
  }

  /// Stream of connectivity changes
  Stream<bool> get onConnectivityChanged {
    return _connectivity.onConnectivityChanged.map(
      (results) => !results.contains(ConnectivityResult.none),
    );
  }

  void dispose() {
    _subscription?.cancel();
  }
}

final connectivityProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// Reactive online status
final isOnlineProvider = StreamProvider<bool>((ref) {
  final service = ref.read(connectivityProvider);
  return service.onConnectivityChanged;
});

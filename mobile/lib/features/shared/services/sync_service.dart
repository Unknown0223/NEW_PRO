/// Offline sync conflict resolution — server-wins (orders) va last-write-wins (clients/products).
library;

enum SyncConflictStrategy {
  /// Server versiyasi ustun — zakazlar va narxlar uchun.
  serverWins,
  /// Eng so‘nggi `updatedAt` ustun — mijozlar uchun.
  lastWriteWins,
}

class SyncConflictResolver {
  const SyncConflictResolver();

  /// Qaysi yozuv saqlanishini hal qiladi.
  Map<String, dynamic> resolve({
    required String entityType,
    required Map<String, dynamic> localRow,
    required Map<String, dynamic> serverRow,
  }) {
    final strategy = _strategyFor(entityType);
    switch (strategy) {
      case SyncConflictStrategy.serverWins:
        return Map<String, dynamic>.from(serverRow);
      case SyncConflictStrategy.lastWriteWins:
        return _lastWriteWins(localRow, serverRow);
    }
  }

  SyncConflictStrategy _strategyFor(String entityType) {
    switch (entityType) {
      case 'orders':
      case 'prices':
      case 'products':
        return SyncConflictStrategy.serverWins;
      case 'clients':
      default:
        return SyncConflictStrategy.lastWriteWins;
    }
  }

  Map<String, dynamic> _lastWriteWins(
    Map<String, dynamic> local,
    Map<String, dynamic> server,
  ) {
    final localTs = _parseTs(local['updated_at'] ?? local['updatedAt']);
    final serverTs = _parseTs(server['updated_at'] ?? server['updatedAt']);
    if (localTs == null) return Map<String, dynamic>.from(server);
    if (serverTs == null) return Map<String, dynamic>.from(local);
    return localTs.isAfter(serverTs)
        ? Map<String, dynamic>.from(local)
        : Map<String, dynamic>.from(server);
  }

  DateTime? _parseTs(Object? raw) {
    if (raw == null) return null;
    if (raw is DateTime) return raw;
    return DateTime.tryParse(raw.toString());
  }
}

/// SyncEngine uchun singleton.
const syncConflictResolver = SyncConflictResolver();

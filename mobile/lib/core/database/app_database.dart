import 'dart:convert';

import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

import '../time/work_region_time.dart';

class AppDatabase {
  static Database? _db;

  static Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  static Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'salesdoc.db');
    return openDatabase(
      path,
      version: 14,
      onOpen: (db) async {
        // Android: PRAGMA faqat rawQuery orqali (execute xato beradi).
        try {
          await db.rawQuery('PRAGMA journal_mode=WAL');
          await db.rawQuery('PRAGMA synchronous=NORMAL');
        } catch (_) {}
        await _ensureClientColumns(db);
      },
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE clients (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            address TEXT,
            phone TEXT,
            legal_name TEXT,
            client_code TEXT,
            category TEXT,
            zone TEXT,
            region TEXT,
            city TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            latitude REAL,
            longitude REAL,
            visit_weekdays TEXT,
            balance REAL,
            credit_limit REAL,
            inn TEXT,
            sales_channel TEXT,
            client_type_code TEXT,
            bank_name TEXT,
            bank_mfo TEXT,
            oked TEXT,
            client_pinfl TEXT,
            contract_number TEXT,
            notes TEXT,
            visit_date TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            sku TEXT,
            name TEXT NOT NULL DEFAULT '',
            unit TEXT,
            barcode TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE prices (
            product_id INTEGER NOT NULL,
            price_type TEXT NOT NULL DEFAULT 'default',
            price REAL NOT NULL,
            PRIMARY KEY (product_id, price_type)
          )
        ''');
        await db.execute('''
          CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            number TEXT,
            client_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            total REAL DEFAULT 0,
            created_at TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE offline_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            warehouse_id INTEGER,
            items TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT '',
            latitude REAL,
            longitude REAL,
            price_type TEXT,
            comment TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE agent_visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            client_name TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            start_time TEXT,
            end_time TEXT,
            notes TEXT,
            photo_paths TEXT,
            refusal_reason_ref TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            visit_day TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE order_drafts (
            client_id INTEGER PRIMARY KEY,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            price_type TEXT NOT NULL DEFAULT '',
            comment TEXT,
            is_consignment INTEGER NOT NULL DEFAULT 0,
            consignment_due_date TEXT,
            quantities TEXT NOT NULL,
            total_qty REAL NOT NULL DEFAULT 0,
            total_sum REAL NOT NULL DEFAULT 0,
            total_volume REAL NOT NULL DEFAULT 0,
            saved_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE pending_photo_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            caption TEXT NOT NULL,
            order_id INTEGER,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('ALTER TABLE clients ADD COLUMN client_code TEXT');
          await db.execute('ALTER TABLE clients ADD COLUMN category TEXT');
          await db.execute('ALTER TABLE clients ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
        }
        if (oldVersion < 3) {
          // Eski to‘liq katalog (admin/sync) — agent bog‘langan ro‘yxatiga o‘tish
          await db.delete('clients');
        }
        if (oldVersion < 4) {
          await db.execute('ALTER TABLE offline_queue ADD COLUMN warehouse_id INTEGER');
          await db.execute('ALTER TABLE offline_queue ADD COLUMN price_type TEXT');
          await db.execute('ALTER TABLE offline_queue ADD COLUMN comment TEXT');
        }
        if (oldVersion < 6) {
          await db.execute('ALTER TABLE clients ADD COLUMN visit_weekdays TEXT');
          await db.execute('ALTER TABLE clients ADD COLUMN balance REAL');
        }
        if (oldVersion < 7) {
          await db.execute('ALTER TABLE clients ADD COLUMN credit_limit REAL');
        }
        if (oldVersion < 8) {
          await _ensureClientColumns(db);
        }
        if (oldVersion < 9) {
          await _ensureClientColumns(db);
        }
        if (oldVersion < 10) {
          await _ensureClientColumns(db);
        }
        if (oldVersion < 11) {
          await _ensureClientColumns(db);
        }
        if (oldVersion < 12) {
          await _ensureClientColumns(db);
        }
        if (oldVersion < 13) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS order_drafts (
              client_id INTEGER PRIMARY KEY,
              warehouse_id INTEGER NOT NULL,
              warehouse_name TEXT,
              price_type TEXT NOT NULL DEFAULT '',
              comment TEXT,
              is_consignment INTEGER NOT NULL DEFAULT 0,
              consignment_due_date TEXT,
              quantities TEXT NOT NULL,
              total_qty REAL NOT NULL DEFAULT 0,
              total_sum REAL NOT NULL DEFAULT 0,
              total_volume REAL NOT NULL DEFAULT 0,
              saved_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            )
          ''');
        }
        if (oldVersion < 14) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS pending_photo_reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              client_id INTEGER NOT NULL,
              image_path TEXT NOT NULL,
              caption TEXT NOT NULL,
              order_id INTEGER,
              created_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending'
            )
          ''');
        }
        if (oldVersion < 5) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS agent_visits (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              client_id INTEGER,
              client_name TEXT NOT NULL,
              latitude REAL,
              longitude REAL,
              start_time TEXT,
              end_time TEXT,
              notes TEXT,
              photo_paths TEXT,
              refusal_reason_ref TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              visit_day TEXT NOT NULL
            )
          ''');
        }
      },
    );
  }

  static Future<void> _ensureClientColumns(Database db) async {
    final cols = (await db.rawQuery('PRAGMA table_info(clients)'))
        .map((r) => r['name'] as String)
        .toSet();
    if (!cols.contains('visit_weekdays')) {
      await db.execute('ALTER TABLE clients ADD COLUMN visit_weekdays TEXT');
    }
    if (!cols.contains('balance')) {
      await db.execute('ALTER TABLE clients ADD COLUMN balance REAL');
    }
    if (!cols.contains('credit_limit')) {
      await db.execute('ALTER TABLE clients ADD COLUMN credit_limit REAL');
    }
    if (!cols.contains('legal_name')) {
      await db.execute('ALTER TABLE clients ADD COLUMN legal_name TEXT');
    }
    if (!cols.contains('region')) {
      await db.execute('ALTER TABLE clients ADD COLUMN region TEXT');
    }
    if (!cols.contains('zone')) {
      await db.execute('ALTER TABLE clients ADD COLUMN zone TEXT');
    }
    if (!cols.contains('city')) {
      await db.execute('ALTER TABLE clients ADD COLUMN city TEXT');
    }
    if (!cols.contains('inn')) {
      await db.execute('ALTER TABLE clients ADD COLUMN inn TEXT');
    }
    if (!cols.contains('sales_channel')) {
      await db.execute('ALTER TABLE clients ADD COLUMN sales_channel TEXT');
    }
    if (!cols.contains('client_type_code')) {
      await db.execute('ALTER TABLE clients ADD COLUMN client_type_code TEXT');
    }
    if (!cols.contains('bank_name')) {
      await db.execute('ALTER TABLE clients ADD COLUMN bank_name TEXT');
    }
    if (!cols.contains('bank_mfo')) {
      await db.execute('ALTER TABLE clients ADD COLUMN bank_mfo TEXT');
    }
    if (!cols.contains('oked')) {
      await db.execute('ALTER TABLE clients ADD COLUMN oked TEXT');
    }
    if (!cols.contains('client_pinfl')) {
      await db.execute('ALTER TABLE clients ADD COLUMN client_pinfl TEXT');
    }
    if (!cols.contains('contract_number')) {
      await db.execute('ALTER TABLE clients ADD COLUMN contract_number TEXT');
    }
    if (!cols.contains('notes')) {
      await db.execute('ALTER TABLE clients ADD COLUMN notes TEXT');
    }
    if (!cols.contains('visit_date')) {
      await db.execute('ALTER TABLE clients ADD COLUMN visit_date TEXT');
    }
  }

  static Future<void> _upsertBatched(
    Database db,
    String table,
    List<Map<String, dynamic>> rows, {
    int chunkSize = 800,
  }) async {
    if (rows.isEmpty) return;
    for (var i = 0; i < rows.length; i += chunkSize) {
      final chunk = rows.skip(i).take(chunkSize).toList();
      final batch = db.batch();
      for (final row in chunk) {
        batch.insert(table, row, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await batch.commit(noResult: true);
    }
  }

  static Future<void> _upsertBatchedTxn(
    Transaction txn,
    String table,
    List<Map<String, dynamic>> rows, {
    int chunkSize = 1000,
  }) async {
    if (rows.isEmpty) return;
    for (var i = 0; i < rows.length; i += chunkSize) {
      final chunk = rows.skip(i).take(chunkSize).toList();
      final batch = txn.batch();
      for (final row in chunk) {
        batch.insert(table, row, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await batch.commit(noResult: true);
      if (i + chunkSize < rows.length) {
        await Future<void>.delayed(Duration.zero);
      }
    }
  }

  /// Bitta tranzaksiyada sinxron natijasini saqlash (tezroq).
  Future<void> persistSync({
    required bool replaceProductCatalog,
    required bool replaceClients,
    required bool markAgentClientsSynced,
    required List<Map<String, dynamic>> products,
    required List<Map<String, dynamic>> prices,
    required List<Map<String, dynamic>> clients,
    required List<Map<String, dynamic>> orders,
    required String syncAt,
  }) async {
    final db = await database;
    await db.transaction((txn) async {
      if (replaceProductCatalog) {
        await txn.delete('products');
        await txn.delete('prices');
      }
      await _upsertBatchedTxn(txn, 'products', products);
      await Future<void>.delayed(Duration.zero);
      await _upsertBatchedTxn(txn, 'prices', prices);
      await Future<void>.delayed(Duration.zero);
      if (replaceClients) {
        await txn.delete('clients');
      }
      await _upsertBatchedTxn(txn, 'clients', clients);
      await Future<void>.delayed(Duration.zero);
      if (markAgentClientsSynced) {
        await txn.insert(
          'sync_meta',
          {'key': 'agent_clients_v', 'value': '4'},
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await _upsertBatchedTxn(txn, 'orders', orders);
      if (syncAt.isNotEmpty) {
        await txn.insert(
          'sync_meta',
          {'key': 'last_sync_at', 'value': syncAt},
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  Future<void> clearClients() async {
    final db = await database;
    await db.delete('clients');
  }

  Future<void> clearProducts() async {
    final db = await database;
    await db.delete('products');
    await db.delete('prices');
  }

  /// Chiqish yoki agent qayta kirishda eski katalogni olib tashlash.
  Future<void> clearAgentScopedCache() async {
    final db = await database;
    await db.delete('clients');
    await db.delete('agent_visits');
    await db.delete('sync_meta', where: "key = 'agent_clients_v'");
  }

  // Ish mintaqasi (server-langarlangan) bo‘yicha bugungi kun. Qurilma soati
  // o‘zgartirilsa ham tashriflar/sinxron sanog‘i to‘g‘ri kunга yoziladi.
  static String _todayKey() => serverTodayKey();

  Future<int> getSyncCountToday() async {
    final db = await database;
    final r = await db.query('sync_meta', where: "key = 'sync_count_day'");
    if (r.isEmpty) return 0;
    try {
      final m = jsonDecode(r.first['value'] as String) as Map<String, dynamic>;
      if (m['date'] == _todayKey()) return (m['count'] as num?)?.toInt() ?? 0;
    } catch (_) {}
    return 0;
  }

  Future<void> recordSyncToday() async {
    final db = await database;
    final day = _todayKey();
    var count = 0;
    final r = await db.query('sync_meta', where: "key = 'sync_count_day'");
    if (r.isNotEmpty) {
      try {
        final m = jsonDecode(r.first['value'] as String) as Map<String, dynamic>;
        if (m['date'] == day) count = (m['count'] as num?)?.toInt() ?? 0;
      } catch (_) {}
    }
    await db.insert(
      'sync_meta',
      {'key': 'sync_count_day', 'value': jsonEncode({'date': day, 'count': count + 1})},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getVisitsForDay([String? day]) async {
    final db = await database;
    final d = day ?? _todayKey();
    return db.query('agent_visits', where: 'visit_day = ?', whereArgs: [d], orderBy: 'id DESC');
  }

  /// Oxirgi N kun ichida kamida bitta tashrif qilgan mijozlar (mahalliy vizitlar).
  Future<Set<int>> getClientIdsVisitedSince(DateTime since) async {
    final db = await database;
    final sinceKey = since.toIso8601String().substring(0, 10);
    final rows = await db.query(
      'agent_visits',
      columns: ['client_id'],
      where:
          "client_id IS NOT NULL AND status IN ('completed', 'in_progress', 'refused') AND visit_day >= ?",
      whereArgs: [sinceKey],
    );
    final out = <int>{};
    for (final r in rows) {
      final id = (r['client_id'] as num?)?.toInt();
      if (id != null) out.add(id);
    }
    return out;
  }

  /// Oxirgi tashrif yoki buyurtma sanasi — marshrut cooldown uchun.
  Future<Map<int, DateTime>> getLastClientActivityById() async {
    final db = await database;
    final out = <int, DateTime>{};

    void consider(int? clientId, String? dateStr) {
      if (clientId == null || clientId <= 0 || dateStr == null || dateStr.length < 10) return;
      final d = DateTime.tryParse(dateStr.substring(0, 10));
      if (d == null) return;
      final prev = out[clientId];
      if (prev == null || d.isAfter(prev)) out[clientId] = d;
    }

    final visits = await db.query(
      'agent_visits',
      columns: ['client_id', 'visit_day'],
      where: "client_id IS NOT NULL AND status IN ('completed', 'in_progress', 'refused')",
    );
    for (final r in visits) {
      consider((r['client_id'] as num?)?.toInt(), r['visit_day']?.toString());
    }

    final orders = await db.query('orders', columns: ['client_id', 'created_at']);
    for (final r in orders) {
      consider((r['client_id'] as num?)?.toInt(), r['created_at']?.toString());
    }

    return out;
  }

  Future<void> replaceVisitsForDay(List<Map<String, dynamic>> rows, [String? day]) async {
    final db = await database;
    final d = day ?? _todayKey();
    await db.delete('agent_visits', where: 'visit_day = ?', whereArgs: [d]);
    final batch = db.batch();
    for (final r in rows) {
      batch.insert('agent_visits', {...r, 'visit_day': d});
    }
    await batch.commit(noResult: true);
  }

  Future<int> insertVisit(Map<String, dynamic> row) async {
    final db = await database;
    return db.insert('agent_visits', {...row, 'visit_day': _todayKey()});
  }

  Future<void> updateVisit(int id, Map<String, dynamic> row) async {
    final db = await database;
    await db.update('agent_visits', row, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markAgentClientsSynced() async {
    final db = await database;
    await db.insert(
      'sync_meta',
      {'key': 'agent_clients_v', 'value': '4'},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<bool> isAgentClientsSynced() async {
    final db = await database;
    final r = await db.query('sync_meta', where: "key = 'agent_clients_v'");
    return r.isNotEmpty;
  }

  Future<void> upsertClients(List<Map<String, dynamic>> clients) async {
    final db = await database;
    await _upsertBatched(db, 'clients', clients);
  }

  /// Agentga bog'langan mijozlar (sync dan keyin faqat shu ro'yxat).
  Future<List<Map<String, dynamic>>> getAllClients({bool activeOnly = true}) async {
    final db = await database;
    if (activeOnly) {
      return db.query(
        'clients',
        where: 'is_active = 1',
        orderBy: 'name COLLATE NOCASE ASC',
      );
    }
    return db.query('clients', orderBy: 'name COLLATE NOCASE ASC');
  }

  Future<Map<String, dynamic>?> getClientById(int id) async {
    final db = await database;
    final rows = await db.query('clients', where: 'id = ?', whereArgs: [id], limit: 1);
    return rows.isEmpty ? null : rows.first;
  }

  Future<List<Map<String, dynamic>>> searchClients(String query, {int limit = 80, bool activeOnly = true}) async {
    final db = await database;
    final q = query.trim();
    if (q.isEmpty) return getAllClients(activeOnly: activeOnly);
    final like = '%$q%';
    final activeClause = activeOnly ? 'is_active = 1 AND (' : '(';
    return db.query(
      'clients',
      where: '''
        $activeClause
          name LIKE ? OR phone LIKE ? OR client_code LIKE ? OR address LIKE ?
        )
      ''',
      whereArgs: [like, like, like, like],
      orderBy: 'name COLLATE NOCASE ASC',
      limit: limit,
    );
  }

  Future<void> upsertProducts(List<Map<String, dynamic>> products) async {
    final db = await database;
    await _upsertBatched(db, 'products', products);
  }

  Future<List<Map<String, dynamic>>> getAllProducts() async {
    final db = await database;
    return db.query('products', orderBy: 'name ASC');
  }

  Future<List<Map<String, dynamic>>> searchProducts(String query, {int limit = 80}) async {
    final db = await database;
    final q = query.trim();
    if (q.isEmpty) {
      return db.query('products', orderBy: 'name ASC', limit: limit);
    }
    return db.query(
      'products',
      where: 'name LIKE ? OR sku LIKE ? OR barcode LIKE ?',
      whereArgs: ['%$q%', '%$q%', '%$q%'],
      orderBy: 'name ASC',
      limit: limit,
    );
  }

  Future<Map<int, double>> getDefaultPrices({List<String>? priceTypes}) async {
    final db = await database;
    final types = (priceTypes != null && priceTypes.isNotEmpty)
        ? priceTypes
        : const ['default'];
    for (final t in types) {
      final rows = await db.query('prices', where: 'price_type = ?', whereArgs: [t]);
      if (rows.isNotEmpty) {
        return {
          for (final r in rows)
            (r['product_id'] as num).toInt(): (r['price'] as num).toDouble(),
        };
      }
    }
    final any = await db.query('prices');
    final out = <int, double>{};
    for (final r in any) {
      final pid = (r['product_id'] as num).toInt();
      if (!out.containsKey(pid)) {
        out[pid] = (r['price'] as num).toDouble();
      }
    }
    return out;
  }

  Future<void> upsertPrices(List<Map<String, dynamic>> prices) async {
    final db = await database;
    await _upsertBatched(db, 'prices', prices);
  }

  Future<void> upsertOrders(List<Map<String, dynamic>> orders) async {
    final db = await database;
    await _upsertBatched(db, 'orders', orders);
  }

  Future<List<Map<String, dynamic>>> getOrders({int? limit}) async {
    final db = await database;
    return db.query('orders', orderBy: 'id DESC', limit: limit);
  }

  /// Joriy kalendar oyi (mahalliy vaqt) ichidagi mijoz buyurtmalari.
  Future<List<Map<String, dynamic>>> getClientOrdersForCurrentMonth(int clientId) async {
    final db = await database;
    final rows = await db.query(
      'orders',
      where: 'client_id = ?',
      whereArgs: [clientId],
      orderBy: 'id DESC',
    );
    final wrNow = workRegionNow();
    final start = DateTime(wrNow.year, wrNow.month, 1);
    final end = DateTime(wrNow.year, wrNow.month + 1, 1);
    return rows.where((o) {
      final raw = o['created_at']?.toString();
      if (raw == null || raw.isEmpty) return false;
      final dt = DateTime.tryParse(raw)?.toLocal();
      if (dt == null) return false;
      return !dt.isBefore(start) && dt.isBefore(end);
    }).toList();
  }

  Future<int> addOfflineOrder(
    int clientId,
    int warehouseId,
    String itemsJson, {
    double? lat,
    double? lng,
    String? priceType,
    String? comment,
  }) async {
    final db = await database;
    return db.insert('offline_queue', {
      'client_id': clientId,
      'warehouse_id': warehouseId,
      'items': itemsJson,
      'status': 'pending',
      'created_at': DateTime.now().toIso8601String(),
      'latitude': lat,
      'longitude': lng,
      'price_type': priceType,
      'comment': comment,
    });
  }

  Future<List<Map<String, dynamic>>> getPendingOrders() async {
    final db = await database;
    return db.query(
      'offline_queue',
      where: "status = 'pending'",
      orderBy: 'created_at ASC',
    );
  }

  Future<int> pendingCount() async {
    final db = await database;
    final r = await db.rawQuery(
      "SELECT COUNT(*) as cnt FROM offline_queue WHERE status = 'pending'",
    );
    return r.first['cnt'] as int? ?? 0;
  }

  Future<String?> getLastSyncAt() async {
    final db = await database;
    final r = await db.query('sync_meta', where: "key = 'last_sync_at'");
    if (r.isEmpty) return null;
    return r.first['value'] as String?;
  }

  Future<void> markQueueItemSent(int id) async {
    final db = await database;
    await db.update('offline_queue', {'status': 'sent'}, where: 'id = ?', whereArgs: [id]);
  }

  Future<int> enqueuePendingPhotoReport({
    required int clientId,
    required String imagePath,
    required String caption,
    int? orderId,
  }) async {
    final db = await database;
    return db.insert('pending_photo_reports', {
      'client_id': clientId,
      'image_path': imagePath,
      'caption': caption,
      'order_id': orderId,
      'created_at': DateTime.now().toIso8601String(),
      'status': 'pending',
    });
  }

  Future<List<Map<String, dynamic>>> getPendingPhotoReports() async {
    final db = await database;
    return db.query(
      'pending_photo_reports',
      where: "status = 'pending'",
      orderBy: 'created_at ASC',
    );
  }

  Future<void> deletePendingPhotoReport(int id) async {
    final db = await database;
    await db.delete('pending_photo_reports', where: 'id = ?', whereArgs: [id]);
  }

  Future<int> pendingPhotoReportCount() async {
    final db = await database;
    final r = await db.rawQuery(
      "SELECT COUNT(*) as cnt FROM pending_photo_reports WHERE status = 'pending'",
    );
    return r.first['cnt'] as int? ?? 0;
  }

  Future<void> setLastSyncAt(String value) async {
    final db = await database;
    await db.insert(
      'sync_meta',
      {'key': 'last_sync_at', 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getSyncMeta(String key) async {
    final db = await database;
    final r = await db.query('sync_meta', where: 'key = ?', whereArgs: [key], limit: 1);
    if (r.isEmpty) return null;
    return r.first['value'] as String?;
  }

  Future<void> setSyncMeta(String key, String value) async {
    final db = await database;
    await db.insert(
      'sync_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> clientCount({bool activeOnly = true}) async {
    final db = await database;
    final r = activeOnly
        ? await db.rawQuery('SELECT COUNT(*) as cnt FROM clients WHERE is_active = 1')
        : await db.rawQuery('SELECT COUNT(*) as cnt FROM clients');
    return r.first['cnt'] as int? ?? 0;
  }

  Future<int> productCount() async {
    final db = await database;
    final r = await db.rawQuery('SELECT COUNT(*) as cnt FROM products');
    return r.first['cnt'] as int? ?? 0;
  }

  Future<int> orderCount() async {
    final db = await database;
    final r = await db.rawQuery('SELECT COUNT(*) as cnt FROM orders');
    return r.first['cnt'] as int? ?? 0;
  }

  Future<void> purgeExpiredOrderDrafts() async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.delete('order_drafts', where: 'expires_at <= ?', whereArgs: [now]);
  }

  Future<void> upsertOrderDraft(Map<String, dynamic> row) async {
    final db = await database;
    await db.insert(
      'order_drafts',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Map<String, dynamic>?> getOrderDraftRowForClient(int clientId) async {
    await purgeExpiredOrderDrafts();
    final db = await database;
    final rows = await db.query(
      'order_drafts',
      where: 'client_id = ?',
      whereArgs: [clientId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first;
  }

  Future<List<Map<String, dynamic>>> getActiveOrderDraftRows() async {
    await purgeExpiredOrderDrafts();
    final db = await database;
    return db.query('order_drafts');
  }

  Future<void> deleteOrderDraft(int clientId) async {
    final db = await database;
    await db.delete('order_drafts', where: 'client_id = ?', whereArgs: [clientId]);
  }
}

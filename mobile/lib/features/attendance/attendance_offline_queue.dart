import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Oflayn davomat belgilari: fayl yo‘li + GPS, tarmoq qaytganda yuboriladi.
class AttendanceOfflineQueue {
  AttendanceOfflineQueue._();

  static Future<Directory> _dir() async {
    final root = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(root.path, 'pending_attendance'));
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  static Future<String> persistBytes(List<int> bytes, String ext) async {
    final dir = await _dir();
    final file = File(p.join(dir.path, '${DateTime.now().millisecondsSinceEpoch}.$ext'));
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  static Future<void> enqueue(Map<String, dynamic> payload) async {
    final dir = await _dir();
    final file = File(p.join(dir.path, 'q-${DateTime.now().millisecondsSinceEpoch}.json'));
    await file.writeAsString(jsonEncode(payload));
  }

  static Future<List<Map<String, dynamic>>> pending() async {
    final dir = await _dir();
    final out = <Map<String, dynamic>>[];
    await for (final ent in dir.list()) {
      if (ent is! File || !ent.path.endsWith('.json')) continue;
      try {
        final map = jsonDecode(await ent.readAsString());
        if (map is Map) {
          final row = Map<String, dynamic>.from(map);
          row['_queue_file'] = ent.path;
          out.add(row);
        }
      } catch (_) {}
    }
    return out;
  }

  static Future<void> remove(String queueFile) async {
    final f = File(queueFile);
    if (await f.exists()) await f.delete();
  }
}

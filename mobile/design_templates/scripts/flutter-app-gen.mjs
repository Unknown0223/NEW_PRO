import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* Reuse tokens/zip logic from the TS sources by compiling them first. */
const ds = await import("../.gen/design-system.cjs");
const zip = await import("../.gen/zip.cjs");
const { FLUTTER_FILES, PACKAGE_VERSION, handoffReadme } = ds;
const { buildZipBytes, textFile } = zip;
const designSystem = FLUTTER_FILES.map((f) => textFile(f.path.replace(/^mobile\//, "mobile/"), f.code));

const V = "1.0.0";
const APP = "sales_arena";

/* ------------------------------------------------------------------ */
/*  App source                                                         */
/* ------------------------------------------------------------------ */
const pubspec = `name: sales_arena
description: Sales Arena — agent, ekspeditor, supervayzer va kassir uchun mobil ilova.
publish_to: "none"
version: \${V}+1

environment:
  sdk: ">=3.4.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  go_router: ^14.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/design/catalog.json

# Ilova tashqi paketlarga bog'liq emas: API uchun dart:io,
# kesh uchun fayl tizimi ishlatiladi. Shu sababli build tez va barqaror.
`;

const analysis = `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: true
    avoid_print: true
    use_super_parameters: true
`;

const catalogJson = `{
  "version": "1.0.0",
  "updated": "2026-01-01",
  "colors": {
    "salesBlue": "#1F66D1",
    "brightSky": "#6FA8FF",
    "agent": "#1F66D1",
    "expeditor": "#0E8A4F",
    "supervisor": "#1FA855",
    "cashier": "#0F766E"
  },
  "radius": { "chip": 8, "control": 12, "card": 16, "sheet": 20 },
  "flags": { "newSyncView": true }
}
`;

const mainDart = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import 'app/router.dart';
import 'core/api/api_client.dart';
import 'core/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final catalog = await SaCatalog.loadBundled();
  final api = ApiClient(baseUrl: const String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000'));
  final session = Session(api);
  runApp(SalesArenaApp(catalog: catalog, api: api, session: session));
}

class SalesArenaApp extends StatelessWidget {
  const SalesArenaApp({super.key, required this.catalog, required this.api, required this.session});
  final SaCatalog catalog;
  final ApiClient api;
  final Session session;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      api: api,
      session: session,
      child: MaterialApp.router(
        title: 'Sales Arena',
        debugShowCheckedModeBanner: false,
        theme: SaTheme.light(catalog),
        darkTheme: SaTheme.dark(catalog),
        routerConfig: buildRouter(session),
      ),
    );
  }
}

/// Ilova bo'ylab bitta api/session nusxasi.
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.api, required this.session, required super.child});
  final ApiClient api;
  final Session session;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope old) => old.session != session || old.api != api;
}
`;

const router = `import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../features/auth/splash_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/pin_page.dart';
import '../features/shell/shell_page.dart';
import '../features/home/home_page.dart';
import '../features/visits/visits_page.dart';
import '../features/visits/start_visit_page.dart';
import '../features/clients/clients_page.dart';
import '../features/clients/client_detail_page.dart';
import '../features/clients/new_client_page.dart';
import '../features/orders/orders_page.dart';
import '../features/orders/order_detail_page.dart';
import '../features/orders/create_order_page.dart';
import '../features/kpi/kpi_page.dart';
import '../features/kpi/bonuses_page.dart';
import '../features/report/report_page.dart';
import '../features/map/map_page.dart';
import '../features/tabel/tabel_page.dart';
import '../features/warehouse/warehouse_page.dart';
import '../features/tasks/tasks_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/profile/profile_page.dart';
import '../features/menu/menu_page.dart';
import '../features/sync/sync_page.dart';

final _rootKey = GlobalKey<NavigatorState>();

GoRouter buildRouter(Session session) {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/splash',
    refreshListenable: session,
    redirect: (ctx, state) {
      final auth = session.signedIn;
      final at = state.matchedLocation;
      final public = at == '/splash' || at == '/login' || at == '/pin';
      if (!auth && !public) return '/login';
      if (auth && public) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/pin', builder: (_, __) => const PinPage()),
      ShellRoute(
        builder: (_, __, child) => ShellPage(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomePage()),
          GoRoute(path: '/visits', builder: (_, __) => const VisitsPage()),
          GoRoute(path: '/clients', builder: (_, __) => const ClientsPage()),
          GoRoute(path: '/orders', builder: (_, __) => const OrdersPage()),
          GoRoute(path: '/kpi', builder: (_, __) => const KpiPage()),
          GoRoute(path: '/bonuses', builder: (_, __) => const BonusesPage()),
          GoRoute(path: '/report', builder: (_, __) => const ReportPage()),
          GoRoute(path: '/map', builder: (_, __) => const MapPage()),
          GoRoute(path: '/tabel', builder: (_, __) => const TabelPage()),
          GoRoute(path: '/warehouse', builder: (_, __) => const WarehousePage()),
          GoRoute(path: '/tasks', builder: (_, __) => const TasksPage()),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
          GoRoute(path: '/menu', builder: (_, __) => const MenuPage()),
          GoRoute(path: '/sync', builder: (_, __) => const SyncPage()),
        ],
      ),
      GoRoute(path: '/visits/start/:id', builder: (_, s) => StartVisitPage(clientId: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/clients/new', builder: (_, __) => const NewClientPage()),
      GoRoute(path: '/clients/:id', builder: (_, s) => ClientDetailPage(clientId: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/orders/new', builder: (_, __) => const CreateOrderPage()),
      GoRoute(path: '/orders/:id', builder: (_, s) => OrderDetailPage(orderId: int.parse(s.pathParameters['id']!))),
    ],
  );
}
`;

const session = `import 'package:flutter/foundation.dart';
import 'api/api_client.dart';

class Session extends ChangeNotifier {
  Session(this.api);
  final ApiClient api;

  String? _token;
  String? _role;
  String? _name;
  int? _id;
  bool busy = false;
  String? error;
  Map<String, dynamic> kpi = {};

  bool get signedIn => _token != null;
  String? get role => _role;
  String? get name => _name ?? '';
  int? get userId => _id;

  Future<bool> login(String login, String password) async {
    busy = true; error = null; notifyListeners();
    try {
      final res = await api.post('/api/auth/login', {'login': login, 'password': password});
      _token = res['token'] as String;
      api.token = _token;
      final u = Map<String, dynamic>.from(res['user']);
      _id = u['id'] as int;
      _role = u['role'] as String;
      _name = u['name'] as String;
      kpi = await api.get('/api/kpi/me').then((d) => Map<String, dynamic>.from(d['kpi'] ?? {}));
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false; notifyListeners();
    }
  }

  Future<bool> unlock(String pin) async {
    busy = true; notifyListeners();
    try {
      final res = await api.post('/api/auth/pin', {'pin': pin});
      return res['ok'] == true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false; notifyListeners();
    }
  }

  void logout() {
    _token = null; _role = null; _name = null; _id = null; api.token = null;
    notifyListeners();
  }
}
`;

const ui = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';

/// Ilova bo'ylab bir xil sarlavha, karta va bo'sh holat.
class AppBar2 extends StatelessWidget {
  const AppBar2({super.key, required this.title, this.subtitle, this.actions = const []});
  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: SaType.title.copyWith(fontSize: 20)),
                if (subtitle != null)
                  Text(subtitle!, style: SaType.caption.copyWith(fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

class Tile extends StatelessWidget {
  const Tile({super.key, required this.value, required this.label, this.accent});
  final String value, label;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SaCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: SaType.title.copyWith(fontSize: 18, color: accent ?? scheme.onSurface)),
          const SizedBox(height: 2),
          Text(label, style: SaType.caption.copyWith(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.hint, this.action});
  final String title;
  final String? hint;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inbox_outlined, size: 36),
            const SizedBox(height: 10),
            Text(title, style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
            if (hint != null) ...[
              const SizedBox(height: 4),
              Text(hint!, textAlign: TextAlign.center, style: SaType.caption),
            ],
            if (action != null) ...[const SizedBox(height: 12), action!],
          ],
        ),
      ),
    );
  }
}

class Loader extends StatelessWidget {
  const Loader({super.key, this.message = 'Yuklanmoqda…'});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(strokeWidth: 2.5),
            const SizedBox(height: 10),
            Text(message, style: SaType.caption),
          ],
        ),
      );
}
`;

const format = `String money(int tiyin) {
  final s = (tiyin ~/ 100).toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return b.toString();
}
`;

const shell = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class ShellPage extends StatelessWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.diamond_outlined, size: 18),
            const SizedBox(width: 8),
            Text('Sales Arena', style: SaType.title.copyWith(fontSize: 16)),
            const SizedBox(width: 6),
            Text(scope.session.role ?? '', style: SaType.mono),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sinxronlash',
            onPressed: () => context.push('/sync'),
            icon: const Icon(Icons.sync, size: 20),
          ),
          IconButton(
            tooltip: 'Bildirishnomalar',
            onPressed: () => context.push('/notifications'),
            icon: const Icon(Icons.notifications_none, size: 20),
          ),
          IconButton(
            tooltip: 'Profil',
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.person_outline, size: 20),
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Text('Sales Arena', style: SaType.title),
            Text(scope.session.name, style: SaType.caption),
            const Divider(height: 24),
            ..._items.map(
              (e) => ListTile(
                dense: true,
                leading: Icon(e.$2, size: 18),
                title: Text(e.$1, style: SaType.body.copyWith(fontSize: 13)),
                onTap: () {
                  Navigator.of(context).pop();
                  context.push(e.$3);
                },
              ),
            ),
          ],
        ),
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        backgroundColor: scheme.surface,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Asosiy'),
          NavigationDestination(icon: Icon(Icons.place_outlined), label: 'Vizit'),
          NavigationDestination(icon: Icon(Icons.people_outline), label: 'Mijoz'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'Zakaz'),
        ],
        onDestinationSelected: (i) {
          const routes = ['/home', '/visits', '/clients', '/orders'];
          context.go(routes[i]);
        },
      ),
    );
  }

  static const _items = <(String, IconData, String)>[
    ('Bosh sahifa', Icons.home_outlined, '/home'),
    ('Vizitlar', Icons.place_outlined, '/visits'),
    ('Savdo nuqtalari', Icons.store_outlined, '/clients'),
    ('Yangi zakaz', Icons.add_shopping_cart, '/orders/new'),
    ('Mening buyurtmalarim', Icons.receipt_long_outlined, '/orders'),
    ('KPI', Icons.insights_outlined, '/kpi'),
    ('Bonuslar', Icons.card_giftcard, '/bonuses'),
    ('Hisobotlar', Icons.bar_chart, '/report'),
    ('Xarita', Icons.map_outlined, '/map'),
    ('Tabel', Icons.calendar_month_outlined, '/tabel'),
    ('Ombor', Icons.warehouse_outlined, '/warehouse'),
    ('Vazifalar', Icons.checklist, '/tasks'),
    ('Sinxronlash', Icons.sync, '/sync'),
    ('Sozlamalar', Icons.settings_outlined, '/profile'),
  ];
}
`;

/* ---------------- auth ---------------- */
const splash = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});
  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (!mounted) return;
      final s = AppScope.of(context).session;
      context.go(s.signedIn ? '/home' : '/login');
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: SaColors.navy,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [BoxShadow(blurRadius: 30, color: SaColors.navy.withOpacity(.35), offset: const Offset(0, 12))],
              ),
              child: const Icon(Icons.diamond_outlined, color: SaColors.brightSky, size: 36),
            ),
            const SizedBox(height: 16),
            Text('Sales Arena', style: SaType.display.copyWith(fontSize: 24)),
            const SizedBox(height: 6),
            Text('Savdo jamoasi uchun mobil ilova', style: SaType.caption),
            const SizedBox(height: 22),
            SizedBox(width: 120, child: LinearProgressIndicator(minHeight: 3, color: scheme.primary)),
          ],
        ),
      ),
    );
  }
}
`;

const login = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _login = TextEditingController(text: 'aziz.qodirov');
  final _pass = TextEditingController(text: 'Arena#2026');
  bool busy = false;
  String? error;

  Future<void> _submit() async {
    setState(() { busy = true; error = null; });
    final ok = await AppScope.of(context).session.login(_login.text.trim(), _pass.text);
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) {
      context.go('/pin');
    } else {
      setState(() => error = AppScope.of(context).session.error ?? 'Kirish amalga oshmadi');
    }
  }

  @override
  void dispose() {
    _login.dispose();
    _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 40),
            Center(
              child: Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: SaColors.navy, borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.diamond_outlined, color: SaColors.brightSky),
              ),
            ),
            const SizedBox(height: 18),
            Text('Xush kelibsiz', textAlign: TextAlign.center, style: SaType.title.copyWith(fontSize: 22)),
            Text('Sales Arena hisobingizga kiring', textAlign: TextAlign.center, style: SaType.caption),
            const SizedBox(height: 24),
            TextField(
              controller: _login,
              decoration: const InputDecoration(labelText: 'Login', prefixIcon: Icon(Icons.person_outline)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _pass,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Parol', prefixIcon: Icon(Icons.lock_outline)),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: scheme.error, fontSize: 12)),
            ],
            const SizedBox(height: 18),
            SaPrimaryButton(label: 'Kirish', loading: busy, onPressed: _submit),
            const SizedBox(height: 14),
            Text(
              'Demo: aziz.qodirov / Arena#2026 · PIN 1234',
              textAlign: TextAlign.center,
              style: SaType.mono,
            ),
          ],
        ),
      ),
    );
  }
}
`;

const pin = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class PinPage extends StatefulWidget {
  const PinPage({super.key});
  @override
  State<PinPage> createState() => _PinPageState();
}

class _PinPageState extends State<PinPage> {
  String pin = '';
  String? error;
  int tries = 3;
  bool busy = false;

  Future<void> _press(String d) async {
    if (busy || tries <= 0 || pin.length >= 4) return;
    setState(() { pin += d; error = null; });
    if (pin.length < 4) return;
    setState(() => busy = true);
    final ok = await AppScope.of(context).session.unlock(pin);
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) {
      context.go('/home');
    } else {
      setState(() {
        tries -= 1;
        pin = '';
        error = tries > 0 ? 'PIN xato · \$tries urinish qoldi' : 'Bloklandi, keyinroq urinib ko\\'ring';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text('PIN kodni kiriting', style: SaType.title.copyWith(fontSize: 20)),
            const SizedBox(height: 6),
            Text('Qurilmaga kirish uchun 4 xonali kod', style: SaType.caption),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final on = pin.length > i;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: scheme.surfaceVariant,
                    border: Border.all(color: on ? scheme.primary : scheme.outlineVariant),
                  ),
                  child: on ? const Center(child: Icon(Icons.circle, size: 10)) : null,
                );
              }),
            ),
            const SizedBox(height: 12),
            Text(error ?? (busy ? 'Tekshirilmoqda…' : 'Demo PIN: 1234'), style: SaType.caption.copyWith(color: error != null ? scheme.error : null)),
            const SizedBox(height: 18),
            for (final row in [['1','2','3'], ['4','5','6'], ['7','8','9']])
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: row.map((d) => _key(d)).toList(),
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [_key('clear', icon: Icons.backspace_outlined), _key('0')],
            ),
          ],
        ),
      ),
    );
  }

  Widget _key(String d, {IconData? icon}) => SizedBox(
        width: 84, height: 54,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: OutlinedButton(
            onPressed: tries <= 0 ? null : () {
              if (d == 'clear') {
                setState(() => pin = pin.isEmpty ? pin : pin.substring(0, pin.length - 1));
              } else {
                _press(d);
              }
            },
            child: icon != null ? Icon(icon, size: 18) : Text(d),
          ),
        ),
      );
}
`;

const home = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  Map<String, dynamic> kpi = {};
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final scope = AppScope.of(context);
    try {
      final k = await scope.api.get('/api/kpi/me');
      if (!mounted) return;
      setState(() { kpi = Map<String, dynamic>.from(k['kpi'] ?? {}); loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { error = e.toString(); loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final pct = (kpi['pct'] ?? 0) as num;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          AppBar2(title: 'Xayrli kun, \${scope.session.name.split(' ').first}', subtitle: 'Sales Arena · bugungi reja'),
          if (loading) const SizedBox(height: 220, child: Loader()),
          if (error != null) Padding(padding: const EdgeInsets.all(16), child: Text(error!)),
          if (!loading && error == null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SaCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Oylik reja', style: SaType.caption),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text('\${pct.toInt()}%', style: SaType.title.copyWith(fontSize: 30)),
                        const Spacer(),
                        Text('\${money((kpi['fact'] ?? 0).toInt())} / \${money((kpi['plan'] ?? 0).toInt())}', style: SaType.mono),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: pct / 100, minHeight: 6, borderRadius: BorderRadius.circular(99)),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 8, runSpacing: 8,
                children: [
                  _Action(icon: Icons.place_outlined, label: 'Vizitlar', onTap: () => context.push('/visits')),
                  _Action(icon: Icons.store_outlined, label: 'Mijozlar', onTap: () => context.push('/clients')),
                  _Action(icon: Icons.add_shopping_cart, label: 'Yangi zakaz', onTap: () => context.push('/orders/new')),
                  _Action(icon: Icons.insights_outlined, label: 'KPI', onTap: () => context.push('/kpi')),
                  _Action(icon: Icons.card_giftcard, label: 'Bonuslar', onTap: () => context.push('/bonuses')),
                  _Action(icon: Icons.map_outlined, label: 'Xarita', onTap: () => context.push('/map')),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                Expanded(child: Tile(value: money((kpi['fact'] ?? 0).toInt()), label: 'Oylik savdo')),
                const SizedBox(width: 8),
                Expanded(child: Tile(value: '\${kpi['orders'] ?? 0}', label: 'Buyurtma')),
                const SizedBox(width: 8),
                Expanded(child: Tile(value: '\${kpi['premiumPct'] ?? 0}%', label: 'Premiya')),
              ]),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SaCard(
                child: Row(
                  children: [
                    const Icon(Icons.sync, size: 16),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Oflayn kesh faol — barcha yozuvlar saqlanadi', style: SaType.caption)),
                    TextButton(onPressed: () => context.push('/sync'), child: const Text('Sinxron')),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 100,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
        child: Column(children: [Icon(icon, size: 20), const SizedBox(height: 6), Text(label, style: SaType.caption, textAlign: TextAlign.center)]),
      ),
    );
  }
}
`;


/* ---------------- visits ---------------- */
const visits = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';
import '../main.dart';

class VisitsPage extends StatefulWidget {
  const VisitsPage({super.key});
  @override
  State<VisitsPage> createState() => _VisitsPageState();
}

class _VisitsPageState extends State<VisitsPage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/visits');
      if (!mounted) return;
      setState(() {
        rows = ((res['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const AppBar2(title: 'Vizitlar', subtitle: 'Bugungi marshrut'),
        Expanded(
          child: loading
              ? const Loader()
              : rows.isEmpty
                  ? EmptyState(
                      title: 'Vizit yo\\'q',
                      hint: 'Mijoz kartasidan vizitni boshlang',
                      action: SaPrimaryButton(label: 'Mijozlar', onPressed: () => context.push('/clients')),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final v = rows[i];
                          final client = Map<String, dynamic>.from(v['client'] ?? {});
                          return SaCard(
                            onTap: () => context.push('/clients/\${v['clientId']}'),
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                CircleAvatar(radius: 16, child: Text('\${(client['name'] ?? '?').toString().substring(0, 1)}')),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(client['name']?.toString() ?? '—', style: SaType.body.copyWith(fontWeight: FontWeight.w600)),
                                    Text('\${client['code'] ?? ''} · \${v['status']}', style: SaType.caption),
                                  ]),
                                ),
                                const Icon(Icons.chevron_right, size: 18),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
`;

const startVisit = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class StartVisitPage extends StatefulWidget {
  const StartVisitPage({super.key, required this.clientId});
  final int clientId;
  @override
  State<StartVisitPage> createState() => _StartVisitPageState();
}

class _StartVisitPageState extends State<StartVisitPage> {
  bool gps = false;
  bool busy = false;
  String? error;

  Future<void> _start() async {
    setState(() { busy = true; error = null; });
    try {
      await AppScope.of(context).api.post('/api/visits', {
        'clientId': widget.clientId,
        'lat': 41.31108,
        'lng': 69.27973,
      });
      if (!mounted) return;
      context.go('/visits');
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vizitni boshlash')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SaCard(
              child: Column(children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('GPS aniqligi'),
                  subtitle: const Text('Nuqta radiusida ekanini tasdiqlang'),
                  value: gps,
                  onChanged: (v) => setState(() => gps = v),
                ),
                const Divider(),
                Row(children: const [
                  Icon(Icons.camera_alt_outlined, size: 18),
                  SizedBox(width: 8),
                  Expanded(child: Text('Selfie tasdiq serverda tekshiriladi')),
                ]),
              ]),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
            ],
            const Spacer(),
            SaPrimaryButton(label: 'Vizitni boshlash', loading: busy, onPressed: gps ? _start : null),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}
`;

/* ---------------- clients ---------------- */
const clients = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';
import '../main.dart';

class ClientsPage extends StatefulWidget {
  const ClientsPage({super.key});
  @override
  State<ClientsPage> createState() => _ClientsPageState();
}

class _ClientsPageState extends State<ClientsPage> {
  final _q = TextEditingController();
  List<Map<String, dynamic>> rows = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final res = await AppScope.of(context).api.get('/api/clients', query: {'q': _q.text});
      if (!mounted) return;
      setState(() {
        rows = ((res['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppBar2(
          title: 'Savdo nuqtalari',
          subtitle: '\${rows.length} ta mijoz',
          actions: [
            IconButton(onPressed: () => context.push('/clients/new'), icon: const Icon(Icons.add)),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _q,
            onSubmitted: (_) => _load(),
            decoration: InputDecoration(
              hintText: 'Nom yoki kod…',
              prefixIcon: const Icon(Icons.search, size: 18),
              suffixIcon: IconButton(onPressed: () { _q.clear(); _load(); }, icon: const Icon(Icons.close, size: 16)),
            ),
          ),
        ),
        Expanded(
          child: loading
              ? const Loader()
              : rows.isEmpty
                  ? const EmptyState(title: 'Mijoz topilmadi')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final c = rows[i];
                        final bal = (c['balance'] ?? 0) as int;
                        return SaCard(
                          onTap: () => context.push('/clients/\${c['id']}'),
                          padding: const EdgeInsets.all(12),
                          child: Row(children: [
                            CircleAvatar(radius: 18, child: Text('\${(c['name'] ?? '?').toString().substring(0, 1)}')),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(c['name']?.toString() ?? '—', style: SaType.body.copyWith(fontWeight: FontWeight.w600)),
                                Text('\${c['code']} · \${c['city']}', style: SaType.caption),
                              ]),
                            ),
                            Text(bal < 0 ? '−' : '', style: SaType.caption),
                            Text('\${bal.abs() ~/ 100}', style: TextStyle(fontSize: 11, color: bal < 0 ? Theme.of(context).colorScheme.error : null)),
                          ]),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
`;

const clientDetail = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class ClientDetailPage extends StatefulWidget {
  const ClientDetailPage({super.key, required this.clientId});
  final int clientId;
  @override
  State<ClientDetailPage> createState() => _ClientDetailPageState();
}

class _ClientDetailPageState extends State<ClientDetailPage> {
  Map<String, dynamic>? client;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/clients/\${widget.clientId}');
      if (!mounted) return;
      setState(() { client = Map<String, dynamic>.from(res['client']); loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = ((client?['orders'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
    return Scaffold(
      appBar: AppBar(title: Text(client?['name']?.toString() ?? 'Mijoz')),
      body: loading
          ? const Loader()
          : client == null
              ? const EmptyState(title: 'Mijoz topilmadi')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SaCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Joriy balans', style: SaType.caption),
                        Text('\${money((client!['balance'] ?? 0) as int)} so\\'m', style: SaType.title.copyWith(fontSize: 24)),
                        const SizedBox(height: 8),
                        Text('\${client!['code']} · \${client!['city']} · \${client!['tier']} toifa', style: SaType.caption),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: SaGhostButton(label: 'Vizit', onPressed: () => context.push('/visits/start/\${widget.clientId}'))),
                      const SizedBox(width: 8),
                      Expanded(child: SaPrimaryButton(label: 'Zakaz', onPressed: () => context.push('/clients'))),
                    ]),
                    const SizedBox(height: 16),
                    Text('Buyurtmalar', style: SaType.title.copyWith(fontSize: 15)),
                    const SizedBox(height: 8),
                    if (orders.isEmpty)
                      const EmptyState(title: 'Buyurtma yo\\'q')
                    else
                      ...orders.map((o) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: SaCard(
                              onTap: () => context.push('/orders/\${o['id']}'),
                              padding: const EdgeInsets.all(12),
                              child: Row(children: [
                                Expanded(child: Text(o['number']?.toString() ?? '', style: SaType.body)),
                                Text('\${money((o['total'] ?? 0) as int)}', style: SaType.mono),
                                const SizedBox(width: 8),
                                const Icon(Icons.chevron_right, size: 16),
                              ]),
                            ),
                          )),
                  ],
                ),
    );
  }
}
`;

const newClient = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class NewClientPage extends StatefulWidget {
  const NewClientPage({super.key});
  @override
  State<NewClientPage> createState() => _NewClientPageState();
}

class _NewClientPageState extends State<NewClientPage> {
  final _name = TextEditingController();
  final _inn = TextEditingController();
  final _city = TextEditingController(text: 'Toshkent');
  final _address = TextEditingController();
  String tier = 'B';
  bool busy = false;
  String? error;

  Future<void> _save() async {
    if (_name.text.trim().length < 3) {
      setState(() => error = 'Nom kamida 3 belgi');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      await AppScope.of(context).api.post('/api/clients', {
        'name': _name.text.trim(),
        'inn': _inn.text.trim().isEmpty ? null : _inn.text.trim(),
        'city': _city.text.trim(),
        'address': _address.text.trim(),
        'tier': tier,
        'lat': 41.31108,
        'lng': 69.27973,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mijoz qo\\'shildi')));
      context.pop();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yangi savdo nuqtasi')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nomi *')),
          const SizedBox(height: 12),
          TextField(controller: _inn, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'INN (9 raqam)')),
          const SizedBox(height: 12),
          TextField(controller: _city, decoration: const InputDecoration(labelText: 'Shahar *')),
          const SizedBox(height: 12),
          TextField(controller: _address, decoration: const InputDecoration(labelText: 'Manzil')),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'A', label: Text('A')),
              ButtonSegment(value: 'B', label: Text('B')),
              ButtonSegment(value: 'C', label: Text('C')),
            ],
            selected: {tier},
            onSelectionChanged: (v) => setState(() => tier = v.first),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
          ],
          const SizedBox(height: 20),
          SaPrimaryButton(label: 'Mijozni saqlash', loading: busy, onPressed: _save),
        ],
      ),
    );
  }
}
`;

/* ---------------- orders ---------------- */
const orders = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});
  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true;
  String? status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final res = await AppScope.of(context).api.get('/api/orders', query: {if (status != null) 'status': status!});
      if (!mounted) return;
      setState(() {
        rows = ((res['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppBar2(
          title: 'Mening buyurtmalarim',
          subtitle: '\${rows.length} ta',
          actions: [IconButton(onPressed: () => context.push('/orders/new'), icon: const Icon(Icons.add))],
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [null, 'new', 'confirmed', 'delivered', 'cancelled'].map((s) {
              final on = status == s;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(s == null ? 'Barchasi' : s),
                  selected: on,
                  onSelected: (_) { setState(() => status = s); _load(); },
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: loading
              ? const Loader()
              : rows.isEmpty
                  ? EmptyState(
                      title: 'Buyurtma yo\\'q',
                      action: SaPrimaryButton(label: 'Yangi zakaz', onPressed: () => context.push('/orders/new')),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final o = rows[i];
                          return SaCard(
                            onTap: () => context.push('/orders/\${o['id']}'),
                            padding: const EdgeInsets.all(12),
                            child: Row(children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(o['number']?.toString() ?? '', style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
                                  Text('\${o['items'] is List ? (o['items'] as List).length : 0} pozitsiya · \${o['status']}', style: SaType.caption),
                                ]),
                              ),
                              Text('\${money((o['total'] ?? 0) as int)}', style: SaType.mono),
                              const Icon(Icons.chevron_right, size: 16),
                            ]),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
`;

const orderDetail = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});
  final int orderId;
  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  Map<String, dynamic>? order;
  bool loading = true;
  bool cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/orders/\${widget.orderId}');
      if (!mounted) return;
      setState(() { order = Map<String, dynamic>.from(res['order']); loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _cancel() async {
    setState(() => cancelling = true);
    try {
      await AppScope.of(context).api.post('/api/orders/\${widget.orderId}/cancel', {});
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bekor qilindi')));
    } finally {
      if (mounted) setState(() => cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = ((order?['items'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
    return Scaffold(
      appBar: AppBar(title: Text(order?['number']?.toString() ?? 'Buyurtma')),
      body: loading
          ? const Loader()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SaCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(order?['status']?.toString() ?? '', style: SaType.caption),
                    const SizedBox(height: 4),
                    Text('\${money((order?['total'] ?? 0) as int)} so\\'m', style: SaType.title.copyWith(fontSize: 24)),
                    const SizedBox(height: 4),
                    Text('Skidka: \${order?['discountPct'] ?? 0}% · Bonus: \${order?['bonusQty'] ?? 0}', style: SaType.caption),
                  ]),
                ),
                const SizedBox(height: 12),
                Text('Tovarlar', style: SaType.title.copyWith(fontSize: 15)),
                const SizedBox(height: 8),
                ...items.map((it) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: SaCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(children: [
                          Expanded(child: Text((it['product']?['name'] ?? '—').toString(), style: SaType.body)),
                          Text('\${it['qty']} × \${money((it['price'] ?? 0) as int)}', style: SaType.mono),
                        ]),
                      ),
                    )),
                const SizedBox(height: 16),
                if (order?['status'] != 'cancelled')
                  SaGhostButton(label: cancelling ? 'Bekor qilinmoqda…' : 'Bekor qilish', onPressed: cancelling ? null : _cancel),
              ],
            ),
    );
  }
}
`;

const createOrder = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../main.dart';

class _Line {
  _Line(this.id, this.name, this.price, this.stock);
  final int id;
  final String name;
  final int price;
  final int stock;
  int qty = 0;
}

class CreateOrderPage extends StatefulWidget {
  const CreateOrderPage({super.key});
  @override
  State<CreateOrderPage> createState() => _CreateOrderPageState();
}

class _CreateOrderPageState extends State<CreateOrderPage> {
  List<_Line> products = [];
  List<Map<String, dynamic>> clients = [];
  int? clientId;
  double discount = 0;
  bool consignment = false;
  bool busy = false;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = AppScope.of(context).api;
    try {
      final p = await api.get('/api/products');
      final c = await api.get('/api/clients');
      if (!mounted) return;
      setState(() {
        products = ((p['rows'] ?? []) as List)
            .map((e) => Map<String, dynamic>.from(e))
            .map((m) => _Line(m['id'] as int, m['name'] as String, m['price'] as int, m['stock'] as int))
            .toList();
        clients = ((c['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        clientId = clients.isNotEmpty ? clients.first['id'] as int : null;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  int get subtotal => products.fold(0, (s, p) => s + p.qty * p.price);
  int get total => (subtotal * (1 - discount / 100)).round();

  Future<void> _submit() async {
    final lines = products.where((p) => p.qty > 0).toList();
    if (lines.isEmpty || clientId == null) return;
    setState(() => busy = true);
    try {
      await AppScope.of(context).api.post('/api/orders', {
        'clientId': clientId,
        'discountPct': discount,
        'consignment': consignment,
        'items': lines.map((l) => {'productId': l.id, 'qty': l.qty}).toList(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Buyurtma yuborildi')));
      context.go('/orders');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yangi buyurtma')),
      body: loading
          ? const Loader()
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      SaCard(
                        child: DropdownButtonFormField<int>(
                          value: clientId,
                          decoration: const InputDecoration(labelText: 'Mijoz'),
                          items: clients
                              .map((c) => DropdownMenuItem<int>(value: c['id'] as int, child: Text(c['name'].toString(), overflow: TextOverflow.ellipsis)))
                              .toList(),
                          onChanged: (v) => setState(() => clientId = v),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...products.map((p) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: SaCard(
                              padding: const EdgeInsets.all(12),
                              child: Row(children: [
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(p.name, style: SaType.body.copyWith(fontWeight: FontWeight.w600)),
                                    Text('Qoldiq: \${p.stock} · \${p.price ~/ 100} so\\'m', style: SaType.caption),
                                  ]),
                                ),
                                IconButton(
                                  onPressed: p.qty > 0 ? () => setState(() => p.qty--) : null,
                                  icon: const Icon(Icons.remove_circle_outline),
                                ),
                                Text('\${p.qty}', style: SaType.mono.copyWith(fontSize: 13)),
                                IconButton(
                                  onPressed: p.qty < p.stock ? () => setState(() => p.qty++) : null,
                                  icon: const Icon(Icons.add_circle_outline),
                                ),
                              ]),
                            ),
                          )),
                      Slider(
                        value: discount,
                        max: 15,
                        divisions: 15,
                        label: '\${discount.toInt()}%',
                        onChanged: (v) => setState(() => discount = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Konsignatsiya'),
                        value: consignment,
                        onChanged: (v) => setState(() => consignment = v),
                      ),
                    ],
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: SaPrimaryButton(
                      label: 'Yuborish · \${(total / 100).toStringAsFixed(0)} so\\'m',
                      loading: busy,
                      onPressed: total > 0 ? _submit : null,
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
`;

/* ---------------- analytics ---------------- */
const kpi = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class KpiPage extends StatefulWidget {
  const KpiPage({super.key});
  @override
  State<KpiPage> createState() => _KpiPageState();
}

class _KpiPageState extends State<KpiPage> {
  Map<String, dynamic> kpi = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/kpi/me');
      if (!mounted) return;
      setState(() { kpi = Map<String, dynamic>.from(res['kpi'] ?? {}); loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Loader();
    final pct = (kpi['pct'] ?? 0) as num;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        AppBar2(title: 'KPI', subtitle: 'Oylik hisob · \${kpi['month'] ?? ''}'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Column(children: [
              Row(children: [
                Text('\${pct.toInt()}%', style: SaType.display.copyWith(fontSize: 34)),
                const Spacer(),
                Text('\${kpi['elapsed']}/\${kpi['workDays']} kun', style: SaType.mono),
              ]),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: pct / 100, minHeight: 7, borderRadius: BorderRadius.circular(99)),
              const SizedBox(height: 10),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Reja \${money((kpi['plan'] ?? 0).toInt())}', style: SaType.caption),
                Text('Fakt \${money((kpi['fact'] ?? 0).toInt())}', style: SaType.caption),
              ]),
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            SizedBox(width: 165, child: Tile(value: money((kpi['dayBase'] ?? 0).toInt()), label: 'Kunlik baza')),
            SizedBox(width: 165, child: Tile(value: '\${kpi['premiumPct'] ?? 0}%', label: 'Premiya foizi')),
            SizedBox(width: 165, child: Tile(value: money((kpi['premium'] ?? 0).toInt()), label: 'Premiya summasi')),
            SizedBox(width: 165, child: Tile(value: money((kpi['monthRemaining'] ?? 0).toInt()), label: 'Oy oxirigacha')),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Bugun nima qilish kerak', style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text('1. Kunlik bazani yoping — \${money((kpi['dayBase'] ?? 0).toInt())} so\\'m.', style: SaType.caption),
              Text('2. Oylik rejagacha \${money((kpi['monthRemaining'] ?? 0).toInt())} so\\'m qoldi.', style: SaType.caption),
            ]),
          ),
        ),
      ],
    );
  }
}
`;

const bonuses = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';
import '../main.dart';

class BonusesPage extends StatefulWidget {
  const BonusesPage({super.key});
  @override
  State<BonusesPage> createState() => _BonusesPageState();
}

class _BonusesPageState extends State<BonusesPage> {
  Map<String, dynamic> kpi = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/kpi/me');
      if (!mounted) return;
      setState(() => kpi = Map<String, dynamic>.from(res['kpi'] ?? {}));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final premium = (kpi['premium'] ?? 0) as num;
    final pct = (kpi['pct'] ?? 0) as num;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const AppBar2(title: 'Mening bonuslarim', subtitle: 'Avtomatik hisoblanadi'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Hisoblangan bonus', style: SaType.caption),
              Text('\${premium.toInt()} so\\'m', style: SaType.title.copyWith(fontSize: 26)),
              const SizedBox(height: 6),
              Text('Premiya foizi: \${kpi['premiumPct'] ?? 0}% · reja \${pct.toInt()}%', style: SaType.caption),
            ]),
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text('Zinapoya', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
        ...[20, 30, 40].map((sum) {
          final reached = (kpi['fact'] ?? 0) >= sum * 100000000;
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SaCard(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Icon(reached ? Icons.check_circle : Icons.lock_outline, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text('\$sum mln so\\'m', style: SaType.body)),
                Text(reached ? 'bajarildi' : '\${sum == 20 ? 3 : sum == 30 ? 5 : 8}%', style: SaType.mono),
              ]),
            ),
          );
        }),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: SaSyncView(
            progress: 0.42,
            steps: ['Coca-Cola 5+1', 'Sneklar 10 → 2', '300k+ Nescafé', 'Tasdiq'],
            doneSteps: 2,
          ),
        ),
      ],
    );
  }
}
`;

const report = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/format.dart';
import '../../core/ui.dart';
import '../main.dart';

class ReportPage extends StatefulWidget {
  const ReportPage({super.key});
  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/orders');
      if (!mounted) return;
      setState(() {
        rows = ((res['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = rows.fold<int>(0, (s, o) => s + ((o['total'] ?? 0) as int));
    final delivered = rows.where((o) => o['status'] == 'delivered').length;
    return loading
        ? const Loader()
        : ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              AppBar2(title: 'Hisobotlar', subtitle: '\${rows.length} buyurtma'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(children: [
                  Expanded(child: Tile(value: money(total), label: 'Jami savdo')),
                  const SizedBox(width: 8),
                  Expanded(child: Tile(value: '\${rows.length}', label: 'Buyurtma')),
                  const SizedBox(width: 8),
                  Expanded(child: Tile(value: '\${delivered}', label: 'Yetkazildi')),
                ]),
              ),
              const Padding(
                padding: EdgeInsets.all(16),
                child: SaCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Kunlik savdo', style: TextStyle(fontWeight: FontWeight.w700)),
                    SizedBox(height: 10),
                    SizedBox(height: 90, child: _Bars()),
                  ]),
                ),
              ),
            ],
          );
  }
}

class _Bars extends StatelessWidget {
  const _Bars();
  @override
  Widget build(BuildContext context) {
    const values = [0.42, 0.58, 0.47, 0.72, 0.63, 0.88, 0.69];
    final scheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: values.map((v) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: FractionallySizedBox(
              heightFactor: v,
              alignment: Alignment.bottomCenter,
              child: Container(decoration: BoxDecoration(color: scheme.primary.withOpacity(.75), borderRadius: BorderRadius.circular(4))),
            ),
          ),
        );
      }).toList(),
    );
  }
}
`;

const mapPage = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';

class MapPage extends StatelessWidget {
  const MapPage({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        const AppBar2(title: 'Xarita', subtitle: 'Bugungi marshrut · 21 km'),
        Expanded(
          child: Stack(
            children: [
              Container(color: scheme.surfaceVariant),
              CustomPaint(painter: _GridPainter(scheme.outlineVariant, scheme.surface), size: Size.infinite),
              const Positioned(left: 40, top: 60, child: _Pin(label: '1')),
              const Positioned(right: 60, top: 120, child: _Pin(label: '2', active: true)),
              const Positioned(left: 80, bottom: 160, child: _Pin(label: '3')),
              Positioned(
                left: 16, right: 16, bottom: 16,
                child: SaCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('IP Karimov Store', style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
                    Text('Faol vizit · 1.2 km · 4 daqiqa', style: SaType.caption),
                    const SizedBox(height: 8),
                    SaPrimaryButton(label: 'Navigatsiya', onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Navigator ochildi')))),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.label, this.active = false});
  final String label;
  final bool active;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 30, height: 30,
      decoration: BoxDecoration(
        color: active ? scheme.primary : scheme.surface,
        shape: BoxShape.circle,
        border: Border.all(color: scheme.primary),
      ),
      child: Center(child: Text(label, style: TextStyle(color: active ? Colors.white : scheme.onSurface, fontSize: 11, fontWeight: FontWeight.w700))),
    );
  }
}

class _GridPainter extends CustomPainter {
  _GridPainter(this.line, this.background);
  final Color line, background;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = line..strokeWidth = 2;
    for (var i = 1; i < 6; i++) {
      canvas.drawLine(Offset(0, size.height / 6 * i), Offset(size.width, size.height / 6 * i), p);
      canvas.drawLine(Offset(size.width / 6 * i, 0), Offset(size.width / 6 * i, size.height), p);
    }
    final route = Paint()..color = line..strokeWidth = 3..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(size.width * .2, size.height * .85)
      ..cubicTo(size.width * .35, size.height * .5, size.width * .55, size.height * .7, size.width * .75, size.height * .35);
    canvas.drawPath(path, route);
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.line != line;
}
`;

/* ---------------- secondary ---------------- */
const tabel = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';

class TabelPage extends StatefulWidget {
  const TabelPage({super.key});
  @override
  State<TabelPage> createState() => _TabelPageState();
}

class _TabelPageState extends State<TabelPage> {
  static const _status = ['1', '0.5', '0', 'В', 'О', 'Б', 'К'];
  int filter = -1;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const AppBar2(title: 'Tabel', subtitle: 'Iyul 2026 · Aziz Qodirov'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 6,
            children: List.generate(_status.length, (i) {
              final on = filter == i;
              return ChoiceChip(
                label: Text(_status[i]),
                selected: on,
                onSelected: (_) => setState(() => filter = on ? -1 : i),
              );
            }),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Wrap(
              spacing: 6, runSpacing: 6,
              children: List.generate(31, (i) {
                final day = i + 1;
                final weekend = day % 7 == 6;
                final code = weekend ? 'В' : day % 11 == 0 ? 'Б' : day % 8 == 0 ? '0.5' : '1';
                if (filter >= 0 && _status[filter] != code) {
                  return Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: scheme.outlineVariant)),
                    child: Center(child: Text('\$day', style: SaType.mono.copyWith(fontSize: 9, color: scheme.outline))),
                  );
                }
                final tone = code == '1' ? SaColors.expeditor : code == '0.5' ? SaColors.supervisor : scheme.error;
                return Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(color: tone.withOpacity(.14), borderRadius: BorderRadius.circular(8)),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('\$day', style: SaType.mono.copyWith(fontSize: 8)),
                    Text(code, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: tone)),
                  ]),
                );
              }),
            ),
          ),
        ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: SaCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Status kodlari', style: TextStyle(fontWeight: FontWeight.w700)),
                    SizedBox(height: 6),
                    Text('1 — ishladi · 0.5 — yarim kun · 0 — yo\\'q', style: TextStyle(fontSize: 11)),
                    Text('В — dam · О — ta\\'til · Б — kasallik · К — safar', style: TextStyle(fontSize: 11)),
                  ]),
                ),
              ),
      ],
    );
  }
}
`;

const warehouse = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';
import '../main.dart';

class WarehousePage extends StatefulWidget {
  const WarehousePage({super.key});
  @override
  State<WarehousePage> createState() => _WarehousePageState();
}

class _WarehousePageState extends State<WarehousePage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await AppScope.of(context).api.get('/api/products');
      if (!mounted) return;
      setState(() {
        rows = ((res['rows'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const AppBar2(title: 'Ombor qoldiqlari', subtitle: 'Markaziy ombor'),
        Expanded(
          child: loading
              ? const Loader()
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final p = rows[i];
                    final stock = (p['stock'] ?? 0) as int;
                    return SaCard(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        const Icon(Icons.inventory_2_outlined, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(p['name']?.toString() ?? '', style: SaType.body.copyWith(fontWeight: FontWeight.w600)),
                            Text('\${p['category']} · \${p['sku']}', style: SaType.caption),
                          ]),
                        ),
                        Text('\$stock dona', style: SaType.mono.copyWith(color: stock < 15 ? Theme.of(context).colorScheme.error : null)),
                      ]),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
`;

const tasks = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';

class TasksPage extends StatefulWidget {
  const TasksPage({super.key});
  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  final _title = TextEditingController();
  final List<(String, bool)> items = [
    ('Navruz Shop — foto hisobot', false),
    ('Lalaku qarzi bo\\'yicha qo\\'ng\\'iroq', true),
    ('Oylik KPI baholash', false),
  ];

  void _add() {
    if (_title.text.trim().isEmpty) return;
    setState(() {
      items.insert(0, (_title.text.trim(), false));
      _title.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final open = items.where((e) => !e.\$2).length;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        AppBar2(title: 'Vazifalar', subtitle: '\$open ta ochiq'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Expanded(child: TextField(controller: _title, decoration: const InputDecoration(hintText: 'Yangi vazifa…'), onSubmitted: (_) => _add())),
            const SizedBox(width: 8),
            IconButton.filled(onPressed: _add, icon: const Icon(Icons.add)),
          ]),
        ),
        const SizedBox(height: 8),
        ...items.asMap().entries.map((e) {
          final t = e.value;
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SaCard(
              onTap: () => setState(() => items[e.key] = (t.\$1, !t.\$2)),
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Icon(t.\$2 ? Icons.check_circle : Icons.radio_button_unchecked, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text(t.\$1, style: SaType.body.copyWith(decoration: t.\$2 ? TextDecoration.lineThrough : null))),
              ]),
            ),
          );
        }),
      ],
    );
  }
}
`;

const notifications = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final items = const [
    ('Yangi bonus zinapoyasi', '30 mln so\\'mga 5% bonus qo\\'shildi', '2 daq'),
    ('Sinxronlash yakunlandi', '12 buyurtma, 8 foto yuborildi', '14 daq'),
    ('Supervayzer izohi', 'Navruz Shop vizitida foto qo\\'shing', '1 soat'),
    ('Yangi marshrut tayyor', 'Ertaga 11 vizit rejalashtirildi', '3 soat'),
  ];
  final read = <int>{};

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppBar2(
          title: 'Bildirishnomalar',
          subtitle: '\${items.length - read.length} ta o\\'qilmagan',
          actions: [TextButton(onPressed: () => setState(() => read.addAll(List.generate(items.length, (i) => i))), child: const Text('O\\'qildi'))],
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = items[i];
              final isRead = read.contains(i);
              return SaCard(
                onTap: () => setState(() => read.add(i)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(isRead ? Icons.notifications_none : Icons.notifications_active, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(n.\$1, style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
                      Text(n.\$2, style: SaType.caption),
                      Text(n.\$3, style: SaType.mono.copyWith(fontSize: 9)),
                    ]),
                  ),
                ]),
              );
            },
          ),
        ),
      ],
    );
  }
}
`;

const profile = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/ui.dart';
import '../main.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool dark = false;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        AppBar2(title: 'Profil', subtitle: scope.session.role ?? ''),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Row(children: [
              const CircleAvatar(radius: 24, child: Icon(Icons.person_outline)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(scope.session.name, style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
                  Text(scope.session.role ?? '', style: SaType.caption),
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaCard(
            child: Column(children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tungi rejim'),
                value: dark,
                onChanged: (v) => setState(() => dark = v),
              ),
              const Divider(),
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.sync), title: const Text('Sinxronlash'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/sync')),
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.calendar_month_outlined), title: const Text('Tabel'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/tabel')),
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.warehouse_outlined), title: const Text('Ombor'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/warehouse')),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SaGhostButton(label: 'Chiqish', onPressed: () { scope.session.logout(); context.go('/login'); }),
        ),
      ],
    );
  }
}
`;

const menu = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sales_arena/design_system/design_system.dart';

class MenuPage extends StatelessWidget {
  const MenuPage({super.key});

  static const _items = <(String, IconData, String)>[
    ('Bosh sahifa', Icons.home_outlined, '/home'),
    ('Vizitlar', Icons.place_outlined, '/visits'),
    ('Savdo nuqtalari', Icons.store_outlined, '/clients'),
    ('Yangi savdo nuqtasi', Icons.add_business_outlined, '/clients/new'),
    ('Mening buyurtmalarim', Icons.receipt_long_outlined, '/orders'),
    ('Yangi buyurtma', Icons.add_shopping_cart, '/orders/new'),
    ('KPI', Icons.insights_outlined, '/kpi'),
    ('Bonuslar', Icons.card_giftcard, '/bonuses'),
    ('Hisobotlar', Icons.bar_chart, '/report'),
    ('Xarita', Icons.map_outlined, '/map'),
    ('Tabel', Icons.calendar_month_outlined, '/tabel'),
    ('Ombor qoldiqlari', Icons.warehouse_outlined, '/warehouse'),
    ('Vazifalar', Icons.checklist, '/tasks'),
    ('Bildirishnomalar', Icons.notifications_none, '/notifications'),
    ('Sinxronlash', Icons.sync, '/sync'),
    ('Profil', Icons.settings_outlined, '/profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Menyu', style: SaType.title.copyWith(fontSize: 20)),
        const SizedBox(height: 10),
        ..._items.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: SaCard(
                onTap: () => context.push(e.\$3),
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Icon(e.\$2, size: 18),
                  const SizedBox(width: 10),
                  Expanded(child: Text(e.\$1, style: SaType.body)),
                  const Icon(Icons.chevron_right, size: 16),
                ]),
              ),
            )),
      ],
    );
  }
}
`;

const sync = `import 'package:flutter/material.dart';
import 'package:sales_arena/design_system/design_system.dart';
import '../../core/sync.dart';
import '../../core/ui.dart';
import '../main.dart';

class SyncPage extends StatefulWidget {
  const SyncPage({super.key});
  @override
  State<SyncPage> createState() => _SyncPageState();
}

class _SyncPageState extends State<SyncPage> {
  double progress = 0;
  int done = 0;
  SyncResult? result;
  String? error;
  String? running;
  final steps = const ['Mijozlar', 'Katalog', 'Narxlar', 'Qoldiq', 'Buyurtmalar', 'Foto', 'Tayyor'];

  Future<void> _run(SyncKind kind) async {
    setState(() { running = kind.name; progress = 0; done = 0; error = null; result = null; });
    for (var i = 1; i <= steps.length; i++) {
      await Future.delayed(const Duration(milliseconds: 260));
      if (!mounted) return;
      setState(() { done = i; progress = i / steps.length; });
    }
    try {
      final sync = SyncService(AppScope.of(context).api);
      final res = await sync.run(kind);
      if (!mounted) return;
      setState(() { result = res; running = null; });
    } catch (e) {
      if (!mounted) return;
      setState(() { error = e.toString(); running = null; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Sinxronlash', style: SaType.title.copyWith(fontSize: 20)),
        Text('Uch xil rejim — kod o\\'zgarmaydi', style: SaType.caption),
        const SizedBox(height: 16),
        SaCard(
          child: SaSyncView(progress: progress, steps: steps, doneSteps: done, done: result != null),
        ),
        const SizedBox(height: 14),
        SaPrimaryButton(label: 'To\\'liq sinxron', loading: running == 'full', onPressed: running == null ? () => _run(SyncKind.full) : null),
        const SizedBox(height: 8),
        SaGhostButton(label: 'Oddiy sinxron (diff)', onPressed: running == null ? () => _run(SyncKind.quick) : null),
        const SizedBox(height: 8),
        SaGhostButton(label: 'Rol kartasi', onPressed: running == null ? () => _run(SyncKind.identity) : null),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: TextStyle(color: scheme.error, fontSize: 12)),
        ],
        if (result != null) ...[
          const SizedBox(height: 12),
          SaCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(result!.label, style: SaType.body.copyWith(fontWeight: FontWeight.w700)),
              Text('Yuborildi: \${result!.sent} · Qabul qilindi: \${result!.received}', style: SaType.caption),
              Text('\${result!.at}', style: SaType.mono.copyWith(fontSize: 9)),
            ]),
          ),
        ],
      ],
    );
  }
}
`;

/* ------------------------------------------------------------------ */
/*  Assemble the project                                              */
/* ------------------------------------------------------------------ */
const stack = await import("../.gen/flutter-module.cjs");
const pick = (path) => [...stack.STACK_FILES, ...stack.STACK_EXTRA, ...stack.STACK_TESTS].find((f) => f.path === path)?.code ?? "";

const files = {
  "pubspec.yaml": pubspec,
  "analysis_options.yaml": analysis,
  "README.md": `# Sales Arena — mobil ilova

To'liq Flutter ilova: 4 rol, 20+ ekran, offline-first sinxron, Fastify/Prisma backend bilan bog'langan.

## Ishga tushirish

    flutter pub get
    flutter run --dart-define=API_URL=http://10.0.2.2:4000

API manzili:
- Android emulyator: http://10.0.2.2:4000
- iOS simulator:      http://localhost:4000
- Haqiqiy qurilma:    http://<kompyuter-IP>:4000

## Demo

| Rol | Login | Parol | PIN |
|---|---|---|---|
| Agent | aziz.qodirov | Arena#2026 | 1234 |
| Ekspeditor | bobur.rahimov | Arena#2026 | 1234 |
| Supervayzer | kamol.aliyev | Arena#2026 | 1234 |
| Kassir | dilnoza.karimova | Arena#2026 | 1234 |

## Tuzilma

    lib/
      main.dart              # kirish, tema, DI
      app/router.dart        # go_router: 20+ marshrut
      core/                  # api, models, session, sync, format, ui
      design_system/         # token, tema, vidgetlar, katalog
      features/              # auth, home, visits, clients, orders, kpi,
                             # report, map, tabel, warehouse, tasks,
                             # notifications, profile, menu, sync
    assets/design/catalog.json

## Build

    flutter build apk --release --dart-define=API_URL=https://api.salesarena.uz
    flutter build ios --release --dart-define=API_URL=https://api.salesarena.uz

## Backend

"backend/" papkasi alohida: cd backend && npm install && npm run setup && npm run dev
`,
  "assets/design/catalog.json": catalogJson,
  "lib/main.dart": mainDart,
  "lib/app/router.dart": router,
  "lib/core/session.dart": session,
  "lib/core/format.dart": format,
  "lib/core/ui.dart": ui,
  "lib/core/sync.dart": pick("mobile/lib/core/sync/sync_service.dart").replace("import '../api/api_client.dart';", "import 'api/api_client.dart';"),
  "lib/core/api/api_client.dart": pick("mobile/lib/core/api/api_client.dart"),
  "lib/core/models/models.dart": pick("mobile/lib/core/models/models.dart"),
  "lib/features/auth/splash_page.dart": splash,
  "lib/features/auth/login_page.dart": login,
  "lib/features/auth/pin_page.dart": pin,
  "lib/features/shell/shell_page.dart": shell,
  "lib/features/home/home_page.dart": home,
  "lib/features/visits/visits_page.dart": visits,
  "lib/features/visits/start_visit_page.dart": startVisit,
  "lib/features/clients/clients_page.dart": clients,
  "lib/features/clients/client_detail_page.dart": clientDetail,
  "lib/features/clients/new_client_page.dart": newClient,
  "lib/features/orders/orders_page.dart": orders,
  "lib/features/orders/order_detail_page.dart": orderDetail,
  "lib/features/orders/create_order_page.dart": createOrder,
  "lib/features/kpi/kpi_page.dart": kpi,
  "lib/features/kpi/bonuses_page.dart": bonuses,
  "lib/features/report/report_page.dart": report,
  "lib/features/map/map_page.dart": mapPage,
  "lib/features/tabel/tabel_page.dart": tabel,
  "lib/features/warehouse/warehouse_page.dart": warehouse,
  "lib/features/tasks/tasks_page.dart": tasks,
  "lib/features/notifications/notifications_page.dart": notifications,
  "lib/features/profile/profile_page.dart": profile,
  "lib/features/menu/menu_page.dart": menu,
  "lib/features/sync/sync_page.dart": sync,
};

/* design_system files (paths already start with mobile/lib) */
for (const f of FLUTTER_FILES) {
  const rel = f.path.replace(/^mobile\//, "");
  files[rel] = f.code;
}

/* backend stays in a separate folder for one-command startup */
for (const f of [...stack.STACK_FILES, ...stack.STACK_EXTRA, ...stack.STACK_TESTS]) {
  if (f.path.startsWith("backend/")) files[f.path] = f.code;
}

/* --- import path fixes: features/* -> ../../main.dart --- */
for (const [path, code] of Object.entries(files)) {
  if (path.startsWith('lib/features/')) {
    files[path] = code
      .replaceAll("import '../main.dart';", "import '../../main.dart';")
      .replaceAll("import '../../core/ui.dart';", "import '../../core/ui.dart';");
  }
}

const entries = Object.entries(files).map(([path, code]) => textFile(path, code));
const bytes = buildZipBytes(entries);
const outDir = join(process.cwd(), "public", "downloads");
mkdirSync(outDir, { recursive: true });
const name = `sales-arena-app-v${V}.zip`;
writeFileSync(join(outDir, name), bytes);

/* manifest for the site */
const byDir = {};
for (const path of Object.keys(files).sort()) {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
  (byDir[dir] ??= []).push(path);
}
const manifest = `// Auto-generated by scripts/flutter-app-gen.mjs — do not edit by hand.
export const APP_VERSION = ${JSON.stringify(V)};
export const APP_ZIP = ${JSON.stringify(name)};
export const APP_BYTES = ${bytes.length};
export const APP_FILES = ${JSON.stringify(Object.keys(files).sort(), null, 2)};
export const APP_TREE = ${JSON.stringify(byDir, null, 2)};
export const APP_SCREENS = ${JSON.stringify([
  ["Splash", "lib/features/auth/splash_page.dart", "shared"],
  ["Login", "lib/features/auth/login_page.dart", "shared"],
  ["PIN", "lib/features/auth/pin_page.dart", "shared"],
  ["Shell (drawer + tab)", "lib/features/shell/shell_page.dart", "shared"],
  ["Bosh sahifa", "lib/features/home/home_page.dart", "agent"],
  ["Vizitlar", "lib/features/visits/visits_page.dart", "agent"],
  ["Vizitni boshlash", "lib/features/visits/start_visit_page.dart", "agent"],
  ["Mijozlar", "lib/features/clients/clients_page.dart", "agent"],
  ["Mijoz kartasi", "lib/features/clients/client_detail_page.dart", "agent"],
  ["Yangi nuqta", "lib/features/clients/new_client_page.dart", "agent"],
  ["Buyurtmalar", "lib/features/orders/orders_page.dart", "agent"],
  ["Buyurtma detali", "lib/features/orders/order_detail_page.dart", "agent"],
  ["Yangi buyurtma", "lib/features/orders/create_order_page.dart", "agent"],
  ["KPI", "lib/features/kpi/kpi_page.dart", "analitika"],
  ["Bonuslar", "lib/features/kpi/bonuses_page.dart", "analitika"],
  ["Hisobotlar", "lib/features/report/report_page.dart", "analitika"],
  ["Xarita", "lib/features/map/map_page.dart", "operatsiya"],
  ["Tabel", "lib/features/tabel/tabel_page.dart", "analitika"],
  ["Ombor", "lib/features/warehouse/warehouse_page.dart", "operatsiya"],
  ["Vazifalar", "lib/features/tasks/tasks_page.dart", "shared"],
  ["Bildirishnomalar", "lib/features/notifications/notifications_page.dart", "shared"],
  ["Profil", "lib/features/profile/profile_page.dart", "shared"],
  ["Menyu", "lib/features/menu/menu_page.dart", "shared"],
  ["Sinxronlash", "lib/features/sync/sync_page.dart", "shared"],
], null, 2)};
`;
writeFileSync(join(process.cwd(), "src", "data", "appManifest.ts"), manifest);

console.log("APP ZIP:", name, bytes.length, "bytes ·", Object.keys(files).length, "fayl");

import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/orders_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/agent/outlet_radius.dart';
import '../../../core/config/agent_action_guards.dart';
import '../../../core/config/gps_config_policy.dart';
import '../config/agent_config_enforcement.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/mobile_order_guards.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/database/app_database.dart';
import '../visits/visit_stats_helper.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/auth_provider.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../shell/agent_app_bar.dart';
import '../shell/agent_drawer.dart';
import '../clients/client_photo_report_flow.dart';
import '../../../core/api/mobile_api.dart';
import 'order_create_models.dart';
import 'order_create_sheets.dart';
import 'order_draft_model.dart';
import 'order_draft_provider.dart';
import 'order_draft_ui.dart';
import 'bonus_stock_utils.dart';
import '../warehouse/warehouse_stock_providers.dart';
import 'held_orders_provider.dart';
import 'orders_providers.dart';
import 'van_selling_payment_sheet.dart';

/// Yangi zakaz — referens ketma-ketlik:
/// mijoz → asosiy ma'lumotlar (sheet) → kategoriyalar → mahsulotlar → bonus → yuborish.
class CreateOrderScreen extends ConsumerStatefulWidget {
  final int? initialClientId;
  final Map<String, dynamic>? initialClient;
  final int? heldOrderId;

  const CreateOrderScreen({
    super.key,
    this.initialClientId,
    this.initialClient,
    this.heldOrderId,
  });

  @override
  ConsumerState<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

enum _CreateStep { pickClient, categories, categoryProducts }

class _CreateOrderScreenState extends ConsumerState<CreateOrderScreen> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  Map<String, dynamic>? _selectedClient;
  int? _warehouseId;
  int? _defaultWarehouseId;
  String _priceType = '';
  String _comment = '';
  bool _isConsignment = false;
  String _consignmentDueDate = '';
  String _shipmentDate = '';
  List<Map<String, dynamic>> _warehouses = [];
  List<String> _priceTypes = const ['default'];

  List<Map<String, dynamic>> _allProducts = [];
  Map<int, Map<String, dynamic>> _productById = {};
  List<OrderCategoryGroup> _categories = [];
  OrderCategoryGroup? _openCategory;

  final Map<int, double> _stockAvailable = {};
  final Map<int, double> _unitPrices = {};
  final Map<int, double> _quantities = {};

  _CreateStep _step = _CreateStep.pickClient;
  final bool _loading = false;
  bool _loadingCatalog = false;
  String? _loadError;
  bool _submitting = false;
  int _clientCount = 0;
  String _productSearch = '';
  bool _setupShown = false;
  bool _bootstrappingInitialClient = false;
  int? _heldOrderId;
  OrderClientFinance? _clientFinance;
  bool _hasUnlinkedPhotoToday = false;
  Map<int, double>? _pendingDraftRestore;

  OrderCreateContext? _createContextCache;
  int? _createContextCacheClientId;
  int? _createContextCacheWarehouseId;
  DateTime? _createContextCacheAt;
  DateTime? _configRefreshedAt;
  DateTime? _photoStatusFetchedAt;
  DateTime? _mandatoryChecksPassedAt;

  final _productSearchCtrl = TextEditingController();
  Timer? _productSearchDebounce;

  static const _createContextCacheTtl = Duration(minutes: 2);
  static const _photoStatusCacheTtl = Duration(minutes: 2);
  static const _configRefreshTtl = Duration(minutes: 5);
  static const _mandatoryChecksCacheTtl = Duration(minutes: 10);

  @override
  void dispose() {
    _productSearchDebounce?.cancel();
    _productSearchCtrl.dispose();
    super.dispose();
  }

  void _invalidateCreateContextCache() {
    _createContextCache = null;
    _createContextCacheClientId = null;
    _createContextCacheWarehouseId = null;
    _createContextCacheAt = null;
  }

  Future<OrderCreateContext?> _getCreateContext({int? warehouseId, bool forceRefresh = false}) async {
    final clientId = _effectiveClientId;
    if (clientId <= 0) return null;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return null;

    final wh = warehouseId ?? _warehouseId;
    final now = DateTime.now();
    if (!forceRefresh &&
        _createContextCache != null &&
        _createContextCacheClientId == clientId &&
        _createContextCacheWarehouseId == wh &&
        _createContextCacheAt != null &&
        now.difference(_createContextCacheAt!) < _createContextCacheTtl) {
      return _createContextCache;
    }

    final ctx = await ref.read(ordersApiProvider).getCreateContext(
          slug,
          clientId: clientId,
          warehouseId: wh,
        );
    _createContextCache = ctx;
    _createContextCacheClientId = clientId;
    _createContextCacheWarehouseId = wh;
    _createContextCacheAt = now;
    return ctx;
  }

  Future<void> _refreshAgentConfigIfStale() async {
    final now = DateTime.now();
    if (_configRefreshedAt != null && now.difference(_configRefreshedAt!) < _configRefreshTtl) {
      return;
    }
    await ref.read(authStateProvider.notifier).refreshMobileConfig();
    _configRefreshedAt = now;
    if (mounted) setState(() {});
  }

  void _onProductSearchChanged(String value) {
    _productSearchDebounce?.cancel();
    _productSearchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      setState(() => _productSearch = value.trim().toLowerCase());
    });
  }

  @override
  void initState() {
    super.initState();
    _heldOrderId = widget.heldOrderId;
    if (_heldOrderId != null && _heldOrderId! > 0) {
      _bootstrappingInitialClient = true;
      _bootstrapHeldOrder().then((_) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _refreshAgentConfigIfStale();
        });
      });
    } else {
      final initialId = widget.initialClientId;
      if (initialId != null && initialId > 0) {
        _bootstrappingInitialClient = true;
      }
      _bootstrap().then((_) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _refreshAgentConfigIfStale();
        });
      });
    }
  }

  Future<void> _bootstrapHeldOrder() async {
    ref.read(heldOrderSchedulerProvider);
    final held = await ref.read(heldOrderRepositoryProvider).getById(_heldOrderId!);
    if (held == null) {
      if (mounted) setState(() => _bootstrappingInitialClient = false);
      return;
    }
    await _waitAuthReady();
    if (!mounted) return;
    var client = _normalizeClientRow(await AppDatabase().getClientById(held.clientId), expectedId: held.clientId);
    client ??= {
      'id': held.clientId,
      'name': held.clientName.isNotEmpty ? held.clientName : 'Клиент #${held.clientId}',
    };
    setState(() {
      _selectedClient = client;
      _warehouseId = held.warehouseId;
      _priceType = held.priceType;
      _comment = held.comment;
      _isConsignment = held.isConsignment;
      _consignmentDueDate = held.consignmentDueDate ?? '';
      _shipmentDate = held.shipmentDate ?? '';
      _setupShown = true;
      _step = _CreateStep.categories;
    });
    _quantities
      ..clear()
      ..addAll({for (final i in held.items) i.productId: i.qty});
    await _loadCatalog(clearCart: false);
    if (mounted) setState(() => _bootstrappingInitialClient = false);
  }

  Future<void> _cancelHeldOrder() async {
    if (_heldOrderId == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Отменить заказ?'),
        content: const Text('Заказ будет удалён из очереди отправки.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Нет')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Да, отменить')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await ref.read(heldOrderSchedulerProvider).cancelHeldOrder(_heldOrderId!);
    _heldOrderId = null;
    if (!mounted) return;
    _toast('Заказ отменён', accent: AppColors.warning);
    context.go('/orders');
  }


  void _toast(String message, {Color accent = AppColors.error}) {
    if (!mounted) return;
    showAgentToast(context, message, accentColor: accent);
  }

  Future<void> _bootstrap() async {
    await _initClients();
    final id = widget.initialClientId;
    if (id == null || id <= 0) return;

    await _waitAuthReady();
    if (!mounted) return;

    // Vizit / mijoz detali orqali kelgan — mijozni qayta tanlatmaymiz.
    var client = _normalizeClientRow(widget.initialClient, expectedId: id);
    client ??= _normalizeClientRow(await AppDatabase().getClientById(id), expectedId: id);
    client ??= _normalizeClientRow(await _fetchClientFromServer(id), expectedId: id);

    // Minimal fallback: ID ma'lum — tanlash ekranini o'tkazib yuboramiz.
    client ??= {
      'id': id,
      'name': 'Клиент #$id',
    };

    if (client['name'] != 'Клиент #$id') {
      await AppDatabase().upsertClients([client]);
    }

    if (!mounted) return;
    setState(() => _selectedClient = client);

    final draft = await ref.read(orderDraftRepositoryProvider).loadForClient(id);
    if (!mounted) return;
    if (draft != null && draft.hasItems) {
      setState(() {
        _warehouseId = draft.warehouseId;
        _priceType = draft.priceType;
        _comment = draft.comment;
        _isConsignment = draft.isConsignment;
        _consignmentDueDate = draft.consignmentDueDate;
        _setupShown = true;
        _pendingDraftRestore = Map<int, double>.from(draft.quantities);
      });
      await _loadCatalog(clearCart: false);
    } else {
      await _openSetupSheet(fromInitialClient: true);
    }
    if (mounted) setState(() => _bootstrappingInitialClient = false);
  }

  Future<void> _waitAuthReady() async {
    for (var i = 0; i < 150; i++) {
      if (!mounted) return;
      final status = ref.read(authStateProvider).status;
      if (status == AuthStatus.ready) return;
      if (status == AuthStatus.error) return;
      await Future.delayed(const Duration(milliseconds: 100));
    }
  }

  Map<String, dynamic>? _normalizeClientRow(Map<String, dynamic>? raw, {required int expectedId}) {
    if (raw == null) return null;
    final rawId = raw['id'];
    final id = rawId is num
        ? rawId.toInt()
        : int.tryParse(rawId?.toString() ?? '');
    if (id != expectedId) return null;
    // SQLite / extra dan kelgan qator — id har doim int bo‘lsin.
    if (rawId is! int) {
      return {...raw, 'id': id};
    }
    return raw;
  }

  Future<Map<String, dynamic>?> _fetchClientFromServer(int clientId) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return null;
    try {
      final ctx = await ref.read(ordersApiProvider).getCreateContext(
            slug,
            clientId: clientId,
          );
      for (final c in ctx.clients) {
        final rawId = c['id'];
        final id = rawId is num
            ? rawId.toInt()
            : int.tryParse(rawId?.toString() ?? '');
        if (id == clientId) return _normalizeClientRow(c, expectedId: clientId);
      }
    } catch (_) {}
    return null;
  }

  int get _selectedClientId {
    final id = _selectedClient?['id'];
    if (id is int) return id;
    if (id is num) return id.toInt();
    return int.tryParse(id?.toString() ?? '') ?? 0;
  }

  /// Route/query dan kelgan mijoz — tanlangan mijoz hali yuklanmagan bo‘lsa ham.
  int get _effectiveClientId {
    final selected = _selectedClientId;
    if (selected > 0) return selected;
    final initial = widget.initialClientId;
    if (initial != null && initial > 0) return initial;
    return 0;
  }

  Future<void> _ensureSelectedClientFromRoute() async {
    final id = _effectiveClientId;
    if (id <= 0) return;
    if (_selectedClient != null && _selectedClientId == id) return;

    var client = _normalizeClientRow(widget.initialClient, expectedId: id);
    client ??= _normalizeClientRow(await AppDatabase().getClientById(id), expectedId: id);
    client ??= _normalizeClientRow(await _fetchClientFromServer(id), expectedId: id);
    client ??= {
      'id': id,
      'name': widget.initialClient?['name']?.toString() ??
          _selectedClient?['name']?.toString() ??
          'Клиент #$id',
    };

    if (!mounted) return;
    setState(() => _selectedClient = client);
  }

  double get _total {
    var t = 0.0;
    for (final e in _quantities.entries) {
      if (e.value > 0) t += e.value * (_unitPrices[e.key] ?? 0);
    }
    return t;
  }

  int get _cartQty => qtyInCart(_quantities);

  bool get _hasUnsavedChanges =>
      _step != _CreateStep.pickClient && _warehouseId != null && _cartQty > 0;

  String _warehouseName() {
    for (final w in _warehouses) {
      final id = (w['id'] as num?)?.toInt();
      if (id == _warehouseId) return w['name']?.toString() ?? '';
    }
    return '';
  }

  double _estimateVolume() {
    var v = 0.0;
    for (final e in _quantities.entries) {
      if (e.value <= 0) continue;
      final p = _productById[e.key];
      if (p == null) continue;
      final cat = p['category'];
      final vol = parseOrderNum(
        p['volume_m3'] ?? (cat is Map ? cat['volume_m3'] : null),
      );
      v += e.value * vol;
    }
    return v;
  }

  Future<bool> _saveDraft({bool popAfter = false}) async {
    if (_selectedClientId <= 0 || _warehouseId == null || _cartQty == 0) {
      _toast('Kamida bitta mahsulot tanlang', accent: AppColors.warning);
      return false;
    }
    final now = DateTime.now();
    final draft = OrderDraft(
      clientId: _selectedClientId,
      warehouseId: _warehouseId!,
      warehouseName: _warehouseName(),
      priceType: _priceType,
      comment: _comment,
      isConsignment: _isConsignment,
      consignmentDueDate: _consignmentDueDate,
      quantities: Map<int, double>.from(_quantities),
      totalQty: _cartQty.toDouble(),
      totalSum: _total,
      totalVolume: _estimateVolume(),
      savedAt: now,
      expiresAt: now.add(OrderDraft.ttl),
    );
    await ref.read(orderDraftRepositoryProvider).save(draft);
    ref.invalidate(orderDraftsProvider);
    ref.invalidate(orderDraftListProvider);
    ref.invalidate(orderDraftForClientProvider(_selectedClientId));
    if (mounted) {
      _toast(S.orderDraftSaved, accent: AppColors.success);
      if (popAfter && context.canPop()) context.pop();
    }
    return true;
  }

  Future<void> _handleBack() async {
    if (_step == _CreateStep.categoryProducts) {
      setState(() {
        _openCategory = null;
        _step = _CreateStep.categories;
      });
      return;
    }
    if (_hasUnsavedChanges) {
      final save = await showOrderDraftExitDialog(context);
      if (!mounted) return;
      if (save == null) return;
      if (save) {
        final ok = await _saveDraft(popAfter: false);
        if (!ok || !mounted) return;
      }
      if (context.canPop()) context.pop();
      return;
    }
    if (context.canPop()) context.pop();
  }

  Future<void> _initClients() async {
    _clientCount = await AppDatabase().clientCount();
    if (mounted) setState(() {});
  }

  Future<void> _refreshPhotoStatus({bool force = false}) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty || _selectedClientId <= 0) return;
    final now = DateTime.now();
    if (!force &&
        _hasUnlinkedPhotoToday &&
        _photoStatusFetchedAt != null &&
        now.difference(_photoStatusFetchedAt!) < _photoStatusCacheTtl) {
      return;
    }
    try {
      final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, _selectedClientId);
      if (mounted) {
        setState(() => _hasUnlinkedPhotoToday = hasUnlinkedPhotoReportToday(photos));
        _photoStatusFetchedAt = now;
      }
    } catch (_) {}
  }

  Future<void> _showProductSearch() async {
    final q = await showDialog<String>(
      context: context,
      builder: (ctx) => _ProductSearchDialog(initialQuery: _productSearch),
    );
    if (q != null && mounted) {
      setState(() => _productSearch = q.trim().toLowerCase());
      if (_productSearch.isNotEmpty && _step == _CreateStep.categories) {
        for (final cat in _categories) {
          final hit = cat.products.any((p) {
            final name = p['name']?.toString().toLowerCase() ?? '';
            final sku = p['sku']?.toString().toLowerCase() ?? '';
            return name.contains(_productSearch) || sku.contains(_productSearch);
          });
          if (hit) {
            await _enterCategory(cat);
            break;
          }
        }
      }
    }
  }

  Future<void> _pickClient() async {
    final cfg = ref.read(sessionProvider).mobileConfig ?? const MobileConfig();
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _ClientPickerSheet(
        clientCount: _clientCount,
        mobileConfig: cfg,
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _selectedClient = picked;
        _hasUnlinkedPhotoToday = false;
      });
      _invalidateCreateContextCache();
      _photoStatusFetchedAt = null;
      _mandatoryChecksPassedAt = null;
      await _openSetupSheet();
    }
  }

  Future<void> _prefetchWarehouses() async {
    if (_effectiveClientId <= 0) return;
    try {
      final ctx = await _getCreateContext();
      if (ctx == null || !mounted) return;
      setState(() {
        _warehouses = ctx.warehouses;
        _defaultWarehouseId = ctx.defaultWarehouseId;
        _priceTypes = ctx.priceTypes.isNotEmpty ? ctx.priceTypes : const ['retail'];
        if (_priceType.isEmpty || !_priceTypes.contains(_priceType)) {
          _priceType = _priceTypes.first;
        }
        if (_warehouseId == null) {
          final stockWh = ref.read(warehouseStockWarehouseIdProvider);
          final allowedIds = ctx.warehouses
              .map((w) => (w['id'] as num?)?.toInt())
              .whereType<int>()
              .toSet();
          if (stockWh != null && allowedIds.contains(stockWh)) {
            _warehouseId = stockWh;
          } else if (ctx.defaultWarehouseId != null) {
            _warehouseId = ctx.defaultWarehouseId;
          }
        }
        if (ctx.clientFinance != null) {
          _clientFinance = ctx.clientFinance;
          if (!ctx.clientFinance!.consignmentToggleEnabled && _isConsignment) {
            _isConsignment = false;
            _consignmentDueDate = '';
          }
        }
      });
    } catch (_) {}
  }

  Future<void> _openSetupSheet({bool fromInitialClient = false}) async {
    if (_selectedClient == null || _setupShown && _warehouseId != null) {
      // qayta ochish — asosiy ma'lumotlarni o'zgartirish
    }
    await _ensureSelectedClientFromRoute();
    await _prefetchWarehouses();
    if (!mounted) return;

    final agentLimits = ref.read(sessionProvider).agentLimits;
    final ordersCfg = ref.read(sessionProvider).mobileConfig?.orders ?? const OrdersConfig();
    final creditLimitRaw = _selectedClient?['credit_limit']?.toString().trim();
    var creditLimitHint = (creditLimitRaw != null &&
            creditLimitRaw.isNotEmpty &&
            creditLimitRaw != '0' &&
            creditLimitRaw != '0.00')
        ? creditLimitRaw
        : null;
    if (creditLimitHint == null) {
      for (final c in _createContextCache?.clients ?? const <Map<String, dynamic>>[]) {
        final id = (c['id'] as num?)?.toInt();
        if (id != _selectedClientId) continue;
        final cl = c['credit_limit']?.toString().trim();
        if (cl != null && cl.isNotEmpty && cl != '0' && cl != '0.00') {
          creditLimitHint = cl;
        }
        break;
      }
    }
    if (!mounted) return;
    await _refreshPhotoStatus();
    final photoRequired =
        ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false;
    final requireShipmentDate =
        ref.read(sessionProvider).mobileConfig?.misc.requireShipmentDate ?? false;
    final result = await OrderSetupSheet.show(
      context,
      warehouses: _warehouses,
      priceTypes: _priceTypes,
      initialWarehouseId: _warehouseId,
      defaultWarehouseId: _defaultWarehouseId,
      initialPriceType: _priceType,
      initialComment: _comment,
      showConsignmentField: agentLimits.consignment,
      consignmentPaymentDueRule: ordersCfg.consignmentPaymentDueRule,
      initialIsConsignment: _isConsignment,
      initialConsignmentDueDate: _consignmentDueDate,
      clientCreditLimitHint: creditLimitHint,
      clientFinance: _clientFinance,
      cartTotal: _total,
      consignmentCheckboxEnabled: _clientFinance != null
          ? _clientFinance!.consignmentToggleEnabled
          : agentLimits.consignment,
      photoRequired: photoRequired,
      initialHasUnlinkedPhoto: _hasUnlinkedPhotoToday,
      showShipmentDateField: requireShipmentDate,
      initialShipmentDate: _shipmentDate,
      onAddPhoto: () async {
        final ok = await _addPhotoReport();
        if (ok) await _refreshPhotoStatus();
        return _hasUnlinkedPhotoToday;
      },
    );
    if (result == null) {
      if (_warehouseId == null && mounted) {
        if (fromInitialClient || (widget.initialClientId != null && widget.initialClientId! > 0)) {
          if (context.canPop()) context.pop();
        } else {
          setState(() => _step = _CreateStep.pickClient);
        }
      }
      return;
    }

    final prevWarehouseId = _warehouseId;
    final prevPriceType = _priceType;
    setState(() {
      _warehouseId = result.warehouseId;
      _priceType = result.priceType;
      _comment = result.comment;
      _isConsignment = result.isConsignment;
      _consignmentDueDate = result.consignmentDueDate ?? '';
      _shipmentDate = result.shipmentDate ?? '';
      _setupShown = true;
      if (_effectiveClientId > 0) _step = _CreateStep.categories;
    });
    if (result.warehouseId != prevWarehouseId) {
      _invalidateCreateContextCache();
      _mandatoryChecksPassedAt = null;
    }
    if (result.warehouseId != null) {
      ref.read(warehouseStockWarehouseIdProvider.notifier).state = result.warehouseId;
    }
    if (!await _ensureMandatoryBeforeProductSelection()) {
      return;
    }
    // Ombor `_prefetchWarehouses` da oldindan to'ldirilishi mumkin (ostatkalar sahifasidan).
    // Shunda foydalanuvchi xuddi shu omborni tanlasa ham katalog birinchi marta yuklanishi kerak.
    final needsCatalogLoad =
        prevWarehouseId != result.warehouseId ||
        prevWarehouseId == null ||
        _allProducts.isEmpty;
    if (needsCatalogLoad) {
      await _loadCatalog(clearCart: true);
    } else if (prevPriceType != result.priceType) {
      await _reloadUnitPrices();
      await _refreshClientFinance();
    } else {
      await _refreshClientFinance();
    }
  }

  Future<void> _refreshClientFinance() async {
    final clientId = _selectedClientId;
    if (clientId <= 0) return;
    try {
      final ctx = await _getCreateContext(warehouseId: _warehouseId);
      if (!mounted || ctx == null) return;
      if (ctx.clientFinance != null) {
        setState(() {
          _clientFinance = ctx.clientFinance;
          if (!ctx.clientFinance!.consignmentToggleEnabled && _isConsignment) {
            _isConsignment = false;
            _consignmentDueDate = '';
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _reloadUnitPrices() async {
    final prices = <int, double>{};
    for (final p in _allProducts) {
      final id = (p['id'] as num?)?.toInt() ?? 0;
      if (id <= 0) continue;
      prices[id] = unitPriceForProduct(p, _priceType);
    }
    if (mounted) setState(() => _unitPrices..clear()..addAll(prices));
  }

  Future<void> _loadCatalog({bool clearCart = true}) async {
    await _ensureSelectedClientFromRoute();
    final clientId = _effectiveClientId;
    final whId = _warehouseId;
    if (clientId <= 0 || whId == null) return;

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    setState(() {
      _loadingCatalog = true;
      _loadError = null;
      if (clearCart) _quantities.clear();
      _openCategory = null;
      _step = _CreateStep.categories;
    });

    final photoRequired =
        ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false;
    if (photoRequired) {
      await _refreshPhotoStatus();
      if (!_hasUnlinkedPhotoToday) {
        if (mounted) {
          setState(() => _loadingCatalog = false);
          _toast('Необходимо добавить фотоотчет');
          await _openSetupSheet();
        }
        return;
      }
    }

    try {
      final ctx = await _getCreateContext(warehouseId: whId, forceRefresh: clearCart);
      if (ctx == null) {
        if (mounted) {
          setState(() {
            _loadError = 'Katalog yuklanmadi';
            _loadingCatalog = false;
          });
        }
        return;
      }
      final showOutOfStock =
          ref.read(sessionProvider).mobileConfig?.productList.showOutOfStock ?? true;
      var products = ctx.products
          .where((p) => p['is_blocked'] != true && p['is_active'] != false)
          .toList();
      final productIds = products
          .map((p) => (p['id'] as num?)?.toInt() ?? 0)
          .where((id) => id > 0)
          .toList();

      final stock = await ref.read(ordersApiProvider).getStock(
        slug,
        warehouseId: whId,
        productIds: productIds,
      );
      final stockMap = {for (final s in stock) s.productId: s.available};

      final prices = <int, double>{};
      for (final p in products) {
        final id = (p['id'] as num?)?.toInt() ?? 0;
        if (id <= 0) continue;
        prices[id] = unitPriceForProduct(p, _priceType);
      }

      if (!showOutOfStock) {
        products = products.where((p) {
          final id = (p['id'] as num?)?.toInt() ?? 0;
          return (stockMap[id] ?? 0) > 0;
        }).toList();
      }

      if (!mounted) return;
      setState(() {
        _priceTypes = ctx.priceTypes.isNotEmpty ? ctx.priceTypes : _priceTypes;
        _warehouses = ctx.warehouses.isNotEmpty ? ctx.warehouses : _warehouses;
        _defaultWarehouseId = ctx.defaultWarehouseId ?? _defaultWarehouseId;
        if (ctx.clientFinance != null) {
          _clientFinance = ctx.clientFinance;
          if (!ctx.clientFinance!.consignmentToggleEnabled && _isConsignment) {
            _isConsignment = false;
            _consignmentDueDate = '';
          }
        }
        _allProducts = products;
        _productById = {
          for (final p in products)
            if (((p['id'] as num?)?.toInt() ?? 0) > 0) (p['id'] as num).toInt(): p,
        };
        final sortProducts = ref.read(agentLocalPrefsProvider).valueOrNull?.sortProductsAlphabetically ?? true;
        _categories = groupProductsByCategory(products, sortProductsAlphabetically: sortProducts);
        _stockAvailable
          ..clear()
          ..addAll(stockMap);
        _unitPrices
          ..clear()
          ..addAll(prices);
        if (_pendingDraftRestore != null) {
          _quantities
            ..clear()
            ..addAll(_pendingDraftRestore!);
          _pendingDraftRestore = null;
        }
        _loadingCatalog = false;
        _step = _CreateStep.categories;
      });
      await _refreshPhotoStatus();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loadError = e.message;
          _loadingCatalog = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadError = 'Katalog yuklanmadi';
          _loadingCatalog = false;
        });
      }
    }
  }

  int _qtyInCategory(OrderCategoryGroup cat) {
    var n = 0.0;
    for (final p in cat.products) {
      final id = (p['id'] as num?)?.toInt() ?? 0;
      n += _quantities[id] ?? 0;
    }
    return n.round();
  }

  Future<bool> _runOrderMandatoryChecks({required bool offerPhotoCapture}) async {
    final cfg = ref.read(sessionProvider).mobileConfig ?? const MobileConfig();
    final guardBlock = await evaluateAgentOrderGuards(
      ref,
      clientId: _selectedClientId > 0 ? _selectedClientId : null,
    );
    if (guardBlock != null) {
      if (mounted) {
        _toast(
          guardBlock.message,
          accent: guardBlock.kind == AgentActionBlockKind.mandatorySync
              ? AppColors.warning
              : AppColors.error,
        );
      }
      return false;
    }
    if (_selectedClient != null) {
      if (isNewClientBlockedForOrder(_selectedClient!, cfg.client, cfg.productList)) {
        if (mounted) {
          _toast('Yangi mijozga buyurtma berish taqiqlangan (konfiguratsiya)');
        }
        return false;
      }
    }
    if (requiresInternetForAgent(cfg.gps)) {
      final online = await ref.read(connectivityProvider).isOnline();
      if (!online) {
        if (mounted) {
          _toast('Buyurtma uchun internet kerak (konfiguratsiya)');
        }
        return false;
      }
    }
    if (_selectedClient != null) {
      final clat = (_selectedClient!['latitude'] as num?)?.toDouble();
      final clng = (_selectedClient!['longitude'] as num?)?.toDouble();
      if (!await ensureWithinOutletRadius(
        context: context,
        config: cfg,
        clientLat: clat,
        clientLng: clng,
        blockedMessage: 'Buyurtma uchun mijoz radiusida bo‘ling',
      )) {
        return false;
      }
    }
    if (cfg.gps.requiredForOrder) {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) {
          _toast('Buyurtma uchun GPS ruxsati kerak');
        }
        return false;
      }
      final pos = await Geolocator.getCurrentPosition();
      final check = checkGpsPosition(cfg.gps, pos);
      if (!check.ok) {
        if (mounted) {
          _toast(check.message ?? 'GPS aniqligi yetarli emas');
        }
        return false;
      }
      final moveBlock = checkVanSellingMovementBlock(
        vanSelling: cfg.vanSelling,
        speedMetersPerSecond: pos.speed,
      );
      if (moveBlock != null) {
        if (mounted) _toast(moveBlock.message);
        return false;
      }
    }
    if (cfg.photo.requiredForOrder && _selectedClientId > 0) {
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      if (slug.isEmpty) return false;
      try {
        if (!_hasUnlinkedPhotoToday) {
          await _refreshPhotoStatus(force: true);
        }
        if (!_hasUnlinkedPhotoToday) {
          if (!mounted) return false;
          if (!offerPhotoCapture) {
            _toast('Необходимо добавить фотоотчет');
            return false;
          }
          _toast('Необходимо добавить фотоотчет', accent: AppColors.warning);
          await _addPhotoReport();
          await _refreshPhotoStatus();
          if (!_hasUnlinkedPhotoToday) return false;
        }
      } catch (_) {
        if (mounted) {
          _toast('Фотоотчет tekshirilmadi — internetni tekshiring');
        }
        return false;
      }
    }
    final prefs = ref.read(agentLocalPrefsProvider).valueOrNull;
    final stockCheck = checkStockSnapshotRequired(
      cfg.misc,
      hasSnapshotToday: isStockSnapshotFresh(prefs?.stockSnapshotDay),
    );
    if (!stockCheck.allowed) {
      if (mounted) {
        _toast(stockCheck.message ?? 'Qoldiq snapshot kerak');
      }
      return false;
    }
    final shipCheck = checkShipmentDateRequired(cfg.misc, _shipmentDate);
    if (!shipCheck.allowed) {
      if (mounted) {
        _toast(shipCheck.message ?? 'Jo\'natish sanasi kerak');
      }
      return false;
    }
    return true;
  }

  Future<bool> _ensureMandatoryBeforeProductSelection() async {
    final now = DateTime.now();
    final photoRequired =
        ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false;
    if (_mandatoryChecksPassedAt != null &&
        now.difference(_mandatoryChecksPassedAt!) < _mandatoryChecksCacheTtl &&
        (!photoRequired || _hasUnlinkedPhotoToday)) {
      return true;
    }
    final ok = await _runOrderMandatoryChecks(offerPhotoCapture: true);
    if (ok) _mandatoryChecksPassedAt = now;
    return ok;
  }

  Future<bool> _ensureOrderPolicy() => _runOrderMandatoryChecks(offerPhotoCapture: false);

  Future<void> _enterCategory(OrderCategoryGroup cat) async {
    if (!await _ensureMandatoryBeforeProductSelection()) return;
    if (!mounted) return;
    setState(() {
      _openCategory = cat;
      _step = _CreateStep.categoryProducts;
    });
  }

  Future<bool> _addPhotoReport() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty || _selectedClientId <= 0) return false;
    final category = await pickPhotoReportCategory(context, ref);
    if (category == null || !mounted) return false;
    final row = await captureAndUploadPhotoReport(
      context: context,
      ref: ref,
      slug: slug,
      clientId: _selectedClientId,
      category: category,
    );
    if (row != null && mounted) {
      setState(() {
        _hasUnlinkedPhotoToday = true;
        _photoStatusFetchedAt = DateTime.now();
      });
      _toast('Фотоотчет сохранён', accent: AppColors.success);
      return true;
    }
    return false;
  }

  void _showOrderActionsSheet() {
    if (_selectedClientId <= 0) return;
    showAgentClientActionsSheet(
      context,
      onPhotoReport: _addPhotoReport,
      onRefusal: () {
        _toast('Отказ — tashriflar bo‘limida', accent: AppColors.warning);
      },
      onCreateOrder: null,
      createOrderEnabled: false,
    );
  }

  Future<void> _submit({
    required bool applyBonus,
    bool applyDiscount = true,
    List<BonusGiftOverrideInput> giftOverrides = const [],
    List<BonusGiftLineInput> giftLines = const [],
  }) async {
    if (_selectedClient == null || _warehouseId == null || _cartQty == 0) return;
    setState(() => _submitting = true);

    final finance = _clientFinance;
    final gateReason = _isConsignment
        ? finance?.consignmentBlockReason()
        : finance?.regularOrderBlockReason();
    if (gateReason != null) {
      if (mounted) {
        _toast(gateReason);
        setState(() => _submitting = false);
      }
      return;
    }
    final limitReason = _consignmentLimitGateReason();
    if (limitReason != null) {
      if (mounted) {
        _toast(limitReason);
        setState(() => _submitting = false);
      }
      return;
    }

    if (!await _ensureOrderPolicy()) {
      if (mounted) setState(() => _submitting = false);
      return;
    }

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final items = <OrderLineInput>[];
    for (final e in _quantities.entries) {
      if (e.value <= 0) continue;
      final avail = _stockAvailable[e.key] ?? 0;
      if (e.value > avail) {
        if (mounted) {
          _toast('Mahsulot #${e.key}: omborda yetarli emas');
        }
        setState(() => _submitting = false);
        return;
      }
      final price = _unitPrices[e.key] ?? 0;
      if (price <= 0) {
        if (mounted) {
          _toast('Mahsulot #${e.key}: «$_priceType» narxi yo\'q — asosiy ma\'lumotlarni tekshiring');
        }
        setState(() => _submitting = false);
        return;
      }
      items.add(OrderLineInput(productId: e.key, qty: e.value));
    }

    if (ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder == true) {
      try {
        final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, _selectedClientId);
        if (!hasUnlinkedPhotoReportToday(photos)) {
          if (mounted) {
            _toast('Необходимо добавить фотоотчет');
            setState(() => _submitting = false);
          }
          return;
        }
      } catch (_) {
        if (mounted) {
          _toast('Фотоотчет tekshirilmadi — internetni tekshiring');
          setState(() => _submitting = false);
        }
        return;
      }
    }

    final online = await ConnectivityService().isOnline();
    if (!online || slug.isEmpty) {
      try {
        final payload = items
            .map((e) => {'product_id': e.productId, 'qty': e.qty})
            .toList();
        await AppDatabase().addOfflineOrder(
          _selectedClientId,
          _warehouseId!,
          jsonEncode(payload),
          priceType: _priceType,
          comment: _comment.isEmpty ? null : _comment,
        );
        await ref.read(orderDraftRepositoryProvider).delete(_selectedClientId);
        await ensureVisitCompletedForClientToday(
          _selectedClientId,
          clientName: _selectedClient?['name']?.toString(),
        );
        ref.invalidate(orderDraftsProvider);
        ref.invalidate(orderDraftListProvider);
        ref.invalidate(orderDraftForClientProvider(_selectedClientId));
        refreshVisitStatsProviders(ref.invalidate);
        if (mounted) {
          _toast('Oflayn navbatga qo\'shildi', accent: AppColors.warning);
          if (context.canPop()) context.pop();
          ref.invalidate(pendingCountProvider);
        }
      } catch (e) {
        if (mounted) {
          _toast('Oflayn xato: $e');
        }
      }
      if (mounted) setState(() => _submitting = false);
      return;
    }

    final delayMin = ref.read(sessionProvider).mobileConfig?.sync.postOrderDelayMinutes ?? 0;
    if (delayMin > 0) {
      try {
        await saveHeldOrder(
          ref: ref,
          clientId: _selectedClientId,
          clientName: _selectedClient?['name']?.toString() ?? '',
          warehouseId: _warehouseId!,
          priceType: _priceType,
          comment: _comment,
          items: items,
          applyBonus: applyBonus,
          applyDiscount: applyDiscount,
          giftOverrides: giftOverrides,
          giftLines: giftLines,
          isConsignment: _isConsignment,
          consignmentDueDate: _isConsignment ? _consignmentDueDate : null,
          shipmentDate: _shipmentDate.isEmpty ? null : _shipmentDate,
          estimatedTotal: _total,
          delayMinutes: delayMin,
          existingId: _heldOrderId,
        );
        await ref.read(orderDraftRepositoryProvider).delete(_selectedClientId);
        await ensureVisitCompletedForClientToday(
          _selectedClientId,
          clientName: _selectedClient?['name']?.toString(),
        );
        ref.invalidate(orderDraftsProvider);
        ref.invalidate(orderDraftListProvider);
        ref.invalidate(orderDraftForClientProvider(_selectedClientId));
        ref.invalidate(heldOrdersProvider);
        ref.invalidate(heldOrderCountProvider);
        refreshVisitStatsProviders(ref.invalidate);
        if (mounted) {
          _toast(
            'Заказ в очереди — отправка через $delayMin мин',
            accent: AppColors.warning,
          );
          context.go('/orders');
        }
      } catch (e) {
        if (mounted) _toast('Ошибка очереди: $e');
      } finally {
        if (mounted) setState(() => _submitting = false);
      }
      return;
    }

    try {
      final row = await ref.read(ordersApiProvider).createOrder(
        slug,
        clientId: _selectedClientId,
        warehouseId: _warehouseId!,
        items: items,
        priceType: _priceType,
        applyBonus: applyBonus,
        applyDiscount: applyDiscount,
        giftOverrides: giftOverrides,
        giftLines: giftLines,
        comment: _comment.isEmpty ? null : _comment,
        isConsignment: _isConsignment,
        consignmentDueDate: _isConsignment ? _consignmentDueDate : null,
        shipmentDate: _shipmentDate.isEmpty ? null : _shipmentDate,
      );
      final orderId = parseOrderInt(row['id']);
      final orderNumber = row['number']?.toString() ?? (orderId != null ? '$orderId' : '—');
      if (orderId != null && (ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false)) {
        try {
          final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, _selectedClientId);
          final latest = latestUnlinkedPhotoReportToday(photos);
          if (latest != null && latest.orderId == null) {
            await ref.read(mobileApiProvider).linkClientPhotoToOrder(
                  slug,
                  _selectedClientId,
                  latest.id,
                  orderId: orderId,
                );
          }
        } catch (_) {}
      }
      if (orderId != null) {
        await AppDatabase().upsertOrders([
          {
            'id': orderId,
            'number': orderNumber,
            'client_id': _selectedClientId,
            'status': row['status']?.toString() ?? 'new',
            'created_at': row['created_at']?.toString() ?? DateTime.now().toIso8601String(),
            'total': parseOrderNum(row['total_sum'] ?? row['total']),
          },
        ]);
      }
      if (mounted) {
        setState(() => _hasUnlinkedPhotoToday = false);
        await ref.read(orderDraftRepositoryProvider).delete(_selectedClientId);
        await ensureVisitCompletedForClientToday(
          _selectedClientId,
          clientName: _selectedClient?['name']?.toString(),
        );
        ref.invalidate(orderDraftsProvider);
        ref.invalidate(orderDraftListProvider);
        ref.invalidate(orderDraftForClientProvider(_selectedClientId));
        refreshVisitStatsProviders(ref.invalidate);
        _toast('Заказ №$orderNumber создан', accent: AppColors.success);
        final vanCfg = ref.read(sessionProvider).mobileConfig?.vanSelling;
        if (vanCfg?.paymentRequired == true && orderId != null) {
          final paid = await VanSellingPaymentSheet.show(
            context,
            clientId: _selectedClientId,
            orderId: orderId,
          );
          if (!mounted) return;
          if (paid != true) {
            _toast('To‘lov qayd etilmadi — keyinroq kassadan kiriting', accent: AppColors.warning);
          }
        }
        if (!mounted) return;
        context.go('/home');
        invalidateSyncedData(ref.invalidate);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(authStateProvider.notifier).resync();
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        _toast(e.message);
      }
    } catch (e) {
      if (mounted) {
        final msg = e is ApiException
            ? e.message
            : (e is DioException ? mapDioException(e).message : 'Не удалось отправить заказ');
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String? _consignmentLimitGateReason() {
    if (!_isConsignment) return null;
    return _clientFinance?.consignmentLimitBlockReason(_total);
  }

  Future<void> _onFinishOrder() async {
    if (_cartQty == 0) {
      _toast('Kamida bitta mahsulot tanlang', accent: AppColors.warning);
      return;
    }

    final finance = _clientFinance;
    final gateReason = _isConsignment
        ? finance?.consignmentBlockReason()
        : finance?.regularOrderBlockReason();
    if (gateReason != null) {
      _toast(gateReason);
      return;
    }
    final limitReason = _consignmentLimitGateReason();
    if (limitReason != null) {
      _toast(limitReason);
      return;
    }

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) {
        _toast('Sessiya yo‘q — qayta kiring');
      }
      return;
    }
    if (_warehouseId == null) {
      if (mounted) {
        _toast('Avval omborni tanlang');
      }
      await _openSetupSheet();
      return;
    }

    final items = <OrderLineInput>[];
    for (final e in _quantities.entries) {
      if (e.value <= 0) continue;
      items.add(OrderLineInput(productId: e.key, qty: e.value));
    }

    if (!mounted) return;
    final ordersCfg = ref.read(sessionProvider).mobileConfig?.orders ?? const OrdersConfig();
    final result = await OrderBonusDiscountSheet.show(
      context,
      slug: slug,
      clientId: _selectedClientId,
      warehouseId: _warehouseId!,
      priceType: _priceType,
      items: items,
      ordersApi: ref.read(ordersApiProvider),
      ordersConfig: ordersCfg,
    );
    if (result == null || !mounted) return;
    if (result.bonusShortageComment.isNotEmpty) {
      _comment = appendOrderComment(_comment, result.bonusShortageComment);
    }
    if (result.discountShortageComment.isNotEmpty) {
      _comment = appendOrderComment(_comment, result.discountShortageComment);
    }
    await _submit(
      applyBonus: result.applyBonus,
      applyDiscount: result.applyDiscount,
      giftOverrides: result.giftOverrides,
      giftLines: result.giftLines,
    );
  }

  Widget _buildCategoryList({
    required List<OrderCategoryGroup> visible,
    required bool productSelectionBlocked,
  }) {
    if (_categories.isEmpty) {
      return const Center(child: AgentEmptyState(message: S.emptyCategories));
    }
    if (visible.isEmpty) {
      return const Center(child: AgentEmptyState(message: 'Ничего не найдено'));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: visible.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final cat = visible[i];
        final qQty = _qtyInCategory(cat);
        final blocked = productSelectionBlocked;
        final count = cat.products.length;
        return Card(
          margin: EdgeInsets.zero,
          color: blocked ? Colors.grey.shade50 : null,
          child: ListTile(
            enabled: !blocked,
            title: Text(
              cat.name,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: blocked ? AppColors.textMuted : null,
              ),
            ),
            subtitle: blocked
                ? const Text(
                    'Сначала добавьте фотоотчет',
                    style: TextStyle(fontSize: 12, color: AppColors.warning),
                  )
                : Text('$count ${S.categoryProductsCount}'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (blocked)
                  const Icon(Icons.photo_camera_outlined, color: AppColors.warning, size: 20)
                else if (qQty > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$qQty',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, color: blocked ? AppColors.textMuted : null),
              ],
            ),
            onTap: blocked
                ? () async {
                    await _addPhotoReport();
                    await _refreshPhotoStatus(force: true);
                  }
                : () => _enterCategory(cat),
          ),
        );
      },
    );
  }

  Widget _buildBottomBar({
    required String primaryLabel,
    required VoidCallback? onPrimary,
    required bool photoRequired,
    bool primaryEnabled = true,
    bool showActionsButton = true,
    bool showMandatoryBanner = false,
    bool showDraftButton = false,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showMandatoryBanner && photoRequired && !_hasUnlinkedPhotoToday)
          MandatoryPhotoBanner(onAdd: _addPhotoReport),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Colors.grey.shade200)),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, -2)),
            ],
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${S.selectedProducts}: $_cartQty ${S.unitPcs}', style: AppTypography.bodyMedium),
                    Text(
                      '${S.total}: ${formatOrderMoney(_total)}',
                      style: AppTypography.headlineSmall.copyWith(color: AppColors.agentAccent),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    if (showDraftButton) ...[
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              backgroundColor: const Color(0xFFF1F5F9),
                              foregroundColor: AppColors.textPrimary,
                              side: BorderSide.none,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: (_submitting || _cartQty <= 0)
                                ? null
                                : () => _saveDraft(popAfter: true),
                            child: const Text(S.draft),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      flex: showDraftButton ? 2 : 1,
                      child: SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.agentAccent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: (_submitting || !primaryEnabled) ? null : onPrimary,
                          child: _submitting
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : Text(primaryLabel),
                        ),
                      ),
                    ),
                    if (showActionsButton && _selectedClientId > 0) ...[
                      const SizedBox(width: 8),
                      Material(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: _showOrderActionsSheet,
                          borderRadius: BorderRadius.circular(12),
                          child: const SizedBox(
                            width: 48,
                            height: 48,
                            child: Icon(Icons.more_horiz, color: AppColors.textSecondary),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPickClient() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person_search_outlined, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              _clientCount == 0 ? S.syncFirst : S.selectClient,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _clientCount == 0 ? null : _pickClient,
              icon: const Icon(Icons.people),
              label: const Text(S.selectClient),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategories({required bool photoRequired}) {
    final productSelectionBlocked = photoRequired && !_hasUnlinkedPhotoToday;
    if (_loadingCatalog) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_loadError!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _loadCatalog, child: const Text(S.retry)),
          ],
        ),
      );
    }

    final visible = _productSearch.isEmpty
        ? _categories
        : _categories.where((cat) {
            final q = _productSearch.toLowerCase();
            if (cat.name.toLowerCase().contains(q)) return true;
            return cat.products.any((p) {
              final name = p['name']?.toString().toLowerCase() ?? '';
              final sku = p['sku']?.toString().toLowerCase() ?? '';
              return name.contains(q) || sku.contains(q);
            });
          }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (productSelectionBlocked)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: MandatoryPhotoInlinePrompt(onAdd: _addPhotoReport),
          ),
        if (!_isConsignment &&
            (_clientFinance?.regularOrderBlockReason() != null))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              _clientFinance!.regularOrderBlockReason()!,
              style: AppTypography.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        if (_isConsignment &&
            (_clientFinance?.consignmentBlockReason() != null))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              _clientFinance!.consignmentBlockReason()!,
              style: AppTypography.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        if (_consignmentLimitGateReason() != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
              ),
              child: Text(
                _consignmentLimitGateReason()!,
                style: AppTypography.caption.copyWith(
                  color: AppColors.error,
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _selectedClient?['name']?.toString() ?? S.orderAddTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
              TextButton.icon(
                onPressed: _openSetupSheet,
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text(S.editOrderSetup),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            controller: _productSearchCtrl,
            onChanged: _onProductSearchChanged,
            decoration: const InputDecoration(
              hintText: 'Поиск товаров…',
              prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
            ),
          ),
        ),
        Expanded(
          child: _buildCategoryList(
            visible: visible,
            productSelectionBlocked: productSelectionBlocked,
          ),
        ),
        _buildBottomBar(
          primaryLabel: S.orderAddOrder,
          onPrimary: _cartQty > 0 ? _onFinishOrder : null,
          primaryEnabled: _cartQty > 0 &&
              (!photoRequired || _hasUnlinkedPhotoToday) &&
              _consignmentLimitGateReason() == null,
          photoRequired: photoRequired,
        ),
      ],
    );
  }

  Widget _buildCategoryProducts({required bool photoRequired}) {
    final productSelectionBlocked = photoRequired && !_hasUnlinkedPhotoToday;
    final cat = _openCategory;
    if (cat == null) return const SizedBox.shrink();

    final products = _productSearch.isEmpty
        ? cat.products
        : cat.products.where((p) {
            final name = p['name']?.toString().toLowerCase() ?? '';
            final sku = p['sku']?.toString().toLowerCase() ?? '';
            return name.contains(_productSearch) || sku.contains(_productSearch);
          }).toList();
    final showBoxes = ref.watch(agentLocalPrefsProvider).valueOrNull?.showBoxCount ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_productSearch.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Chip(
              label: Text('Filtr: $_productSearch'),
              onDeleted: () {
                _productSearchCtrl.clear();
                setState(() => _productSearch = '');
              },
            ),
          ),
        Expanded(
          child: products.isEmpty
              ? const Center(child: AgentEmptyState(message: S.emptyProducts))
              : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: products.length,
            itemBuilder: (_, i) {
              final p = products[i];
              final pid = (p['id'] as num).toInt();
              final qty = _quantities[pid] ?? 0;
              final price = _unitPrices[pid] ?? 0;
              final avail = _stockAvailable[pid] ?? 0;
              final out = avail <= 0;
              final remaining = (avail - qty).clamp(0.0, double.infinity);
              final stockLabel = qty > 0
                  ? '${S.warehouseStock}: ${avail.toStringAsFixed(0)} · ${S.remaining}: ${remaining.toStringAsFixed(0)}'
                  : '${S.inStock}: ${avail.toStringAsFixed(0)}';
              final stockText = out ? S.outOfStock : stockLabel;
              final boxLabel = productQuantityLabel(p, qty.toDouble(), showBoxes: showBoxes);
              return RepaintBoundary(
                child: Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: out ? Colors.grey.shade100 : null,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: qty > 0
                      ? const BorderSide(color: AppColors.agentAccent, width: 2)
                      : BorderSide.none,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(productDisplayName(p), style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              stockText,
                              style: TextStyle(
                                fontSize: 12,
                                color: out
                                    ? AppColors.error
                                    : (qty > avail ? AppColors.error : AppColors.success),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            price > 0 ? '${S.price}: ${formatOrderMoney(price)}' : '—',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            qty > 0 && showBoxes ? '$qty ${p['unit']?.toString() ?? S.unitPcs} · $boxLabel' : S.unitPcs,
                            style: AppTypography.caption,
                          ),
                          const Spacer(),
                          AgentEditableQuantityStepper(
                            value: qty,
                            min: 0,
                            max: avail,
                            disabled: out || productSelectionBlocked,
                            onChanged: (next) {
                              setState(() {
                                if (next <= 0) {
                                  _quantities.remove(pid);
                                } else {
                                  _quantities[pid] = next;
                                }
                              });
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              );
            },
          ),
        ),
        _buildBottomBar(
          primaryLabel: S.finish,
          onPrimary: () => setState(() {
            _openCategory = null;
            _step = _CreateStep.categories;
          }),
          photoRequired: photoRequired,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final photoRequired =
        ref.watch(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false;
    final title = _step == _CreateStep.categoryProducts
        ? (_openCategory?.name ?? S.productsTitle)
        : S.orderAddTitle;

    return PopScope(
      canPop: _step == _CreateStep.pickClient ||
          (_step == _CreateStep.categories && !_hasUnsavedChanges),
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (_step == _CreateStep.categoryProducts) {
          setState(() {
            _openCategory = null;
            _step = _CreateStep.categories;
          });
          return;
        }
        if (_step == _CreateStep.categories && _hasUnsavedChanges) {
          await _handleBack();
        }
      },
      child: Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      appBar: AgentAppBar(
        title: title,
        showBack: true,
        drawerScaffoldKey: _scaffoldKey,
        onBack: _handleBack,
        actions: [
          if (_heldOrderId != null)
            AgentIconButton(icon: Icons.close, onPressed: _cancelHeldOrder),
          if (_selectedClientId > 0)
            AgentIconButton(icon: Icons.more_horiz, onPressed: _showOrderActionsSheet),
          if (_step == _CreateStep.categoryProducts || _step == _CreateStep.categories)
            AgentIconButton(icon: Icons.search, onPressed: _showProductSearch),
        ],
      ),
      body: Stack(
        children: [
          if (_bootstrappingInitialClient)
            const Center(child: CircularProgressIndicator())
          else if (_step == _CreateStep.pickClient && _effectiveClientId <= 0)
            _buildPickClient()
          else if (_step == _CreateStep.categories)
            _buildCategories(photoRequired: photoRequired)
          else
            _buildCategoryProducts(photoRequired: photoRequired),
          if (_loading)
            const ColoredBox(
              color: Color(0x88FFFFFF),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    ),
    );
  }
}

class _ProductSearchDialog extends StatefulWidget {
  final String initialQuery;
  const _ProductSearchDialog({required this.initialQuery});

  @override
  State<_ProductSearchDialog> createState() => _ProductSearchDialogState();
}

class _ProductSearchDialogState extends State<_ProductSearchDialog> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Mahsulot qidirish'),
      content: TextField(
        controller: _ctrl,
        autofocus: true,
        decoration: const InputDecoration(hintText: 'Nom yoki SKU...'),
        onSubmitted: (v) => Navigator.pop(context, v),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Bekor')),
        TextButton(onPressed: () => Navigator.pop(context, _ctrl.text), child: const Text('OK')),
      ],
    );
  }
}

class _ClientPickerSheet extends StatefulWidget {
  final int clientCount;
  final MobileConfig mobileConfig;
  const _ClientPickerSheet({
    required this.clientCount,
    required this.mobileConfig,
  });

  @override
  State<_ClientPickerSheet> createState() => _ClientPickerSheetState();
}

class _ClientPickerSheetState extends State<_ClientPickerSheet> {
  late final TextEditingController _searchCtrl;
  late final FocusNode _focusNode;
  List<Map<String, dynamic>> _results = [];
  var _searching = false;
  var _query = '';
  var _searchToken = 0;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController();
    _focusNode = FocusNode();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _closeSheet() {
    _focusNode.unfocus();
    Navigator.pop(context);
  }

  void _scheduleSearch(String q) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () => _runSearch(q));
  }

  Future<void> _runSearch(String q) async {
    final trimmed = q.trim();
    if (!mounted) return;
    setState(() => _query = q);

    if (trimmed.length < 2) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }

    final token = ++_searchToken;
    setState(() => _searching = true);
    final rows = await AppDatabase().searchClients(trimmed, activeOnly: false);
    if (!mounted || token != _searchToken) return;

    final cfg = widget.mobileConfig;
    final filtered = rows
        .where((c) => !isNewClientBlockedForOrder(c, cfg.client, cfg.productList))
        .toList();
    if (!mounted || token != _searchToken) return;
    setState(() {
      _results = filtered;
      _searching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final queryLen = _query.trim().length;

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: FractionallySizedBox(
        heightFactor: 0.75,
        alignment: Alignment.topCenter,
        child: Material(
          color: Theme.of(context).scaffoldBackgroundColor,
          child: Column(
            children: [
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Mijoz tanlang', style: AppTypography.headlineSmall),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _searchCtrl,
                  focusNode: _focusNode,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: 'Nom yoki telefon (kamida 2 harf)...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: _closeSheet,
                    ),
                  ),
                  onChanged: _scheduleSearch,
                ),
              ),
              Expanded(
                child: _searching
                    ? const Center(child: CircularProgressIndicator())
                    : queryLen < 2
                        ? Center(
                            child: Text(
                              'Qidiruv: kamida 2 harf\n(${widget.clientCount} mijoz)',
                              textAlign: TextAlign.center,
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                            ),
                          )
                        : _results.isEmpty
                            ? const Center(child: AgentEmptyState(message: S.emptyClientSearch))
                            : ListView.builder(
                                itemCount: _results.length,
                                itemBuilder: (_, i) {
                                  final c = _results[i];
                                  return ListTile(
                                    title: Text(c['name']?.toString() ?? ''),
                                    subtitle: Text(c['phone']?.toString() ?? ''),
                                    onTap: () {
                                      _focusNode.unfocus();
                                      Navigator.pop(context, c);
                                    },
                                  );
                                },
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

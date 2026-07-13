class MobileConfig {
  final int schemaVersion;
  final ClientConfig client;
  final GpsConfig gps;
  final OutletConfig outlet;
  final RouteConfig route;
  final PhotoConfig photo;
  final MiscConfig misc;
  final SyncConfig sync;
  final OrdersConfig orders;
  final ProductListConfig productList;
  final ExpeditorConfig? expeditor;
  final SupervisionConfig? supervision;
  final VanSellingConfig? vanSelling;

  const MobileConfig({
    this.schemaVersion = 1,
    this.client = const ClientConfig(),
    this.gps = const GpsConfig(),
    this.outlet = const OutletConfig(),
    this.route = const RouteConfig(),
    this.photo = const PhotoConfig(),
    this.misc = const MiscConfig(),
    this.sync = const SyncConfig(),
    this.orders = const OrdersConfig(),
    this.productList = const ProductListConfig(),
    this.expeditor,
    this.supervision,
    this.vanSelling,
  });

  factory MobileConfig.fromJson(Map<String, dynamic> j) => MobileConfig(
        schemaVersion: j['schema_version'] ?? 1,
        client: ClientConfig.fromJson(j['client'] ?? {}),
        gps: GpsConfig.fromJson(j['gps'] ?? {}),
        outlet: OutletConfig.fromJson(j['outlet'] ?? {}),
        route: RouteConfig.fromJson(j['route'] ?? {}),
        photo: PhotoConfig.fromJson(j['photo'] ?? {}),
        misc: MiscConfig.fromJson(j['misc'] ?? {}),
        sync: SyncConfig.fromJson(j['sync'] ?? {}),
        orders: OrdersConfig.fromJson(j['orders'] ?? {}),
        productList: ProductListConfig.fromJson(j['product_list'] ?? {}),
        expeditor: j['expeditor'] != null ? ExpeditorConfig.fromJson(j['expeditor']) : null,
        supervision: j['supervision'] != null ? SupervisionConfig.fromJson(j['supervision']) : null,
        vanSelling: j['van_selling'] != null ? VanSellingConfig.fromJson(j['van_selling']) : null,
      );
}

Map<String, bool> _boolMap(dynamic raw) {
  if (raw is! Map) return const {};
  return raw.map((k, v) => MapEntry(k.toString(), v == true));
}

class ClientConfig {
  final bool canEdit;
  final bool canCreate;
  final bool requireNewClientApproval;
  final bool showBalance;
  final bool showPhotos;
  final bool canChangeClientLocation;
  final String phonePrefix;
  final Map<String, bool> fieldsVisible;
  final Map<String, bool> fieldsRequired;

  const ClientConfig({
    this.canEdit = false,
    this.canCreate = false,
    this.requireNewClientApproval = false,
    this.showBalance = true,
    this.showPhotos = true,
    this.canChangeClientLocation = false,
    this.phonePrefix = '+998',
    this.fieldsVisible = const {},
    this.fieldsRequired = const {},
  });

  factory ClientConfig.fromJson(Map<String, dynamic> j) => ClientConfig(
        canEdit: j['can_edit'] ?? false,
        canCreate: j['can_create'] ?? false,
        requireNewClientApproval: j['require_new_client_approval'] ?? false,
        showBalance: j['show_balance'] ?? true,
        showPhotos: j['show_photos'] ?? true,
        canChangeClientLocation: j['can_change_client_location'] ?? false,
        phonePrefix: j['phone_prefix']?.toString() ?? '+998',
        fieldsVisible: _boolMap(j['fields_visible']),
        fieldsRequired: _boolMap(j['fields_required']),
      );
}

class GpsConfig {
  final bool trackingEnabled;
  final bool alwaysOn;
  final bool requiredForOrder;
  final bool internetRequiredForOrder;
  final bool internetAlwaysOn;
  final int trackingIntervalSec;
  final int? minBatteryPct;
  final double? minDistanceM;
  final double? maxAccuracyM;

  const GpsConfig({
    this.trackingEnabled = false,
    this.alwaysOn = false,
    this.requiredForOrder = false,
    this.internetRequiredForOrder = false,
    this.internetAlwaysOn = false,
    this.trackingIntervalSec = 300,
    this.minBatteryPct,
    this.minDistanceM,
    this.maxAccuracyM,
  });

  factory GpsConfig.fromJson(Map<String, dynamic> j) => GpsConfig(
        trackingEnabled: j['tracking_enabled'] ?? false,
        alwaysOn: j['always_on'] ?? false,
        requiredForOrder: j['required_for_order'] ?? false,
        internetRequiredForOrder: j['internet_required_for_order'] ?? false,
        internetAlwaysOn: j['internet_always_on'] ?? false,
        trackingIntervalSec: (j['tracking_interval_sec'] as num?)?.toInt() ?? 300,
        minBatteryPct: (j['min_battery_pct'] as num?)?.toInt(),
        minDistanceM: (j['min_distance_m'] as num?)?.toDouble(),
        maxAccuracyM: (j['max_accuracy_m'] as num?)?.toDouble(),
      );
}

class OutletConfig {
  final bool showPlanInReports;
  final String? planVersion;

  const OutletConfig({
    this.showPlanInReports = false,
    this.planVersion,
  });

  factory OutletConfig.fromJson(Map<String, dynamic> j) => OutletConfig(
        showPlanInReports: j['show_plan_in_reports'] ?? false,
        planVersion: j['plan_version']?.toString(),
      );
}

class RouteConfig {
  /// Kuniga marshrutdagi do‘konlar (0 = cheksiz).
  final int dailyVisitLimit;
  /// Tashrifdan keyin marshrutga qayta qo‘shilmaslik (kun).
  final int readdCooldownDays;

  const RouteConfig({
    this.dailyVisitLimit = 50,
    this.readdCooldownDays = 0,
  });

  factory RouteConfig.fromJson(Map<String, dynamic> j) => RouteConfig(
        dailyVisitLimit: (j['daily_visit_limit'] as num?)?.toInt() ?? 50,
        readdCooldownDays: (j['readd_cooldown_days'] as num?)?.toInt() ?? 0,
      );
}

class PhotoConfig {
  final bool requiredForOrder;
  final int jpegQuality;
  final int maxWidthPx;
  final int maxHeightPx;

  const PhotoConfig({
    this.requiredForOrder = false,
    this.jpegQuality = 92,
    this.maxWidthPx = 4032,
    this.maxHeightPx = 4032,
  });

  factory PhotoConfig.fromJson(Map<String, dynamic> j) => PhotoConfig(
        requiredForOrder: j['required_for_order'] ?? false,
        jpegQuality: (j['jpeg_quality'] as num?)?.toInt() ?? 80,
        maxWidthPx: (j['max_width_px'] as num?)?.toInt() ?? 1280,
        maxHeightPx: (j['max_height_px'] as num?)?.toInt() ?? 1280,
      );
}

class MiscConfig {
  final bool visitStartEndEnabled;
  final double? requireWithinOutletRadiusM;
  final bool requireStockSnapshotForOrder;
  final bool requireShipmentDate;
  final bool allowExchangeRequest;
  final List<String> disallowedPaymentMethodCodes;

  const MiscConfig({
    this.visitStartEndEnabled = false,
    this.requireWithinOutletRadiusM,
    this.requireStockSnapshotForOrder = false,
    this.requireShipmentDate = false,
    this.allowExchangeRequest = false,
    this.disallowedPaymentMethodCodes = const [],
  });

  factory MiscConfig.fromJson(Map<String, dynamic> j) => MiscConfig(
        visitStartEndEnabled: j['visit_start_end_enabled'] ?? false,
        requireWithinOutletRadiusM: (j['require_within_outlet_radius_m'] as num?)?.toDouble(),
        requireStockSnapshotForOrder: j['require_stock_snapshot_for_order'] ?? false,
        requireShipmentDate: j['require_shipment_date'] ?? false,
        allowExchangeRequest: j['allow_exchange_request'] ?? false,
        disallowedPaymentMethodCodes: (j['disallowed_payment_method_codes'] as List?)
                ?.map((e) => e.toString())
                .where((s) => s.isNotEmpty)
                .toList() ??
            const [],
      );
}

class SyncConfig {
  final int mandatorySyncCount;
  final bool blockSync;
  final String? allowedWindowFrom;
  final String? allowedWindowTo;
  final int postOrderDelayMinutes;

  const SyncConfig({
    this.mandatorySyncCount = 0,
    this.blockSync = false,
    this.allowedWindowFrom,
    this.allowedWindowTo,
    this.postOrderDelayMinutes = 0,
  });

  factory SyncConfig.fromJson(Map<String, dynamic> j) => SyncConfig(
        mandatorySyncCount: (j['mandatory_sync_count'] as num?)?.toInt() ?? 0,
        blockSync: j['block_sync'] ?? false,
        allowedWindowFrom: _optHm(j['allowed_window_from']),
        allowedWindowTo: _optHm(j['allowed_window_to']),
        postOrderDelayMinutes: (j['post_order_delay_minutes'] as num?)?.toInt() ?? 0,
      );
}

String? _optHm(dynamic v) {
  final s = v?.toString().trim();
  if (s == null || s.isEmpty) return null;
  return s;
}

class OrdersConfig {
  final bool allowReturnFromShelf;
  final bool allowPartialReturnEdit;
  final bool allowReloadFromVehicle;
  final bool returnReasonRequired;
  final String? consignmentPaymentDueRule;
  final String? bonusFillMode;

  const OrdersConfig({
    this.allowReturnFromShelf = false,
    this.allowPartialReturnEdit = false,
    this.allowReloadFromVehicle = false,
    this.returnReasonRequired = false,
    this.consignmentPaymentDueRule,
    this.bonusFillMode,
  });

  factory OrdersConfig.fromJson(Map<String, dynamic> j) => OrdersConfig(
        allowReturnFromShelf: j['allow_return_from_shelf'] ?? false,
        allowPartialReturnEdit: j['allow_partial_return_edit'] ?? false,
        allowReloadFromVehicle: j['allow_reload_from_vehicle'] ?? false,
        returnReasonRequired: j['return_reason_required'] ?? false,
        consignmentPaymentDueRule: j['consignment_payment_due_rule']?.toString(),
        bonusFillMode: j['bonus_fill_mode']?.toString(),
      );
}

class ProductListConfig {
  final bool showOutOfStock;
  final bool allowSubmitForNewClient;

  const ProductListConfig({
    this.showOutOfStock = true,
    this.allowSubmitForNewClient = true,
  });

  factory ProductListConfig.fromJson(Map<String, dynamic> j) => ProductListConfig(
        showOutOfStock: j['show_out_of_stock'] ?? true,
        allowSubmitForNewClient: j['allow_submit_for_new_client'] ?? true,
      );
}

class ExpeditorConfig {
  final bool acceptPaymentForOrder;
  final bool acceptPaymentOnDelivery;
  final bool acceptPaymentFromDebtors;
  final bool fingerprintRequiredForShipmentConfirm;
  final bool deliveryPaymentMethodStrict;
  final bool requirePhotoReportBeforeVisit;
  final String currencySymbol;
  final List<String> allowedPaymentMethodIds;
  final List<int> allowedTradeDirectionIds;

  const ExpeditorConfig({
    this.acceptPaymentForOrder = true,
    this.acceptPaymentOnDelivery = true,
    this.acceptPaymentFromDebtors = false,
    this.fingerprintRequiredForShipmentConfirm = false,
    this.deliveryPaymentMethodStrict = false,
    this.requirePhotoReportBeforeVisit = false,
    this.currencySymbol = "so'm",
    this.allowedPaymentMethodIds = const [],
    this.allowedTradeDirectionIds = const [],
  });

  factory ExpeditorConfig.fromJson(Map<String, dynamic> j) => ExpeditorConfig(
        acceptPaymentForOrder: j['accept_payment_for_order'] ?? true,
        acceptPaymentOnDelivery: j['accept_payment_on_delivery'] ?? true,
        acceptPaymentFromDebtors: j['accept_payment_from_debtors'] ?? false,
        fingerprintRequiredForShipmentConfirm: j['fingerprint_required_for_shipment_confirm'] ?? false,
        deliveryPaymentMethodStrict: j['delivery_payment_method_strict'] ?? false,
        requirePhotoReportBeforeVisit: j['require_photo_report_before_visit'] ?? false,
        currencySymbol: j['currency_symbol']?.toString() ?? "so'm",
        allowedPaymentMethodIds: (j['allowed_payment_method_ids'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        allowedTradeDirectionIds: (j['allowed_trade_direction_ids'] as List?)
                ?.map((e) => (e as num).toInt())
                .toList() ??
            const [],
      );
}

class SupervisionConfig {
  final bool checkReceiptFaces;
  final bool checkMerchandising;
  final bool checkDefaultPrice;
  final bool checkStock;
  final bool checkSales;
  final bool checkMotivation;

  const SupervisionConfig({
    this.checkReceiptFaces = false,
    this.checkMerchandising = false,
    this.checkDefaultPrice = false,
    this.checkStock = false,
    this.checkSales = false,
    this.checkMotivation = false,
  });

  factory SupervisionConfig.fromJson(Map<String, dynamic> j) => SupervisionConfig(
        checkReceiptFaces: j['check_receipt_faces'] ?? false,
        checkMerchandising: j['check_merchandising'] ?? false,
        checkDefaultPrice: j['check_default_price'] ?? false,
        checkStock: j['check_stock'] ?? false,
        checkSales: j['check_sales'] ?? false,
        checkMotivation: j['check_motivation'] ?? false,
      );
}

class VanSellingConfig {
  final bool paymentRequired;
  final bool allowOrderWhileMoving;
  final bool allowChangeMovementStatus;
  final List<String> paymentAcceptanceMethodIds;

  const VanSellingConfig({
    this.paymentRequired = false,
    this.allowOrderWhileMoving = false,
    this.allowChangeMovementStatus = false,
    this.paymentAcceptanceMethodIds = const [],
  });

  factory VanSellingConfig.fromJson(Map<String, dynamic> j) => VanSellingConfig(
        paymentRequired: j['payment_required'] ?? false,
        allowOrderWhileMoving: j['allow_order_while_moving'] ?? false,
        allowChangeMovementStatus: j['allow_change_movement_status'] ?? false,
        paymentAcceptanceMethodIds: (j['payment_acceptance_method_ids'] as List?)
                ?.map((e) => e.toString())
                .where((s) => s.isNotEmpty)
                .toList() ??
            const [],
      );
}

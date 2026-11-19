import '../../../core/config/mobile_config.dart';

class ExpeditorConfigPolicy {
  final ExpeditorConfig? config;
  final OrdersConfig? orders;
  final ClientConfig? client;

  const ExpeditorConfigPolicy({this.config, this.orders, this.client});

  factory ExpeditorConfigPolicy.fromMobileConfig(MobileConfig? mc) =>
      ExpeditorConfigPolicy(
        config: mc?.expeditor,
        orders: mc?.orders,
        client: mc?.client,
      );

  bool get acceptPaymentForOrder => config?.acceptPaymentForOrder ?? true;
  bool get acceptPaymentOnDelivery => config?.acceptPaymentOnDelivery ?? true;
  bool get acceptPaymentFromDebtors => config?.acceptPaymentFromDebtors ?? false;
  bool get deliveryPaymentMethodStrict => config?.deliveryPaymentMethodStrict ?? false;

  bool get paymentsEnabled =>
      acceptPaymentForOrder && (acceptPaymentOnDelivery || acceptPaymentFromDebtors);
  bool get allowPartialReturn => orders?.allowPartialReturnEdit ?? false;
  bool get allowReloadFromVehicle => orders?.allowReloadFromVehicle ?? false;
  bool get allowReturnFromShelf => orders?.allowReturnFromShelf ?? false;
  bool get returnReasonRequired => orders?.returnReasonRequired ?? false;
  bool get canChangeClientLocation => client?.canChangeClientLocation ?? false;
  bool get fingerprintRequired => config?.fingerprintRequiredForShipmentConfirm ?? false;
  bool get requirePhotoReportBeforeVisit =>
      config?.requirePhotoReportBeforeVisit ?? false;
  String get currencySymbol => config?.currencySymbol ?? "so'm";

  bool get returnsEnabled => allowPartialReturn || allowReloadFromVehicle;

  String blockPaymentMessage() {
    if (!acceptPaymentForOrder) {
      return 'Buyurtma uchun to\'lov qabul qilish admin panelda o\'chirilgan';
    }
    if (!paymentsEnabled) {
      return 'Yetkazishda to\'lov qabul qilish admin panelda o\'chirilgan';
    }
    if (!acceptPaymentOnDelivery) {
      return 'Faqat qarzdor mijozlardan to\'lov qabul qilish ruxsat etilgan';
    }
    return '';
  }

  bool canSubmitPayment({required bool fromDebtor, String? orderStatus}) {
    if (!acceptPaymentForOrder) return false;
    if (fromDebtor) return acceptPaymentFromDebtors || acceptPaymentOnDelivery;
    if (orderStatus != null && orderStatus != 'delivered' && !acceptPaymentFromDebtors) {
      return false;
    }
    return acceptPaymentOnDelivery;
  }
}

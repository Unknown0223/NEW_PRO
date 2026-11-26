import '../shared/tezyuk_expeditor_chrome.dart';

/// Qaytarish (javon / buyurtma) — SalesDoc RU, TezYuk O'zbek.
abstract final class ExpeditorReturnByOrderL10n {
  static String pageTitlePickOrder() => expeditorLabel(
        'Возврат с полки по заказу',
        'Buyurtmaga qaytarish',
      );

  static String pageTitleComposition() =>
      expeditorLabel('Возврат · заказ', 'Qaytarish · buyurtma');

  static String tabByProducts() => expeditorLabel('По\nпродуктам', 'Qisman');

  static String tabByOrder() => expeditorLabel('По\nзаказу', 'Po zakaz');

  static String tabFullOrder() => expeditorLabel('Полный\nзаказ', 'To\'liq');

  static String filterButton(bool active) => active
      ? expeditorLabel('Фильтр •', 'Filtr •')
      : expeditorLabel('Фильтр', 'Filtr');

  static String emptyOrders() => expeditorLabel(
        'Нет заказов, доступных для возврата по текущим настройкам',
        'Joriy sozlamalar bo\'yicha qaytarish mumkin bo\'lgan buyurtma yo\'q',
      );

  static String emptyFiltered() => expeditorLabel(
        'По выбранным фильтрам заказов нет',
        'Tanlangan filtrlar bo\'yicha buyurtma yo\'q',
      );

  static String orderChip(String orderNo) =>
      expeditorLabel('Заказ № $orderNo', 'Buyurtma № $orderNo');

  static String hintFullReturn() => expeditorLabel(
        'Полный возврат заказа — всё автоматически',
        'To\'liq qaytarish — hammasi avtomatik',
      );

  static String hintByOrder() => expeditorLabel(
        'По категориям — количество к возврату',
        'Kategoriya bo\'yicha — qaytariladigan miqdor',
      );

  static String hintByProducts() => expeditorLabel(
        'Товары к возврату',
        'Qaytariladigan mahsulotlar',
      );

  static String submitReturn() =>
      expeditorLabel('Оформить возврат', 'Qaytarishni rasmiylashtirish');

  static String confirmReturn() =>
      expeditorLabel('Подтвердите возврат', 'Qaytarishni tasdiqlang');

  static String qtyPcs(String qty) => expeditorLabel('$qty шт', '$qty dona');

  static String backToOrders() =>
      expeditorLabel('К списку заказов', 'Buyurtmalar ro\'yxatiga');

  static String noItems() => expeditorLabel(
        'Нет товаров, доступных к возврату',
        'Qaytarish uchun mahsulot yo\'q',
      );

  static String uncategorized() =>
      expeditorLabel('Без категории', 'Kategoriyasiz');

  /// API foto maydonini qabul qilmaydi — UI stub (YAGNI upload).
  static String photoNotRequiredNote() => expeditorLabel(
        'Фото возврата в API не требуется — съёмка здесь не запрашивается.',
        'Qaytarish fotosi API da majburiy emas — bu yerda surat olinmaydi.',
      );
}
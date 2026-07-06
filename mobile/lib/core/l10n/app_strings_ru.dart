/// Ruscha matnlar (develop-flutter-mobile-frontend shablon).
abstract final class S {
  static const navHome = 'Главная';
  static const navVisits = 'Визиты';
  static const navReports = 'Отчёты';
  static const navPoints = 'Тор. точки';

  static const home = 'Главная';
  static const visits = 'Визиты';
  static const visitsDisabled = 'Визиты отключены в настройках';
  static const dailyReport = 'Ежедневный отчёт';
  static const mandatorySync = 'Обязательная синхронизация:';
  static const visited = 'Посещено';
  static const remaining = 'Осталось';
  static const unsyncedPhotos = 'Несинхр. фото';
  static const lastSync = 'Последняя синхронизация';
  static const sync = 'Синхронизация';
  static const ordersSumToday = 'Сумма заказов сегодня';
  static const productsVolumeToday = 'Объём товаров сегодня';

  static const visitOrder = 'Добавить заказ';
  static const visitComplete = 'Завершить визит';
  static const visitRefuse = 'Отказ от визита';
  static const refuseReason = 'Причина отказа';
  static const startVisit = 'Начать визит';

  static const syncTitle = 'Синхронизация';
  static const performance = 'Эффективность';
  static const byRoute = 'По маршруту';
  static const offRoute = 'Вне маршрута';
  /// «Осталось» kartochkasi — marshrutdan tashqari qolganlar (takrorlanmasin).
  static const remainingOnRoute = 'Ост. по марш.';
  static const remainingOffRoute = 'Ост. вне марш.';
  /// Hafta kuni qisqacha: 1=ПН … 7=ВС (`weekDays` bilan bir xil).
  static String weekdayShort(int weekday) {
    if (weekday >= 1 && weekday <= 7) return weekDays[weekday];
    return '—';
  }

  /// Chap: bugungi haqiqiy kun bo‘yicha 1 oylik ne-poseshcheniya.
  static String dormantNotVisitedToday(int weekday) =>
      'Не посещ. ${weekdayShort(weekday)}, 1 мес';

  /// O‘ng: noyob mijozlar — 30 kun ichida tashrifsiz (ОКБ).
  static const dormantNotVisitedMonth = 'Не посещ., 1 мес';
  static const syncWindowEndsIn = 'До конца синхронизации';
  static const syncWindowStartsIn = 'Синхронизация через';
  static const syncWindowEndsShort = 'до откл.';
  static const syncWindowStartsShort = 'через';
  static const syncWindowTooltipEnds =
      'Осталось времени до отключения синхронизации. Успейте отправить данные.';
  static const syncWindowTooltipStarts =
      'Синхронизация будет доступна через указанное время.';
  static const syncWindowAlertTitle = 'Синхронизация';
  static const syncWindowTenMinAlert =
      'До отключения синхронизации осталось 10 минут. Отправьте данные сейчас.';
  static const syncNotificationPermissionHint =
      'Разрешите уведомления — напомним за 10 минут до отключения синхронизации и о новых версиях.';
  static const checkAppUpdate = 'Проверить обновление';
  static String appUpdateNotificationBody(String latest, String current) =>
      latest.isEmpty
          ? 'Доступна новая версия. Текущая: $current. Откройте приложение для установки.'
          : 'Версия $latest доступна. У вас: $current. Нажмите, чтобы обновить.';
  static String appUpdateNotificationAfterSync(String latest) =>
      latest.isEmpty
          ? 'Синхронизация завершена. Доступна новая версия — данные уже отправлены.'
          : 'Синхронизация завершена. Установите версию $latest — данные уже отправлены.';
  static const appUpdateTitle = 'Доступна новая версия';
  static const appUpdateTitleRequired = 'Требуется обновление';
  static const appUpdateAfterSyncHint =
      'Синхронизация завершена — данные отправлены на сервер. '
      'После обновления сохранятся: локальный кеш, PIN и пароль для входа.';
  static const appUpdateBeforeInstallHint =
      'Перед обновлением несинхронизированные заказы и фотоотчёты будут отправлены на сервер. '
      'После установки сохранятся: локальный кеш, PIN и пароль для входа.';
  static const visitStatusVisited = 'Посещено';
  static const visitStatusNotVisited = 'Не посещено';
  static const visitPresenceFilter = 'Статус посещения';
  static const shownOnMap = 'Показано на карте';
  static const notShownOnMap = 'Не показано на карте';
  static const mapPointsTitle = 'Торговые точки';
  static const clientsWithDebts = 'Клиенты с долгами';
  static const filter = 'Фильтр';
  static const dayAll = 'Все';
  static const empty = 'Нет данных';
  static const emptyOrders = 'Нет заказов';
  static const emptyVisitPoints = 'Нет точек для визита на этот день';
  static const emptyOutlets = 'Нет торговых точек';
  static const emptyOutletsForDay = 'Нет торговых точек на этот день';
  static const emptyDebtors = 'Нет должников';
  static const emptyStock = 'Нет остатков на складе';
  static const emptyRoutePoints = 'Нет точек на этот день';
  static const emptyMapPoints = 'Нет точек с координатами';
  static const emptySearch = 'Ничего не найдено';
  static const emptyReport = 'Нет продаж за месяц';
  static const emptyClients = 'Нет прикреплённых клиентов';
  static const emptyPhotos = 'Нет фотографий';
  static const emptyProducts = 'Товары не найдены';
  static const emptyCategories = 'Категории товаров не найдены';
  static const emptyDeliveries = 'Нет доставок';
  static const emptyVehicleStock = 'В машине нет товаров';
  static const emptySupervisorVisits = 'Нет визитов';
  static const emptySupervisorAgents = 'Нет данных GPS агентов';
  static const emptyStartVisitClients = 'Нет торговых точек для визита';
  static const emptyDraft = 'Нет черновиков';
  static const emptyClientOrders = 'Нет заказов за месяц';
  static const emptyClientSearch = 'Клиент не найден';
  static const gpsOn = 'GPS включён';
  static const gpsStarting = 'GPS запускается…';

  static const loginTitle = 'Вход';
  static const loginSubtitle = 'Мобильное приложение SalesDoc';
  static const companySlug = 'Код компании';
  static const login = 'Логин';
  static const password = 'Пароль';
  static const signIn = 'Войти';
  static const fillAllFields = 'Заполните все поля';

  static const weekDays = ['Все', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  // Buyurtma yaratish (referens «Добавить заказ»)
  static const orderAddTitle = 'Добавить заказ';
  static const orderWarehouse = 'Склад';
  static const orderPriceType = 'Тип цены';
  static const orderDiscount = 'Скидка (%)';
  static const orderComment = 'Комментарий';
  static const orderConsignment = 'Консигнация';
  static const orderConsignmentDue = 'Срок оплаты';
  static const orderNoConsignmentLimit = 'У вас нет лимита';
  static const creditLimit = 'Кредитный лимит';
  static const limitRemaining = 'Осталось';
  static const consignmentLimit = 'Лимит консигнации';
  static const consignmentNotAvailable = 'Консигнация недоступна для вашего профиля';
  static const close = 'Закрыть';
  static const continueBtn = 'Продолжить';
  static const finish = 'Завершить';
  static const editOrderSetup = 'Изменить основные данные';
  static const clientLabel = 'Клиент';
  static const selectClient = 'Выберите клиента';
  static const syncFirst = 'Сначала выполните синхронизацию';
  static const selectedProducts = 'Выбрано товаров';
  static const total = 'Итого';
  static const draft = 'Черновик';
  static const orderDraftSaved = 'Заказ сохранен в черновик';
  static const orderExitTitle = 'Выйти из добавления заказа?';
  static const orderExitSubtitle = 'Заказ не сохранён. Сохранить как черновик перед выходом?';
  static const orderExitSave = 'Сохранить и выйти';
  static const orderExitDiscard = 'Выйти без сохранения';
  static const orderAddOrder = 'Добавить заказ';
  static const inStock = 'В наличие';
  static const price = 'Цена';
  static const unitPcs = 'Шт';
  static const no = 'Нет';
  static const productsTitle = 'Товары';
  static const retry = 'Повторить';
  static const bonusAddTitle = 'Добавление';
  static const bonusDiscountAddTitle = 'Добавить бонус и скидку';
  static const bonusSection = 'Бонус';
  static const discountSection = 'Скидка';
  static const bonusAuto = 'Авто';
  static const bonusNone = 'Без бонуса';
  static const bonusManual = 'Ручной';
  static const discountAuto = 'Авто';
  static const discountNone = 'Без скидки';
  static const discountManual = 'Выбрать скидку';
  static const bonusPickAssortment = 'Выбрать ассортимента';
  static const bonusQtyLabel = 'Количество бонусов';
  static const bonusEarnedHint = 'По заказу положено';
  static const bonusSelectProduct = 'Выберите бонусный товар';
  static const bonusDistributeHint = 'Распределите бонусы по товарам';
  static const bonusEditGifts = 'Изменить состав';
  static const bonusQtyShort = 'Кол-во';
  static const bonusStockAvailable = 'Доступно для бонуса';
  static const bonusStockShortage = 'Не хватает';
  static const bonusStockInsufficient = 'Недостаточно товара на складе для бонуса';
  static const bonusShortageCommentPrefix = 'Бонус — недостаток на складе';
  static const discountShortageCommentPrefix = 'Скидка';
  static const warehouseStock = 'На складе';
  static const emptyBonuses = 'Нет бонусов';
  static const emptyDiscounts = 'Нет скидок';
  static const discountNotApplied = 'Скидка не будет применена к заказу';
  static const discountCashDeskMissing = 'Касса для оплаты скидки не настроена';
  static const discountLinkBonusRequired = 'Выберите связанный бонус для применения скидки';
  static const noCategory = 'Без категории';
  static const selectBtn = 'Выбрать';
  static const bonusPreviewFailed =
      'Не удалось загрузить правила — выберите «Авто» или «Без бонуса»';
  static const linkedBonusDiscountHint =
      'Бонус и скидка связаны — можно использовать оба';
  static const exclusiveBonusDiscountHint =
      'Можно выбрать только бонус или скидку';
  static const selectCategory = 'Выберите категорию';
}

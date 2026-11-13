/// UI matnlari (shablon o‘zbekcha; fayl nomi tarixiy).
abstract final class S {
  static const navHome = 'Bosh sahifa';
  static const navVisits = 'Vizitlar';
  static const navOrders = 'Buyurtmalar';
  static const navKpi = 'KPI';
  static const navDailyPlan = 'Kunlik reja';
  static const navReports = 'Hisobotlar';
  static const navPoints = 'Nuqtalar';
  static const outlets = 'Savdo nuqtalari';
  static const searchOutlet = 'Nom yoki kod bo\'yicha qidirish…';
  static const staleCatalog = 'Katalog eskirgan — sinxronlang';
  static const withDebt = 'Qarzi bor';
  static const cancel = 'Bekor';
  static const save = 'Saqlash';

  static const home = 'Bosh sahifa';
  static const visits = 'Vizitlar';
  static const visitsDisabled = 'Vizitlar sozlamada o\'chirilgan';
  static const dailyReport = 'Kunlik hisobot';
  static const mandatorySync = 'Majburiy sinxron:';
  static const visited = 'Tashrif';
  static const remaining = 'Qoldi';
  static const unsyncedPhotos = 'Sinx. qilinmagan foto';
  static const syncedPhotos = 'Sinx. foto';
  static const photoSyncStatus = 'Foto holati';
  static const photoSyncOk = 'Sinxronlandi';
  static const photoSyncPending = 'Navbatda';
  static const photoSyncFailed = 'Yuborish xatosi';
  static const lastSync = 'Oxirgi sinxron';
  static const sync = 'Sinxronlash';
  static const ordersSumToday = 'Bugungi buyurtmalar summasi';
  static const productsVolumeToday = 'Bugungi tovar hajmi';
  static String orderCreatedBanner(String number) => 'Buyurtma №$number yaratildi';
  static const orderCreatedBannerHint = 'Buyurtma muvaffaqiyatli yuborildi';

  static const visitOrder = 'Buyurtma qo\'shish';
  static const visitComplete = 'Vizitni yakunlash';
  static const visitInProgressTitle = 'Vizit';
  static const visitActiveLive = 'Vizit faol · LIVE';
  static const visitEndHint = '↓ keyin 5 daqiqalik tahrir oynasi ochiladi';
  static const noOrderToday = 'bugun buyurtma yo\'q';
  static const photoReport = 'Foto hisobot';
  static const createOrderAction = 'Buyurtma yaratish';
  static const sendHeldOrderNow = 'Hozir yuborish';
  static const refusalAction = 'Rad etish';
  static const supervisionChecklist = 'Superviziya chek-list';
  static const draftBadge = 'Qoralama';
  static const visitedBadge = '✓ Tashrif';
  static const visitRefuse = 'Vizitni rad etish';
  static const refuseReason = 'Rad sababi';
  static const startVisit = 'Vizitni boshlash';

  static const syncTitle = 'Sinxronlash';
  static const performance = 'Samaradorlik';
  static const byRoute = 'Marshrut bo\'yicha';
  static const offRoute = 'Marshrutdan tashqari';
  static const remainingOnRoute = 'Marshrutda qoldi';
  static const remainingOffRoute = 'Tashqarida qoldi';
  static String weekdayShort(int weekday) {
    if (weekday >= 1 && weekday <= 7) return weekDays[weekday];
    return '—';
  }

  static String dormantNotVisitedToday(int weekday) =>
      'Tashrif yo\'q ${weekdayShort(weekday)}, 1 oy';

  static const dormantNotVisitedMonth = 'Tashrif yo\'q, 1 oy';
  static const syncWindowEndsIn = 'Sinxron tugashiga';
  static const syncWindowStartsIn = 'Sinxron yoqilishiga';
  static const syncWindowEndsShort = 'gacha o\'ch.';
  static const syncWindowStartsShort = 'gacha yoq.';
  static const syncIn = 'gacha o\'ch.';
  static const syncWindowTooltipEnds =
      'Sinxron o\'chishiga qolgan vaqt. Ma\'lumotlarni yuboring.';
  static const syncWindowTooltipStarts =
      'Sinxron hozir o\'chirilgan. Ko\'rsatilgan vaqtdan keyin yoqiladi.';
  static const syncWindowAlertTitle = 'Sinxronlash';
  static const syncWindowTenMinAlert =
      'Sinxron o\'chishiga 10 daqiqa qoldi. Ma\'lumotlarni hozir yuboring.';
  static const syncNotificationPermissionHint =
      'Bildirishnomaga ruxsat bering — sinxron o\'chishidan 10 daqiqa oldin eslatamiz.';
  static const checkAppUpdate = 'Yangilanishni tekshirish';
  static const appUpdateChecking = 'Yangilanish tekshirilmoqda…';
  static String appUpdateAlreadyLatest(String current) =>
      'Sizda eng so\'nggi versiya: $current';
  static const appUpdateCheckFailed =
      'Yangilanishni tekshirib bo\'lmadi. Internetni tekshiring.';
  static const noVisitsPlannedToday =
      'Bugun rejada nuqta yo\'q. Veb-panelda tashrif kunlarini belgilang.';
  static const noVisitScheduleHint =
      'Tashrif kunlari belgilanmagan — barcha savdo nuqtalari ko\'rsatiladi.';
  static String appUpdateNotificationBody(String latest, String current) =>
      latest.isEmpty
          ? 'Sales Arena yangi versiyasi chiqdi. Hozirgi: $current.'
          : 'Sales Arena $latest chiqdi. Sizda: $current.';
  static String appUpdateNotificationAfterSync(String latest) =>
      latest.isEmpty
          ? 'Sinxron tugadi. Sales Arena yangi versiyasi bor.'
          : 'Sinxron tugadi. Sales Arena $latest ni o\'rnating.';
  static const appUpdateTitle = 'Sales Arena yangilanishi';
  static const appUpdateTitleRequired = 'Sales Arena yangilanishi shart';
  static const appUpdateAfterSyncHint =
      'Sinxron tugadi — ma\'lumotlar serverga yuborildi. '
      'Yangilanishdan keyin mahalliy kesh, PIN va parol saqlanadi.';
  static const appUpdateBeforeInstallHint =
      'Yangilashdan oldin oflayn buyurtma va fotolar yuboriladi. '
      'O\'rnatishdan keyin kesh, PIN va parol saqlanadi.';
  static const visitStatusVisited = 'Tashrif qilingan';
  static const visitStatusNotVisited = 'Tashrif yo\'q';
  static const visitPresenceFilter = 'Tashrif holati';
  static const shownOnMap = 'Xaritada';
  static const notShownOnMap = 'Xaritada yo\'q';
  static const mapPointsTitle = 'Savdo nuqtalari';
  static const clientsWithDebts = 'Qarzdor mijozlar';
  static const filter = 'Filtr';
  static const dayAll = 'Hammasi';
  static const empty = 'Ma\'lumot yo\'q';
  static const emptyOrders = 'Buyurtma yo\'q';
  static const emptyVisitPoints = 'Bu kun uchun vizit nuqtasi yo\'q';
  static const emptyVisitOpenAll = 'Barcha mijozlarni ko\'rsatish';
  static const emptyVisitHasClientsHint =
      'Mijozlar yuklangan, lekin bu kun rejasi bo\'sh';
  static const emptyOutlets = 'Savdo nuqtasi yo\'q';
  static const emptyOutletsForDay = 'Bu kun uchun savdo nuqtasi yo\'q';
  static const emptyDebtors = 'Qarzdorlar yo\'q';
  static const emptyStock = 'Omborda qoldiq yo\'q';
  static const emptyRoutePoints = 'Bu kun uchun nuqta yo\'q';
  static const emptyMapPoints = 'Koordinatali nuqta yo\'q';
  static const emptySearch = 'Hech narsa topilmadi';
  static const emptyReport = 'Oy uchun savdo yo\'q';
  static const emptyClients = 'Biriktirilgan mijoz yo\'q';
  static const emptyPhotos = 'Foto yo\'q';
  static const emptyProducts = 'Mahsulot topilmadi';
  static const emptyCategories = 'Kategoriya topilmadi';
  static const emptyDeliveries = 'Yetkazish yo\'q';
  static const emptyVehicleStock = 'Mashinada tovar yo\'q';
  static const emptySupervisorVisits = 'Vizit yo\'q';
  static const emptySupervisorAgents = 'Agent GPS ma\'lumoti yo\'q';
  static const emptyStartVisitClients = 'Vizit uchun nuqta yo\'q';
  static const emptyDraft = 'Qoralama yo\'q';
  static const emptyClientOrders = 'Oy uchun buyurtma yo\'q';
  static const emptyClientSearch = 'Mijoz topilmadi';
  static const gpsOn = 'GPS yoqilgan';
  static const gpsActive = 'GPS faol';
  static const gpsAccuracy = 'Aniqlik';
  static const gpsStarting = 'GPS ishga tushmoqda…';

  static const appName = 'Sales Arena';
  static const loginTitle = 'Tizimga kirish';
  static const loginSubtitle = 'Sales Arena mobil ilovasi';
  static const companySlug = 'Kompaniya';
  static const companyHint = 'Diler kodi';
  static const login = 'Login';
  static const loginHint = 'Login';
  static const password = 'Parol';
  static const signIn = 'Kirish';
  static const connecting = 'Ulanmoqda…';
  static const help = 'Yordam';
  static const support = 'Texyordam';
  static const fillAllFields = 'Barcha maydonlarni to\'ldiring';

  static const pinSecurity = 'Xavfsizlik';
  static const pinCreate = 'PIN yarating';
  static const pinConfirmTitle = 'PINni tasdiqlang';
  static const pinSubtitle = 'Tezkor kirish uchun 4 raqam';
  static String pinStepLabel(int step) => 'Qadam $step / 2 · $pinConfirmTitle';

  static const pinEnter = 'PINni kiriting';
  static const touchId = 'Touch ID';

  static const fullSync = 'To\'liq sinxronlash';
  static const firstLaunch = 'Birinchi ishga tushirish';
  static const syncRecordsLabel = '847 yozuv';
  static const syncDataUpdated = 'Ma\'lumotlar yangilandi';
  static const syncAllDone = '100% · barcha 847 yozuv';
  static const syncProgressHint =
      'Ma\'lumotlar serverga yuborilmoqda. Ilovani yopmang.';
  static const syncOrdersSent = 'Buyurtmalar yuborildi';
  static const syncPhotosUpload = 'Foto yuklash';
  static const syncClients = 'Mijozlar';
  static String syncRecordsCount(int n) => '$n yozuv';
  static const readyBadge = 'TAYYOR';

  static const weekDays = ['Hammasi', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

  static const orderAddTitle = 'Buyurtma qo\'shish';
  static const orderSetup = 'Buyurtma parametrlari';
  static const orderWarehouse = 'Ombor';
  static const orderPriceType = 'Narx turi';
  static const orderDiscount = 'Skidka (%)';
  static const orderComment = 'Izoh';
  static const orderCommentHint = 'Ixtiyoriy…';
  static const orderConsignment = 'Konsignatsiya';
  static const orderConsignmentDue = 'To\'lov muddati';
  static const orderShipmentDate = 'Yuklash sanasi';
  static const orderNoConsignmentLimit = 'Limitingiz yo\'q';
  static const creditLimit = 'Kredit limiti';
  static const limitRemaining = 'Qoldi';
  static const consignmentLimit = 'Konsignatsiya limiti';
  static const consignmentLimitExceeded = 'Konsignatsiya limiti oshib ketdi';
  static const consignmentNotAvailable =
      'Konsignatsiya profilingiz uchun mavjud emas';
  static const consignmentClientDisabled =
      'Bu mijoz uchun konsignatsiya admin tomonidan taqiqlangan';
  static const consignmentBlockedByDebt =
      'Konsignatsiya taqiqlangan: mijozda konsignatsiya qarzi bor';
  static const orderBlockedByDebt =
      'Oddiy buyurtma taqiqlangan: mijozda qarz bor. Qarzni yoping yoki adminga murojaat qiling';
  static const close = 'Yopish';
  static const continueBtn = 'Davom etish';
  static const continueArrow = 'Davom etish →';
  static const categoryProductsCount = 'mahsulot';
  static const finish = 'Yakunlash';
  static const editOrderSetup = 'Asosiy ma\'lumotlarni o\'zgartirish';
  static const clientLabel = 'Mijoz';
  static const selectClient = 'Mijozni tanlang';
  static const syncFirst = 'Avval sinxronlang';
  static const selectedProducts = 'Tanlangan mahsulotlar';
  static const total = 'Jami';
  static const draft = 'Qoralama';
  static const orderDraftSaved = 'Buyurtma qoralamaga saqlandi';
  static const orderExitTitle = 'Buyurtmadan chiqilsinmi?';
  static const orderExitSubtitle =
      'Buyurtma saqlanmagan. Chiqishdan oldin qoralama qilinsinmi?';
  static const orderExitSave = 'Saqlab chiqish';
  static const orderExitDiscard = 'Saqlamasdan chiqish';
  static const orderAddOrder = 'Buyurtma qo\'shish';
  static const inStock = 'Omborda bor';
  static const outOfStock = 'Qoldiq yo\'q';
  static const price = 'Narx';
  static const unitPcs = 'Dona';
  static const no = 'Yo\'q';
  static const productsTitle = 'Mahsulotlar';
  static const retry = 'Qayta urinish';
  static const bonusAddTitle = 'Qo\'shish';
  static const bonusDiscountAddTitle = 'Bonus va skidka';
  static const bonusSection = 'Bonus';
  static const discountSection = 'Skidka';
  static const bonusAuto = 'Avto';
  static const bonusNone = 'Bonussiz';
  static const discountAuto = 'Avto';
  static const discountNone = 'Skidkasiz';
  static const discountManual = 'Skidka tanlash';
  static const bonusPickAssortment = 'Assortiment tanlash';
  static const bonusQtyLabel = 'Bonus miqdori';
  static const bonusEarnedHint = 'Buyurtma bo\'yicha tegishli';
  static const bonusSelectProduct = 'Bonus mahsulotini tanlang';
  static const bonusDistributeHint = 'Bonuslarni mahsulotlarga taqsimlang';
  static const bonusEditGifts = 'Tarkibni o\'zgartirish';
  static const bonusQtyShort = 'Soni';
  static const bonusStockAvailable = 'Bonus uchun mavjud';
  static const bonusStockShortage = 'Yetarli emas';
  static const bonusStockInsufficient =
      'Bonus uchun omborda tovar yetarli emas';
  static const bonusShortageCommentPrefix = 'Bonus — omborda kamchilik';
  static const discountShortageCommentPrefix = 'Skidka';
  static const warehouseStock = 'Omborda';
  static const emptyBonuses = 'Bonus yo\'q';
  static const emptyBonusesNoActive =
      'Bu buyurtma uchun faol bonus yo\'q';
  static const emptyDiscounts = 'Skidka yo\'q';
  static const discountNotApplied = 'Skidka buyurtmaga qo\'llanilmaydi';
  static const discountCashDeskMissing = 'Skidka uchun kassa sozlanmagan';
  static const discountLinkBonusRequired =
      'Skidka uchun bog\'langan bonusni tanlang';
  static const noCategory = 'Kategoriyasiz';
  static const selectBtn = 'Tanlash';
  static const bonusPreviewFailed =
      'Qoidalarni yuklab bo\'lmadi — «Avto» yoki «Bonussiz» ni tanlang';
  static const bonusFillIncomplete =
      'Barcha tegishli bonuslarni to\'liq to\'ldiring';
  static const bonusStrategyChoiceRequired =
      'Bonus strategiya qoidalarini tanlang';
  static const linkedBonusDiscountHint =
      'Bonus va skidka bog\'langan — ikkalasini ham ishlatish mumkin';
  static const exclusiveBonusDiscountHint =
      'Faqat bonus yoki skidkani tanlash mumkin';
  static const selectCategory = 'Kategoriyani tanlang';
  /// Foto hisobot sabablari spravochnigi.
  static const selectPhotoReason = 'Foto sababini tanlang';
}

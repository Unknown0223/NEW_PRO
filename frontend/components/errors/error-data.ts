export const ERROR_CODES = [401, 403, 404, 429, 500, 502, 503, 504] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorLanguage = "ru" | "uz";
export type ErrorAction = "login" | "retry" | "home";

export type ErrorCopy = {
  tab: string;
  title: string;
  description: string;
  causes: readonly [string, string];
  guidance: string;
  interaction: string;
};

type ErrorDefinition = {
  name: string;
  action: ErrorAction;
  accent: string;
  ru: ErrorCopy;
  uz: ErrorCopy;
};

export const ERRORS: Record<ErrorCode, ErrorDefinition> = {
  401: {
    name: "Unauthorized", action: "login", accent: "#1e63c9",
    ru: {
      tab: "Авторизация", title: "Давайте знакомиться заново",
      description: "Для этой страницы нужно войти в аккаунт. Подтвердите, что это вы, и продолжайте работу.",
      causes: ["Срок действия сессии истёк.", "Данные авторизации отсутствуют или недействительны."],
      guidance: "Войдите заново. Если ошибка повторяется, обратитесь к администратору.",
      interaction: "Пропуск ждёт подтверждения личности.",
    },
    uz: {
      tab: "Avtorizatsiya", title: "Hisobingizga qayta kiring",
      description: "Bu sahifa uchun hisobga kirish kerak. Shaxsingizni tasdiqlab, ishni davom ettiring.",
      causes: ["Sessiyaning amal qilish muddati tugagan.", "Kirish ma'lumotlari yo'q yoki yaroqsiz."],
      guidance: "Hisobga qayta kiring. Xato takrorlansa, administratorga murojaat qiling.",
      interaction: "Kirish kartasi shaxs tasdig'ini kutmoqda.",
    },
  },
  403: {
    name: "Forbidden", action: "retry", accent: "#1e63c9",
    ru: {
      tab: "Нет доступа", title: "Доступ ограничен",
      description: "Вы на верном пути, но эта дверь пока закрыта. Для просмотра раздела нужны дополнительные права.",
      causes: ["Вашей роли не разрешён доступ к этому разделу.", "Доступ ограничен политикой организации."],
      guidance: "Попросите администратора проверить права. Повторный вход сам по себе не выдаёт доступ.",
      interaction: "Надёжный замок. Ключ есть у администратора.",
    },
    uz: {
      tab: "Kirish cheklangan", title: "Bu eshik hozircha yopiq",
      description: "To'g'ri manzildasiz, ammo bu bo'limni ko'rish uchun qo'shimcha ruxsat kerak.",
      causes: ["Rolingizga bu bo'limni ko'rish huquqi berilmagan.", "Kirish tashkilot qoidalari bilan cheklangan."],
      guidance: "Administratordan huquqlaringizni tekshirishni so'rang. Qayta kirishning o'zi ruxsat bermaydi.",
      interaction: "Ishonchli qulf. Kalit administratorda.",
    },
  },
  404: {
    name: "Not Found", action: "home", accent: "#1e63c9",
    ru: {
      tab: "Не найдено", title: "Кажется, здесь ничего нет",
      description: "Мы заглянули в каждый уголок, но не нашли эту страницу. Вернёмся туда, где всё на месте?",
      causes: ["В адресе страницы есть опечатка.", "Страница удалена, перенесена или ещё не создана."],
      guidance: "Проверьте адрес или найдите нужный раздел в меню. Не повторяйте один и тот же запрос.",
      interaction: "Поиск завершён: по этому адресу страницы нет.",
    },
    uz: {
      tab: "Topilmadi", title: "Bu yerda hech narsa topilmadi",
      description: "Hamma joyni qidirdik, lekin bu sahifani topa olmadik. Bosh sahifaga qaytamizmi?",
      causes: ["Sahifa manzilida xato bor.", "Sahifa o'chirilgan, ko'chirilgan yoki yaratilmagan."],
      guidance: "Manzilni tekshiring yoki kerakli bo'limni menyudan toping.",
      interaction: "Qidiruv tugadi: bu manzilda sahifa yo'q.",
    },
  },
  429: {
    name: "Too Many Requests", action: "retry", accent: "#b77a19",
    ru: {
      tab: "Лимит запросов", title: "Давайте немного замедлимся",
      description: "Запросов оказалось слишком много. Небольшая пауза поможет системе снова вас услышать.",
      causes: ["За короткое время отправлено слишком много запросов.", "Достигнут лимит аккаунта, IP-адреса или API."],
      guidance: "Дождитесь окончания таймера. В рабочем приложении время задаёт заголовок Retry-After; не обновляйте страницу многократно.",
      interaction: "Небольшая пауза. Таймер продолжает идти.",
    },
    uz: {
      tab: "So'rovlar limiti", title: "Biroz sekinlashamizmi?",
      description: "So'rovlar juda ko'payib ketdi. Qisqa tanaffusdan keyin yana urinib ko'rishingiz mumkin.",
      causes: ["Qisqa vaqt ichida juda ko'p so'rov yuborilgan.", "Hisob, IP manzil yoki API limiti tugagan."],
      guidance: "Taymer tugashini kuting. Ishchi ilovada vaqt Retry-After sarlavhasidan olinadi. Sahifani ketma-ket yangilamang.",
      interaction: "Qisqa tanaffus. Taymer hisoblashda davom etmoqda.",
    },
  },
  500: {
    name: "Internal Server Error", action: "retry", accent: "#c46058",
    ru: {
      tab: "Ошибка сервера", title: "Что-то пошло не по плану",
      description: "Сервер столкнулся с неожиданной ошибкой. Это не ваша вина. Попробуйте ещё раз немного позже.",
      causes: ["В приложении возникла необработанная ошибка.", "Не удалось выполнить внутреннюю операцию сервера."],
      guidance: "Если сбой повторяется, передайте код ошибки и время обращения поддержке. Точная причина определяется по журналам сервера.",
      interaction: "Нужна проверка сервера, а не вашего устройства.",
    },
    uz: {
      tab: "Server xatosi", title: "Nimadir reja bo'yicha ketmadi",
      description: "Serverda kutilmagan xato yuz berdi. Bu sizning aybingiz emas. Birozdan keyin yana urinib ko'ring.",
      causes: ["Ilovada qayta ishlanmagan xato yuz bergan.", "Server ichki amalni bajara olmagan."],
      guidance: "Xato takrorlansa, kod va vaqtni yordam xizmatiga yuboring. Aniq sabab server jurnallaridan aniqlanadi.",
      interaction: "Qurilmangizni emas, serverni tekshirish kerak.",
    },
  },
  502: {
    name: "Bad Gateway", action: "retry", accent: "#1e63c9",
    ru: {
      tab: "Ошибка шлюза", title: "Сервисы не поняли друг друга",
      description: "Шлюз получил некорректный ответ от другого сервера. Дадим им немного времени восстановить связь.",
      causes: ["Вышестоящий сервер вернул некорректный ответ.", "Прокси или балансировщик не смог обработать ответ сервиса."],
      guidance: "Попробуйте позже. Если ошибка сохраняется, поддержке стоит проверить шлюз и зависимые сервисы.",
      interaction: "Связь есть, но ответ сервиса нельзя обработать.",
    },
    uz: {
      tab: "Shlyuz xatosi", title: "Xizmatlar bir-birini tushunmadi",
      description: "Shlyuz boshqa serverdan noto'g'ri javob oldi. Aloqa tiklanishi uchun biroz vaqt beramiz.",
      causes: ["Yuqori server noto'g'ri javob qaytargan.", "Proksi yoki yuk taqsimlagich xizmat javobini qayta ishlay olmagan."],
      guidance: "Birozdan keyin urinib ko'ring. Muammo davom etsa, shlyuz va bog'liq xizmatlarni tekshirtiring.",
      interaction: "Aloqa bor, lekin xizmat javobini qayta ishlash imkonsiz.",
    },
  },
  503: {
    name: "Service Unavailable", action: "retry", accent: "#b77a19",
    ru: {
      tab: "Недоступен", title: "Сервис взял короткую паузу",
      description: "Сейчас сервер не может принять запрос. Пожалуйста, вернитесь чуть позже.",
      causes: ["Может выполняться техническое обслуживание.", "Сервис перегружен или временно недоступен."],
      guidance: "Если сервер передал Retry-After, дождитесь указанного времени. Точный срок восстановления пока неизвестен.",
      interaction: "Техническая пауза, а не потерянная страница.",
    },
    uz: {
      tab: "Xizmat mavjud emas", title: "Xizmat qisqa tanaffusda",
      description: "Server hozir so'rovni qabul qila olmaydi. Iltimos, birozdan keyin qayting.",
      causes: ["Texnik xizmat ko'rsatilayotgan bo'lishi mumkin.", "Xizmat ortiqcha yuklangan yoki vaqtincha ishlamayapti."],
      guidance: "Server Retry-After yuborsa, ko'rsatilgan vaqtni kuting. Tiklanishning aniq vaqti hozircha noma'lum.",
      interaction: "Sahifa yo'qolmagan, xizmat vaqtincha tanaffusda.",
    },
  },
  504: {
    name: "Gateway Timeout", action: "retry", accent: "#b77a19",
    ru: {
      tab: "Время ожидания", title: "Ответ немного задержался",
      description: "Шлюз слишком долго ждал другой сервер. Время ожидания истекло, но вы можете попробовать позже.",
      causes: ["Вышестоящий сервер не ответил за отведённое время.", "Между сервисами возникла задержка сети или долгая операция."],
      guidance: "Перед повтором заказа или платежа проверьте его состояние: операция могла завершиться без ответа.",
      interaction: "Время вышло. Это не обязательно означает отмену операции.",
    },
    uz: {
      tab: "Kutish vaqti", title: "Javob biroz kechikdi",
      description: "Shlyuz boshqa serverning javobini juda uzoq kutdi. Kutish vaqti tugadi, keyinroq urinib ko'ring.",
      causes: ["Yuqori server belgilangan vaqtda javob bermagan.", "Xizmatlar orasida tarmoq kechikishi yoki uzoq amal bor."],
      guidance: "Buyurtma yoki to'lovni takrorlashdan oldin holatini tekshiring: amal javobsiz ham bajarilgan bo'lishi mumkin.",
      interaction: "Vaqt tugadi. Bu amal bekor qilinganini anglatmaydi.",
    },
  },
};

export const UI = {
  ru: {
    studio: "Системные страницы", preview: "Предпросмотр", tabs: "Выберите код ошибки",
    causes: "Возможные причины", details: "Что делать?", primary: { login: "Войти в аккаунт", retry: "Попробовать снова", home: "На главную" },
    checkAccess: "Проверить доступ", back: "Вернуться назад", home: "На главную", request: "Запросить доступ", support: "Сообщить о проблеме",
    checking: "Проверяем...", countdown: "Повторить через", ready: "Можно попробовать снова", seconds: "с",
    interact: "Нажмите на иллюстрацию", pause: "Остановить анимацию", resume: "Включить анимацию", replay: "Повторить", paused: "Анимация на паузе",
    demo: "Демо-режим. Сервер не подключён.", retryDemo: "Демо: повторная попытка выполнена. Ответ сервера не проверяется.",
    retryFail: "Не удалось выполнить запрос. Попробуйте позже.", retryComplete: "Попытка завершена. Если ошибка сохраняется, обратитесь в поддержку.",
    copy: "Скопировать", copied: "Скопировано", download: "Скачать обращение", close: "Закрыть",
    reportTitle: "Передать в поддержку", reportDescription: "Сохраните описание и передайте его администратору. В демо обращение не отправляется на сервер.",
    notes: "Что произошло?", notesPlaceholder: "Например: ошибка появилась при открытии отчёта...", diagnostic: "Диагностика", copyFailed: "Копирование недоступно. Скачайте обращение.",
    loginTitle: "Вернёмся к работе", loginDescription: "В рабочем приложении эта кнопка открывает страницу входа /login. Здесь можно продолжить просмотр без авторизации.", demoLogin: "Открыть демо-панель",
    reference: "Код обращения", viewAll: "Все системные страницы",
  },
  uz: {
    studio: "Tizim sahifalari", preview: "Ko'rib chiqish", tabs: "Xato kodini tanlang",
    causes: "Mumkin bo'lgan sabablar", details: "Nima qilish kerak?", primary: { login: "Hisobga kirish", retry: "Qayta urinish", home: "Bosh sahifaga" },
    checkAccess: "Ruxsatni tekshirish", back: "Orqaga qaytish", home: "Bosh sahifaga", request: "Ruxsat so'rash", support: "Muammo haqida xabar",
    checking: "Tekshirilmoqda...", countdown: "Qayta urinishgacha", ready: "Endi qayta urinib ko'rishingiz mumkin", seconds: "s",
    interact: "Rasmni bosib ko'ring", pause: "Animatsiyani to'xtatish", resume: "Animatsiyani yoqish", replay: "Takrorlash", paused: "Animatsiya to'xtatilgan",
    demo: "Demo-rejim. Server ulanmagan.", retryDemo: "Demo: qayta urinish bajarildi. Server javobi tekshirilmaydi.",
    retryFail: "So'rov bajarilmadi. Birozdan keyin urinib ko'ring.", retryComplete: "Urinish tugadi. Xato davom etsa, yordam xizmatiga murojaat qiling.",
    copy: "Nusxalash", copied: "Nusxalandi", download: "Murojaatni yuklash", close: "Yopish",
    reportTitle: "Yordam xizmatiga murojaat", reportDescription: "Tavsifni saqlab, administratorga yuboring. Demoda murojaat serverga yuborilmaydi.",
    notes: "Nima yuz berdi?", notesPlaceholder: "Masalan: hisobotni ochishda xato chiqdi...", diagnostic: "Diagnostika", copyFailed: "Nusxalash imkonsiz. Murojaatni yuklab oling.",
    loginTitle: "Ishga qaytamiz", loginDescription: "Ishchi ilovada bu tugma /login sahifasini ochadi. Bu yerda avtorizatsiyasiz demoni ko'rishingiz mumkin.", demoLogin: "Demo-panelni ochish",
    reference: "Murojaat kodi", viewAll: "Barcha tizim sahifalari",
  },
} as const;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "number" && (ERROR_CODES as readonly number[]).includes(value);
}

// Retry-After accepts either delay-seconds or an HTTP date.
export function retryDelay(value: string | number | undefined, now = Date.now()): number {
  if (value === undefined) return 0;
  const text = String(value).trim();
  const seconds = /^\d+(\.\d+)?$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
}
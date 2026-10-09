import { sendApiError } from "../../lib/api-error";

function isTechnicalPrismaMessage(m: string): boolean {
  return (
    /Invalid `?\w+\.create\(\)`? invocation|Argument [`']?\w+[`']? is missing/i.test(m) ||
    /PrismaClient|prisma\.|node_modules|[A-Za-z]:\\|\.ts:\d+/i.test(m) ||
    /invocation in\s+/i.test(m)
  );
}

/** Async sessiya / sync apply — foydalanuvchiga sodda o‘zbekcha matn. */
export function humanizeMigrationApplyError(e: unknown): string {
  const prismaCode =
    e !== null && typeof e === "object" && "code" in e
      ? String((e as { code?: unknown }).code ?? "")
      : "";
  if (prismaCode === "P2002") {
    return "Найдена дублирующая запись. Загрузите в пустую компанию или выберите «Оставить старое / Заменить новым».";
  }
  if (prismaCode === "P2003") {
    return "Ошибка связи (foreign key). Сначала импортируйте справочники или загрузите в пустую компанию.";
  }
  if (prismaCode === "P2021" || prismaCode === "P2022") {
    return "База данных не обновлена. Обратитесь к администратору.";
  }

  if (e instanceof Error) {
    const m = e.message.trim();
    if (m === "TARGET_NOT_EMPTY") {
      return "В этой компании уже есть данные. Загрузите в пустую компанию или продолжите в окне дубликатов.";
    }
    if (m === "PROFILE_MISSING") {
      return "Профиль компании не найден. Архив неполный — выполните экспорт заново.";
    }
    if (m === "NOT_FOUND") {
      return "Компания или профиль не найдены. Обновите страницу и попробуйте снова.";
    }
    if (m === "INVALID_BRANCH_CASH_DESK") {
      return "ID кассы филиала отсутствует в целевой компании. Сначала импортируйте кассы/справочники или загрузите в пустую компанию.";
    }
    if (m === "DUPLICATE_BRANCH_CASH_DESK") {
      return "В настройках филиала одна и та же касса привязана дважды. Проверьте связи филиал/касса в архиве.";
    }
    if (m === "EMPTY_EXPORT") {
      return "Экспорт получился пустым. Выполните экспорт заново.";
    }
    if (m.startsWith("INVALID_BACKUP:")) {
      return m.replace("INVALID_BACKUP:", "").trim() || "Архив резервной копии недействителен.";
    }
    if (m.startsWith("IMPORT_MAP_ERROR:")) {
      return (
        m.replace("IMPORT_MAP_ERROR:", "").trim() ||
        "Ошибка связей: некоторые записи не найдены. Сначала импортируйте справочники."
      );
    }
    if (/Unexpected token|JSON|SyntaxError/i.test(m) || e instanceof SyntaxError) {
      return "Данные в архиве повреждены. Выполните экспорт заново.";
    }
    if (/Transaction.*timeout|Interactive transaction/i.test(m)) {
      return "Импорт выполнялся слишком долго. Попробуйте архив поменьше или пустую компанию.";
    }
    if (/Argument [`']?product[`']? is missing|product_id/i.test(m) && /missing|null|Invalid/i.test(m)) {
      return "Цена товара не импортирована: товар не найден. Сначала отметьте основные справочники (товары).";
    }
    if (isTechnicalPrismaMessage(m)) {
      return "Импорт не выполнен: некоторые связи не найдены. Проверьте справочники и повторите попытку.";
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(m) || /^P20\d{2}/.test(m)) {
      return `Импорт не выполнен (${m}). Повторите попытку или загрузите в пустую компанию.`;
    }
    if (/[A-Za-z]:\\|node_modules|\.ts:\d+/.test(m)) {
      return "Импорт не выполнен. Повторите попытку.";
    }
    if (m) return m;
  }
  return "Импорт не выполнен. Повторите попытку.";
}

/** Sync apply xatolarini API javobiga aylantirish. true = javob yuborildi. */
export function mapMigrationApplyError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
): boolean {
  if (e instanceof Error && e.message === "TARGET_NOT_EMPTY") {
    void sendApiError(
      reply,
      request,
      409,
      "TargetNotEmpty",
      "В этой компании уже есть данные. Загрузите в пустую компанию или подтвердите «Продолжить» в окне дубликатов."
    );
    return true;
  }
  if (e instanceof Error && e.message === "PROFILE_MISSING") {
    void sendApiError(
      reply,
      request,
      400,
      "ProfileMissing",
      "Профиль компании не найден. Архив неполный — выполните экспорт заново."
    );
    return true;
  }
  if (e instanceof Error && e.message === "INVALID_BRANCH_CASH_DESK") {
    void sendApiError(
      reply,
      request,
      400,
      "InvalidBranchCashDesk",
      humanizeMigrationApplyError(e)
    );
    return true;
  }
  if (e instanceof Error && e.message === "DUPLICATE_BRANCH_CASH_DESK") {
    void sendApiError(
      reply,
      request,
      400,
      "DuplicateBranchCashDesk",
      humanizeMigrationApplyError(e)
    );
    return true;
  }
  if (e instanceof Error && e.message.startsWith("IMPORT_MAP_ERROR:")) {
    void sendApiError(
      reply,
      request,
      422,
      "ImportMapError",
      e.message.replace("IMPORT_MAP_ERROR:", "").trim() ||
        "Ошибка связей: некоторые записи не найдены. Сначала импортируйте справочники."
    );
    return true;
  }
  if (e instanceof Error && e.message.startsWith("INVALID_BACKUP:")) {
    void sendApiError(
      reply,
      request,
      400,
      "InvalidBackup",
      e.message.replace("INVALID_BACKUP:", "").trim() || "Архив резервной копии недействителен."
    );
    return true;
  }
  const prismaCode =
    e !== null && typeof e === "object" && "code" in e
      ? String((e as { code?: unknown }).code ?? "")
      : "";
  if (prismaCode === "P2002") {
    void sendApiError(
      reply,
      request,
      409,
      "DuplicateKey",
      "Найдена дублирующая запись. Загрузите в пустую компанию или выберите «Оставить старое / Заменить новым»."
    );
    return true;
  }
  if (prismaCode === "P2021" || prismaCode === "P2022") {
    void sendApiError(
      reply,
      request,
      503,
      "DatabaseSchemaMismatch",
      "База данных не обновлена. Обратитесь к администратору."
    );
    return true;
  }
  if (e instanceof Error && /Transaction.*timeout|Interactive transaction/i.test(e.message)) {
    void sendApiError(
      reply,
      request,
      504,
      "ImportTimeout",
      "Импорт выполнялся слишком долго. Попробуйте архив поменьше или пустую компанию."
    );
    return true;
  }
  if (e instanceof SyntaxError) {
    void sendApiError(
      reply,
      request,
      400,
      "InvalidBackup",
      "Данные в архиве повреждены (JSON). Выполните экспорт заново."
    );
    return true;
  }
  if (e instanceof Error && isTechnicalPrismaMessage(e.message)) {
    void sendApiError(reply, request, 422, "ImportDataError", humanizeMigrationApplyError(e));
    return true;
  }
  return false;
}

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
  if (e instanceof Error) {
    const m = e.message.trim();
    if (m === "TARGET_NOT_EMPTY") {
      return "Bu tenant allaqachon ma’lumotlarga ega. Bo‘sh tenantga yuklang yoki dublikat oynasida davom eting.";
    }
    if (m === "PROFILE_MISSING") {
      return "Kompaniya profili topilmadi. Arxiv to‘liq emas — qayta eksport qiling.";
    }
    if (m.startsWith("INVALID_BACKUP:")) {
      return m.replace("INVALID_BACKUP:", "").trim() || "Zaxira arxivi yaroqsiz.";
    }
    if (m.startsWith("IMPORT_MAP_ERROR:")) {
      return (
        m.replace("IMPORT_MAP_ERROR:", "").trim() ||
        "Bog‘lanish xatosi: ba’zi yozuvlar topilmadi. Avval spravochniklarni import qiling."
      );
    }
    if (/Unexpected token|JSON|SyntaxError/i.test(m) || e instanceof SyntaxError) {
      return "Arxiv ichidagi ma’lumot buzilgan. Qayta eksport qiling.";
    }
    if (/Transaction.*timeout|Interactive transaction/i.test(m)) {
      return "Import juda uzoq davom etdi. Kichikroq arxiv yoki bo‘sh tenantga urinib ko‘ring.";
    }
    if (/Argument [`']?product[`']? is missing|product_id/i.test(m) && /missing|null|Invalid/i.test(m)) {
      return "Mahsulot narxi import qilinmadi: mahsulot topilmadi. Avval asosiy spravochniklarni (mahsulotlar) belgilang.";
    }
    if (isTechnicalPrismaMessage(m)) {
      return "Import amalga oshmadi: ba’zi bog‘lanishlar topilmadi. Spravochniklarni tekshirib, qayta urinib ko‘ring.";
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(m) || /^P20\d{2}/.test(m)) {
      return "Import amalga oshmadi. Qayta urinib ko‘ring yoki bo‘sh tenantga yuklang.";
    }
    if (/[A-Za-z]:\\|node_modules|\.ts:\d+/.test(m)) {
      return "Import amalga oshmadi. Qayta urinib ko‘ring.";
    }
    if (m) return m;
  }
  return "Import amalga oshmadi. Qayta urinib ko‘ring.";
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
      "Bu tenant allaqachon ma’lumotlarga ega. Bo‘sh tenantga yuklang yoki dublikat oynasida «davom etish»ni tasdiqlang."
    );
    return true;
  }
  if (e instanceof Error && e.message === "PROFILE_MISSING") {
    void sendApiError(
      reply,
      request,
      400,
      "ProfileMissing",
      "Kompaniya profili topilmadi. Arxiv to‘liq emas — qayta eksport qiling."
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
        "Bog‘lanish xatosi: ba’zi yozuvlar topilmadi. Avval spravochniklarni import qiling."
    );
    return true;
  }
  if (e instanceof Error && e.message.startsWith("INVALID_BACKUP:")) {
    void sendApiError(
      reply,
      request,
      400,
      "InvalidBackup",
      e.message.replace("INVALID_BACKUP:", "").trim() || "Zaxira arxivi yaroqsiz."
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
      "Dublikat yozuv topildi. Bo‘sh tenantga yuklang yoki «Eskisini qoldirish / Yangisini almashtirish» ni tanlang."
    );
    return true;
  }
  if (prismaCode === "P2021" || prismaCode === "P2022") {
    void sendApiError(
      reply,
      request,
      503,
      "DatabaseSchemaMismatch",
      "Ma’lumotlar bazasi yangilanmagan. Administratorga murojaat qiling."
    );
    return true;
  }
  if (e instanceof Error && /Transaction.*timeout|Interactive transaction/i.test(e.message)) {
    void sendApiError(
      reply,
      request,
      504,
      "ImportTimeout",
      "Import juda uzoq davom etdi. Kichikroq arxiv yoki bo‘sh tenantga urinib ko‘ring."
    );
    return true;
  }
  if (e instanceof SyntaxError) {
    void sendApiError(
      reply,
      request,
      400,
      "InvalidBackup",
      "Arxiv ichidagi ma’lumot buzilgan (JSON). Qayta eksport qiling."
    );
    return true;
  }
  if (e instanceof Error && isTechnicalPrismaMessage(e.message)) {
    void sendApiError(reply, request, 422, "ImportDataError", humanizeMigrationApplyError(e));
    return true;
  }
  return false;
}

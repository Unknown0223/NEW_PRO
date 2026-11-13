/**
 * Prisma / Postgres xatolarini foydalanuvchi uchun qisqa 4xx ga aylantirish.
 * Global error handler da — «Непредвиденная ошибка» o‘rniga tushunarli matn.
 */

export type PrismaUserFacingError = {
  statusCode: number;
  error: string;
  message: string;
};

function errorText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.message}\n${error.stack ?? ""}`;
  if (typeof error === "object") {
    const o = error as { message?: unknown; meta?: unknown; cause?: unknown };
    const parts = [o.message, o.meta != null ? JSON.stringify(o.meta) : "", o.cause];
    return parts.map((p) => (p == null ? "" : String(p))).join("\n");
  }
  return String(error);
}

/** Check constraint / known Prisma → qisqa biznes xabar. */
export function mapPrismaToUserFacingError(error: unknown): PrismaUserFacingError | null {
  const text = errorText(error);
  if (!text) return null;

  if (/stock_reserved_qty_nonneg/i.test(text) || /reserved_qty.*check constraint/i.test(text)) {
    return {
      statusCode: 409,
      error: "StockReserveConflict",
      message: "Резерв склада сбился. Обновите страницу и повторите."
    };
  }

  if (/stock_qty_nonneg|violates check constraint "stock_/i.test(text)) {
    return {
      statusCode: 409,
      error: "StockQtyConflict",
      message: "Остаток склада не позволяет операцию. Проверьте склад и повторите."
    };
  }

  const name = error !== null && typeof error === "object" ? (error as { name?: string }).name : undefined;
  const code =
    error !== null && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  // Postgres check / unique orqali Prisma Unknown
  if (name === "PrismaClientUnknownRequestError" && /23514|check constraint/i.test(text)) {
    return {
      statusCode: 409,
      error: "DatabaseConstraintConflict",
      message: "Данные на складе конфликтуют. Обновите и повторите."
    };
  }

  if (code === "P2002") {
    return {
      statusCode: 409,
      error: "DuplicateRecord",
      message: "Такая запись уже есть."
    };
  }

  if (code === "P2003") {
    return {
      statusCode: 400,
      error: "RelatedRecordMissing",
      message: "Связанная запись не найдена. Проверьте данные."
    };
  }

  if (code === "P2025") {
    return {
      statusCode: 404,
      error: "RecordNotFound",
      message: "Запись не найдена или уже изменена."
    };
  }

  return null;
}

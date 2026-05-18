import type { AxiosError } from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";

/** POST /agents|expeditors|supervisors|operators — login band va boshqa maxsus kodlar; qolganlari `getUserFacingError`. */
export function messageFromStaffCreateError(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error;
  if (status === 409 && code === "LoginExists") {
    return withApiSupportLine("Bu login allaqachon band. Boshqa login kiriting.", err);
  }
  if (status === 409 && code === "CashDeskUserLinkExists") {
    return withApiSupportLine("Bu foydalanuvchi allaqachon boshqa kassaga bog‘langan.", err);
  }
  if (status === 400 && code === "CashDeskOperatorOnly") {
    return withApiSupportLine("Kassa bog‘lanishi faqat «Operator» roli uchun.", err);
  }
  if (status === 400 && code === "ValidationError") {
    const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
    const hint =
      flat != null
        ? firstValidationUserHint(flat)
        : typeof ax.response?.data?.message === "string"
          ? ax.response.data.message.trim() || undefined
          : undefined;
    const base = hint ?? "Ma’lumotlarni tekshiring.";
    return withApiSupportLine(base, err);
  }
  return getUserFacingError(err, "Xodimni qo‘shishda xatolik.");
}

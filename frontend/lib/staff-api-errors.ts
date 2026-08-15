import type { AxiosError } from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";

/** POST /agents|expeditors|supervisors|operators — login band va boshqa maxsus kodlar; qolganlari `getUserFacingError`. */
export function messageFromStaffCreateError(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error;
  if (status === 409 && code === "LoginExists") {
    return withApiSupportLine("Этот логин уже занят. Укажите другой логин.", err);
  }
  if (status === 409 && code === "AgentAlreadyAssigned") {
    return withApiSupportLine(
      "Tanlangan agent allaqachon boshqa supervizorga bog‘langan.",
      err
    );
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

/** PATCH supervisor — agent allaqachon boshqa SVRga bog‘langan. */
export function messageFromSupervisorPatchError(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error;
  if (status === 409 && code === "AgentAlreadyAssigned") {
    return withApiSupportLine(
      "Bu agent allaqachon boshqa supervizorga bog‘langan. Avval u yerdan ajrating.",
      err
    );
  }
  if (typeof ax.response?.data?.message === "string" && ax.response.data.message.trim()) {
    return withApiSupportLine(ax.response.data.message.trim(), err);
  }
  return getUserFacingError(err, "Supervizorni saqlashda xatolik.");
}

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
      "Выбранный агент уже привязан к другому супервайзеру.",
      err
    );
  }
  if (status === 409 && code === "CashDeskUserLinkExists") {
    return withApiSupportLine("Этот пользователь уже привязан к другой кассе.", err);
  }
  if (status === 400 && code === "CashDeskOperatorOnly") {
    return withApiSupportLine("Привязка к кассе доступна только для роли «Оператор».", err);
  }
  if (status === 400 && code === "ValidationError") {
    const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
    const hint =
      flat != null
        ? firstValidationUserHint(flat)
        : typeof ax.response?.data?.message === "string"
          ? ax.response.data.message.trim() || undefined
          : undefined;
    const base = hint ?? "Проверьте введённые данные.";
    return withApiSupportLine(base, err);
  }
  return getUserFacingError(err, "Ошибка при добавлении сотрудника.");
}

/** PATCH supervisor — agent allaqachon boshqa SVRga bog‘langan. */
export function messageFromSupervisorPatchError(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error;
  if (status === 409 && code === "LoginExists") {
    return withApiSupportLine("Этот логин уже занят. Укажите другой логин.", err);
  }
  if (status === 409 && code === "AgentAlreadyAssigned") {
    return withApiSupportLine(
      "Этот агент уже привязан к другому супервайзеру. Сначала отвяжите его там.",
      err
    );
  }
  if (status === 409 && code === "WorkplaceOnSlot") {
    return withApiSupportLine(
      "Настройки места меняются в «Рабочее место», не в карточке сотрудника.",
      err
    );
  }
  if (typeof ax.response?.data?.message === "string" && ax.response.data.message.trim()) {
    return withApiSupportLine(ax.response.data.message.trim(), err);
  }
  return getUserFacingError(err, "Ошибка при сохранении супервайзера.");
}

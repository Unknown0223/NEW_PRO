"use client";

import { type ReactNode } from "react";
import { isAxiosError } from "axios";
import { getUserFacingError } from "@/lib/error-utils";

export function FaceLoginModeBtn({
  active,
  onClick,
  children,
  disabled
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? "flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          : "flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

export function faceVerifyError(err: unknown, fallback = "Не удалось проверить Face ID"): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    if (body?.message) return body.message;
    if (body?.error === "FACE_MISMATCH") return "Лицо не совпало с эталоном";
    if (body?.error === "FACE_LIVENESS_FAILED") return "Проверка живости не пройдена";
    if (body?.error === "REFERENCE_MISSING") return "Нет эталонного фото Face ID";
    if (body?.error === "FACE_CHALLENGE_EXPIRED") {
      return "Срок проверки истёк. Нажмите «Обновить QR» или войдите снова.";
    }
  }
  return getUserFacingError(err, fallback);
}

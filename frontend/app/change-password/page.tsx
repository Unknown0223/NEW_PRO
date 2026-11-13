"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function ChangePasswordPage() {
  const router = useRouter();
  const hydrated = useAuthStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const mustChange = useAuthStore((s) => s.mustChangePassword);
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!hydrated) {
    return <main className="mx-auto max-w-md p-8 text-sm text-neutral-600">Загрузка…</main>;
  }
  if (!accessToken) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Новый пароль и подтверждение не совпадают.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Пароль: минимум 8 символов, буква и цифра.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword
      });
      setMustChangePassword(false);
      router.replace("/dashboard");
    } catch {
      setError("Не удалось сменить пароль. Проверьте текущий пароль и правила (буква + цифра).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Смена пароля</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {mustChange
            ? "Администратор требует сменить временный пароль перед работой."
            : "Введите текущий и новый пароль."}
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Текущий пароль
          <input
            className="rounded border px-3 py-2"
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Новый пароль
          <input
            className="rounded border px-3 py-2"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Подтверждение
          <input
            className="rounded border px-3 py-2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Сохранение…" : "Сохранить"}
        </button>
        {!mustChange ? (
          <button
            type="button"
            className="text-sm text-neutral-500 underline"
            onClick={() => router.back()}
          >
            Назад
          </button>
        ) : (
          <button
            type="button"
            className="text-sm text-neutral-500 underline"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            Выйти
          </button>
        )}
      </form>
    </main>
  );
}

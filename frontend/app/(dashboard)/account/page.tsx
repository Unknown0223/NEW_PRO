"use client";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2, Monitor, Star, UserCircle } from "lucide-react";
import { useState } from "react";

type MeUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  code?: string | null;
  app_access?: boolean | null;
};

type TabKey = "general" | "sessions" | "password" | "favorites";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  supervisor: "Супервайзер",
  director: "Директор",
  sales_director: "Директор по продажам",
  regional_manager: "Региональный менеджер",
  accountant: "Бухгалтер",
  agent: "Агент",
  expeditor: "Экспедитор",
  collector: "Инкассатор",
  skladchik: "Складчик",
  warehouse: "Складчик",
  auditor: "Аудитор"
};

function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

function initials(name: string, login: string): string {
  const src = (name || login || "").trim();
  if (!src) return "—";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const NAV: { key: TabKey; label: string; icon: typeof UserCircle; group?: string }[] = [
  { key: "general", label: "Общие данные", icon: UserCircle },
  { key: "sessions", label: "Активные сессии", icon: Monitor },
  { key: "password", label: "Пароль", icon: KeyRound, group: "Настройки" },
  { key: "favorites", label: "Избранные страницы", icon: Star, group: "Настройки" }
];

function SoonNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
      <span className="mr-2 rounded bg-amber-300/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Скоро
      </span>
      {text}
    </div>
  );
}

export default function AccountPage() {
  const { tenantSlug } = useAuthStore();
  const [tab, setTab] = useState<TabKey>("general");

  const meQ = useQuery({
    queryKey: ["me", "account", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ user: MeUser }>("/auth/me");
      return data.user;
    }
  });

  const me = meQ.data;
  const active = me?.app_access !== false;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Профиль</h1>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Chap navigatsiya */}
        <nav className="w-full shrink-0 rounded-xl border border-border bg-card p-2 md:w-64">
          {NAV.map((item, idx) => {
            const showGroup = item.group && NAV[idx - 1]?.group !== item.group;
            return (
              <div key={item.key}>
                {showGroup ? (
                  <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    tab === item.key
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-muted"
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Kontent */}
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-5">
          {meQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Загрузка…
            </div>
          ) : tab === "general" ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                  {initials(me?.name ?? "", me?.login ?? "")}
                </span>
                <div>
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    {me?.name?.trim() || me?.login || "—"}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {active ? "Активный" : "Неактивный"}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{roleLabel(me?.role)}</p>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Общие данные</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ФИО" value={me?.name ?? ""} />
                  <Field label="Роль" value={roleLabel(me?.role)} />
                  <Field label="Логин" value={me?.login ?? ""} />
                  <Field label="Код" value={me?.code ?? ""} />
                  <Field label="Компания" value={me?.tenantName ?? me?.tenantSlug ?? ""} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Данные доступны только для чтения. Изменение профиля будет добавлено позже.
                </p>
              </div>
            </div>
          ) : tab === "sessions" ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Управление сессиями</h2>
              <SoonNote text="Список активных сессий (устройство, IP, время входа) и завершение сессий будут подключены на следующем этапе." />
            </div>
          ) : tab === "password" ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Пароль</h2>
              <SoonNote text="Смена пароля из веб-кабинета будет подключена на следующем этапе." />
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Избранные страницы</h2>
              <SoonNote text="Настройка избранных страниц будет подключена на следующем этапе." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value || "—"} readOnly disabled className="bg-muted/40" />
    </div>
  );
}

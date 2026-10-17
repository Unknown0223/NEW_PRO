"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

type SectionKey =
  | "payments"
  | "orders"
  | "returns"
  | "stock"
  | "expenses"
  | "opening_balances";

type SectionConfig = { enabled: boolean; days: number };

type LockSettings = {
  enabled: boolean;
  sections: Record<SectionKey, SectionConfig>;
};

type SearchHit = {
  section: SectionKey;
  document_id: number;
  document_kind: string | null;
  label: string;
  document_date: string;
};

type GrantRow = {
  id: number;
  section: SectionKey;
  document_id: number;
  document_kind: string | null;
  access_user_id: number;
  access_user_name: string;
  duration_minutes: number;
  expires_at: string;
  created_by_name: string | null;
};

type AccessUser = { id: number; full_name: string; login: string; role: string };

const SECTION_LABELS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "payments", label: "Оплаты", hint: "Касса, подтверждение, отмена, распределение" },
  { key: "orders", label: "Заказы", hint: "Строки, статус, подтверждение, массовые действия" },
  { key: "returns", label: "Возвраты", hint: "Создание, приёмка, отклонение" },
  { key: "stock", label: "Склад", hint: "Приход, перемещение, корректировка" },
  { key: "expenses", label: "Расходы", hint: "Создание, подтверждение, отмена" },
  { key: "opening_balances", label: "Начальные остатки", hint: "Создание, удаление, восстановление" }
];

const MINUTE_PRESETS = [15, 30, 60, 120] as const;

function basketKey(h: SearchHit): string {
  return `${h.section}:${h.document_kind ?? ""}:${h.document_id}`;
}

function Block({
  title,
  subtitle,
  step,
  children,
  footer,
  className
}: {
  title: string;
  subtitle?: string;
  step?: number;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        className
      )}
    >
      <div className="mb-4 flex items-start gap-3 border-b border-border pb-3">
        {step != null ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
      {footer ? <div className="mt-4 border-t border-border pt-4">{footer}</div> : null}
    </section>
  );
}

export function DocumentEditLockWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { has, hasAny } = usePermissions();
  const canView = hasAny(
    "settings.document_edit_lock.view",
    "settings.document_edit_lock.update",
    "settings.document_edit_lock.assign"
  );
  const canEditRules = has("settings.document_edit_lock.update");
  const canGrant = has("settings.document_edit_lock.assign");
  const qc = useQueryClient();

  const [tab, setTab] = useState<"rules" | "open">("rules");
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<LockSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  const [searchSection, setSearchSection] = useState<SectionKey>("payments");
  const [docId, setDocId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [basket, setBasket] = useState<SearchHit[]>([]);
  const [userPick, setUserPick] = useState<Record<number, boolean>>({});
  const [preset, setPreset] = useState(30);
  const [customMin, setCustomMin] = useState(60);
  const [useCustom, setUseCustom] = useState(false);
  const [searching, setSearching] = useState(false);

  const minutes = useCustom ? customMin : preset;

  const settingsQ = useQuery({
    queryKey: ["document-edit-lock", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated && canView,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ settings: LockSettings }>(
        `/api/${tenantSlug}/settings/document-edit-lock`
      );
      return data.settings;
    }
  });

  const grantsQ = useQuery({
    queryKey: ["document-edit-lock-grants", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated && canView && tab === "open",
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: GrantRow[] }>(
        `/api/${tenantSlug}/settings/document-edit-lock/grants`
      );
      return data.data;
    }
  });

  const usersQ = useQuery({
    queryKey: ["document-edit-lock-users", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated && canGrant && tab === "open",
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessUser[] }>(
        `/api/${tenantSlug}/settings/document-edit-lock/users`
      );
      return data.data ?? [];
    }
  });

  const settings = draft ?? settingsQ.data ?? null;
  const pickedUsers = useMemo(
    () => Object.entries(userPick).filter(([, v]) => v).map(([id]) => Number(id)),
    [userPick]
  );
  const activeUsers = useMemo(
    () => (usersQ.data ?? []).filter((u) => u.role !== "admin"),
    [usersQ.data]
  );
  const selectedHits = useMemo(
    () => hits.filter((h) => selected[basketKey(h)]),
    [hits, selected]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Настройки не загружены");
      await api.patch(`/api/${tenantSlug}/settings/document-edit-lock`, settings);
    },
    onSuccess: async () => {
      setMsg("Правила сохранены");
      setDraft(null);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["document-edit-lock", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  const grantMut = useMutation({
    mutationFn: async () => {
      if (basket.length === 0) throw new Error("Корзина пуста");
      if (pickedUsers.length === 0) throw new Error("Выберите хотя бы одного сотрудника");
      await api.post(`/api/${tenantSlug}/settings/document-edit-lock/grants`, {
        items: basket.map((b) => ({
          section: b.section,
          document_id: b.document_id,
          document_kind: b.document_kind
        })),
        user_ids: pickedUsers,
        duration_minutes: Math.min(1440, Math.max(1, minutes))
      });
    },
    onSuccess: async () => {
      setMsg("Временное открытие сохранено — уведомление отправлено");
      setBasket([]);
      setSelected({});
      setUserPick({});
      setPreset(30);
      setUseCustom(false);
      await qc.invalidateQueries({ queryKey: ["document-edit-lock-grants", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  const revokeMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/settings/document-edit-lock/grants/${id}/revoke`);
    },
    onSuccess: async () => {
      setMsg("Открытие отменено");
      await qc.invalidateQueries({ queryKey: ["document-edit-lock-grants", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  const updateDraft = (next: LockSettings) => {
    setDraft(next);
    setDirty(true);
  };

  const patchSection = (key: SectionKey, patch: Partial<SectionConfig>) => {
    if (!settings) return;
    updateDraft({
      ...settings,
      sections: {
        ...settings.sections,
        [key]: { ...settings.sections[key], ...patch }
      }
    });
  };

  const clearSearch = () => {
    setDocId("");
    setDateFrom("");
    setDateTo("");
    setHits([]);
    setSelected({});
  };

  const runSearch = async () => {
    setSearching(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ section: searchSection });
      const id = Number.parseInt(docId.trim(), 10);
      if (Number.isFinite(id) && id > 0) params.set("document_id", String(id));
      if (dateFrom.trim()) params.set("date_from", dateFrom.trim());
      if (dateTo.trim()) params.set("date_to", dateTo.trim());
      const { data } = await api.get<{ data: SearchHit[] }>(
        `/api/${tenantSlug}/settings/document-edit-lock/search?${params}`
      );
      setHits(data.data);
      setSelected({});
      if (data.data.length === 0) setMsg("Ничего не найдено — проверьте фильтр");
    } catch (e) {
      setMsg(getUserFacingError(e));
    } finally {
      setSearching(false);
    }
  };

  const addToBasket = () => {
    if (!selectedHits.length) {
      setMsg("Отметьте в результатах хотя бы один документ");
      return;
    }
    setBasket((prev) => {
      const map = new Map(prev.map((p) => [basketKey(p), p]));
      for (const p of selectedHits) map.set(basketKey(p), p);
      return [...map.values()];
    });
    setSelected({});
    setMsg(`Добавлено в корзину документов: ${selectedHits.length}`);
  };

  if (!hydrated) return null;

  if (!canView) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-10">
        <h1 className="text-lg font-semibold">Ограничение периода</h1>
        <p className="text-sm text-muted-foreground">
          Нет доступа к этому разделу.{" "}
          <Link href="/settings" className="text-primary underline">
            Вернуться в настройки
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header — tizim sozlamalari uslubi */}
      <header className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Ограничение периода</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Сколько дней по каждому разделу можно вносить изменения. По истечении срока обычный сотрудник
          не может редактировать/удалять — при необходимости администратор временно открывает доступ.
        </p>
      </header>

      {/* Qisqa yo‘riqnoma — alohida blok */}
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
            <span>
              <span className="font-medium text-foreground">Правила</span> — число дней для каждого раздела
            </span>
          </div>
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              <span className="font-medium text-foreground">Автозакрытие</span> — через N дней изменения
              закрываются
            </span>
          </div>
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>
              <span className="font-medium text-foreground">Временно</span> — конкретный документ +
              конкретный сотрудник
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "rules"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("rules")}
        >
          Правила
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "open"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("open")}
        >
          Временное открытие
        </button>
      </div>

      {msg ? (
        <p
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100"
          role="status"
        >
          {msg}
        </p>
      ) : null}

      {tab === "rules" ? (
        settingsQ.isLoading || !settings ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="space-y-5">
            {/* Blok 1: asosiy yoqish */}
            <Block
              title="1. Основное включение"
              subtitle="Если выключено, указанные ниже дни не действуют — ничего не закрывается."
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={settings.enabled}
                  disabled={!canEditRules}
                  onChange={(e) => updateDraft({ ...settings, enabled: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Включить ограничение периода</span>
                  <span className="mt-1 block text-muted-foreground">
                    При включении ограничиваются только разделы, отмеченные «Да». Для администратора всегда открыто.
                  </span>
                </span>
              </label>

              <div
                className={cn(
                  "mt-3 flex gap-2 rounded-lg border px-3 py-2.5 text-sm",
                  settings.enabled
                    ? "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100"
                    : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                )}
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <p className="leading-relaxed">
                  {settings.enabled
                    ? "Ограничение включено — укажите дни в таблице ниже и сохраните."
                    : "Сейчас выключено — сотрудники (при наличии прав) могут изменять и старые документы."}
                </p>
              </div>
            </Block>

            {/* Blok 2: bo‘limlar */}
            <Block
              title="2. Дни по разделам"
              subtitle="Пример: Оплаты = 1 день — сегодняшняя оплата открыта, вчерашняя закрыта (если нет временного доступа)."
              className={cn(!settings.enabled && "opacity-60")}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Просмотр и отчёты никогда не закрываются.
                  </p>
                  <Button
                    type="button"
                    className={cn(!canEditRules && "hidden")}
                    disabled={saveMut.isPending || !dirty}
                    onClick={() => {
                      setMsg(null);
                      saveMut.mutate();
                    }}
                  >
                    {saveMut.isPending ? "Сохранение…" : "Сохранить правила"}
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Раздел</th>
                      <th className="w-28 px-3 py-2.5 font-medium">Ограничить</th>
                      <th className="w-36 px-3 py-2.5 font-medium">Дней</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SECTION_LABELS.map(({ key, label, hint }) => {
                      const row = settings.sections[key];
                      return (
                        <tr key={key} className="border-t border-border">
                          <td className="px-3 py-3">
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{hint}</p>
                          </td>
                          <td className="px-3 py-3">
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="accent-primary"
                                checked={row.enabled}
                                disabled={!canEditRules || !settings.enabled}
                                onChange={(e) =>
                                  patchSection(key, { enabled: e.target.checked })
                                }
                              />
                              {row.enabled ? "Да" : "Нет"}
                            </label>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                disabled={!canEditRules || !settings.enabled || !row.enabled}
                                className="h-9 w-20"
                                value={row.days}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (Number.isFinite(n)) patchSection(key, { days: n });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">дн.</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Block>
          </div>
        )
      ) : (
        <div className="space-y-5">
          <div className={cn("space-y-5", !canGrant && "hidden")}>
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Порядок: найдите → в корзину → кому → минуты → сохраните. Весь раздел целиком
              для всех не открывается.
            </p>
          </div>

          <Block
            step={1}
            title="Поиск документов"
            subtitle="Раздел, ID и/или диапазон дат (не более 50 шт.)."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Раздел</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={searchSection}
                  onChange={(e) => setSearchSection(e.target.value as SectionKey)}
                >
                  {SECTION_LABELS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>ID документа</Label>
                <Input
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="необязательно"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Дата с</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Дата по</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearSearch}>
                Очистить
              </Button>
              <Button type="button" disabled={searching} onClick={() => void runSearch()}>
                {searching ? "Поиск…" : "Поиск"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedHits.length}
                onClick={addToBasket}
              >
                Выбранные в корзину ({selectedHits.length})
              </Button>
            </div>

            {hits.length > 0 ? (
              <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 text-left text-muted-foreground">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-2 py-2">ID</th>
                      <th className="px-2 py-2">Дата</th>
                      <th className="px-2 py-2">Запись</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h) => {
                      const k = basketKey(h);
                      return (
                        <tr key={k} className="border-t border-border">
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={Boolean(selected[k])}
                              onChange={(e) =>
                                setSelected((prev) => ({ ...prev, [k]: e.target.checked }))
                              }
                            />
                          </td>
                          <td className="px-2 py-2 font-medium">#{h.document_id}</td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {h.document_date.slice(0, 10)}
                          </td>
                          <td className="px-2 py-2">{h.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Block>

          <Block
            step={2}
            title={`Корзина (${basket.length})`}
            subtitle="Можно открывать документы из разных разделов одновременно."
          >
            {basket.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                Документов пока нет — добавьте на шаге 1
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {basket.map((b) => (
                  <li
                    key={basketKey(b)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span>
                      <span className="font-medium">
                        {SECTION_LABELS.find((s) => s.key === b.section)?.label}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        #{b.document_id}
                        {b.document_kind ? ` · ${b.document_kind}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-destructive hover:underline"
                      onClick={() =>
                        setBasket((prev) => prev.filter((x) => basketKey(x) !== basketKey(b)))
                      }
                    >
                      Убрать
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block
            step={3}
            title={`Кому (${pickedUsers.length})`}
            subtitle="Только отмеченные сотрудники. Администраторам временный доступ не нужен."
          >
            {usersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : (
              <div className="max-h-48 space-y-0.5 overflow-auto rounded-lg border border-border p-2">
                {activeUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={Boolean(userPick[u.id])}
                      onChange={(e) =>
                        setUserPick((prev) => ({ ...prev, [u.id]: e.target.checked }))
                      }
                    />
                    <span className="font-medium">{u.full_name || u.login}</span>
                    <span className="text-xs text-muted-foreground">({u.role})</span>
                  </label>
                ))}
              </div>
            )}
          </Block>

          <Block
            step={4}
            title="На сколько минут открыть"
            subtitle="По истечении срока или после нажатия «Отменить» доступ снова закрывается."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Документов: {basket.length} · сотрудников: {pickedUsers.length} · {minutes} мин.
                </p>
                <Button
                  type="button"
                  disabled={
                    grantMut.isPending || basket.length === 0 || pickedUsers.length === 0
                  }
                  onClick={() => {
                    setMsg(null);
                    grantMut.mutate();
                  }}
                >
                  {grantMut.isPending ? "Сохранение…" : "Сохранить открытие"}
                </Button>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {MINUTE_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={!useCustom && preset === m ? "default" : "outline"}
                  onClick={() => {
                    setPreset(m);
                    setUseCustom(false);
                  }}
                >
                  {m} мин
                </Button>
              ))}
              <Input
                type="number"
                min={1}
                max={1440}
                className="h-8 w-24"
                value={customMin}
                onChange={(e) => {
                  setCustomMin(Number.parseInt(e.target.value, 10) || 0);
                  setUseCustom(true);
                }}
              />
              <span className="text-xs text-muted-foreground">вручную</span>
            </div>
          </Block>
          </div>

          <Block
            title="Активные открытия"
            subtitle="Действующие временные доступы. Их можно отменить досрочно."
          >
            {grantsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : (grantsQ.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Активных открытий нет
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Раздел</th>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Кому</th>
                      <th className="px-3 py-2 font-medium">Окончание</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {(grantsQ.data ?? []).map((g) => (
                      <tr key={g.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {SECTION_LABELS.find((s) => s.key === g.section)?.label ?? g.section}
                        </td>
                        <td className="px-3 py-2">
                          #{g.document_id}
                          {g.document_kind ? (
                            <span className="text-muted-foreground"> · {g.document_kind}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{g.access_user_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(g.expires_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(!canGrant && "hidden")}
                            disabled={revokeMut.isPending}
                            onClick={() => revokeMut.mutate(g.id)}
                          >
                            Отменить
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Block>
        </div>
      )}
    </div>
  );
}

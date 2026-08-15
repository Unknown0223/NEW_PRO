"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
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
  { key: "payments", label: "To‘lovlar", hint: "Kassa, tasdiq, bekor, taqsimlash" },
  { key: "orders", label: "Buyurtmalar", hint: "Qator, status, tasdiq, bulk" },
  { key: "returns", label: "Qaytarishlar", hint: "Yaratish, qabul, rad" },
  { key: "stock", label: "Ombor", hint: "Kirim, transfer, korrektirovka" },
  { key: "expenses", label: "Xarajatlar", hint: "Yaratish, tasdiq, bekor" },
  { key: "opening_balances", label: "Ochilish qoldiqlari", hint: "Yaratish, o‘chirish, tiklash" }
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
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const isAdmin = role === "admin";
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
    enabled: Boolean(tenantSlug) && hydrated && isAdmin,
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
    enabled: Boolean(tenantSlug) && hydrated && isAdmin && tab === "open",
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
    enabled: Boolean(tenantSlug) && hydrated && isAdmin && tab === "open",
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessUser[] }>(
        `/api/${tenantSlug}/access/users?include_counts=false&is_active=true`
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
      if (!settings) throw new Error("Sozlama yuklanmagan");
      await api.patch(`/api/${tenantSlug}/settings/document-edit-lock`, settings);
    },
    onSuccess: async () => {
      setMsg("Qoidalar saqlandi");
      setDraft(null);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["document-edit-lock", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  const grantMut = useMutation({
    mutationFn: async () => {
      if (basket.length === 0) throw new Error("Savatcha bo‘sh");
      if (pickedUsers.length === 0) throw new Error("Kamida bitta xodim tanlang");
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
      setMsg("Vaqtinchalik ochish saqlandi — bildirishnoma yuborildi");
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
      setMsg("Ochish bekor qilindi");
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
      if (data.data.length === 0) setMsg("Hech narsa topilmadi — filtrni tekshiring");
    } catch (e) {
      setMsg(getUserFacingError(e));
    } finally {
      setSearching(false);
    }
  };

  const addToBasket = () => {
    if (!selectedHits.length) {
      setMsg("Natijadan kamida bitta hujjatni belgilang");
      return;
    }
    setBasket((prev) => {
      const map = new Map(prev.map((p) => [basketKey(p), p]));
      for (const p of selectedHits) map.set(basketKey(p), p);
      return [...map.values()];
    });
    setSelected({});
    setMsg(`${selectedHits.length} ta hujjat savatchaga qo‘shildi`);
  };

  if (!hydrated) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-10">
        <h1 className="text-lg font-semibold">Davr cheklovi</h1>
        <p className="text-sm text-muted-foreground">
          Bu bo‘lim faqat admin uchun.{" "}
          <Link href="/settings" className="text-primary underline">
            Sozlamalarga qaytish
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      {/* Header — tizim sozlamalari uslubi */}
      <header className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Davr cheklovi</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Bo‘limlar bo‘yicha necha kun ichida yozish mumkin. Kun o‘tsa oddiy xodim
          tahrirlay/o‘chira olmaydi — admin kerak bo‘lsa vaqtinchalik ochadi.
        </p>
      </header>

      {/* Qisqa yo‘riqnoma — alohida blok */}
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
            <span>
              <span className="font-medium text-foreground">Qoidalar</span> — har bo‘lim uchun kun
            </span>
          </div>
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              <span className="font-medium text-foreground">Avto-yopish</span> — N kundan keyin yozish
              yopiladi
            </span>
          </div>
          <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>
              <span className="font-medium text-foreground">Vaqtinchalik</span> — aniq hujjat + aniq
              xodim
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
          Qoidalar
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
          Vaqtinchalik ochish
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
          <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
        ) : (
          <div className="space-y-5">
            {/* Blok 1: asosiy yoqish */}
            <Block
              title="1. Asosiy yoqish"
              subtitle="Bu o‘chirilgan bo‘lsa, pastdagi kunlar ishlamaydi — hech narsa yopilmaydi."
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={settings.enabled}
                  onChange={(e) => updateDraft({ ...settings, enabled: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Davr cheklovini yoqish</span>
                  <span className="mt-1 block text-muted-foreground">
                    Yoqilganda faqat «Yoqilgan» bo‘limlar cheklanadi. Admin har doim ochiq.
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
                    ? "Cheklov yoqilgan — quyidagi jadvalda kunlarni belgilang va saqlang."
                    : "Hozir o‘chirilgan — xodimlar (ruxsatlari bo‘lsa) eski hujjatlarni ham o‘zgartira oladi."}
                </p>
              </div>
            </Block>

            {/* Blok 2: bo‘limlar */}
            <Block
              title="2. Bo‘limlar bo‘yicha kun"
              subtitle="Misol: To‘lovlar = 1 kun — bugungi to‘lov ochiq, kechagi yopiq (grant bo‘lmasa)."
              className={cn(!settings.enabled && "opacity-60")}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    O‘qish / hisobot hech qachon yopilmaydi.
                  </p>
                  <Button
                    type="button"
                    disabled={saveMut.isPending || !dirty}
                    onClick={() => {
                      setMsg(null);
                      saveMut.mutate();
                    }}
                  >
                    {saveMut.isPending ? "Saqlanmoqda…" : "Qoidalarni saqlash"}
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Bo‘lim</th>
                      <th className="w-28 px-3 py-2.5 font-medium">Cheklash</th>
                      <th className="w-36 px-3 py-2.5 font-medium">Kun</th>
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
                                disabled={!settings.enabled}
                                onChange={(e) =>
                                  patchSection(key, { enabled: e.target.checked })
                                }
                              />
                              {row.enabled ? "Ha" : "Yo‘q"}
                            </label>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                disabled={!settings.enabled || !row.enabled}
                                className="h-9 w-20"
                                value={row.days}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (Number.isFinite(n)) patchSection(key, { days: n });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">kun</span>
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
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Ketma-ketlik: toping → savatchaga → kimlarga → daqiqa → saqlang. Butun bo‘lim
              hammaga ochilmaydi.
            </p>
          </div>

          <Block
            step={1}
            title="Hujjatlarni topish"
            subtitle="Bo‘lim, ID va/yoki sana oralig‘i (eng ko‘pi 50 ta)."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Bo‘lim</Label>
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
                <Label>Hujjat ID</Label>
                <Input
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="ixtiyoriy"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sana dan</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sana gacha</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearSearch}>
                Tozalash
              </Button>
              <Button type="button" disabled={searching} onClick={() => void runSearch()}>
                {searching ? "Qidirilmoqda…" : "Qidirish"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedHits.length}
                onClick={addToBasket}
              >
                Tanlanganlarni savatchaga ({selectedHits.length})
              </Button>
            </div>

            {hits.length > 0 ? (
              <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 text-left text-muted-foreground">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-2 py-2">ID</th>
                      <th className="px-2 py-2">Sana</th>
                      <th className="px-2 py-2">Yozuv</th>
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
            title={`Savatcha (${basket.length})`}
            subtitle="Turli bo‘limlarni birga ochish mumkin."
          >
            {basket.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                Hali hujjat yo‘q — 1-bosqichdan qo‘shing
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
                      Olib tashlash
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block
            step={3}
            title={`Kimlarga (${pickedUsers.length})`}
            subtitle="Faqat belgilangan xodimlar. Adminlarga grant kerak emas."
          >
            {usersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
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
            title="Qancha daqiqa ochiq"
            subtitle="Muddat tugagach yoki «Bekor» qilinsa yana yopiladi."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {basket.length} hujjat · {pickedUsers.length} xodim · {minutes} daqiqa
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
                  {grantMut.isPending ? "Saqlanmoqda…" : "Ochishni saqlash"}
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
                  {m} daq
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
              <span className="text-xs text-muted-foreground">qo‘lda</span>
            </div>
          </Block>

          <Block
            title="Faol ochishlar"
            subtitle="Hozir amal qilayotgan grantlar. Muddatdan oldin bekor qilish mumkin."
          >
            {grantsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
            ) : (grantsQ.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Faol ochish yo‘q
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Bo‘lim</th>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Kimga</th>
                      <th className="px-3 py-2 font-medium">Tugash</th>
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
                            disabled={revokeMut.isPending}
                            onClick={() => revokeMut.mutate(g.id)}
                          >
                            Bekor
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

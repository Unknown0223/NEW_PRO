"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type CurrencyEntry = {
  id: string;
  name: string;
  code: string;
  sort_order: number | null;
  active: boolean;
  is_default: boolean;
};

type TenantProfile = {
  references: {
    currency_entries?: CurrencyEntry[];
  };
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cur-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortRows(list: CurrencyEntry[]): CurrencyEntry[] {
  return [...list].sort((a, b) => {
    const ao = a.sort_order ?? 1e6;
    const bo = b.sort_order ?? 1e6;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "uz");
  });
}

function ensureOneDefault(entries: CurrencyEntry[]): CurrencyEntry[] {
  const active = entries.filter((e) => e.active !== false);
  const pool = active.length > 0 ? active : entries;
  const defId = pool.find((e) => e.is_default)?.id ?? pool[0]?.id;
  if (!defId) return entries;
  return entries.map((e) => ({ ...e, is_default: e.id === defId }));
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export function FinanceCurrenciesSettings() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [active, setActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const rows = useMemo(() => {
    const list = profileQ.data?.references?.currency_entries ?? [];
    return sortRows(list);
  }, [profileQ.data]);

  const filtered = useMemo(
    () => rows.filter((x) => (tab === "active" ? x.active !== false : x.active === false)),
    [rows, tab]
  );

  const saveMut = useMutation({
    mutationFn: async (next: CurrencyEntry[]) => {
      if (!tenantSlug) throw new Error("no tenant");
      await api.patch(`/api/${tenantSlug}/settings/profile`, {
        references: { currency_entries: ensureOneDefault(next) }
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["price-types", tenantSlug] });
      setServerFieldErrs({});
      setMsg("Saqlandi.");
      setOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Saqlashda xatolik."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Saqlashda xatolik."));
    },
  });

  function resetForm() {
    setEditId(null);
    setName("");
    setCode("");
    setSortOrder("");
    setActive(true);
    setIsDefault(false);
    setServerFieldErrs({});
  }

  function openAdd() {
    resetForm();
    setMsg(null);
    setOpen(true);
  }

  function openEdit(row: CurrencyEntry) {
    setEditId(row.id);
    setName(row.name);
    setCode(row.code);
    setSortOrder(row.sort_order == null ? "" : String(row.sort_order));
    setActive(row.active !== false);
    setIsDefault(row.is_default === true);
    setServerFieldErrs({});
    setMsg(null);
    setOpen(true);
  }

  function submitForm() {
    const n = name.trim();
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    if (!n || c.length < 2) return;
    const nextRow: CurrencyEntry = {
      id: editId ?? newId(),
      name: n,
      code: c,
      sort_order: sortOrder.trim() ? Number(sortOrder.trim()) : null,
      active,
      is_default: isDefault
    };
    let merged = editId ? rows.map((x) => (x.id === editId ? nextRow : x)) : [...rows, nextRow];
    if (nextRow.is_default) {
      merged = merged.map((x) => ({ ...x, is_default: x.id === nextRow.id }));
    }
    saveMut.mutate(sortRows(ensureOneDefault(merged)));
  }

  if (!hydrated) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Sessiya...</p>
      </PageShell>
    );
  }
  if (!tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Kirish
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Валюты"
        description="Standart valyuta bittasi; kodlar mahsulot narxlari (currency) bilan mos keladi."
        actions={
          <div className="flex gap-2">
            <Button size="sm" disabled={!isAdmin} onClick={openAdd}>
              Добавить
            </Button>
            <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Katalog
            </Link>
            <Link href="/currency-rates" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Курс валют
            </Link>
          </div>
        }
      />

      <SettingsWorkspace>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              className={cn("rounded px-3 py-1 text-sm", tab === "active" ? "bg-primary text-primary-foreground" : "bg-muted")}
              onClick={() => setTab("active")}
            >
              Активный
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-3 py-1 text-sm",
                tab === "inactive" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
              onClick={() => setTab("inactive")}
            >
              Не активный
            </button>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="app-table-thead text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium">Код</th>
                  <th className="px-3 py-2 font-medium">Сортировка</th>
                  <th className="px-3 py-2 font-medium">По умолчанию</th>
                  <th className="px-3 py-2 text-right font-medium">...</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2">{r.sort_order ?? "—"}</td>
                    <td className="px-3 py-2">{r.is_default ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <TableRowActionGroup className="justify-end" ariaLabel="Valyuta">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            title="Tahrirlash"
                            aria-label="Tahrirlash"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                        </TableRowActionGroup>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Ma&apos;lumot yo&apos;q
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </SettingsWorkspace>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать" : "Добавить"}</DialogTitle>
            <DialogDescription>Kod: 2–20 ta lotin harf yoki raqam. Bitta default valyuta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              {pickZodLeaf(serverFieldErrs, "name") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "name")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Код</Label>
                <span className="text-xs text-muted-foreground">{code.length} / 20</span>
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))}
              />
              {pickZodLeaf(serverFieldErrs, "code") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "code")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Сортировка</Label>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
              />
              {pickZodLeaf(serverFieldErrs, "sort_order") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "sort_order")}</p>
              ) : null}
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Активный</span>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>По умолчанию</span>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            </label>
            <Button onClick={submitForm} disabled={saveMut.isPending || !isAdmin}>
              {editId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

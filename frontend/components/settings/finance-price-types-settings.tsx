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

type PaymentMethodEntry = { id: string; name: string; active: boolean };

type PriceTypeEntry = {
  id: string;
  name: string;
  code: string | null;
  payment_method_id: string;
  kind: "sale" | "purchase";
  sort_order: number | null;
  comment: string | null;
  active: boolean;
  manual: boolean;
  attached_clients_only: boolean;
};

type TenantProfile = {
  references: {
    payment_method_entries?: PaymentMethodEntry[];
    price_type_entries?: PriceTypeEntry[];
  };
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortRows(list: PriceTypeEntry[]): PriceTypeEntry[] {
  return [...list].sort((a, b) => {
    const ao = a.sort_order ?? 1e6;
    const bo = b.sort_order ?? 1e6;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "uz");
  });
}

function priceKey(e: PriceTypeEntry): string {
  return (e.code?.trim() || e.name.trim()) || e.name;
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export function FinancePriceTypesSettings() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [comment, setComment] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [kind, setKind] = useState<"sale" | "purchase">("sale");
  const [manual, setManual] = useState(false);
  const [attachedOnly, setAttachedOnly] = useState(false);
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

  const payList = useMemo(
    () => profileQ.data?.references?.payment_method_entries?.filter((p) => p.active !== false) ?? [],
    [profileQ.data]
  );

  const rows = useMemo(() => sortRows(profileQ.data?.references?.price_type_entries ?? []), [profileQ.data]);

  const payName = (id: string) => payList.find((p) => p.id === id)?.name ?? "—";

  const saveMut = useMutation({
    mutationFn: async (next: PriceTypeEntry[]) => {
      if (!tenantSlug) throw new Error("no tenant");
      await api.patch(`/api/${tenantSlug}/settings/profile`, {
        references: { price_type_entries: next }
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["price-types", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["finance-price-overview", tenantSlug] });
      setServerFieldErrs({});
      setMsg("Saqlandi. Narx turi kaliti mahsulot narxlari (price_type) bilan mos kelishi kerak.");
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
    }
  });

  function resetForm() {
    setEditId(null);
    setName("");
    setCode("");
    setSortOrder("");
    setComment("");
    setPaymentMethodId(payList[0]?.id ?? "");
    setKind("sale");
    setManual(false);
    setAttachedOnly(false);
    setServerFieldErrs({});
  }

  function openAdd() {
    resetForm();
    setMsg(null);
    setOpen(true);
  }

  function openEdit(row: PriceTypeEntry) {
    setEditId(row.id);
    setName(row.name);
    setCode(row.code ?? "");
    setSortOrder(row.sort_order == null ? "" : String(row.sort_order));
    setComment(row.comment ?? "");
    setPaymentMethodId(row.payment_method_id);
    setKind(row.kind === "purchase" ? "purchase" : "sale");
    setManual(row.manual === true);
    setAttachedOnly(row.attached_clients_only === true);
    setServerFieldErrs({});
    setMsg(null);
    setOpen(true);
  }

  function submitForm() {
    setServerFieldErrs({});
    setMsg(null);
    const n = name.trim();
    if (!n || !paymentMethodId) return;
    const codeNorm = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20);
    const nextRow: PriceTypeEntry = {
      id: editId ?? newId(),
      name: n,
      code: codeNorm || null,
      payment_method_id: paymentMethodId,
      kind,
      sort_order: sortOrder.trim() ? Number(sortOrder.trim()) : null,
      comment: comment.trim() || null,
      active: true,
      manual,
      attached_clients_only: attachedOnly
    };
    const merged = editId ? rows.map((x) => (x.id === editId ? nextRow : x)) : [...rows, nextRow];
    saveMut.mutate(sortRows(merged));
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
        title="Тип цены"
        description="Sotish yoki xarid; to‘lov usuli bilan bog‘langan. Kalit: kod bo‘lsa kod, aks holda nom. Katalog to‘ldirilgan bo‘lsa, zakaz/prixod tanlovi faqat shu yozuvlar bo‘yicha."
        actions={
          <div className="flex gap-2">
            <Button size="sm" disabled={!isAdmin || payList.length === 0} onClick={openAdd}>
              Добавить
            </Button>
            <Link
              href="/settings/payment-methods"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Способ оплаты
            </Link>
            <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Katalog
            </Link>
          </div>
        }
      />

      {payList.length === 0 ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Avval{" "}
          <Link href="/settings/payment-methods" className="underline">
            to‘lov usullarini
          </Link>{" "}
          qo‘shing.
        </p>
      ) : null}

      <SettingsWorkspace>
        <div className="rounded-lg border bg-card p-4">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="app-table-thead text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium">Способ оплаты</th>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium">Ключ (DB)</th>
                  <th className="px-3 py-2 text-right font-medium">...</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{payName(r.payment_method_id)}</td>
                    <td className="px-3 py-2">{r.kind === "purchase" ? "Покупка" : "Продажа"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{priceKey(r)}</td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <TableRowActionGroup className="justify-end" ariaLabel="Narx turi">
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
                {rows.length === 0 ? (
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
            <DialogDescription>Kod ixtiyoriy (A–Z, 0–9, _). Bo‘sh bo‘lsa kalit sifatida nom ishlatiladi.</DialogDescription>
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
              <Label>Способ оплаты</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
              >
                {payList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {pickZodLeaf(serverFieldErrs, "payment_method_id") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "payment_method_id")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Тип</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value === "purchase" ? "purchase" : "sale")}
              >
                <option value="sale">Продажа</option>
                <option value="purchase">Покупка</option>
              </select>
              {pickZodLeaf(serverFieldErrs, "kind") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "kind")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Код</Label>
                <span className="text-xs text-muted-foreground">{code.length} / 20</span>
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20))}
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
            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <textarea
                className="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {pickZodLeaf(serverFieldErrs, "comment") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "comment")}</p>
              ) : null}
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Ручной</span>
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            </label>
            {pickZodLeaf(serverFieldErrs, "manual") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "manual")}</p>
            ) : null}
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Доступно только для прикрепленных клиентов</span>
              <input type="checkbox" checked={attachedOnly} onChange={(e) => setAttachedOnly(e.target.checked)} />
            </label>
            {pickZodLeaf(serverFieldErrs, "attached_clients_only") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "attached_clients_only")}</p>
            ) : null}
            <Button onClick={submitForm} disabled={saveMut.isPending || !isAdmin}>
              {editId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

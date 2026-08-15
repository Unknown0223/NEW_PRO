"use client";

import { GROUP_PROCESSING_IDS_STORAGE_KEY } from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DebtDraft = {
  allow_consignment: boolean;
  allow_order_with_debt: boolean;
  allow_consignment_with_debt: boolean;
};

type DebtField = keyof DebtDraft;

type ClientsResponse = { data: ClientRow[]; total: number };

function emptyDebt(): DebtDraft {
  return {
    allow_consignment: true,
    allow_order_with_debt: true,
    allow_consignment_with_debt: true
  };
}

function fromClient(c: ClientRow): DebtDraft {
  return {
    allow_consignment: c.allow_consignment !== false,
    allow_order_with_debt: c.allow_order_with_debt !== false,
    allow_consignment_with_debt: c.allow_consignment_with_debt !== false
  };
}

function debtEqual(a: DebtDraft, b: DebtDraft): boolean {
  return (
    a.allow_consignment === b.allow_consignment &&
    a.allow_order_with_debt === b.allow_order_with_debt &&
    a.allow_consignment_with_debt === b.allow_consignment_with_debt
  );
}

function diffPatch(orig: DebtDraft, draft: DebtDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (draft.allow_consignment !== orig.allow_consignment) {
    patch.allow_consignment = draft.allow_consignment;
  }
  if (draft.allow_order_with_debt !== orig.allow_order_with_debt) {
    patch.allow_order_with_debt = draft.allow_order_with_debt;
  }
  if (draft.allow_consignment_with_debt !== orig.allow_consignment_with_debt) {
    patch.allow_consignment_with_debt = draft.allow_consignment_with_debt;
  }
  return Object.keys(patch).length ? patch : null;
}

function parseIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 500);
}

function loadStoredIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500);
  } catch {
    return [];
  }
}

const COLUMNS: { field: DebtField; label: string }[] = [
  { field: "allow_consignment", label: "Разрешить консигнацию" },
  { field: "allow_order_with_debt", label: "Заказ при наличии долга" },
  { field: "allow_consignment_with_debt", label: "Можно заказать по консигнации в долг" }
];

export function GroupProcessingDebtWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const seedIds = useMemo(() => {
    const fromQ = parseIds(searchParams.get("ids"));
    if (fromQ.length) return fromQ;
    return loadStoredIds();
  }, [searchParams]);

  const [draftByClient, setDraftByClient] = useState<Record<number, DebtDraft>>({});
  const [origByClient, setOrigByClient] = useState<Record<number, DebtDraft>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const clientsQ = useQuery({
    queryKey: ["clients", "gp-debt", tenantSlug, seedIds.join(",")],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      if (seedIds.length > 0) {
        const params = new URLSearchParams({
          page: "1",
          limit: String(Math.min(500, seedIds.length)),
          client_ids: seedIds.join(",")
        });
        const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
        const byId = new Map(data.data.map((c) => [c.id, c]));
        const ordered = seedIds.map((id) => byId.get(id)).filter(Boolean) as ClientRow[];
        return { data: ordered, total: ordered.length };
      }
      const { data } = await api.get<ClientsResponse>(
        `/api/${tenantSlug}/clients?page=1&limit=50`
      );
      return { data: data.data, total: data.total };
    }
  });

  const rows = clientsQ.data?.data ?? [];

  useEffect(() => {
    if (!rows.length) return;
    setDraftByClient((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of rows) {
        if (!next[c.id]) {
          next[c.id] = fromClient(c);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setOrigByClient((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of rows) {
        if (!next[c.id]) {
          next[c.id] = fromClient(c);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const ensureDraft = useCallback(
    (id: number): DebtDraft => draftByClient[id] ?? emptyDebt(),
    [draftByClient]
  );

  const setField = (clientId: number, field: DebtField, value: boolean) => {
    setDraftByClient((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? emptyDebt()), [field]: value }
    }));
  };

  const setAllField = (field: DebtField, value: boolean) => {
    setDraftByClient((prev) => {
      const next = { ...prev };
      for (const c of rows) {
        next[c.id] = { ...(next[c.id] ?? emptyDebt()), [field]: value };
      }
      return next;
    });
  };

  const allChecked = (field: DebtField) =>
    rows.length > 0 && rows.every((c) => ensureDraft(c.id)[field]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const c of rows) {
      const d = draftByClient[c.id];
      const o = origByClient[c.id];
      if (d && o && !debtEqual(d, o)) n += 1;
    }
    return n;
  }, [rows, draftByClient, origByClient]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("No tenant");
      let ok = 0;
      let skipped = 0;
      const failed: string[] = [];
      for (const c of rows) {
        const draft = draftByClient[c.id];
        const orig = origByClient[c.id];
        if (!draft || !orig) {
          skipped += 1;
          continue;
        }
        const patch = diffPatch(orig, draft);
        if (!patch) {
          skipped += 1;
          continue;
        }
        try {
          await api.patch(`/api/${tenantSlug}/clients/${c.id}`, patch);
          ok += 1;
        } catch (e) {
          failed.push(`#${c.id}: ${getUserFacingError(e, "ошибка")}`);
        }
      }
      return { ok, skipped, failed };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      if (res.ok > 0 && res.failed.length === 0) {
        router.push("/clients");
        return;
      }
      setOrigByClient((prev) => {
        const next = { ...prev };
        for (const c of rows) {
          const d = draftByClient[c.id];
          if (d) next[c.id] = { ...d };
        }
        return next;
      });
      setStatusMsg(
        res.failed.length
          ? `Сохранено: ${res.ok}. Ошибки: ${res.failed.slice(0, 3).join("; ")}`
          : `Сохранено: ${res.ok} · без изменений: ${res.skipped}`
      );
    },
    onError: (e) => setStatusMsg(getUserFacingError(e, "Ошибка сохранения"))
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            Заказ при наличии долга
          </h1>
          <p className="text-sm text-muted-foreground">
            Клиентов: <b>{rows.length}</b>
            {dirtyCount > 0 ? (
              <>
                {" "}
                · изменено: <b>{dirtyCount}</b>
              </>
            ) : null}
          </p>
          {statusMsg ? <p className="mt-1 text-sm text-emerald-700">{statusMsg}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Вернуться обратно
          </Link>
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            disabled={saveMut.isPending || !rows.length || dirtyCount === 0}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {clientsQ.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : !rows.length ? (
          <div className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>Нет клиентов. Сначала выберите клиентов в списке.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/clients")}>
              К списку клиентов
            </Button>
          </div>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-[12px] font-semibold text-slate-700">
                <th className="px-3 py-3 text-left font-medium">Название клиента</th>
                {COLUMNS.map((col) => (
                  <th key={col.field} className="px-3 py-3 text-center align-bottom">
                    <div className="mb-2 font-medium leading-snug">{col.label}</div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-normal text-slate-500">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-teal-600"
                        checked={allChecked(col.field)}
                        onChange={(e) => setAllField(col.field, e.target.checked)}
                      />
                      Выбрать все
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, idx) => {
                const draft = ensureDraft(c.id);
                const dirty = origByClient[c.id] ? !debtEqual(draft, origByClient[c.id]!) : false;
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-slate-100",
                      idx % 2 === 1 ? "bg-slate-50/60" : "bg-white",
                      dirty && "bg-amber-50/80"
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-800">{c.name}</td>
                    {COLUMNS.map((col) => (
                      <td key={col.field} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-teal-600"
                          checked={draft[col.field]}
                          onChange={(e) => setField(c.id, col.field, e.target.checked)}
                          aria-label={`${col.label}: ${c.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            className="bg-teal-600 px-8 hover:bg-teal-700"
            disabled={saveMut.isPending || dirtyCount === 0}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

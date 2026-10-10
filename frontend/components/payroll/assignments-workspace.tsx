"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { PAYROLL_QUERY_KEYS, payrollApi } from "./payroll-api";
import type { PayrollAssignmentRow } from "./payroll-api";
import { roleLabel } from "./payroll-utils";

type Props = { tenantSlug: string };

type Draft = { user_id: number; formula_id: string; base_amount: string };

export function AssignmentsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const optionsQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await payrollApi.options(tenantSlug)).data.data
  });

  const listQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.assignments(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => (await payrollApi.assignments(tenantSlug)).data.data
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const items = Object.values(drafts)
        .filter((d) => d.formula_id !== "" || d.base_amount !== "")
        .map((d) => ({
          user_id: d.user_id,
          formula_id: d.formula_id ? Number(d.formula_id) : null,
          base_amount: d.base_amount === "" ? null : Number(d.base_amount.replace(/\s/g, "").replace(",", "."))
        }));
      if (items.length === 0) return Promise.reject(new Error("Hech narsa o‘zgarmadi"));
      return payrollApi.saveAssignments(tenantSlug, items);
    },
    onSuccess: (res) => {
      setDrafts({});
      setError(null);
      setSavedMsg(`${res.data.data.saved} ta xodim saqlandi`);
      void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.assignments(tenantSlug) });
      void qc.invalidateQueries({ queryKey: ["payroll", "calc", tenantSlug] });
      void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.formulas(tenantSlug) });
    },
    onError: (e) => {
      setSavedMsg(null);
      setError(getUserFacingError(e));
    }
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (role && r.role !== role) return false;
      if (!q) return true;
      return `${r.fio} ${r.role}`.toLowerCase().includes(q);
    });
  }, [listQ.data, role, search]);

  const formulas = optionsQ.data?.formulas ?? [];
  const dirtyCount = Object.keys(drafts).length;

  const setDraft = (row: PayrollAssignmentRow, patch: Partial<Draft>) => {
    setSavedMsg(null);
    setDrafts((prev) => ({
      ...prev,
      [row.user_id]: {
        user_id: row.user_id,
        formula_id: prev[row.user_id]?.formula_id ?? (row.formula_id ? String(row.formula_id) : ""),
        base_amount: prev[row.user_id]?.base_amount ?? (row.base_amount != null ? String(row.base_amount) : ""),
        ...patch
      }
    }));
  };

  return (
    <PageShell>
      <PageHeader
        title="Привязка сотрудников"
        description="Xodimga individual formula va oklad. Bo‘sh qoldirilsa — KPI guruhi va rol bo‘yicha formula ishlatiladi."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
            <Button type="button" size="sm" disabled={saveMut.isPending || dirtyCount === 0} onClick={() => saveMut.mutate()}>
              <Save className="size-4" /> Saqlash ({formatGroupedInteger(dirtyCount)})
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-xs text-xs"
              placeholder="Qidiruv: ФИО"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Barcha rollar</option>
              {(optionsQ.data?.roles ?? []).map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{formatGroupedInteger(rows.length)} xodim</span>
          </div>

          {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p> : null}
          {savedMsg ? <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{savedMsg}</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">ФИО</th>
                  <th className="p-2 font-medium">Роль</th>
                  <th className="p-2 font-medium">KPI guruh</th>
                  <th className="p-2 font-medium">Formula</th>
                  <th className="p-2 font-medium">Оклад (сўм)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = drafts[r.user_id];
                  const formulaValue = d?.formula_id ?? (r.formula_id ? String(r.formula_id) : "");
                  const baseValue = d?.base_amount ?? (r.base_amount != null ? String(r.base_amount) : "");
                  return (
                    <tr key={r.user_id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="p-2 font-medium">{r.fio}</td>
                      <td className="p-2">{roleLabel(r.role, optionsQ.data?.roles ?? [])}</td>
                      <td className="p-2 text-muted-foreground">
                        {r.kpi_group_ids.length > 0 ? `${r.kpi_group_ids.length} ta guruh` : "guruh yo‘q"}
                      </td>
                      <td className="p-2">
                        <select
                          className="h-8 w-full max-w-[260px] rounded-md border border-input bg-background px-1 text-xs"
                          value={formulaValue}
                          onChange={(e) => setDraft(r, { formula_id: e.target.value })}
                        >
                          <option value="">Avto (KPI guruh / rol)</option>
                          {formulas.map((f) => (
                            <option key={f.id} value={String(f.id)}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8 w-36 text-right text-xs"
                          inputMode="decimal"
                          placeholder="—"
                          value={baseValue}
                          onChange={(e) => setDraft(r, { base_amount: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      {listQ.isLoading ? "Yuklanmoqda…" : "Xodimlar topilmadi."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

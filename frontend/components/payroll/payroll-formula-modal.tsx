"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search } from "lucide-react";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { payrollApi, payrollErrorText, roleLabel, STATUS_TONE } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { TonePill } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { FORMULA_SCOPES, type FormulaDraft } from "@/components/payroll/payroll-formula-editor";
import { PayrollFormulaBuilder } from "@/components/payroll/payroll-formula-builder";
import type { Formula } from "@/components/payroll/payroll-formulas-workspace";
import { PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollModal, PayrollModalNote } from "@/components/payroll/kit/payroll-kit-modal";
import {
  PAYROLL_INPUT,
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction
} from "@/components/payroll/kit/payroll-kit-table";

type Tab = "write" | "saved";
const SCOPE_LABEL = Object.fromEntries(FORMULA_SCOPES.map((s) => [s.v, s.label])) as Record<string, string>;
const emptyDraft = (scope: FormulaDraft["scope"]): FormulaDraft => ({ name: "", scope, text: "", role: null, target_item_id: null, priority: 100, is_active: true });

export function useSaveFormula(onSuccess: () => void, onError: (e: unknown) => void) {
  const tenant = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: FormulaDraft) => {
      const api = payrollApi(tenant);
      const body = {
        name: d.name.trim(),
        scope: d.scope,
        text: d.text,
        role: d.role,
        target_item_id: d.scope === "salary" ? null : d.target_item_id,
        priority: d.priority,
        is_active: d.is_active
      };
      return d.id ? api.send("PATCH", `/formulas/${d.id}`, body) : api.send("POST", "/formulas", body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payroll-formulas", tenant] });
      onSuccess();
    },
    onError
  });
}

/** «Установка формулу»: the formula builder opened in place on the salary / bonus pages. */
export function PayrollFormulaModal({
  open,
  onClose,
  defaultScope = "allowance",
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  defaultScope?: FormulaDraft["scope"];
  onSaved: (text: string) => void;
}) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.hasAny("staff.zarplaty.update", "staff.zarplaty.create");
  const [tab, setTab] = useState<Tab>("write");
  const [draft, setDraft] = useState<FormulaDraft>(emptyDraft(defaultScope));
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("write");
    setDraft(emptyDraft(defaultScope));
    setQ("");
    setError(null);
  }, [open, defaultScope]);

  const listQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: Boolean(tenant) && open, queryFn: () => api.get<Formula[]>("/formulas") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant) && open, queryFn: () => api.get<PayrollItem[]>("/items") });
  const empQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, false],
    enabled: Boolean(tenant) && open,
    queryFn: () => api.get<Array<{ user_id: number; fio: string; role: string }>>("/employee-configs")
  });
  const roles = useMemo(() => [...new Set((empQ.data ?? []).map((e) => e.role))].sort(), [empQ.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((f) => !s || `${f.name} ${f.text} ${f.target_item_name ?? ""}`.toLowerCase().includes(s));
  }, [listQ.data, q]);

  const save = useSaveFormula(
    () => {
      onSaved("Формула сохранена. Зарплаты пересчитаются автоматически.");
      onClose();
    },
    (e) => setError(payrollErrorText(e))
  );

  const edit = (f: Formula) => {
    setDraft({ id: f.id, name: f.name, scope: f.scope, text: f.text, role: f.role, target_item_id: f.target_item_id, priority: f.priority, is_active: f.is_active });
    setTab("write");
  };

  return (
    <PayrollModal
      open={open}
      onClose={onClose}
      title="Установка формулу"
      width="sm:max-w-[1100px]"
      className="top-[3vh] max-h-[94vh]"
      headerExtra={
        <PayrollSegmentedTabs<Tab>
          variant="status"
          tabs={[
            { id: "write", label: draft.id ? "Изменить формулу" : "Новая формула" },
            { id: "saved", label: "Готовые формулы", count: listQ.data?.length }
          ]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      <div className="space-y-3.5">
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        {tab === "write" ? (
          <PayrollFormulaBuilder
            draft={draft}
            onChange={setDraft}
            onSave={() => {
              setError(null);
              save.mutate(draft);
            }}
            onClear={() => setDraft(emptyDraft(defaultScope))}
            saving={save.isPending}
            canEdit={canEdit}
            items={itemsQ.data ?? []}
            roles={roles}
            employees={empQ.data ?? []}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--pr-border)]">
            <div className="border-b border-[var(--pr-line)] p-3">
              <div className="relative w-full max-w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input placeholder="Поиск формулы" value={q} onChange={(e) => setQ(e.target.value)} className={cn(PAYROLL_INPUT, "pl-9 pr-3")} />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className={PAYROLL_TABLE}>
                <thead className={cn(PAYROLL_THEAD, "sticky top-0 z-10")}>
                  <tr>
                    <th className={TH}>Название</th>
                    <th className={TH}>Раздел</th>
                    <th className={TH}>Роль</th>
                    <th className={TH}>Статья</th>
                    <th className={TH}>Формула</th>
                    <th className={TH}>Статус</th>
                    <th className={cn(TH, "w-16 text-center")} />
                  </tr>
                </thead>
                <tbody>
                  {listQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={7} loading={listQ.isLoading} text="Формул пока нет" /> : null}
                  {rows.map((f) => (
                    <tr key={f.id} className={cn(PAYROLL_TR, "cursor-pointer", !f.is_active && "opacity-60")} onClick={() => edit(f)}>
                      <td className={cn(TD, "font-medium text-foreground")}>{f.name}</td>
                      <td className={TD}>{SCOPE_LABEL[f.scope] ?? f.scope}</td>
                      <td className={cn(TD, "text-muted-foreground")}>{f.role ? roleLabel(f.role) : "—"}</td>
                      <td className={cn(TD, "text-muted-foreground")}>{f.target_item_name ?? "—"}</td>
                      <td className={cn(TD, "max-w-[360px] truncate font-mono text-[12px]")} title={f.text}>{f.text}</td>
                      <td className={TD}>
                        <TonePill {...(f.is_active ? STATUS_TONE.emerald : STATUS_TONE.zinc)}>{f.is_active ? "Активна" : "Отключена"}</TonePill>
                      </td>
                      <td className={cn(TD, "text-center")}>
                        <PayrollIconAction label="Изменить" tone="edit" onClick={() => edit(f)}>
                          <Pencil />
                        </PayrollIconAction>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PayrollModal>
  );
}

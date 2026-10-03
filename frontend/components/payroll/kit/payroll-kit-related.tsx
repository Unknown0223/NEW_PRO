"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { dashboardPayrollNav } from "@/components/dashboard/nav-config";
import { useTenant } from "@/lib/api-client";
import { useEffectiveRole } from "@/lib/auth-store";
import { isNavItemAllowed } from "@/lib/nav-route-access";
import { payrollApi } from "@/lib/payroll/payroll-api";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";

export type PayrollSection =
  | "salary"
  | "role-salaries"
  | "formulas"
  | "bonus"
  | "items"
  | "compare"
  | "advances"
  | "approvals"
  | "limits"
  | "cashier";

type RelatedLink = { id: PayrollSection; label: string; href: string };

const SALARY_LINKS: RelatedLink[] = [
  { id: "salary", label: "Зарплата", href: "/users/salary" },
  { id: "role-salaries", label: "Базовые оклады", href: "/users/salary/role-salaries" },
  { id: "formulas", label: "Формулы", href: "/users/salary/formulas" },
  { id: "bonus", label: "Настройки бонусов и зарплат", href: "/users/bonus-and-salary-settings" },
  { id: "items", label: "Надбавки и вычеты", href: "/settings/payroll/adjustments" }
];

const ADVANCE_LINKS: RelatedLink[] = [
  { id: "advances", label: "Аванс", href: "/users/advances" },
  { id: "approvals", label: "Утверждение авансов", href: "/finance/advances/approval" },
  { id: "limits", label: "Лимиты авансов", href: "/settings/payroll/advance-limits" },
  { id: "cashier", label: "Выдача аванса и зарплаты", href: "/finance/cashier-queue" }
];

const ADVANCE_SECTIONS = new Set<PayrollSection>(ADVANCE_LINKS.map((l) => l.id));
const NAV_ITEMS = dashboardPayrollNav.groups.flatMap((g) => g.items);

type ItemLite = { type: string; is_active: boolean };
type FormulaLite = { is_active: boolean };
type RoleLite = { base_amount: string | number | null };
type ApprovalsLite = { totals: { count: number } };
type QueueLite = { totals: { count: number } };

function useAllowedHref() {
  const role = useEffectiveRole();
  const perms = usePermissions();
  return (href: string) => {
    const item = NAV_ITEMS.find((i) => i.href === href);
    return !item || isNavItemAllowed(item, role, perms.keys);
  };
}

function useSalaryStats(enabled: boolean) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const on = enabled && Boolean(tenant);
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: on, queryFn: () => api.get<ItemLite[]>("/items") });
  const formulasQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: on, queryFn: () => api.get<FormulaLite[]>("/formulas") });
  const rolesQ = useQuery({ queryKey: ["payroll-role-configs", tenant], enabled: on, queryFn: () => api.get<RoleLite[]>("/role-configs") });
  if (!on) return [];
  const items = (itemsQ.data ?? []).filter((i) => i.is_active);
  return [
    { label: "Надбавки", value: items.filter((i) => i.type === "allowance").length },
    { label: "Удержания", value: items.filter((i) => i.type === "deduction").length },
    { label: "Формулы", value: (formulasQ.data ?? []).filter((f) => f.is_active).length },
    { label: "Оклады", value: (rolesQ.data ?? []).filter((r) => Number(r.base_amount ?? 0) > 0).length }
  ];
}

function useAdvanceStats(enabled: boolean, allowed: (href: string) => boolean) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const approvalsOn = enabled && Boolean(tenant) && allowed("/finance/advances/approval");
  const queueOn = enabled && Boolean(tenant) && allowed("/finance/cashier-queue");
  const approvalsQ = useQuery({
    queryKey: ["payroll-advance-approvals", tenant, "status=sent"],
    enabled: approvalsOn,
    refetchInterval: 60_000,
    queryFn: () => api.get<ApprovalsLite>("/advance-approvals?status=sent")
  });
  const queueQ = useQuery({
    queryKey: ["payroll-cashier-queue", tenant, ""],
    enabled: queueOn,
    refetchInterval: 60_000,
    queryFn: () => api.get<QueueLite>("/cashier-queue")
  });
  const out: { label: string; value: number }[] = [];
  if (approvalsOn && approvalsQ.data) out.push({ label: "На утверждении", value: approvalsQ.data.totals.count });
  if (queueOn && queueQ.data) out.push({ label: "В очереди", value: queueQ.data.totals.count });
  return out;
}

/** «Связанные разделы»: sibling pages of the current payroll group plus live counters. */
export function PayrollRelatedBar({ current }: { current: PayrollSection }) {
  const allowed = useAllowedHref();
  const advance = ADVANCE_SECTIONS.has(current);
  const salaryStats = useSalaryStats(!advance);
  const advanceStats = useAdvanceStats(advance, allowed);
  const links = (advance ? ADVANCE_LINKS : SALARY_LINKS).filter((l) => l.id === current || allowed(l.href));
  const stats = advance ? advanceStats : salaryStats;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--pr-border)] bg-card px-3 py-2 text-[12.5px] shadow-[var(--pr-shadow)]">
      <span className="font-semibold text-muted-foreground">Связанные разделы:</span>
      {links.map((l) => (
        <Link
          key={l.id}
          href={l.href}
          aria-current={l.id === current ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            l.id === current ? "bg-[var(--pr-brand-50)] text-[var(--pr-brand-700)]" : "text-foreground/70 hover:bg-muted hover:text-foreground"
          )}
        >
          {l.label}
        </Link>
      ))}
      {stats.length ? (
        <span className="ml-auto flex flex-wrap gap-3 text-[12px] text-muted-foreground">
          {stats.map((s) => (
            <span key={s.label}>
              {s.label}: <b className="text-foreground/80">{s.value}</b>
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

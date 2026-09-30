"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { payrollApi } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { useNotice } from "@/components/payroll/payroll-ui";
import { PayrollTableCard } from "@/components/payroll/kit/payroll-kit-table";

type Settings = { enabled: boolean; parallel_run: boolean; salary_queue_enabled: boolean };

const TOGGLES: Array<{ key: keyof Settings; title: string; hint: string }> = [
  {
    key: "enabled",
    title: "Модуль зарплаты включён",
    hint: "Система сама считает зарплату по табелю, KPI и формулам. Ручные расходы «Зарплата/Аванс» блокируются — выплаты идут через кассира."
  },
  {
    key: "parallel_run",
    title: "Пробный месяц (параллельный расчёт)",
    hint: "Первый месяц зарплата считается и в Excel, и в системе. Загрузите Excel в «Сверке» — система покажет расхождения с причинами."
  },
  {
    key: "salary_queue_enabled",
    title: "Выдача зарплаты через очередь кассира",
    hint: "Подтверждённые зарплаты с остатком к выплате появляются в очереди кассира филиала."
  }
];

const GROUPS: Array<{ title: string; links: Array<{ href: string; title: string; hint: string }> }> = [
  {
    title: "Расчёт",
    links: [
      { href: "/users/salary", title: "Зарплата", hint: "Расчёт, статусы, закрытие месяца" },
      { href: "/users/salary/compare", title: "Сверка с Excel", hint: "Пробный месяц" }
    ]
  },
  {
    title: "Аванс",
    links: [
      { href: "/users/advances", title: "Аванс", hint: "Заявки руководителя" },
      { href: "/finance/advances/approval", title: "Утверждение авансов", hint: "Финансы" },
      { href: "/settings/payroll/advance-limits", title: "Лимиты авансов", hint: "Общий, по роли, исключения" }
    ]
  },
  {
    title: "Выдача",
    links: [{ href: "/finance/cashier-queue", title: "Выдача аванса и зарплаты", hint: "Очередь кассира филиала" }]
  },
  {
    title: "Настройки",
    links: [
      { href: "/users/salary/role-salaries", title: "Базовые оклады", hint: "Оклад по роли и индивидуально" },
      { href: "/users/salary/formulas", title: "Формулы", hint: "KPI-бонусы, надбавки, оклад" },
      { href: "/users/bonus-and-salary-settings", title: "Настройки бонусов и зарплат", hint: "Назначение формул сотрудникам" },
      { href: "/settings/payroll/adjustments", title: "Надбавки и вычеты", hint: "Статьи ведомости" }
    ]
  }
];

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function PayrollSettingsHub() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();

  const q = useQuery({ queryKey: ["payroll-settings", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Settings>("/settings") });
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.send<Settings>("PATCH", "/settings", patch),
    onSuccess: (data) => {
      qc.setQueryData(["payroll-settings", tenant], data);
      notice.ok("Настройки сохранены");
    },
    onError: notice.fail
  });

  return (
    <PageShell className="payroll-template">
      <PageHeader title="Настройки зарплаты" description="Включение модуля и переходы ко всем разделам зарплаты и аванса." />
      {notice.element}
      <PayrollTableCard title="Параметры модуля">
        <div className="divide-y divide-border/70">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{t.title}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{t.hint}</div>
              </div>
              <Toggle
                checked={Boolean(q.data?.[t.key])}
                disabled={!canEdit || q.isLoading || save.isPending}
                onChange={(v) => save.mutate({ [t.key]: v })}
              />
            </div>
          ))}
        </div>
      </PayrollTableCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g) => (
          <PayrollTableCard key={g.title} title={g.title}>
            <div className="divide-y divide-border/70">
              {g.links.map((l) => (
                <Link key={l.href} href={l.href} className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground group-hover:text-primary">{l.title}</span>
                    <span className="block text-xs text-muted-foreground">{l.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </PayrollTableCard>
        ))}
      </div>
    </PageShell>
  );
}

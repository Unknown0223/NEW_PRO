"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { payrollApi } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { useNotice } from "@/components/payroll/payroll-ui";

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

const LINKS = [
  { href: "/users/salary", title: "Зарплатная ведомость", hint: "Расчёт, статусы, закрытие месяца" },
  { href: "/users/salary/role-salaries", title: "Базовые оклады", hint: "Оклад по роли и индивидуально" },
  { href: "/users/salary/formulas", title: "Конструктор формул", hint: "KPI-бонусы и надбавки" },
  { href: "/users/bonus-and-salary-settings", title: "Настройки бонусов", hint: "Назначение формул сотрудникам" },
  { href: "/settings/payroll/adjustments", title: "Надбавки и вычеты", hint: "Статьи ведомости" },
  { href: "/settings/payroll/advance-limits", title: "Лимиты авансов", hint: "Общий, по роли, исключения" },
  { href: "/users/advances", title: "Аванс", hint: "Заявки руководителя" },
  { href: "/finance/advances/approval", title: "Утверждение авансов", hint: "Финансы" },
  { href: "/finance/cashier-queue", title: "Выдача (очередь)", hint: "Кассир филиала" },
  { href: "/users/salary/compare", title: "Сверка с Excel", hint: "Пробный месяц" }
];

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
    <PageShell>
      <PageHeader title="Настройки зарплаты" description="Включение модуля и переходы ко всем разделам зарплаты и аванса." />
      {notice.element}
      <div className="grid max-w-3xl gap-3">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <input
              type="checkbox"
              className="mt-1 size-4"
              disabled={!canEdit || q.isLoading || save.isPending}
              checked={Boolean(q.data?.[t.key])}
              onChange={(e) => save.mutate({ [t.key]: e.target.checked })}
            />
            <span>
              <span className="block font-medium">{t.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={cn(buttonVariants({ variant: "outline" }), "h-auto flex-col items-start gap-0.5 p-4 text-left")}>
            <span className="font-medium">{l.title}</span>
            <span className="text-xs font-normal text-muted-foreground">{l.hint}</span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

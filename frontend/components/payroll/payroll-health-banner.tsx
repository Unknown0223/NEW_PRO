"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, XOctagon } from "lucide-react";
import { useTenant } from "@/lib/api-client";
import { payrollApi, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";

type Health = {
  enabled: boolean;
  parallel_run: boolean;
  ok: boolean;
  issues: Array<{ key: string; level: "error" | "warning" | "info"; count: number; title: string; hint: string; href?: string }>;
};

const ICON = { error: XOctagon, warning: AlertTriangle, info: Info };
const CLS = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900"
};

/** Oylik raqamlariga ta'sir qiladigan holatlar (diagnostika). */
export function PayrollHealthBanner({ ym }: { ym: Ym }) {
  const tenant = useTenant();
  const q = useQuery({
    queryKey: ["payroll-health", tenant, ym.year, ym.month],
    enabled: Boolean(tenant),
    refetchInterval: 60_000,
    queryFn: () => payrollApi(tenant).get<Health>(`/health?${ymQuery(ym)}`)
  });
  const h = q.data;
  if (!h) return null;
  if (!h.enabled) {
    return (
      <div className={cn("rounded-md border px-3 py-2 text-sm", CLS.warning)}>
        Модуль зарплаты выключен — автоматический расчёт не работает.{" "}
        <Link href="/settings/payroll" className="font-medium underline">Включить в настройках</Link>
      </div>
    );
  }
  if (!h.issues.length && !h.parallel_run) return null;
  return (
    <div className="grid gap-1.5">
      {h.parallel_run ? (
        <div className={cn("rounded-md border px-3 py-2 text-sm", CLS.info)}>
          Пробный месяц: сверьте результат с Excel в разделе{" "}
          <Link href="/users/salary/compare" className="font-medium underline">«Сверка с Excel»</Link> перед выплатой.
        </div>
      ) : null}
      {h.issues.map((i) => {
        const Icon = ICON[i.level];
        return (
          <div key={i.key} className={cn("flex items-start gap-2 rounded-md border px-3 py-1.5 text-sm", CLS[i.level])}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>{i.title}: {i.count}.</b> {i.hint}
              {i.href ? <Link href={i.href} className="ml-1 underline">Открыть</Link> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

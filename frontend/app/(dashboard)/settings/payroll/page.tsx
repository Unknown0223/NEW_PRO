"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  Grid3x3,
  Link2,
  Wallet,
  ScrollText
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { PAYROLL_PERIOD_STATUS_LABEL_RU, PAYROLL_QUERY_KEYS, payrollApi } from "@/components/payroll/payroll-api";
import { formatMoney, monthLabel, currentMonth } from "@/components/payroll/payroll-utils";

type Section = {
  href: string;
  title: string;
  description: string;
  icon: typeof Calculator;
};

const SECTIONS: Section[] = [
  {
    href: "/settings/payroll/formulas",
    title: "Формулы",
    description: "Hisob qoidalari: rol + KPI guruhi, оклад, foiz, stawka, ustama/ushlanma va shartlar.",
    icon: Calculator
  },
  {
    href: "/settings/payroll/grids",
    title: "Сетки",
    description: "Bosqichli tarif jadvali: ko‘rsatkich → koeffitsiyent/summa. Oylik ва baza qatorlar.",
    icon: Grid3x3
  },
  {
    href: "/settings/payroll/calc",
    title: "Расчёт за месяц",
    description: "Oylik hisob: qayta hisoblash, tasdiqlash, bloklash va har bir xodim tarkibi.",
    icon: ScrollText
  },
  {
    href: "/settings/payroll/assignments",
    title: "Привязка сотрудников",
    description: "Xodimga individual formula va окlad. Bo‘sh bo‘lsa — KPI guruhi va rol bo‘yicha avto.",
    icon: Link2
  },
  {
    href: "/settings/payroll/payments",
    title: "Выплаты",
    description: "To‘lovlar, qolgan summalar va bekor qilish.",
    icon: Wallet
  }
];

export default function PayrollHubPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const month = currentMonth();

  const calcQ = useQuery({
    queryKey: ["payroll", "calc", tenantSlug, month],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.detail,
    queryFn: async () => (await payrollApi.calc(tenantSlug!, { month })).data
  });

  const period = calcQ.data?.period;
  const rows = calcQ.data?.rows ?? [];
  const total = rows.reduce((acc, r) => acc + r.net_amount, 0);
  const withoutFormula = rows.filter((r) => !r.formula_id).length;

  return (
    <PageShell>
      <PageHeader
        title="Зарплата"
        description="Formulalar va сеткаlar KPI guruhlariga bog‘lanadi; hisob faqat shu guruh xodimlariga qo‘llanadi. Har bir rol uchun alohida hisob turi."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Oy" value={monthLabel(month)} />
        <Stat label="Holat" value={PAYROLL_PERIOD_STATUS_LABEL_RU[period?.status ?? "draft"] ?? "—"} />
        <Stat label="Xodimlar" value={formatGroupedInteger(rows.length)} hint={withoutFormula > 0 ? `${withoutFormula} ta formulasiz` : undefined} warn={withoutFormula > 0} />
        <Stat label="Jami hisob" value={formatMoney(total)} hint={`To‘langan: ${formatMoney(period?.paid_amount ?? 0)}`} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/60">
              <CardContent className="flex h-full items-start gap-3 p-4">
                <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        <Link href="/settings/payroll/adjustments" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/60">
            <CardContent className="flex h-full items-start gap-3 p-4">
              <Wallet className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium">Надбавки и вычеты</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ustama va ushlanma turlari spravochnigi (nomlar ro‘yxati).
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Hisob qanday ishlaydi</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Formula KPI guruhiga bog‘lanadi. Xodim shu guruhda bo‘lsa — uning formulasi qo‘llanadi; aks holda rol
              bo‘yicha standart formula ishlatiladi.
            </li>
            <li>
              Сетка ko‘rsatkichni (masalan KPI bajarilishi) bosqichga soladi va koeffitsiyent/summa/foiz qaytaradi.
              Oylik qator bo‘lsa — faqat o‘sha oy ishlatiladi.
            </li>
            <li>
              Rol bo‘yicha hisob turi: agent — оклад + KPI сетка; supervayzer — jamoa savdosidan foiz; ekspeditor —
              yetkazishlar va inkassatsiya; inkassator — yig‘imdan foiz; omborchi — bajarilgan operatsiya.
            </li>
            <li>Davomat (табель) окладga proporsional ta’sir qiladi, shartlar (gates) bonusni kesadi.</li>
            <li>Oy tasdiqlanadi va bloklanadi — bloklangan oyda табель ham tahrirlanmaydi.</li>
          </ol>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</p>
        {hint ? <p className={`text-[11px] ${warn ? "text-amber-600" : "text-muted-foreground"}`}>{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

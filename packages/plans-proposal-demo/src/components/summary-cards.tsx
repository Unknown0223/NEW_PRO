import { AlertTriangle, ArrowUpRight, CheckCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { percentChange } from "@salec/plans-proposal";
import type { ProposalController } from "@/hooks/use-proposal";
import { fmt, fmtDecimal } from "@/lib/format";
import { cx } from "./ui";

export function SummaryCards({ c }: { c: ProposalController }) {
  const t = c.visibleResult.totals;
  const growth = percentChange(t.previousPlan, t.proposed);
  const pct = t.eligible ? Math.round((t.ready / t.eligible) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <section className="card relative overflow-hidden p-4">
        <div className="absolute top-0 right-0 size-24 translate-x-6 -translate-y-6 rounded-full bg-brand-50" />
        <div className="relative flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8a998f]">Jami taklif reja</p>
          <Wallet size={15} className="text-brand-500" />
        </div>
        <p className="numeric relative mt-2.5 text-lg leading-8 font-bold tracking-[-0.035em] whitespace-nowrap text-brand-800 sm:text-[23px]">
          {fmt(t.proposed)}
          <span className="ml-1.5 text-[10px] font-normal tracking-normal text-[#91a197]">
            so‘m
          </span>
        </p>
        <p className="mt-1.5 text-[9px] text-[#9aa69e]">Faqat tayyor kataklar yig‘indisi</p>
      </section>
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8a998f]">Tayyor kataklar</p>
          <Users size={15} className="text-[#91a698]" />
        </div>
        <p className="numeric mt-2.5 text-[23px] leading-8 font-bold tracking-tight">
          {t.ready}
          <span className="ml-1 text-sm font-normal text-[#a7b2ab]">/ {t.eligible}</span>
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#edf2ee]">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-[#9aa69e]">
          <CheckCheck size={10} /> {t.excluded} ta chiqarilgan · {pct}% tayyor
        </p>
      </section>
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8a998f]">E’tibor kerak</p>
          <AlertTriangle size={15} className="text-amber-500" />
        </div>
        <p className="numeric mt-2.5 text-[23px] leading-8 font-bold tracking-tight text-amber-600">
          {t.warnings}
          <span className="ml-1.5 text-[10px] font-normal text-[#a7b2ab]">ogohlantirish</span>
        </p>
        <p className={cx("mt-1.5 text-[9px]", t.blockers ? "text-red-500" : "text-[#9aa69e]")}>
          {t.blockers} ta katakda bloklovchi to‘siq bor
        </p>
      </section>
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8a998f]">Eski rejaga nisbatan</p>
          <TrendingUp size={15} className="text-[#91a698]" />
        </div>
        <p className="numeric mt-2.5 flex items-center gap-1 text-[23px] leading-8 font-bold tracking-tight text-brand-600">
          {growth == null ? "—" : `${growth > 0 ? "+" : ""}${fmtDecimal(growth)}%`}
          <ArrowUpRight size={17} className="text-brand-400" />
        </p>
        <p className="numeric mt-1.5 text-[9px] text-[#9aa69e]">
          Tayyor kataklar eski rejasi: {fmt(t.previousPlan)}
        </p>
      </section>
    </div>
  );
}

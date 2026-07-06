import { useState } from "react";
import { cn } from "../utils/cn";

const CALC_ITEMS = [
  "Оплаты клиентов",
  "Расходы клиента",
  "Начальные балансы клиентов",
  "Балансы клиентов (оплата и долги)",
  "Балансы клиентов по консигнации",
];

const REPORT_ITEMS = [
  "Отчёт по приходам",
  "Движение денежных средств",
  "Остатки денежных средств",
  "Акт сверки",
  "Долги по заказам",
];

const OTHER_ITEMS = ["Касса", "Курс валют", "Приходы", "Расходы", "Заявки на оплату"];

function TopIcon({ d }: { d: string }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="mt-5 mb-2 flex items-center gap-2 px-4">
      <span className="text-[10.5px] font-semibold tracking-widest text-teal-100/40 uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-teal-100/15" />
    </div>
  );
}

function SubItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={cn(
        "group flex w-full items-start gap-2.5 rounded-md px-4 py-[7px] text-left text-[13px] leading-[18px] transition-colors",
        active ? "font-medium text-white" : "text-teal-50/70 hover:text-white"
      )}
    >
      <span
        className={cn(
          "mt-[7px] h-1 w-1 shrink-0 rounded-full",
          active ? "bg-teal-300" : "bg-teal-100/40 group-hover:bg-teal-300"
        )}
      />
      {label}
    </button>
  );
}

export default function Sidebar({ open }: { open: boolean }) {
  const [cashOpen, setCashOpen] = useState(true);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f3438] transition-transform duration-200 print:hidden",
        open ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex h-[80px] items-center gap-3 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow">
          <span className="text-[15px] font-black tracking-tight text-[#0f3438]">ERP</span>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-white">Enterprise ERP</div>
          <div className="text-[11px] text-teal-100/50">Финансовый модуль</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {/* Top level */}
        <div className="space-y-0.5 px-2 pt-2">
          {[
            { label: "Дашборды", icon: "M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z" },
            { label: "Заявки", icon: "M6 2h12a1 1 0 0 1 1 1v18l-4-3-3 3-3-3-4 3V3a1 1 0 0 1 1-1z" },
            { label: "Клиенты", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
            { label: "Накладные", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
          ].map((it) => (
            <button
              key={it.label}
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-[13.5px] text-teal-50/85 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="flex items-center gap-3">
                <TopIcon d={it.icon} />
                {it.label}
              </span>
              <svg className="h-3.5 w-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}

          {/* Касса — active section */}
          <button
            onClick={() => setCashOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md bg-white/10 px-3 py-2.5 text-[13.5px] font-medium text-white"
          >
            <span className="flex items-center gap-3">
              <TopIcon d="M2 7h20v14H2zM16 3H8v4h8zM2 12h20M12 12v3" />
              Касса
            </span>
            <svg
              className={cn("h-3.5 w-3.5 opacity-70 transition-transform", cashOpen && "rotate-90")}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {cashOpen && (
          <div className="px-2">
            <GroupLabel>Расчеты с клиентами</GroupLabel>
            {CALC_ITEMS.map((l, i) => (
              <SubItem key={l} label={l} active={i === 0} />
            ))}
            <GroupLabel>Отчёты</GroupLabel>
            {REPORT_ITEMS.map((l) => (
              <SubItem key={l} label={l} />
            ))}
            <GroupLabel>Прочие</GroupLabel>
            {OTHER_ITEMS.map((l) => (
              <SubItem key={l} label={l} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}

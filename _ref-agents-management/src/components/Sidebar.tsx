"use client";

import { useState } from "react";

const TOP_ITEMS = [
  { icon: "▦", label: "Дашборды" },
  { icon: "🛒", label: "Заявки" },
  { icon: "👥", label: "Клиенты" },
  { icon: "📄", label: "Накладные" },
  { icon: "💳", label: "Касса" },
  { icon: "📦", label: "Склад" },
  { icon: "🚚", label: "Поставщики" },
  { icon: "🗓", label: "Планы" },
  { icon: "📈", label: "Отчёт" },
  { icon: "📊", label: "Pivot отчеты" },
];

const USERS_TEAM = ["Агент", "Экспедиторы", "Супервайзер"];
const USERS_OTHER = [
  "Сотрудники",
  "Консигнация",
  "Настройки бонусов и зарплат",
  "Зарплата",
  "Рабочие дни",
  "Табель",
];

const BOTTOM_ITEMS = [
  { icon: "🕵", label: "Аудит", chevron: true },
  { icon: "🔑", label: "Доступ" },
  { icon: "⚙️", label: "Настройки" },
];

export default function Sidebar() {
  const [usersOpen, setUsersOpen] = useState(true);

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-[#0b3231] text-teal-100/80 text-[13px] min-h-screen">
      <div className="px-5 py-5">
        <div className="h-10 w-10 rounded-lg bg-white/95" />
      </div>

      <nav className="flex-1 overflow-y-auto pb-6 [scrollbar-width:thin]">
        {TOP_ITEMS.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center justify-between px-5 py-2.5 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-3">
              <span className="w-4 text-center opacity-70">{item.icon}</span>
              {item.label}
            </span>
            <span className="text-[10px] opacity-50">›</span>
          </button>
        ))}

        {/* Users section */}
        <button
          onClick={() => setUsersOpen((o) => !o)}
          className={`flex w-full items-center justify-between px-5 py-2.5 transition-colors ${
            usersOpen ? "bg-white/10 text-white rounded-r-full" : "hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="w-4 text-center opacity-70">👤</span>
            Пользователи
          </span>
          <span
            className={`text-[10px] opacity-70 transition-transform ${
              usersOpen ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </button>

        {usersOpen && (
          <div className="py-1">
            <div className="px-8 pt-2 pb-1 text-[10px] uppercase tracking-wider text-teal-100/40 flex items-center gap-2">
              <span className="h-px w-3 bg-teal-100/30" /> Команда
            </div>
            {USERS_TEAM.map((label) => (
              <button
                key={label}
                className={`flex w-full items-center gap-2 px-9 py-1.5 text-left transition-colors ${
                  label === "Агент"
                    ? "bg-white/15 text-white rounded-r-full mr-4"
                    : "hover:text-white"
                }`}
              >
                <span className="text-[8px] opacity-60">•</span>
                {label}
              </button>
            ))}
            <div className="px-8 pt-3 pb-1 text-[10px] uppercase tracking-wider text-teal-100/40 flex items-center gap-2">
              <span className="h-px w-3 bg-teal-100/30" /> Прочие
            </div>
            {USERS_OTHER.map((label) => (
              <button
                key={label}
                className="flex w-full items-center gap-2 px-9 py-1.5 text-left hover:text-white transition-colors"
              >
                <span className="text-[8px] opacity-60">•</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center justify-between px-5 py-2.5 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-3">
              <span className="w-4 text-center opacity-70">{item.icon}</span>
              {item.label}
            </span>
            {item.chevron && <span className="text-[10px] opacity-50">›</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

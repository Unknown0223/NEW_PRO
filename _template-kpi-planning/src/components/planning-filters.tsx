"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { usePlanningStore } from "@/lib/store";
import { Search, Filter, RotateCcw, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const years = ["2024", "2025", "2026", "2027"];

const roles = [
  { value: "", label: "Все роли" },
  { value: "director", label: "Директор" },
  { value: "sales_director", label: "Директор по продажам" },
  { value: "commercial_director", label: "Коммерческий директор" },
  { value: "manager", label: "Менеджер" },
  { value: "supervisor", label: "Супервайзер" },
  { value: "agent", label: "Агент" },
];

const statuses = [
  { value: "", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В процессе" },
  { value: "pending_approval", label: "На согласовании" },
  { value: "approved", label: "Утверждено" },
  { value: "rejected", label: "Отклонено" },
];

export function PlanningFilters() {
  const { filters, setFilters } = usePlanningStore();

  const currentMonthLabel = months[filters.month - 1];

  const changeMonth = (delta: number) => {
    let newMonth = filters.month + delta;
    let newYear = filters.year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setFilters({ month: newMonth, year: newYear });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Поиск сотрудника..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2 text-sm font-medium">
            <span className="text-slate-500">Месяц и год</span>
            <span className="text-slate-900">{currentMonthLabel} {filters.year}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={filters.role || ""}
          onValueChange={(v) => setFilters({ role: v || null })}
          placeholder="Роль"
          className="w-40"
        >
          {roles.map((r) => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </Select>

        <Select
          value={filters.status || ""}
          onValueChange={(v) => setFilters({ status: v || null })}
          placeholder="Статус"
          className="w-44"
        >
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </Select>

        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          Сохранить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-500"
          onClick={() =>
            setFilters({
              month: 5,
              year: 2026,
              tradeDirectionId: null,
              kpiGroupId: null,
              role: null,
              status: null,
              search: "",
            })
          }
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Сбросить
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">Быстрые фильтры:</span>
        {["В процессе", "На согласовании", "Утверждено", "Текущий месяц", "GIGA"].map((tag) => (
          <button
            key={tag}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

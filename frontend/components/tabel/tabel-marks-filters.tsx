"use client";

import { Input } from "@/components/ui/input";

type StaffOpt = { id: number; label: string };

export function TabelMarksFilters({
  from,
  to,
  branch,
  source,
  userId,
  search,
  branches,
  staffOptions,
  onFrom,
  onTo,
  onBranch,
  onSource,
  onUserId,
  onSearch
}: {
  from: string;
  to: string;
  branch: string;
  source: string;
  userId: number | "";
  search: string;
  branches: string[];
  staffOptions: StaffOpt[];
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onBranch: (v: string) => void;
  onSource: (v: string) => void;
  onUserId: (v: number | "") => void;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата с</label>
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата по</label>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Филиал</label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={branch}
          onChange={(e) => onBranch(e.target.value)}
        >
          <option value="">Все филиалы</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Источник</label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={source}
          onChange={(e) => onSource(e.target.value)}
        >
          <option value="">Все источники</option>
          <option value="mobile_photo">Фото + Face ID</option>
          <option value="mobile_video">Видео + 3-значный код</option>
          <option value="kiosk">Киоск бригады</option>
          <option value="terminal">Терминал Face ID</option>
          <option value="gps">GPS визит</option>
          <option value="manual">Вручную</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Сотрудник</label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={userId === "" ? "" : String(userId)}
          onChange={(e) => onUserId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Все сотрудники</option>
          {staffOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Поиск</label>
        <Input placeholder="ФИО, код, филиал" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
    </div>
  );
}

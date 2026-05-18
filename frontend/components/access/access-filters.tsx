"use client";

import { SearchableMultiSelectPanel, type SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface AccessFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  roleFilter: string;
  onRoleChange: (role: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  onClearFilters: () => void;
}

const ROLE_OPTIONS: SearchableMultiSelectItem<string>[] = [
  { id: "", title: "Все роли" },
  { id: "admin", title: "Администраторы" },
  { id: "supervisor", title: "Супервайзеры" },
  { id: "agent", title: "Агенты" },
  { id: "expeditor", title: "Экспедиторы" },
  { id: "operator", title: "Операторы" },
  { id: "manager", title: "Менеджеры" }
];

const STATUS_OPTIONS: SearchableMultiSelectItem<string>[] = [
  { id: "", title: "Все" },
  { id: "active", title: "Активные" },
  { id: "inactive", title: "Неактивные" }
];

export function AccessFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleChange,
  statusFilter,
  onStatusChange,
  onClearFilters
}: AccessFiltersProps) {
  const hasFilters = searchQuery || roleFilter || statusFilter;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Поиск пользователя..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <SearchableMultiSelectPanel
        triggerLabel={ROLE_OPTIONS.find((r) => r.id === roleFilter)?.title ?? "Роль"}
        items={ROLE_OPTIONS}
        selected={roleFilter ? [roleFilter] : []}
        onChange={(ids) => onRoleChange(ids[0] ?? "")}
        minSearchLength={8}
      />

      <SearchableMultiSelectPanel
        triggerLabel={STATUS_OPTIONS.find((s) => s.id === statusFilter)?.title ?? "Статус"}
        items={STATUS_OPTIONS}
        selected={statusFilter ? [statusFilter] : []}
        onChange={(ids) => onStatusChange(ids[0] ?? "")}
        minSearchLength={8}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Сбросить
        </Button>
      )}
    </div>
  );
}
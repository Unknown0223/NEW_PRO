"use client";

import { useState, useCallback } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePlanningStore } from "@/lib/store";
import { getRoleLabel, getStatusColor, getStatusLabel, formatCurrency, formatNumber, cn } from "@/lib/utils";
import { ArrowUpDown, FileSpreadsheet, ChevronDown, ChevronRight, Save, Lock, Unlock } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  code: string;
  role: string;
  parentId: number | null;
  avatar: string | null;
}

interface KpiTarget {
  id: number;
  planId: number;
  employeeId: number;
  cost: string | null;
  count: string | null;
  volume: string | null;
  acb: string | null;
  orderCount: number | null;
  comment: string | null;
  status: string | null;
  lastUpdated: Date | null;
}

interface KpiMatrixTableProps {
  employees: Employee[];
  kpiTargets: KpiTarget[];
  onUpdateTarget: (target: KpiTarget, field: string, value: string) => void;
}

type SortField = "name" | "role" | "cost" | "count" | "volume" | "acb" | "orderCount" | "status";
type SortDir = "asc" | "desc";

const columns: { key: SortField; label: string; width: string }[] = [
  { key: "name", label: "Сотрудник", width: "min-w-[220px]" },
  { key: "role", label: "Роль", width: "min-w-[100px]" },
  { key: "cost", label: "Сумма (UZS)", width: "min-w-[140px]" },
  { key: "count", label: "Количество", width: "min-w-[120px]" },
  { key: "volume", label: "Объем", width: "min-w-[100px]" },
  { key: "acb", label: "АКБ", width: "min-w-[120px]" },
  { key: "orderCount", label: "Заказы", width: "min-w-[90px]" },
  { key: "status", label: "Статус", width: "min-w-[110px]" },
];

function EditableCell({
  value,
  onChange,
  type = "number",
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  type?: "number" | "text";
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  if (editing && !disabled) {
    return (
      <Input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-7 text-xs px-2 py-0"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        "w-full text-left text-xs font-medium text-slate-700 px-2 py-1 rounded",
        !disabled && "hover:bg-slate-100 cursor-pointer"
      )}
      disabled={disabled}
    >
      {type === "number" ? formatNumber(value) : value}
    </button>
  );
}

export function KpiMatrixTable({ employees, kpiTargets, onUpdateTarget }: KpiMatrixTableProps) {
  const { filters, expandedNodes, toggleNode } = usePlanningStore();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getTarget = useCallback(
    (empId: number) => kpiTargets.find((t) => t.employeeId === empId),
    [kpiTargets]
  );

  const filteredEmployees = employees.filter((emp) => {
    if (filters.role && emp.role !== filters.role) return false;
    if (filters.search && !emp.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "role") {
      const roleOrder = ["director", "sales_director", "commercial_director", "manager", "supervisor", "agent"];
      comparison = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    } else {
      const ta = getTarget(a.id);
      const tb = getTarget(b.id);
      const va = parseFloat((ta as any)?.[sortField] || "0");
      const vb = parseFloat((tb as any)?.[sortField] || "0");
      comparison = va - vb;
    }
    return sortDir === "asc" ? comparison : -comparison;
  });

  const roleHierarchy = ["director", "sales_director", "commercial_director", "manager", "supervisor", "agent"];

  const getIndent = (role: string) => {
    const idx = roleHierarchy.indexOf(role);
    return idx * 16;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">KPI Матрица</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Сохранить
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-2.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors",
                      col.width
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 min-w-[120px]">
                  Комментарий
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((emp) => {
                const target = getTarget(emp.id);
                const cost = parseFloat(target?.cost || "0");
                const completion = Math.min(100, Math.max(0, (cost / 250000000) * 100));
                const isExpanded = expandedNodes.has(emp.id);
                const hasChildren = employees.some((e) => e.parentId === emp.id);
                const isLocked = target?.status === "approved";

                return (
                  <tr
                    key={emp.id}
                    className={cn(
                      "border-b border-slate-100 transition-colors hover:bg-slate-50/50",
                      target?.status === "approved" && "bg-emerald-50/30",
                      target?.status === "pending_approval" && "bg-amber-50/30"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2" style={{ paddingLeft: `${getIndent(emp.role)}px` }}>
                        <button
                          onClick={() => hasChildren && toggleNode(emp.id)}
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded transition-colors",
                            hasChildren ? "hover:bg-slate-200" : "invisible"
                          )}
                        >
                          {hasChildren && (isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                          ))}
                        </button>
                        <Avatar src={emp.avatar} fallback={emp.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{emp.name}</p>
                          <p className="text-[10px] text-slate-400">{emp.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-600">{getRoleLabel(emp.role)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <EditableCell
                          value={target?.cost || "0"}
                          onChange={(val) => target && onUpdateTarget(target, "cost", val)}
                          disabled={isLocked}
                        />
                        <Progress value={completion} size="sm" variant={completion >= 70 ? "success" : completion >= 40 ? "warning" : "default"} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={target?.count || "0"}
                        onChange={(val) => target && onUpdateTarget(target, "count", val)}
                        disabled={isLocked}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={target?.volume || "0"}
                        onChange={(val) => target && onUpdateTarget(target, "volume", val)}
                        disabled={isLocked}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={target?.acb || "0"}
                        onChange={(val) => target && onUpdateTarget(target, "acb", val)}
                        disabled={isLocked}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={String(target?.orderCount || 0)}
                        onChange={(val) => target && onUpdateTarget(target, "orderCount", val)}
                        disabled={isLocked}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusColor(target?.status || "draft"))}>
                          {getStatusLabel(target?.status || "draft")}
                        </Badge>
                        {isLocked ? (
                          <Lock className="h-3 w-3 text-slate-400" />
                        ) : (
                          <Unlock className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-500 truncate block max-w-[120px]">
                        {target?.comment || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

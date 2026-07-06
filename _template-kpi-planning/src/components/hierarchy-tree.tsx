"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePlanningStore } from "@/lib/store";
import { getRoleLabel, getStatusColor, getStatusLabel, formatCurrency } from "@/lib/utils";
import { ChevronRight, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

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
  status: string | null;
}

interface HierarchyTreeProps {
  employees: Employee[];
  kpiTargets: KpiTarget[];
}

function buildTree(employees: Employee[], parentId: number | null = null): Employee[] {
  return employees
    .filter((e) => (parentId === null ? e.parentId === null : e.parentId === parentId))
    .sort((a, b) => {
      const roleOrder = ["director", "sales_director", "commercial_director", "manager", "supervisor", "agent"];
      return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });
}

function getChildCount(employees: Employee[], parentId: number): number {
  const direct = employees.filter((e) => e.parentId === parentId).length;
  const indirect = employees
    .filter((e) => e.parentId === parentId)
    .reduce((sum, child) => sum + getChildCount(employees, child.id), 0);
  return direct + indirect;
}

function TreeNode({
  employee,
  employees,
  kpiTargets,
  depth = 0,
}: {
  employee: Employee;
  employees: Employee[];
  kpiTargets: KpiTarget[];
  depth?: number;
})

{
  const { expandedNodes, toggleNode, selectedEmployeeId, setSelectedEmployeeId } = usePlanningStore();
  const isExpanded = expandedNodes.has(employee.id);
  const children = buildTree(employees, employee.id);
  const hasChildren = children.length > 0;
  const childCount = getChildCount(employees, employee.id);
  const isSelected = selectedEmployeeId === employee.id;

  const target = kpiTargets.find((t) => t.employeeId === employee.id);
  const cost = parseFloat(target?.cost || "0");
  const status = target?.status || "draft";
  const completion = Math.min(100, Math.max(0, (cost / 250000000) * 100));

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
          isSelected ? "bg-emerald-50 border border-emerald-200" : "hover:bg-slate-50 border border-transparent"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => setSelectedEmployeeId(employee.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleNode(employee.id);
          }}
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

        <Avatar src={employee.avatar} fallback={employee.name} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">{employee.name}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1 py-0", getStatusColor(status))}>
              {getStatusLabel(status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{getRoleLabel(employee.role)}</span>
            <span>•</span>
            <span>{employee.code}</span>
            {childCount > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {childCount}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right min-w-[100px]">
          <p className="text-xs font-semibold text-slate-700">{formatCurrency(cost)}</p>
          <Progress value={completion} size="sm" variant={completion >= 70 ? "success" : completion >= 40 ? "warning" : "default"} />
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-0.5">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              employee={child}
              employees={employees}
              kpiTargets={kpiTargets}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyTree({ employees, kpiTargets }: HierarchyTreeProps) {
  const { expandAll, collapseAll } = usePlanningStore();
  const roots = buildTree(employees);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Иерархия сотрудников</h3>
        <div className="flex items-center gap-1">
          <button onClick={expandAll} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
            Раскрыть все
          </button>
          <span className="text-slate-300">|</span>
          <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
            Свернуть все
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {roots.map((root) => (
          <TreeNode key={root.id} employee={root} employees={employees} kpiTargets={kpiTargets} />
        ))}
      </div>
    </div>
  );
}

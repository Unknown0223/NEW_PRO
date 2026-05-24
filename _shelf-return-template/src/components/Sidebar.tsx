import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { SIDEBAR_MENU } from "../data/mock";

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  active?: boolean;
  children?: { key: string; label: string; active?: boolean }[];
}

export default function Sidebar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    requests: true,
    orders: false,
  });

  const toggle = (k: string) =>
    setExpanded((e) => ({ ...e, [k]: !e[k] }));

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Icon name="box" className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">TradeFlow CRM</div>
          <div className="text-[11px] text-slate-500">Sales & Warehouse</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5 text-sm">
          {(SIDEBAR_MENU as unknown as MenuItem[]).map((item) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const isExpanded = expanded[item.key] ?? false;
            const isActiveChild = item.children?.some((c) => c.active);
            return (
              <li key={item.key}>
                <button
                  onClick={() => (hasChildren ? toggle(item.key) : undefined)}
                  className={`group flex w-full items-center justify-between rounded-md px-3 py-2 transition ${
                    isActiveChild
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon && (
                      <Icon
                        name={item.icon as IconName}
                        className="h-4.5 w-4.5 opacity-80"
                      />
                    )}
                    <span className="font-medium">{item.label}</span>
                  </span>
                  {hasChildren && (
                    <Icon
                      name={isExpanded ? "chevron-down" : "chevron-right"}
                      className="h-4 w-4 text-slate-400"
                    />
                  )}
                </button>

                {hasChildren && isExpanded && (
                  <ul className="mt-1 space-y-0.5 pl-10 pr-2">
                    {item.children!.map((child) => (
                      <li key={child.key}>
                        <button
                          className={`w-full rounded-md px-3 py-1.5 text-left text-[13px] transition ${
                            child.active
                              ? "bg-indigo-600 font-medium text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {child.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-sm font-semibold">
            ЖК
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">
              Жасур Азизов
            </div>
            <div className="truncate text-xs text-slate-500">Торговый агент</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

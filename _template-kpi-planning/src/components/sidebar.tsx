"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Wallet,
  Warehouse,
  ShoppingCart,
  BarChart3,
  Settings,
  Shield,
  MapPin,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Target,
  PieChart,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const menuItems = [
  { icon: LayoutDashboard, label: "Дашборды", href: "#" },
  { icon: FileText, label: "Заявки", href: "#", hasChevron: true },
  { icon: Users, label: "Клиенты", href: "#", hasChevron: true },
  { icon: Truck, label: "Накладные", href: "#", hasChevron: true },
  { icon: Wallet, label: "Касса", href: "#", hasChevron: true },
  { icon: Warehouse, label: "Склад", href: "#", hasChevron: true },
  { icon: ShoppingCart, label: "Поставщики", href: "#", hasChevron: true },
  {
    icon: Target,
    label: "Планы",
    href: "#",
    hasChevron: true,
    active: true,
    expanded: true,
    children: [
      { label: "Настройки утверждающих", href: "#", dot: true },
      { label: "Установка планов", href: "/", active: true, dot: true },
    ],
  },
  { icon: BarChart3, label: "Отчёт", href: "#", hasChevron: true },
  { icon: PieChart, label: "Pivot отчеты", href: "#", hasChevron: true },
  { icon: Users, label: "Пользователи", href: "#", hasChevron: true },
  { icon: Shield, label: "Аудит", href: "#", hasChevron: true },
];

const bottomItems = [
  { icon: MapPin, label: "Доступ", href: "#" },
  { icon: Settings, label: "Настройки", href: "#" },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Планы": true });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#0e3731] text-white transition-all duration-300",
        collapsed ? "w-16" : "w-[220px]"
      )}
    >
      {/* Logo + Collapse button */}
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600">
          <div className="h-4 w-4 rounded-sm bg-white" />
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-500"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-500 z-50"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {menuItems.map((item, idx) => (
            <li key={idx}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [item.label]: !p[item.label] }))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      item.active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {expanded[item.label] ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/50" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" />
                        )}
                      </>
                    )}
                  </button>
                  {expanded[item.label] && !collapsed && (
                    <ul className="mt-0.5 space-y-0.5">
                      {item.children.map((child, cidx) => (
                        <li key={cidx}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors ml-6",
                              child.active
                                ? "bg-[#1a5c4f] text-white"
                                : "text-white/60 hover:text-white"
                            )}
                          >
                            {child.dot && (
                              <span className={cn(
                                "h-1 w-1 rounded-full shrink-0",
                                child.active ? "bg-teal-400" : "bg-white/40"
                              )} />
                            )}
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.hasChevron && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/30" />}
                    </>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom items */}
      <div className="border-t border-white/10 py-2 px-2">
        {bottomItems.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </div>
    </aside>
  );
}

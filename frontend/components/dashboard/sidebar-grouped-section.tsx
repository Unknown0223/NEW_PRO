"use client";

import type { NavItem } from "@/components/dashboard/nav-config";
import { ClientLucideIcon } from "@/components/ui/client-lucide-icon";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  title: string;
  icon: LucideIcon;
  groups: { title: string; items: NavItem[] }[];
  open: boolean;
  active: boolean;
  onToggle: () => void;
  isItemVisible: (item: NavItem) => boolean;
  isItemActive: (href: string) => boolean;
};

/** Guruhlangan (ichki sarlavhali) yon panel bo‘limi — Касса / Пользователи bilan bir xil ko‘rinish. */
export function SidebarGroupedSection({ title, icon, groups, open, active, onToggle, isItemVisible, isItemActive }: Props) {
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.disabled && !i.placeholder && i.href !== "#" && isItemVisible(i)) }))
    .filter((g) => g.items.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
            : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
        )}
        aria-expanded={open}
      >
        <ClientLucideIcon icon={icon} className="size-[18px] shrink-0 opacity-90" />
        <span className="min-w-0 flex-1">{title}</span>
        <ClientLucideIcon icon={open ? ChevronDown : ChevronRight} className="size-4 shrink-0 opacity-80" />
      </button>
      {open && (
        <div className="ml-1 space-y-3 border-l border-sidebar-border/60 py-0.5 pl-2">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div className="relative py-1">
                <div className="absolute inset-x-0 top-1/2 border-t border-sidebar-border/50" />
                <p className="relative mx-auto w-fit bg-sidebar px-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                  {group.title}
                </p>
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const itemActive = isItemActive(item.href);
                  return (
                    <li key={`${group.title}-${item.href}`}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                          itemActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            itemActive ? "bg-sidebar-primary-foreground/90" : "bg-sidebar-primary"
                          )}
                          aria-hidden
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

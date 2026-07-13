"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailToolbar({ vm }: { vm: AccessUserDetailVm }) {
  const {
    inner,
    setInner,
    tableSearch,
    setTableSearch,
    modal,
    innerTabs,
    openModal,
    setModal
  } = vm;

  return (
      <div
        className={`access-hub-toolbar w-full shrink-0 shadow-none flex flex-wrap items-center gap-2 ${inner === "operations" ? "justify-between" : ""}`}
      >
        {inner === "operations" ? (
          <div className="relative min-w-[10rem] max-w-xs flex-1 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs"
              placeholder="Поиск"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              aria-label="Поиск по таблице операций"
            />
          </div>
        ) : null}
        <nav
          className={cn(
            "flex flex-wrap gap-1",
            inner === "operations" ? "min-w-0 flex-1 justify-end" : "w-full"
          )}
        >
          {innerTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={
                (t.id === "territories" && modal === "territory") ||
                (t.id === "staff" && modal === "staff") ||
                (t.id === "operations" && inner === "operations") ||
                (t.id === "cash_desks" && modal === "cash") ||
                (t.id === "warehouses" && modal === "warehouse") ||
                (t.id === "branches" && modal === "branch") ||
                (t.id === "payment_methods" && modal === "payment") ||
                (t.id === "trade_directions" && modal === "direction")
              }
              className={cn(
                "access-tab-chip text-xs",
                (t.id === "territories" && modal === "territory") ||
                  (t.id === "staff" && modal === "staff") ||
                  (t.id === "operations" && inner === "operations") ||
                  (t.id === "cash_desks" && modal === "cash") ||
                  (t.id === "warehouses" && modal === "warehouse") ||
                  (t.id === "branches" && modal === "branch") ||
                  (t.id === "payment_methods" && modal === "payment") ||
                  (t.id === "trade_directions" && modal === "direction")
                  ? ""
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => {
                if (t.id === "territories") {
                  openModal("territory");
                  return;
                }
                if (t.id === "staff") {
                  /** Как «Территории»: только модалка, без смены вкладки — матрица «Операции» остаётся под оверлеем. */
                  openModal("staff");
                  return;
                }
                if (t.id === "cash_desks") {
                  openModal("cash");
                  return;
                }
                if (t.id === "warehouses") {
                  openModal("warehouse");
                  return;
                }
                if (t.id === "branches") {
                  openModal("branch");
                  return;
                }
                if (t.id === "payment_methods") {
                  openModal("payment");
                  return;
                }
                if (t.id === "trade_directions") {
                  openModal("direction");
                  return;
                }
                if (t.id === "operations") {
                  setInner("operations");
                  setModal(null);
                  return;
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
  );
}

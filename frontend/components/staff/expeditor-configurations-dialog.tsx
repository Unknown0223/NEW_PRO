"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  SearchableMultiSelectPanel,
  type SearchableMultiSelectItem
} from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import {
  cloneMobileFromRow,
  emptyMobileDraft,
  type AgentMobileConfigDraft
} from "@/components/staff/agent-mobile-config-types";
import type { AgentConfigPaymentMethodEntry } from "@/components/staff/agent-configurations-dialog";
import { Trash2 } from "lucide-react";

export type ExpeditorConfigDialogRow = {
  id: number;
  fio: string;
  agent_entitlements: Record<string, unknown> & {
    price_types?: string[];
    product_rules?: unknown;
    mobile_config?: unknown;
  };
};

function ConfigSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function ConfigCheckRow({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1 py-2.5 transition-colors",
        "hover:bg-muted/50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/60"
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-[17px] shrink-0 rounded border-2 border-muted-foreground/35 bg-background accent-teal-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="select-none text-[13px] leading-snug text-foreground/95">{label}</span>
    </label>
  );
}

function ConfigTextField({
  label,
  hint,
  className,
  ...inputProps
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Input
        className={cn("h-9 max-w-md border-border/80 bg-background text-[13px] shadow-sm", className)}
        {...inputProps}
      />
    </div>
  );
}

function setDraftPath<K extends keyof AgentMobileConfigDraft>(
  draft: AgentMobileConfigDraft,
  key: K,
  fn: (cur: NonNullable<AgentMobileConfigDraft[K]>) => NonNullable<AgentMobileConfigDraft[K]>
): AgentMobileConfigDraft {
  const cur = (draft[key] as object | undefined) ?? {};
  return { ...draft, [key]: fn(cur as NonNullable<AgentMobileConfigDraft[K]>) };
}

function buildPaymentPickerItems(
  entries: AgentConfigPaymentMethodEntry[] | undefined,
  relevantSelectedIds: readonly string[]
): SearchableMultiSelectItem<string>[] {
  const sel = new Set(relevantSelectedIds.map((x) => String(x)));
  return (entries ?? [])
    .filter((e) => e.active !== false || sel.has(String(e.id)))
    .map((e) => ({
      id: String(e.id),
      title: e.name,
      subtitle: e.active === false ? "Неактивен" : e.code?.trim() || null
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

function filterPaymentItemsBySearch(
  items: SearchableMultiSelectItem<string>[],
  q: string
): SearchableMultiSelectItem<string>[] {
  const t = q.trim().toLowerCase();
  if (!t) return items;
  return items.filter(
    (i) =>
      i.title.toLowerCase().includes(t) ||
      (i.subtitle != null && String(i.subtitle).toLowerCase().includes(t))
  );
}

type Props = {
  open: boolean;
  expeditor: ExpeditorConfigDialogRow | null;
  onClose: () => void;
  onSave: (agentEntitlements: ExpeditorConfigDialogRow["agent_entitlements"]) => Promise<void>;
  saving?: boolean;
  paymentMethodEntries?: AgentConfigPaymentMethodEntry[];
  tradeDirections?: Array<{ id: number; name: string; code: string | null }>;
};

export function ExpeditorConfigurationsDialog({
  open,
  expeditor,
  onClose,
  onSave,
  saving = false,
  paymentMethodEntries,
  tradeDirections = []
}: Props) {
  const [draft, setDraft] = useState<AgentMobileConfigDraft>(() => emptyMobileDraft());
  const [paySearch, setPaySearch] = useState("");
  const [tdSearch, setTdSearch] = useState("");

  useEffect(() => {
    if (!open || !expeditor) return;
    setDraft(cloneMobileFromRow(expeditor.agent_entitlements));
    setPaySearch("");
    setTdSearch("");
  }, [open, expeditor]);

  const payItemsAll = useMemo(
    () =>
      buildPaymentPickerItems(
        paymentMethodEntries,
        draft.expeditor?.allowed_payment_method_ids ?? []
      ),
    [paymentMethodEntries, draft.expeditor?.allowed_payment_method_ids]
  );
  const payItems = useMemo(() => filterPaymentItemsBySearch(payItemsAll, paySearch), [payItemsAll, paySearch]);

  const allowedPaySet = useMemo(
    () => new Set((draft.expeditor?.allowed_payment_method_ids ?? []).map(String)),
    [draft.expeditor?.allowed_payment_method_ids]
  );

  const tdItemsAll = useMemo<SearchableMultiSelectItem<number>[]>(
    () =>
      tradeDirections.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: d.code?.trim() || null
      })),
    [tradeDirections]
  );
  const tdItems = useMemo(() => {
    const t = tdSearch.trim().toLowerCase();
    if (!t) return tdItemsAll;
    return tdItemsAll.filter(
      (i) =>
        i.title.toLowerCase().includes(t) ||
        (i.subtitle != null && String(i.subtitle).toLowerCase().includes(t))
    );
  }, [tdItemsAll, tdSearch]);

  const tdSelectedSet = useMemo(
    () => new Set(draft.expeditor?.allowed_trade_direction_ids ?? []),
    [draft.expeditor?.allowed_trade_direction_ids]
  );

  if (!expeditor) return null;

  const handleReset = () => {
    setDraft(cloneMobileFromRow(expeditor.agent_entitlements));
  };

  const handleSave = async () => {
    const prev = expeditor.agent_entitlements ?? {};
    await onSave({
      ...prev,
      mobile_config: draft
    });
  };

  const strictVal =
    draft.expeditor?.delivery_payment_method_strict === true
      ? "strict"
      : draft.expeditor?.delivery_payment_method_strict === false
        ? "off"
        : "unset";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[min(92vh,880px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
          <DialogTitle className="text-base">Конфигурации</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {expeditor.fio.trim() || "Экспедитор"} — мобильное приложение
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[13px]">
          <div className="space-y-8">
            <div>
              <ConfigSectionTitle>Заказ</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                <ConfigCheckRow
                  checked={Boolean(draft.orders?.allow_partial_return_edit)}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "orders", (o) => ({ ...o, allow_partial_return_edit: v })))
                  }
                  label="Изменить частичное возмещение"
                />
                <ConfigCheckRow
                  checked={Boolean(draft.orders?.allow_reload_from_vehicle)}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "orders", (o) => ({ ...o, allow_reload_from_vehicle: v })))
                  }
                  label="Догруз с автомобиля"
                />
                <ConfigCheckRow
                  checked={Boolean(draft.orders?.allow_return_from_shelf)}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "orders", (o) => ({ ...o, allow_return_from_shelf: v })))
                  }
                  label="Создать возврат с полки по номеру заказа"
                />
              </div>
            </div>

            <div>
              <ConfigSectionTitle>Клиент</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                <ConfigCheckRow
                  checked={Boolean(draft.client?.can_change_client_location)}
                  onChange={(v) =>
                    setDraft((d) =>
                      setDraftPath(d, "client", (c) => ({ ...c, can_change_client_location: v }))
                    )
                  }
                  label="Разрешение на изменение местоположения клиента"
                />
              </div>
            </div>

            <div>
              <ConfigSectionTitle>Оплата</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                <ConfigCheckRow
                  checked={Boolean(draft.expeditor?.accept_payment_for_order)}
                  onChange={(v) =>
                    setDraft((d) =>
                      setDraftPath(d, "expeditor", (x) => ({ ...x, accept_payment_for_order: v }))
                    )
                  }
                  label="Принятие оплаты за заказ"
                />
                <ConfigCheckRow
                  checked={Boolean(draft.expeditor?.accept_payment_on_delivery)}
                  onChange={(v) =>
                    setDraft((d) =>
                      setDraftPath(d, "expeditor", (x) => ({ ...x, accept_payment_on_delivery: v }))
                    )
                  }
                  label="Принятие оплаты при доставке"
                />
                <ConfigCheckRow
                  checked={Boolean(draft.expeditor?.accept_payment_from_debtors)}
                  onChange={(v) =>
                    setDraft((d) =>
                      setDraftPath(d, "expeditor", (x) => ({ ...x, accept_payment_from_debtors: v }))
                    )
                  }
                  label="Принятие оплаты от должников"
                />
              </div>
            </div>

            <div>
              <ConfigSectionTitle>Gps</ConfigSectionTitle>
              <div className="mb-3 grid max-w-xl gap-3 sm:grid-cols-2">
                <ConfigTextField
                  label="Минимальный уровень батареи"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.gps?.min_battery_pct ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "gps", (g) => ({
                        ...g,
                        min_battery_pct: e.target.value === "" ? null : Number(e.target.value)
                      }))
                    )
                  }
                />
              </div>
              <div className="mb-3 divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                <ConfigCheckRow
                  checked={Boolean(draft.gps?.always_on)}
                  onChange={(v) => setDraft((d) => setDraftPath(d, "gps", (g) => ({ ...g, always_on: v })))}
                  label="GPS Всегда включен"
                />
                <ConfigCheckRow
                  checked={Boolean(draft.gps?.tracking_enabled)}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "gps", (g) => ({ ...g, tracking_enabled: v })))
                  }
                  label="Отслеживать"
                />
              </div>
              <div className="grid max-w-xl gap-3 sm:grid-cols-3">
                <ConfigTextField
                  label="Интервал (сек.)"
                  type="number"
                  value={draft.gps?.tracking_interval_sec ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "gps", (g) => ({
                        ...g,
                        tracking_interval_sec: e.target.value === "" ? null : Number(e.target.value)
                      }))
                    )
                  }
                />
                <ConfigTextField
                  label="Мин. смещение (м)"
                  type="number"
                  value={draft.gps?.min_distance_m ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "gps", (g) => ({
                        ...g,
                        min_distance_m: e.target.value === "" ? null : Number(e.target.value)
                      }))
                    )
                  }
                />
                <ConfigTextField
                  label="Точность данных (м)"
                  type="number"
                  value={draft.gps?.max_accuracy_m ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "gps", (g) => ({
                        ...g,
                        max_accuracy_m: e.target.value === "" ? null : Number(e.target.value)
                      }))
                    )
                  }
                />
              </div>
            </div>

            <div>
              <ConfigSectionTitle>Параметры</ConfigSectionTitle>
              <div className="space-y-4">
                <ConfigTextField
                  label="Символ валюты"
                  value={draft.expeditor?.currency_symbol ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "expeditor", (x) => ({
                        ...x,
                        currency_symbol: e.target.value.trim() || undefined
                      }))
                    )
                  }
                />
                <div className="rounded-lg border border-border/70 bg-muted/15 shadow-inner">
                  <div className="border-b border-border/60 bg-muted/25 px-3 py-2">
                    <span className="text-xs font-medium text-foreground/90">Способ оплаты</span>
                  </div>
                  <div className="p-3">
                    {payItemsAll.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Способы оплаты не найдены — задайте их в настройках финансов тенанта.
                      </p>
                    ) : (
                      <SearchableMultiSelectPanel<string>
                        label="Способ оплаты"
                        hideOuterLabel
                        selectAllLabel="Выбрать все"
                        clearVisibleLabel="Снять на экране"
                        triggerPlaceholder="Выберите способы оплаты"
                        searchPlaceholder="Поиск"
                        search={paySearch}
                        onSearchChange={setPaySearch}
                        items={payItems}
                        selected={allowedPaySet}
                        onSelectedChange={(updater) => {
                          setDraft((d) => {
                            const prev = new Set(
                              (d.expeditor?.allowed_payment_method_ids ?? []).map(String)
                            );
                            const next = typeof updater === "function" ? updater(prev) : updater;
                            return setDraftPath(d, "expeditor", (x) => ({
                              ...x,
                              allowed_payment_method_ids: Array.from(next)
                            }));
                          });
                        }}
                        emptyMessage="Нет строк по фильтру"
                        triggerClassName="h-10 border-border/80 bg-background text-left text-[13px]"
                        formatTriggerSummary={(sel) => {
                          if (sel.size === 0) return "Выберите способы оплаты";
                          return Array.from(sel)
                            .map((id) => payItemsAll.find((i) => i.id === id)?.title ?? id)
                            .join(", ");
                        }}
                        minPopoverWidth={360}
                      />
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 shadow-inner">
                  <div className="border-b border-border/60 bg-muted/25 px-3 py-2">
                    <span className="text-xs font-medium text-foreground/90">Направление торговли</span>
                  </div>
                  <div className="p-3">
                    {tdItemsAll.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Справочник направлений пуст.</p>
                    ) : (
                      <SearchableMultiSelectPanel<number>
                        label="Направление торговли"
                        hideOuterLabel
                        selectAllLabel="Выбрать все"
                        clearVisibleLabel="Снять на экране"
                        triggerPlaceholder="Выберите направления"
                        searchPlaceholder="Поиск"
                        search={tdSearch}
                        onSearchChange={setTdSearch}
                        items={tdItems}
                        selected={tdSelectedSet}
                        onSelectedChange={(updater) => {
                          setDraft((d) => {
                            const prev = new Set(d.expeditor?.allowed_trade_direction_ids ?? []);
                            const next = typeof updater === "function" ? updater(prev) : updater;
                            return setDraftPath(d, "expeditor", (x) => ({
                              ...x,
                              allowed_trade_direction_ids: Array.from(next)
                            }));
                          });
                        }}
                        emptyMessage="Нет строк по фильтру"
                        triggerClassName="h-10 border-border/80 bg-background text-left text-[13px]"
                        formatTriggerSummary={(sel) => {
                          if (sel.size === 0) return "Выберите направления";
                          return Array.from(sel)
                            .map((id) => tdItemsAll.find((i) => i.id === id)?.title ?? String(id))
                            .join(", ");
                        }}
                        minPopoverWidth={360}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[13px] font-medium text-foreground">
                    Оплата обязательно по способу оплаты при доставке
                  </span>
                  <Select
                    value={strictVal}
                    onValueChange={(v) =>
                      setDraft((d) =>
                        setDraftPath(d, "expeditor", (x) => ({
                          ...x,
                          delivery_payment_method_strict:
                            v === "strict" ? true : v === "off" ? false : undefined
                        }))
                      )
                    }
                  >
                    <SelectTrigger className="h-9 max-w-md">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Не задано</SelectItem>
                      <SelectItem value="off">Нет</SelectItem>
                      <SelectItem value="strict">Да (только из списка выше)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <ConfigSectionTitle>Отгрузочные накладные</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                <ConfigCheckRow
                  checked={Boolean(draft.expeditor?.fingerprint_required_for_shipment_confirm)}
                  onChange={(v) =>
                    setDraft((d) =>
                      setDraftPath(d, "expeditor", (x) => ({
                        ...x,
                        fingerprint_required_for_shipment_confirm: v
                      }))
                    )
                  }
                  label="Отпечаток пальца обязательно при подтверждении накладной"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-border/70 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            title="Сбросить к сохранённым"
            onClick={handleReset}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button"
            className="bg-teal-700 text-white hover:bg-teal-800"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

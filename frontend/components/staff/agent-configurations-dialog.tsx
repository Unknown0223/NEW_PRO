"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SearchableMultiSelectPanel, type SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import {
  BONUS_FILL_MODE_OPTIONS,
  CONSIGNMENT_PAYMENT_DUE_OPTIONS
} from "@/components/staff/agent-mobile-config-order-options";
import {
  CLIENT_FIELD_META,
  cloneMobileFromRow,
  emptyMobileDraft,
  type AgentMobileConfigDraft
} from "@/components/staff/agent-mobile-config-types";

export type AgentConfigDialogRow = {
  id: number;
  fio: string;
  code: string | null;
  login: string;
  agent_entitlements: Record<string, unknown> & {
    price_types?: string[];
    product_rules?: unknown;
    mobile_config?: unknown;
  };
};

/** `GET .../settings/profile` → `references.payment_method_entries` */
export type AgentConfigPaymentMethodEntry = {
  id: string;
  name: string;
  code?: string | null;
  active?: boolean;
};

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

/** Chap panel — reference «Конфигурации» tartibi */
const CONFIG_TABS = [
  { id: "client", label: "Клиент" },
  { id: "gps", label: "Gps" },
  { id: "outlet", label: "Outlet (План)" },
  { id: "product_list", label: "Настройки список продуктов" },
  { id: "photo", label: "Фото" },
  { id: "misc", label: "Прочие настройки" },
  { id: "sync", label: "Синхронизация" },
  { id: "orders", label: "Добавления заказа" },
  { id: "supervision", label: "Аудит" },
  { id: "van_selling", label: "ВанСеллинг" }
] as const;

type TabId = (typeof CONFIG_TABS)[number]["id"];

const SUPERVISOR_TAB_IDS = new Set<TabId>(["client", "gps", "misc"]);

export type AgentConfigurationsVariant = "agent" | "supervisor";

function ConfigSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
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
        className={cn(
          "h-9 max-w-md border-border/80 bg-background text-[13px] shadow-sm",
          className
        )}
        {...inputProps}
      />
    </div>
  );
}

function ConfigFieldGroupBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 shadow-inner">
      <div className="border-b border-border/60 bg-muted/25 px-3 py-2">
        <span className="text-xs font-medium text-foreground/90">{title}</span>
      </div>
      <div className="space-y-0.5 p-2">{children}</div>
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

type Props = {
  open: boolean;
  agent: AgentConfigDialogRow | null;
  onClose: () => void;
  onSave: (agentEntitlements: AgentConfigDialogRow["agent_entitlements"]) => Promise<void>;
  saving?: boolean;
  /** Ro‘yxat bo‘lmasa, to‘lov tanlovlari bo‘sh + qisqa izoh */
  paymentMethodEntries?: AgentConfigPaymentMethodEntry[];
  /** Супервайзер: только «Клиент», «Gps», «Прочие настройки» */
  variant?: AgentConfigurationsVariant;
};

export function AgentConfigurationsDialog({
  open,
  agent,
  onClose,
  onSave,
  saving = false,
  paymentMethodEntries,
  variant = "agent"
}: Props) {
  const isSupervisorUi = variant === "supervisor";
  const [tab, setTab] = useState<TabId>("client");
  const [draft, setDraft] = useState<AgentMobileConfigDraft>(() => emptyMobileDraft());
  const [miscPaySearch, setMiscPaySearch] = useState("");
  const [vanPaySearch, setVanPaySearch] = useState("");

  const visibleTabs = useMemo(
    () => (variant === "supervisor" ? CONFIG_TABS.filter((t) => SUPERVISOR_TAB_IDS.has(t.id)) : [...CONFIG_TABS]),
    [variant]
  );

  useEffect(() => {
    if (!open || !agent) return;
    setDraft(cloneMobileFromRow(agent.agent_entitlements));
    setTab("client");
    setMiscPaySearch("");
    setVanPaySearch("");
  }, [open, agent]);

  useEffect(() => {
    if (!open || variant !== "supervisor") return;
    if (!SUPERVISOR_TAB_IDS.has(tab)) setTab("client");
  }, [open, variant, tab]);

  const miscPaymentItemsAll = useMemo(
    () =>
      buildPaymentPickerItems(
        paymentMethodEntries,
        draft.misc?.disallowed_payment_method_codes ?? []
      ),
    [paymentMethodEntries, draft.misc?.disallowed_payment_method_codes]
  );
  const miscPaymentItems = useMemo(
    () => filterPaymentItemsBySearch(miscPaymentItemsAll, miscPaySearch),
    [miscPaymentItemsAll, miscPaySearch]
  );

  const vanPaymentItemsAll = useMemo(
    () =>
      buildPaymentPickerItems(
        paymentMethodEntries,
        draft.van_selling?.payment_acceptance_method_ids ?? []
      ),
    [paymentMethodEntries, draft.van_selling?.payment_acceptance_method_ids]
  );
  const vanPaymentItems = useMemo(
    () => filterPaymentItemsBySearch(vanPaymentItemsAll, vanPaySearch),
    [vanPaymentItemsAll, vanPaySearch]
  );

  const disallowedPaySet = useMemo(
    () => new Set((draft.misc?.disallowed_payment_method_codes ?? []).map(String)),
    [draft.misc?.disallowed_payment_method_codes]
  );
  const vanAcceptPaySet = useMemo(
    () => new Set((draft.van_selling?.payment_acceptance_method_ids ?? []).map(String)),
    [draft.van_selling?.payment_acceptance_method_ids]
  );

  if (!agent) return null;

  const agentDisplayName = agent.fio?.trim() || "Без имени";

  const handleReset = () => {
    setDraft(cloneMobileFromRow(agent.agent_entitlements));
  };

  const handleSave = async () => {
    const prev = agent.agent_entitlements ?? {};
    await onSave({
      ...prev,
      mobile_config: draft
    });
    onClose();
  };

  const panel = (() => {
    const hideAgentOnlyMisc = isSupervisorUi;
    switch (tab) {
      case "client":
        return (
          <div className="space-y-6 text-[13px]">
            <div>
              <ConfigSectionTitle>Права и отображение</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                {(
                  [
                    ["can_edit", "Редактировать клиента"],
                    ["can_create", "Создать клиента"],
                    ["require_new_client_approval", "Подтверждение нового клиента"],
                    ["show_balance", "Показать баланс клиента"],
                    ["show_photos", "Показать фото клиента"]
                  ] as const
                ).map(([k, label]) => (
                  <ConfigCheckRow
                    key={k}
                    checked={Boolean(draft.client?.[k])}
                    onChange={(v) =>
                      setDraft((d) => setDraftPath(d, "client", (c) => ({ ...c, [k]: v })))
                    }
                    label={label}
                  />
                ))}
              </div>
            </div>
            <ConfigTextField
              label="Префикс номера телефона клиента"
              value={draft.client?.phone_prefix ?? ""}
              onChange={(e) =>
                setDraft((d) => setDraftPath(d, "client", (c) => ({ ...c, phone_prefix: e.target.value })))
              }
            />
            <div>
              <ConfigSectionTitle>Видимость полей</ConfigSectionTitle>
              <ConfigFieldGroupBox title="Показать в форме клиента">
                {CLIENT_FIELD_META.map(({ key, label }) => (
                  <ConfigCheckRow
                    key={`v-${key}`}
                    checked={Boolean(draft.client?.fields_visible?.[key])}
                    onChange={(v) =>
                      setDraft((d) =>
                        setDraftPath(d, "client", (c) => ({
                          ...c,
                          fields_visible: { ...c.fields_visible, [key]: v }
                        }))
                      )
                    }
                    label={label}
                  />
                ))}
              </ConfigFieldGroupBox>
            </div>
            <div>
              <ConfigSectionTitle>Обязательность</ConfigSectionTitle>
              <ConfigFieldGroupBox title="Обязательные поля при сохранении">
                {CLIENT_FIELD_META.map(({ key, label }) => (
                  <ConfigCheckRow
                    key={`r-${key}`}
                    checked={Boolean(draft.client?.fields_required?.[key])}
                    onChange={(v) =>
                      setDraft((d) =>
                        setDraftPath(d, "client", (c) => ({
                          ...c,
                          fields_required: { ...c.fields_required, [key]: v }
                        }))
                      )
                    }
                    label={`Обязательно: ${label}`}
                  />
                ))}
              </ConfigFieldGroupBox>
            </div>
          </div>
        );
      case "gps":
        return (
          <div className="space-y-6 text-[13px]">
            <ConfigTextField
              label="Минимальный уровень батареи"
              hint="Процент заряда (0–100)"
              type="number"
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
            <div>
              <ConfigSectionTitle>Режим GPS и сеть</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                {(
                  [
                    ["always_on", "GPS Всегда включен"],
                    ["required_for_order", "Требуется при размещении заказа"],
                    ["internet_required_for_order", "Интернет требуется при размещении заказа"],
                    ["internet_always_on", "Интернет всегда включен"],
                    ["tracking_enabled", "Отслеживать"]
                  ] as const
                ).map(([k, label]) => (
                  <ConfigCheckRow
                    key={k}
                    checked={Boolean(draft.gps?.[k])}
                    onChange={(v) => setDraft((d) => setDraftPath(d, "gps", (g) => ({ ...g, [k]: v })))}
                    label={label}
                  />
                ))}
              </div>
            </div>
            <div className="grid max-w-xl gap-4 sm:grid-cols-3">
              <ConfigTextField
                label="Интервальные секунды"
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
                label="Мин. расстояние (м)"
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
                label="Точность (м)"
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
        );
      case "outlet":
        return (
          <div className="space-y-6 text-[13px]">
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              <ConfigCheckRow
                checked={Boolean(draft.outlet?.show_plan_in_reports)}
                onChange={(v) =>
                  setDraft((d) => setDraftPath(d, "outlet", (o) => ({ ...o, show_plan_in_reports: v })))
                }
                label="Показывать план агенту в отчётах"
              />
            </div>
            <ConfigTextField
              label="Версия Outlet"
              value={draft.outlet?.plan_version ?? ""}
              onChange={(e) =>
                setDraft((d) => setDraftPath(d, "outlet", (o) => ({ ...o, plan_version: e.target.value })))
              }
            />
          </div>
        );
      case "product_list":
        return (
          <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40 text-[13px]">
            <ConfigCheckRow
              checked={Boolean(draft.product_list?.show_out_of_stock)}
              onChange={(v) =>
                setDraft((d) => setDraftPath(d, "product_list", (p) => ({ ...p, show_out_of_stock: v })))
              }
              label="Показать предметы не в наличии"
            />
            <ConfigCheckRow
              checked={Boolean(draft.product_list?.allow_submit_for_new_client)}
              onChange={(v) =>
                setDraft((d) =>
                  setDraftPath(d, "product_list", (p) => ({ ...p, allow_submit_for_new_client: v }))
                )
              }
              label="Разрешение на отправку для нового клиента"
            />
          </div>
        );
      case "photo":
        return (
          <div className="space-y-5 text-[13px]">
            <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
              <ConfigTextField
                label="Макс. ширина (px)"
                type="number"
                value={draft.photo?.max_width_px ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    setDraftPath(d, "photo", (p) => ({
                      ...p,
                      max_width_px: e.target.value === "" ? null : Number(e.target.value)
                    }))
                  )
                }
              />
              <ConfigTextField
                label="Макс. высота (px)"
                type="number"
                value={draft.photo?.max_height_px ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    setDraftPath(d, "photo", (p) => ({
                      ...p,
                      max_height_px: e.target.value === "" ? null : Number(e.target.value)
                    }))
                  )
                }
              />
              <ConfigTextField
                label="Сжатие JPEG (1–100)"
                type="number"
                value={draft.photo?.jpeg_quality ?? ""}
                onChange={(e) =>
                  setDraft((d) =>
                    setDraftPath(d, "photo", (p) => ({
                      ...p,
                      jpeg_quality: e.target.value === "" ? null : Number(e.target.value)
                    }))
                  )
                }
              />
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              <ConfigCheckRow
                checked={Boolean(draft.photo?.required_for_order)}
                onChange={(v) =>
                  setDraft((d) => setDraftPath(d, "photo", (p) => ({ ...p, required_for_order: v })))
                }
                label="Обязательная фото-фиксация для добавления заказа"
              />
            </div>
          </div>
        );
      case "misc":
        return (
          <div className="space-y-6 text-[13px]">
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              <ConfigCheckRow
                checked={Boolean(draft.misc?.visit_start_end_enabled)}
                onChange={(v) =>
                  setDraft((d) => setDraftPath(d, "misc", (m) => ({ ...m, visit_start_end_enabled: v })))
                }
                label="Включить функцию «Начало/Завершение визита»"
              />
              <ConfigCheckRow
                checked={draft.misc?.require_within_outlet_radius_m === 250}
                onChange={(v) =>
                  setDraft((d) =>
                    setDraftPath(d, "misc", (m) => ({
                      ...m,
                      require_within_outlet_radius_m: v ? 250 : null
                    }))
                  )
                }
                label="Обязательное нахождение на территории торговой точки в радиусе 250 метров"
              />
              {!hideAgentOnlyMisc ? (
                <>
                  <ConfigCheckRow
                    checked={Boolean(draft.misc?.require_stock_snapshot_for_order)}
                    onChange={(v) =>
                      setDraft((d) =>
                        setDraftPath(d, "misc", (m) => ({ ...m, require_stock_snapshot_for_order: v }))
                      )
                    }
                    label="Обязательное добавление остатка для добавления заказа"
                  />
                  <ConfigCheckRow
                    checked={Boolean(draft.misc?.require_shipment_date)}
                    onChange={(v) =>
                      setDraft((d) => setDraftPath(d, "misc", (m) => ({ ...m, require_shipment_date: v })))
                    }
                    label="Обязательное выставление даты отгрузки"
                  />
                  <ConfigCheckRow
                    checked={Boolean(draft.misc?.allow_exchange_request)}
                    onChange={(v) =>
                      setDraft((d) => setDraftPath(d, "misc", (m) => ({ ...m, allow_exchange_request: v })))
                    }
                    label="Разрешить создание заявки на обмен"
                  />
                </>
              ) : null}
            </div>
            <div>
              <ConfigSectionTitle>QR-коды</ConfigSectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                {(
                  [
                    ["qr_attach_visit_page", "Прикрепить QR-код на странице визиты"],
                    ["qr_change_visit_page", "Изменить QR-код на странице визиты"],
                    ["qr_attach_client_page", "Прикрепить QR-код на странице клиент"],
                    ["qr_change_client_page", "Изменить QR-код на странице клиент"]
                  ] as const
                ).map(([k, label]) => (
                  <ConfigCheckRow
                    key={k}
                    checked={Boolean(draft.misc?.[k])}
                    onChange={(v) =>
                      setDraft((d) => setDraftPath(d, "misc", (m) => ({ ...m, [k]: v })))
                    }
                    label={label}
                  />
                ))}
              </div>
            </div>
            {!hideAgentOnlyMisc ? (
              <div className="rounded-lg border border-border/70 bg-muted/15 shadow-inner">
                <div className="border-b border-border/60 bg-muted/25 px-3 py-2">
                  <span className="text-xs font-medium leading-snug text-foreground/90">
                    Не разрешённые способы оплаты заказа с консигнациями
                  </span>
                </div>
                <div className="p-3">
                  {miscPaymentItemsAll.length === 0 ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Способы оплаты не найдены. Добавьте их в разделе настроек финансов (справочник способов оплаты).
                    </p>
                  ) : (
                    <SearchableMultiSelectPanel<string>
                      label="Не разрешённые способы оплаты"
                      hideOuterLabel
                      selectAllLabel="Выбрать все"
                      clearVisibleLabel="Снять на экране"
                      triggerPlaceholder="Выберите способы оплаты"
                      searchPlaceholder="Поиск"
                      search={miscPaySearch}
                      onSearchChange={setMiscPaySearch}
                      items={miscPaymentItems}
                      selected={disallowedPaySet}
                      onSelectedChange={(updater) => {
                        setDraft((d) => {
                          const prev = new Set(
                            (d.misc?.disallowed_payment_method_codes ?? []).map(String)
                          );
                          const next =
                            typeof updater === "function" ? updater(prev) : updater;
                          return setDraftPath(d, "misc", (m) => ({
                            ...m,
                            disallowed_payment_method_codes: Array.from(next)
                          }));
                        });
                      }}
                      emptyMessage="Нет строк по фильтру"
                      triggerClassName="h-10 border-border/80 bg-background text-left text-[13px]"
                      formatTriggerSummary={(sel) => {
                        if (sel.size === 0) return "Выберите способы оплаты";
                        return Array.from(sel)
                          .map((id) => miscPaymentItemsAll.find((i) => i.id === id)?.title ?? id)
                          .join(", ");
                      }}
                      minPopoverWidth={360}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      case "sync":
        return (
          <div className="space-y-6 text-[13px]">
            <ConfigTextField
              label="Обязательная синхронизация"
              hint="Число (например, минимум синхронизаций за период)"
              type="number"
              value={draft.sync?.mandatory_sync_count ?? ""}
              onChange={(e) =>
                setDraft((d) =>
                  setDraftPath(d, "sync", (s) => ({
                    ...s,
                    mandatory_sync_count: e.target.value === "" ? null : Number(e.target.value)
                  }))
                )
              }
            />
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              <ConfigCheckRow
                checked={Boolean(draft.sync?.block_sync)}
                onChange={(v) => setDraft((d) => setDraftPath(d, "sync", (s) => ({ ...s, block_sync: v })))}
                label="Не допускайте синхронизацию"
              />
            </div>
            <div>
              <ConfigSectionTitle>Окно синхронизации</ConfigSectionTitle>
              <div className="flex flex-wrap items-end gap-4">
                <ConfigTextField
                  label="С"
                  placeholder="08:00"
                  className="w-32"
                  value={draft.sync?.allowed_window_from ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "sync", (s) => ({ ...s, allowed_window_from: e.target.value }))
                    )
                  }
                />
                <ConfigTextField
                  label="По"
                  placeholder="17:30"
                  className="w-32"
                  value={draft.sync?.allowed_window_to ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      setDraftPath(d, "sync", (s) => ({ ...s, allowed_window_to: e.target.value }))
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      case "orders": {
        const ruleRaw = (draft.orders?.consignment_payment_due_rule ?? "").trim();
        const bonusRaw = (draft.orders?.bonus_fill_mode ?? "").trim();
        const ruleKnown = CONSIGNMENT_PAYMENT_DUE_OPTIONS.some((o) => o.value === ruleRaw);
        const bonusKnown = BONUS_FILL_MODE_OPTIONS.some((o) => o.value === bonusRaw);
        const ruleSelectValue = !ruleRaw ? "__none__" : ruleKnown ? ruleRaw : "__legacy_rule__";
        const bonusSelectValue = !bonusRaw ? "__none__" : bonusKnown ? bonusRaw : "__legacy_bonus__";

        return (
          <div className="space-y-5 text-[13px]">
            <div className="space-y-1.5">
              <span className="text-[13px] font-medium text-foreground">
                Срок оплаты для заказа с консигнациями
              </span>
              <Select
                value={ruleSelectValue}
                onValueChange={(v) =>
                  setDraft((d) =>
                    setDraftPath(d, "orders", (o) => ({
                      ...o,
                      consignment_payment_due_rule:
                        v === "__none__" ? undefined : v === "__legacy_rule__" ? o.consignment_payment_due_rule : v
                    }))
                  )
                }
              >
                <SelectTrigger className="h-10 max-w-md border-border/80 bg-background text-[13px] shadow-sm">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— не задано —</SelectItem>
                  {CONSIGNMENT_PAYMENT_DUE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  {!ruleKnown && ruleRaw ? (
                    <SelectItem value="__legacy_rule__">
                      (текущее значение) {ruleRaw}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-medium text-foreground">
                Тип заполнения бонусных товаров заказа
              </span>
              <Select
                value={bonusSelectValue}
                onValueChange={(v) =>
                  setDraft((d) =>
                    setDraftPath(d, "orders", (o) => ({
                      ...o,
                      bonus_fill_mode:
                        v === "__none__" ? undefined : v === "__legacy_bonus__" ? o.bonus_fill_mode : v
                    }))
                  )
                }
              >
                <SelectTrigger className="h-10 max-w-md border-border/80 bg-background text-[13px] shadow-sm">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— не задано —</SelectItem>
                  {BONUS_FILL_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  {!bonusKnown && bonusRaw ? (
                    <SelectItem value="__legacy_bonus__">
                      (текущее значение) {bonusRaw}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              <ConfigCheckRow
                checked={Boolean(draft.orders?.allow_return_from_shelf)}
                onChange={(v) =>
                  setDraft((d) => setDraftPath(d, "orders", (o) => ({ ...o, allow_return_from_shelf: v })))
                }
                label="Создать возврат с полки"
              />
            </div>
          </div>
        );
      }
      case "supervision":
        return (
          <div className="space-y-3 text-[13px]">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Проверять при мобильном аудите (не путать с журналом изменений веб-панели).
            </p>
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              {(
                [
                  ["check_receipt_faces", "Лица чека"],
                  ["check_merchandising", "Мерчендайзинг"],
                  ["check_default_price", "Цена по умолчанию"],
                  ["check_motivation", "Мотивация"],
                  ["check_stock", "Запас"],
                  ["check_sales", "Продажи"]
                ] as const
              ).map(([k, label]) => (
                <ConfigCheckRow
                  key={k}
                  checked={Boolean(draft.supervision?.[k])}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "supervision", (s) => ({ ...s, [k]: v })))
                  }
                  label={label}
                />
              ))}
            </div>
          </div>
        );
      case "van_selling":
        return (
          <div className="space-y-6 text-[13px]">
            <div>
              <span className="mb-2 block text-[13px] font-medium text-foreground">
                Методы принятия платежей
              </span>
              {vanPaymentItemsAll.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Способы оплаты не найдены. Добавьте их в настройках финансов.
                </p>
              ) : (
                <SearchableMultiSelectPanel<string>
                  label="Методы принятия платежей"
                  hideOuterLabel
                  selectAllLabel="Выбрать все"
                  clearVisibleLabel="Снять на экране"
                  triggerPlaceholder="Выберите способы оплаты"
                  searchPlaceholder="Поиск"
                  search={vanPaySearch}
                  onSearchChange={setVanPaySearch}
                  items={vanPaymentItems}
                  selected={vanAcceptPaySet}
                  onSelectedChange={(updater) => {
                    setDraft((d) => {
                      const prev = new Set(
                        (d.van_selling?.payment_acceptance_method_ids ?? []).map(String)
                      );
                      const next = typeof updater === "function" ? updater(prev) : updater;
                      return setDraftPath(d, "van_selling", (v) => ({
                        ...v,
                        payment_acceptance_method_ids: Array.from(next)
                      }));
                    });
                  }}
                  emptyMessage="Нет строк по фильтру"
                  triggerClassName="h-10 border-border/80 bg-background text-left text-[13px]"
                  formatTriggerSummary={(sel) => {
                    if (sel.size === 0) return "Выберите методы принятия платежей";
                    return Array.from(sel)
                      .map((id) => vanPaymentItemsAll.find((i) => i.id === id)?.title ?? id)
                      .join(", ");
                  }}
                  minPopoverWidth={360}
                />
              )}
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
              {(
                [
                  ["payment_required", "Оплата требуется"],
                  ["allow_order_while_moving", "Разрешить создавать заказы движущихся"],
                  ["allow_change_movement_status", "Разрешить изменять статус движения приложения"]
                ] as const
              ).map(([k, label]) => (
                <ConfigCheckRow
                  key={k}
                  checked={Boolean(draft.van_selling?.[k])}
                  onChange={(v) =>
                    setDraft((d) => setDraftPath(d, "van_selling", (x) => ({ ...x, [k]: v })))
                  }
                  label={label}
                />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 bg-muted/10 px-6 py-3.5 pr-12 sm:px-8">
          <DialogTitle className="font-sans text-[15px] font-normal leading-snug tracking-tight text-foreground/85 sm:text-base">
            {variant === "supervisor" ? `Конфигурации: ${agentDisplayName}` : agentDisplayName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {variant === "supervisor"
              ? "Настройки конфигурации мобильного приложения для супервайзера"
              : "Настройки конфигурации мобильного приложения для агента"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 max-h-[min(65vh,640px)] gap-0">
          <nav className="w-[13.5rem] shrink-0 overflow-y-auto border-r border-border/70 bg-slate-100/90 p-2 dark:bg-muted/40">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "mb-0.5 w-full rounded-md px-2.5 py-2 text-left text-[12px] font-medium leading-snug transition-colors",
                  tab === t.id
                    ? "bg-teal-600 text-white shadow-sm dark:bg-teal-600"
                    : "text-foreground/90 hover:bg-white/70 dark:hover:bg-muted/60"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-4 sm:px-8">{panel}</div>
        </div>
        <DialogFooter className="mx-0 mb-0 flex flex-row flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/10 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-red-500/70 text-red-600 hover:bg-red-50 dark:border-red-400/60 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={handleReset}
            disabled={saving}
          >
            Сбросить настройки
          </Button>
          <Button
            type="button"
            className="shrink-0 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

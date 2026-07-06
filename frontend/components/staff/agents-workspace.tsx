"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { messageFromAgentsBulkError } from "@/lib/agents-bulk-errors";
import { STALE } from "@/lib/query-stale";
import { MonitorSmartphone, Pencil, Settings2, UserMinus } from "lucide-react";
import { AgentFormModal } from "@/components/staff/agent-form-modal";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { AgentRestrictionsDialog } from "@/components/staff/agent-restrictions-dialog";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import { AgentsBulkEditDialog } from "@/components/staff/agents-bulk-edit-dialog";
import { AgentsFiltersRow } from "@/components/staff/agents-filters-row";
import { formatPersonDisplayName } from "@/lib/person-display";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { activeBranchNamesFromProfile } from "@/lib/branch-options";
import { AgentConfigurationsDialog } from "@/components/staff/agent-configurations-dialog";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import {
  StaffKomandaActiveSessionsCell,
  StaffKomandaApkCell,
  StaffKomandaAppAccessToggle,
  StaffKomandaBranchCell,
  StaffKomandaCodeCell,
  StaffKomandaCreatedAtCell,
  StaffKomandaDeviceCell,
  StaffKomandaFioCell,
  StaffKomandaLastSyncCell,
  StaffKomandaLoginCell,
  StaffKomandaMaxSessionsCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaPositionCell,
  StaffKomandaTagList,
  StaffKomandaTerritoryCell,
  StaffKomandaTradeDirectionCell,
  StaffKomandaWarehouseCell,
  StaffKomandaYesNoCell
} from "@/components/staff/staff-komanda-table-cells";

export type AgentRow = {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  product: string | null;
  agent_type: string | null;
  code: string | null;
  pinfl: string | null;
  consignment: boolean;
  consignment_close_day?: number;
  consignment_close_hour?: number;
  consignment_close_minute?: number;
  consignment_limit_amount?: string | null;
  consignment_ignore_previous_months_debt?: boolean;
  consignment_updated_at?: string | null;
  apk_version: string | null;
  device_name: string | null;
  last_sync_at: string | null;
  phone: string | null;
  email: string | null;
  can_authorize: boolean;
  price_type: string | null;
  price_types: string[];
  warehouse: string | null;
  trade_direction_id: number | null;
  trade_direction: string | null;
  branch: string | null;
  position: string | null;
  created_at: string;
  app_access: boolean;
  territory: string | null;
  login: string;
  is_active: boolean;
  max_sessions: number;
  active_session_count: number;
  kpi_color: string | null;
  agent_entitlements: {
    price_types?: string[];
    product_rules?: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
    mobile_config?: unknown;
  };
  work_slot_id?: number | null;
  work_slot_code?: string | null;
};

type ProductCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  is_active: boolean;
};

type TenantProfile = {
  references: {
    branches?: Array<{ id: string; name: string; active?: boolean }>;
    trade_directions?: string[];
    payment_method_entries?: Array<{
      id: string;
      name: string;
      code?: string | null;
      active?: boolean;
    }>;
  };
};

const COLS = [
  "Ф.И.О",
  "Авторизоваться",
  "Телефон",
  "Код",
  "Продукт",
  "Тип агента",
  "Склад",
  "Версия APK",
  "ПИНФЛ",
  "Территория",
  "Название устройства",
  "Последняя синхронизация",
  "Тип цены",
  "Направление торговли",
  "Филиал",
  "Должность",
  "Консигнация",
  "Дата создания",
  "Доступ к приложение",
  "Количество активных сессий",
  "Максимальное количество сессий"
] as const;

const AGENT_TABLE_ID = "staff.agents.v2";
const AGENT_COLUMN_IDS = [
  "fio",
  "login",
  "phone",
  "code",
  "product",
  "agent_type",
  "warehouse",
  "apk_version",
  "pinfl",
  "territory",
  "device_name",
  "last_sync",
  "price_types",
  "trade_direction",
  "branch",
  "position",
  "consignment",
  "created_at",
  "app_access",
  "active_sessions",
  "max_sessions"
] as const;

const AGENT_COLUMNS = AGENT_COLUMN_IDS.map((id, i) => ({
  id,
  label: COLS[i] ?? id
}));
const AGENT_COLUMN_LABEL_BY_ID = new Map<string, string>(AGENT_COLUMNS.map((c) => [c.id, c.label]));

function agentExportCellString(r: AgentRow, colId: string): string {
  switch (colId) {
    case "fio":
      return formatPersonDisplayName(r);
    case "product":
      return r.product ?? "";
    case "agent_type":
      return r.agent_type ?? "";
    case "code":
      return r.code ?? "";
    case "pinfl":
      return r.pinfl ?? "";
    case "territory":
      return r.territory ?? "";
    case "consignment":
      return r.consignment ? "Да" : "Нет";
    case "apk_version":
      return r.apk_version ?? "";
    case "device_name":
      return r.device_name ?? "";
    case "last_sync":
      return r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("ru-RU") : "";
    case "phone":
      return r.phone ?? "";
    case "login":
      return r.login;
    case "price_types":
      return (r.price_types?.length ? r.price_types : r.price_type ? [r.price_type] : []).join(", ");
    case "warehouse":
      return r.warehouse ?? "";
    case "trade_direction":
      return r.trade_direction ?? "";
    case "branch":
      return r.branch ?? "";
    case "position":
      return r.position ?? "";
    case "created_at":
      return new Date(r.created_at).toLocaleDateString("ru-RU");
    case "app_access":
      return r.app_access ? "Да" : "Нет";
    case "active_sessions":
      return String(r.active_session_count);
    case "max_sessions":
      return String(r.max_sessions);
    default:
      return "";
  }
}

type Props = { tenantSlug: string };

function buildAgentSearchHaystack(r: AgentRow): string {
  return [
    r.fio,
    r.login,
    r.phone ?? "",
    r.code ?? "",
    r.pinfl ?? "",
    r.device_name ?? "",
    r.apk_version ?? "",
    r.branch ?? "",
    r.warehouse ?? "",
    r.agent_type ?? "",
    ...(r.price_types ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

export function AgentsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftTd, setDraftTd] = useState("");
  const [draftPos, setDraftPos] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [appliedTd, setAppliedTd] = useState("");
  const [appliedPos, setAppliedPos] = useState("");
  const [search, setSearch] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: AGENT_TABLE_ID,
    defaultColumnOrder: [...AGENT_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<AgentRow | null>(null);
  const [sessionAgent, setSessionAgent] = useState<AgentRow | null>(null);
  const [restrictAgent, setRestrictAgent] = useState<AgentRow | null>(null);
  const [configAgent, setConfigAgent] = useState<AgentRow | null>(null);
  const [deactivateAgent, setDeactivateAgent] = useState<AgentRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<"activate" | "deactivate" | "clear-sessions" | null>(
    null
  );
  const [groupDialog, setGroupDialog] = useState<null | "restrict">(null);

  const filterOptQ = useQuery({
    queryKey: ["agents-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          branches: string[];
          trade_directions: string[];
          positions: string[];
          territories?: string[];
          territory_tokens?: string[];
        };
      }>(`/api/${tenantSlug}/agents/filter-options`);
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "agents-workspace"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const branchOptions = useMemo(
    () => activeBranchNamesFromProfile(profileQ.data?.references.branches),
    [profileQ.data]
  );

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "agents-workspace");
  const tradeDirectionFilterOptions = tradeDirectionsCatalog.labels;
  const tradeDirectionRows = tradeDirectionsCatalog.rows;

  const tradeDirectionsWithIdQ = useQuery({
    queryKey: ["trade-directions", tenantSlug, "agents-ws"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; name: string; code: string | null; is_active: boolean }>;
      }>(`/api/${tenantSlug}/trade-directions?is_active=true`);
      return data.data;
    }
  });
  const tradeDirectionsWithId = tradeDirectionsWithIdQ.data ?? [];

  const listQ = useQuery({
    queryKey: ["agent", tenantSlug, tab, appliedBranch, appliedTd, appliedPos],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedBranch.trim()) params.set("branch", appliedBranch.trim());
      if (appliedTd.trim()) params.set("trade_direction", appliedTd.trim());
      if (appliedPos.trim()) params.set("position", appliedPos.trim());
      const { data } = await api.get<{ data: AgentRow[] }>(
        `/api/${tenantSlug}/agents?${params.toString()}`
      );
      return data.data;
    }
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "agents-ws"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      return data.data;
    }
  });

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, "agents-ws"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types?kind=sale`);
      return data.data;
    }
  });

  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "agents-ws"],
    enabled: Boolean(tenantSlug) && (Boolean(restrictAgent) || groupDialog === "restrict"),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductCategoryRow[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data.filter((c) => c.is_active);
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<AgentRow>(`/api/${tenantSlug}/agents/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<AgentRow>(`/api/${tenantSlug}/agents`, body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      setAddOpen(false);
    }
  });

  const bulkMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<{ data: { updated: number } }>(`/api/${tenantSlug}/agents/bulk`, body);
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      setGroupDialog(null);
      setSelectedIds(new Set());
    },
    onError: (e: unknown) => {
      window.alert(messageFromAgentsBulkError(e));
    }
  });

  const bulkEditMut = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await api.patch(`/api/${tenantSlug}/agents/${id}`, fields);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      setBulkEditOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: unknown) => {
      window.alert(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  });

  const bulkActiveMut = useMutation({
    mutationFn: async (is_active: boolean) => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await api.patch(`/api/${tenantSlug}/agents/${id}`, { is_active });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      setConfirmBulk(null);
      setSelectedIds(new Set());
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/agents/${id}`, { is_active: false });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      setDeactivateAgent(null);
    }
  });

  const filteredRows = useMemo(() => {
    const src = listQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return src;
    return src.filter((r) => buildAgentSearchHaystack(r).includes(q));
  }, [listQ.data, search]);

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [tab, appliedBranch, appliedTd, appliedPos, search, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, appliedBranch, appliedTd, appliedPos, safePage, pageSize]);

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(r.id)),
    [filteredRows, selectedIds]
  );

  const allAccessOn = useMemo(() => {
    if (selectedRows.length === 0) return false;
    return selectedRows.every((a) => a.app_access);
  }, [selectedRows]);

  const bulkBusy = bulkMut.isPending || bulkEditMut.isPending || bulkActiveMut.isPending;

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));

  const toggleAgentSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllAgentsOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const r of pageRows) next.add(r.id);
      } else {
        for (const r of pageRows) next.delete(r.id);
      }
      return next;
    });
  };

  const applyFilters = () => {
    setAppliedBranch(draftBranch);
    setAppliedTd(draftTd);
    setAppliedPos(draftPos);
  };

  const resetFilters = () => {
    setDraftBranch("");
    setDraftTd("");
    setDraftPos("");
    setAppliedBranch("");
    setAppliedTd("");
    setAppliedPos("");
    setPage(1);
  };

  function formatProductCell(product: string | null): string {
    if (!product?.trim()) return "—";
    const t = product.trim();
    if (/^\d+$/.test(t)) return `${t} шт.`;
    if (t.includes("шт")) return t;
    return t;
  }

  function renderAgentDataCell(colId: string, r: AgentRow) {
    const priceList = r.price_types?.length ? r.price_types : r.price_type ? [r.price_type] : [];
    switch (colId) {
      case "fio":
        return (
          <StaffKomandaFioCell
            first_name={r.first_name}
            last_name={r.last_name}
            middle_name={r.middle_name}
            fio={r.fio}
            kpiColor={r.kpi_color}
          />
        );
      case "login":
        return <StaffKomandaLoginCell login={r.login} />;
      case "phone":
        return <StaffKomandaPhoneCell phone={r.phone} />;
      case "code":
        return <StaffKomandaCodeCell code={r.code} />;
      case "product":
        return (
          <span className="whitespace-nowrap text-slate-700">{formatProductCell(r.product)}</span>
        );
      case "agent_type":
        return <span className="text-slate-600">{r.agent_type ?? "—"}</span>;
      case "warehouse":
        return <StaffKomandaWarehouseCell warehouse={r.warehouse} />;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "territory":
        return <StaffKomandaTerritoryCell territory={r.territory} />;
      case "device_name":
        return <StaffKomandaDeviceCell name={r.device_name} />;
      case "last_sync":
        return <StaffKomandaLastSyncCell at={r.last_sync_at} />;
      case "price_types":
        return <StaffKomandaTagList items={priceList} />;
      case "trade_direction":
        return <StaffKomandaTradeDirectionCell value={r.trade_direction} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "position":
        return <StaffKomandaPositionCell position={r.position} />;
      case "consignment":
        return <StaffKomandaYesNoCell value={r.consignment} />;
      case "created_at":
        return <StaffKomandaCreatedAtCell at={r.created_at} />;
      case "app_access":
        return (
          <StaffKomandaAppAccessToggle
            checked={r.app_access}
            disabled={patchMut.isPending}
            onChange={(next) => patchMut.mutate({ id: r.id, body: { app_access: next } })}
          />
        );
      case "active_sessions":
        return (
          <StaffKomandaActiveSessionsCell
            count={r.active_session_count}
            max={r.max_sessions}
            onClick={() => setSessionAgent(r)}
          />
        );
      case "max_sessions":
        return <StaffKomandaMaxSessionsCell max={r.max_sessions} />;
      default:
        return "—";
    }
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Агент"
        subtitle="Управление агентами, доступом к приложению и мобильной конфигурацией"
        addLabel="Добавить агента"
        onAdd={() => setAddOpen(true)}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <AgentsFiltersRow
            draftBranch={draftBranch}
            draftPos={draftPos}
            draftTd={draftTd}
            onDraftBranch={setDraftBranch}
            onDraftPos={setDraftPos}
            onDraftTd={setDraftTd}
            branchOptions={branchOptions}
            positionOptions={filterOptQ.data?.positions ?? []}
            tradeDirectionOptions={tradeDirectionFilterOptions}
          />
        }
        onReset={resetFilters}
        onApply={applyFilters}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => tablePrefs.setPageSize(n)}
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={toggleAllAgentsOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, логину…"
        onExport={() => {
          const order = tablePrefs.visibleColumnOrder;
          const headers = order.map((id) => AGENT_COLUMN_LABEL_BY_ID.get(id) ?? id);
          const exportData = filteredRows.map((r) => order.map((colId) => agentExportCellString(r, colId)));
          downloadXlsxSheet(
            `agents_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            "Агенты",
            headers,
            exportData
          );
        }}
        onRefresh={() => void listQ.refetch()}
        isFetching={listQ.isFetching}
      />

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Выберите видимые столбцы и порядок. Сохраняется для вашей учётной записи."
        columns={AGENT_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={AGENT_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="агентов"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selectedIds}
        onToggleSelection={toggleAgentSelection}
        renderCell={(colId, row) =>
          renderAgentDataCell(colId, pageRows.find((r) => r.id === row.id)!)
        }
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Конфигурация" onClick={() => setConfigAgent(r)}>
                <Settings2 className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Активные сессии" onClick={() => setSessionAgent(r)}>
                <MonitorSmartphone className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                <Pencil className="h-4 w-4 text-amber-600" />
              </AgentIconButton>
              {tab === "active" ? (
                <AgentIconButton title="Деактивировать" onClick={() => setDeactivateAgent(r)}>
                  <UserMinus className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
            </div>
          );
        }}
      />

      <StaffBulkFloatingBar
        count={selectedIds.size}
        allAccessOn={allAccessOn}
        isActiveTab={tab === "active"}
        busy={bulkBusy}
        onToggleAccess={() =>
          void bulkMut.mutateAsync({
            action: "set_app_access",
            agent_ids: Array.from(selectedIds),
            app_access: !allAccessOn
          })
        }
        onRestrictions={() => setGroupDialog("restrict")}
        onBulkEdit={() => setBulkEditOpen(true)}
        onToggleActive={() => setConfirmBulk(tab === "active" ? "deactivate" : "activate")}
        onClearSessions={() => setConfirmBulk("clear-sessions")}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <AgentsBulkEditDialog
        open={bulkEditOpen}
        count={selectedIds.size}
        loading={bulkEditMut.isPending}
        warehouses={warehousesQ.data ?? []}
        branchOptions={branchOptions}
        tradeDirections={tradeDirectionRows}
        positions={filterOptQ.data?.positions ?? []}
        onClose={() => setBulkEditOpen(false)}
        onSave={async (fields) => {
          await bulkEditMut.mutateAsync(fields);
        }}
      />

      <AgentTemplateConfirmDialog
        open={confirmBulk != null}
        message={
          confirmBulk === "deactivate"
            ? "Вы хотите деактивировать выбранных агентов?"
            : confirmBulk === "activate"
              ? "Вы хотите активировать выбранных агентов?"
              : "Вы хотите сбросить все сессии у выбранных агентов?"
        }
        busy={bulkBusy}
        onCancel={() => setConfirmBulk(null)}
        onConfirm={() => {
          if (confirmBulk === "clear-sessions") {
            void bulkMut.mutateAsync({
              action: "revoke_sessions",
              agent_ids: Array.from(selectedIds)
            });
            setConfirmBulk(null);
            return;
          }
          if (confirmBulk === "deactivate") {
            void bulkActiveMut.mutateAsync(false);
            return;
          }
          if (confirmBulk === "activate") {
            void bulkActiveMut.mutateAsync(true);
          }
        }}
      />

      <AgentFormModal
        mode="create"
        open={addOpen}
        row={null}
        tenantSlug={tenantSlug}
        warehouses={warehousesQ.data ?? []}
        branchOptions={branchOptions}
        tradeDirections={tradeDirectionsWithId}
        priceTypes={priceTypesQ.data ?? []}
        loading={createMut.isPending}
        onClose={() => setAddOpen(false)}
        onSubmitCreate={(body) => createMut.mutate(body)}
        onSubmitEdit={async () => {}}
      />

      <AgentFormModal
        mode="edit"
        open={editRow != null}
        row={editRow}
        tenantSlug={tenantSlug}
        warehouses={warehousesQ.data ?? []}
        branchOptions={branchOptions}
        tradeDirections={tradeDirectionsWithId}
        priceTypes={priceTypesQ.data ?? []}
        loading={patchMut.isPending}
        onClose={() => setEditRow(null)}
        onSubmitCreate={() => {}}
        onSubmitEdit={(id, body) => patchMut.mutateAsync({ id, body })}
        onOpenRestrictions={(r) => {
          setEditRow(null);
          setRestrictAgent(r);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionAgent != null}
        onOpenChange={(open) => {
          if (!open) setSessionAgent(null);
        }}
        tenantSlug={tenantSlug}
        staffKind="agent"
        userId={sessionAgent?.id ?? null}
        maxSessions={sessionAgent?.max_sessions ?? 1}
        onPatched={() => {
          void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
        }}
      />

      <AgentConfigurationsDialog
        open={configAgent != null}
        agent={configAgent}
        saving={patchMut.isPending}
        paymentMethodEntries={profileQ.data?.references?.payment_method_entries}
        onClose={() => setConfigAgent(null)}
        onSave={async (ent) => {
          if (!configAgent) return;
          await patchMut.mutateAsync({ id: configAgent.id, body: { agent_entitlements: ent } });
          void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
        }}
      />

      <AgentRestrictionsDialog
        open={restrictAgent != null}
        agent={restrictAgent}
        onClose={() => setRestrictAgent(null)}
        tenantSlug={tenantSlug}
        categories={categoriesQ.data ?? []}
        categoriesLoading={categoriesQ.isLoading}
        priceTypes={priceTypesQ.data ?? []}
        onSave={async (ent) => {
          if (!restrictAgent) return;
          const prev = restrictAgent.agent_entitlements ?? {};
          await patchMut.mutateAsync({
            id: restrictAgent.id,
            body: {
              agent_entitlements: {
                ...prev,
                price_types: ent.price_types,
                product_rules: ent.product_rules
              }
            }
          });
        }}
      />

      <AgentRestrictionsDialog
        open={groupDialog === "restrict"}
        agent={null}
        bulkMode
        bulkCount={selectedIds.size}
        bulkLabel={`Выбрано агентов: ${selectedIds.size}`}
        onClose={() => setGroupDialog(null)}
        tenantSlug={tenantSlug}
        categories={categoriesQ.data ?? []}
        categoriesLoading={categoriesQ.isLoading}
        priceTypes={priceTypesQ.data ?? []}
        onSave={async (ent) => {
          await bulkMut.mutateAsync({
            action: "set_agent_entitlements",
            agent_ids: Array.from(selectedIds),
            agent_entitlements: ent
          });
        }}
      />

      <AgentTemplateConfirmDialog
        open={Boolean(deactivateAgent)}
        message="Вы хотите деактивировать агента?"
        cancelLabel="Нет"
        confirmLabel="Да"
        busy={deactivateMut.isPending}
        onCancel={() => setDeactivateAgent(null)}
        onConfirm={() => deactivateAgent && deactivateMut.mutate(deactivateAgent.id)}
      />
    </StaffWorkspaceLayout>
  );
}

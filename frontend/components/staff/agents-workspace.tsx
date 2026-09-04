"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { decodeAccessTokenUserId } from "@/lib/me-permissions";
import { api } from "@/lib/api";
import { messageFromAgentsBulkError } from "@/lib/agents-bulk-errors";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { STALE } from "@/lib/query-stale";
import { Pencil, KeyRound, UserMinus } from "lucide-react";
import { AgentFormModal } from "@/components/staff/agent-form-modal";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import { StaffPasswordChangeDialog } from "@/components/staff/staff-password-change-dialog";
import {
  AgentsBulkEditDialog,
  type AgentsBulkEditFields
} from "@/components/staff/agents-bulk-edit-dialog";
import { AgentsFiltersRow } from "@/components/staff/agents-filters-row";
import { formatPersonDisplayName } from "@/lib/person-display";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { activeBranchNamesFromProfile } from "@/lib/branch-options";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { buildTerritoryTreeOnlyCascade } from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";
import {
  StaffKomandaApkCell,
  StaffKomandaCreatedAtCell,
  StaffKomandaDeviceCell,
  StaffKomandaFioCell,
  StaffKomandaLastSyncCell,
  StaffKomandaLoginCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell
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
  has_face_reference?: boolean;
};

type TenantProfile = {
  references: {
    branches?: Array<{ id: string; name: string; active?: boolean }>;
    trade_directions?: string[];
    territory_nodes?: TerritoryNode[];
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
  "Продукт",
  "Тип агента",
  "Версия APK",
  "ПИНФЛ",
  "Название устройства",
  "Последняя синхронизация",
  "Дата создания"
] as const;

/** v5: код / должность / сессии / app_access olib tashlandi — Рабочее место */
const AGENT_TABLE_ID = "staff.agents.v5";
const AGENT_COLUMN_IDS = [
  "fio",
  "login",
  "phone",
  "product",
  "agent_type",
  "apk_version",
  "pinfl",
  "device_name",
  "last_sync",
  "created_at"
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
    case "pinfl":
      return r.pinfl ?? "";
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
    case "created_at":
      return new Date(r.created_at).toLocaleDateString("ru-RU");
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
    r.pinfl ?? "",
    r.device_name ?? "",
    r.apk_version ?? "",
    r.branch ?? "",
    r.warehouse ?? "",
    r.agent_type ?? "",
    r.work_slot_code ?? "",
    ...(r.price_types ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

export function AgentsWorkspace({ tenantSlug }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const actorUserId = decodeAccessTokenUserId(accessToken);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftTd, setDraftTd] = useState("");
  const [draftOblast, setDraftOblast] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [appliedTd, setAppliedTd] = useState("");
  const [appliedOblast, setAppliedOblast] = useState("");
  const [appliedCity, setAppliedCity] = useState("");
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
  const staffImport = useStaffExcelImport(tenantSlug, "agent");

  const [addOpen, setAddOpen] = useState(false);
  const [createAgentError, setCreateAgentError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<AgentRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<AgentRow | null>(null);
  const [deactivateAgent, setDeactivateAgent] = useState<AgentRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<"activate" | "deactivate" | null>(null);

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

  const filterOptQ = useQuery({
    queryKey: ["agents-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          territory_oblasts?: string[];
          territory_cities?: string[];
          territory_tokens?: string[];
        };
      }>(`/api/${tenantSlug}/agents/filter-options`);
      return data.data;
    }
  });

  const territoryNodes = profileQ.data?.references?.territory_nodes;
  const hasTerritoryTree = (territoryNodes?.length ?? 0) > 0;

  const oblastOptions = useMemo(() => {
    if (hasTerritoryTree) {
      const cascaded = buildTerritoryTreeOnlyCascade(territoryNodes, {
        zones: [],
        regions: draftOblast ? [draftOblast] : []
      });
      return cascaded.regions.map((o) => o.value);
    }
    const fromApi = filterOptQ.data?.territory_oblasts ?? [];
    if (fromApi.length > 0) return fromApi;
    return [...(filterOptQ.data?.territory_tokens ?? [])].sort((a, b) => a.localeCompare(b, "ru"));
  }, [hasTerritoryTree, territoryNodes, draftOblast, filterOptQ.data]);

  const cityOptions = useMemo(() => {
    if (hasTerritoryTree) {
      const cascaded = buildTerritoryTreeOnlyCascade(territoryNodes, {
        zones: [],
        regions: draftOblast ? [draftOblast] : []
      });
      return cascaded.cities.map((o) => o.value);
    }
    const fromApi = filterOptQ.data?.territory_cities ?? [];
    if (fromApi.length > 0) return fromApi;
    return [...(filterOptQ.data?.territory_tokens ?? [])].sort((a, b) => a.localeCompare(b, "ru"));
  }, [hasTerritoryTree, territoryNodes, draftOblast, filterOptQ.data]);

  useEffect(() => {
    if (!draftCity) return;
    if (cityOptions.length > 0 && !cityOptions.some((c) => c === draftCity)) {
      setDraftCity("");
    }
  }, [cityOptions, draftCity]);

  const listQ = useQuery({
    queryKey: [
      "agent",
      tenantSlug,
      actorUserId,
      tab,
      appliedBranch,
      appliedTd,
      appliedOblast,
      appliedCity
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedBranch.trim()) params.set("branch", appliedBranch.trim());
      if (appliedTd.trim()) params.set("trade_direction", appliedTd.trim());
      if (appliedOblast.trim()) params.set("territory_oblast", appliedOblast.trim());
      if (appliedCity.trim()) params.set("territory_city", appliedCity.trim());
      const { data } = await api.get<{ data: AgentRow[] }>(
        `/api/${tenantSlug}/agents?${params.toString()}`
      );
      return data.data;
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
      void qc.invalidateQueries({ queryKey: ["consignment"] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<AgentRow>(`/api/${tenantSlug}/agents`, body);
      return data;
    },
    onSuccess: () => {
      setCreateAgentError(null);
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["consignment"] });
      setAddOpen(false);
    },
    onError: (e: unknown) => {
      setCreateAgentError(messageFromStaffCreateError(e));
    }
  });

  const bulkEditMut = useMutation({
    mutationFn: async (fields: AgentsBulkEditFields) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      if (fields.agent_type !== undefined) {
        await api.post(`/api/${tenantSlug}/agents/bulk`, {
          action: "set_agent_type",
          agent_ids: ids,
          agent_type: fields.agent_type
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["consignment"] });
      setBulkEditOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: unknown) => {
      window.alert(messageFromAgentsBulkError(e));
    }
  });

  const bulkActiveMut = useMutation({
    mutationFn: async (is_active: boolean) => {
      const ids = Array.from(selectedIds);
      await api.post(`/api/${tenantSlug}/agents/bulk`, {
        action: "set_is_active",
        agent_ids: ids,
        is_active
      });
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
  }, [tab, appliedBranch, appliedTd, appliedOblast, appliedCity, search, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, appliedBranch, appliedTd, appliedOblast, appliedCity, safePage, pageSize]);

  const bulkBusy = bulkEditMut.isPending || bulkActiveMut.isPending;

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
    setAppliedOblast(draftOblast);
    setAppliedCity(draftCity);
  };

  const resetFilters = () => {
    setDraftBranch("");
    setDraftTd("");
    setDraftOblast("");
    setDraftCity("");
    setAppliedBranch("");
    setAppliedTd("");
    setAppliedOblast("");
    setAppliedCity("");
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
    switch (colId) {
      case "fio":
        return (
          <StaffKomandaFioCell
            first_name={r.first_name}
            last_name={r.last_name}
            middle_name={r.middle_name}
            fio={r.fio}
            kpiColor={r.kpi_color}
            face={{ tenantSlug, userId: r.id, hasPhoto: r.has_face_reference === true }}
          />
        );
      case "login":
        return <StaffKomandaLoginCell login={r.login} />;
      case "phone":
        return <StaffKomandaPhoneCell phone={r.phone} />;
      case "product":
        return (
          <span className="whitespace-nowrap text-slate-700">{formatProductCell(r.product)}</span>
        );
      case "agent_type":
        return <span className="text-slate-600">{r.agent_type ?? "—"}</span>;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "device_name":
        return <StaffKomandaDeviceCell name={r.device_name} />;
      case "last_sync":
        return <StaffKomandaLastSyncCell at={r.last_sync_at} />;
      case "created_at":
        return <StaffKomandaCreatedAtCell at={r.created_at} />;
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
        onAdd={() => {
          setCreateAgentError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <AgentsFiltersRow
            draftBranch={draftBranch}
            draftTd={draftTd}
            draftOblast={draftOblast}
            draftCity={draftCity}
            onDraftBranch={setDraftBranch}
            onDraftTd={setDraftTd}
            onDraftOblast={setDraftOblast}
            onDraftCity={setDraftCity}
            branchOptions={branchOptions}
            tradeDirectionOptions={tradeDirectionFilterOptions}
            oblastOptions={oblastOptions}
            cityOptions={cityOptions}
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
        searchPlaceholder="Поиск по ФИО, логину…"
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
        onImport={() => staffImport.setOpen(true)}
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
        onToggleAllOnPage={toggleAllAgentsOnPage}
        renderCell={(colId, row) =>
          renderAgentDataCell(colId, pageRows.find((r) => r.id === row.id)!)
        }
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Изменить пароль" onClick={() => setPasswordRow(r)}>
                <KeyRound className="h-4 w-4" />
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
        isActiveTab={tab === "active"}
        busy={bulkBusy}
        onBulkEdit={() => setBulkEditOpen(true)}
        onToggleActive={() => setConfirmBulk(tab === "active" ? "deactivate" : "activate")}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <AgentsBulkEditDialog
        open={bulkEditOpen}
        count={selectedIds.size}
        loading={bulkEditMut.isPending}
        tenantSlug={tenantSlug}
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
            : "Вы хотите активировать выбранных агентов?"
        }
        busy={bulkBusy}
        onCancel={() => setConfirmBulk(null)}
        onConfirm={() => {
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
        loading={createMut.isPending}
        submitError={createAgentError}
        onClose={() => {
          setAddOpen(false);
          setCreateAgentError(null);
        }}
        onSubmitCreate={(body) => createMut.mutate(body)}
        onSubmitEdit={async () => {}}
      />

      <StaffImportDialog
        open={staffImport.open}
        onOpenChange={staffImport.setOpen}
        title={staffImport.dialogTitle}
        busy={staffImport.busy}
        result={staffImport.result}
        onClearResult={staffImport.clearResult}
        onDownloadTemplate={staffImport.downloadTemplate}
        onConfirm={(file) => {
          void staffImport.runImport(file).then(() => {
            void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
            void qc.invalidateQueries({ queryKey: ["agents-filter-options", tenantSlug] });
          });
        }}
      />

      <AgentFormModal
        mode="edit"
        open={editRow != null}
        row={editRow}
        tenantSlug={tenantSlug}
        loading={patchMut.isPending}
        onClose={() => setEditRow(null)}
        onSubmitCreate={() => {}}
        onSubmitEdit={(id, body) => patchMut.mutateAsync({ id, body })}
      />

      <StaffPasswordChangeDialog
        open={passwordRow != null}
        tenantSlug={tenantSlug}
        apiSegment="agents"
        userId={passwordRow?.id ?? null}
        login={passwordRow?.login ?? ""}
        onClose={() => setPasswordRow(null)}
        onDone={() => {
          setPasswordRow(null);
          void qc.invalidateQueries({ queryKey: ["agent", tenantSlug] });
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

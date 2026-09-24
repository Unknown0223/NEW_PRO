"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStaffCrudPermissions } from "@/lib/use-staff-crud-permissions";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { KeyRound, Pencil, UserMinus } from "lucide-react";
import { StaffFaceReferencePanel } from "@/components/staff/staff-face-reference-panel";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { StaffPasswordChangeDialog } from "@/components/staff/staff-password-change-dialog";
import { ExpeditorsFiltersRow } from "@/components/staff/expeditors-filters-row";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { activeBranchNamesFromProfile } from "@/lib/branch-options";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { formatPersonDisplayName } from "@/lib/person-display";
import { buildTerritoryTreeOnlyCascade } from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import {
  StaffKomandaApkCell,
  StaffKomandaBranchCell,
  StaffKomandaCreatedAtCell,
  StaffKomandaDeviceCell,
  StaffKomandaFioCell,
  StaffKomandaLastSyncCell,
  StaffKomandaLoginCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaTerritoryCell,
  StaffKomandaWarehouseCell
} from "@/components/staff/staff-komanda-table-cells";

export type ExpeditorAssignmentRules = {
  price_types?: string[];
  agent_ids?: number[];
  warehouse_ids?: number[];
  trade_directions?: string[];
  territories?: string[];
  weekdays?: number[];
};

export type ExpeditorRow = {
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
  work_slot_territories?: string[];
  login: string;
  is_active: boolean;
  max_sessions: number;
  active_session_count: number;
  kpi_color: string | null;
  work_slot_id?: number | null;
  work_slot_code?: string | null;
  has_face_reference?: boolean;
  agent_entitlements: {
    price_types?: string[];
    product_rules?: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
    mobile_config?: unknown;
  };
  expeditor_assignment_rules: ExpeditorAssignmentRules;
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
  "Склад",
  "Версия APK",
  "ПИНФЛ",
  "Территория",
  "Название устройства",
  "Последняя синхронизация",
  "Филиал",
  "Дата создания"
] as const;

/** v2: код / должность / сессии / app_access olib tashlandi — Рабочее место */
const EXPEDITOR_TABLE_ID = "staff.expeditors.v2";
const EXPEDITOR_COLUMN_IDS = [
  "fio",
  "login",
  "phone",
  "warehouse",
  "apk_version",
  "pinfl",
  "territory",
  "device_name",
  "last_sync",
  "branch",
  "created_at"
] as const;
const EXPEDITOR_COLUMNS = EXPEDITOR_COLUMN_IDS.map((id, i) => ({
  id,
  label: COLS[i] ?? id
}));
const EXPEDITOR_COLUMN_LABEL_BY_ID = new Map<string, string>(
  EXPEDITOR_COLUMNS.map((c) => [c.id, c.label])
);

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

type Props = { tenantSlug: string };

export function ExpeditorsWorkspace({ tenantSlug }: Props) {
  const perms = useStaffCrudPermissions("ekspeditor");
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftTd, setDraftTd] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [appliedTd, setAppliedTd] = useState("");
  const [search, setSearch] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: EXPEDITOR_TABLE_ID,
    defaultColumnOrder: [...EXPEDITOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;
  const staffImport = useStaffExcelImport(tenantSlug, "expeditor");

  const [addOpen, setAddOpen] = useState(false);
  const [createExpeditorError, setCreateExpeditorError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ExpeditorRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<ExpeditorRow | null>(null);
  const [deactivateExpeditor, setDeactivateExpeditor] = useState<ExpeditorRow | null>(null);
  const [draftOblast, setDraftOblast] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [appliedOblast, setAppliedOblast] = useState("");
  const [appliedCity, setAppliedCity] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());

  const filterOptQ = useQuery({
    queryKey: ["expeditors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          branches: string[];
          trade_directions: string[];
          positions: string[];
          territories: string[];
          territory_tokens: string[];
          territory_oblasts?: string[];
          territory_cities?: string[];
        };
      }>(`/api/${tenantSlug}/expeditors/filter-options`);
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "expeditors-workspace"],
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

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "expeditors-workspace");
  const tradeDirectionFilterOptions = tradeDirectionsCatalog.labels;

  const listQ = useQuery({
    queryKey: [
      "expeditors",
      tenantSlug,
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
      const { data } = await api.get<{ data: ExpeditorRow[] }>(
        `/api/${tenantSlug}/expeditors?${params.toString()}`
      );
      return data.data;
    }
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "expeditors-ws"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<ExpeditorRow>(`/api/${tenantSlug}/expeditors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["expeditors-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<ExpeditorRow>(`/api/${tenantSlug}/expeditors`, body);
      return data;
    },
    onSuccess: () => {
      setCreateExpeditorError(null);
      void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["expeditors-filter-options", tenantSlug] });
      setAddOpen(false);
    },
    onError: (e: unknown) => {
      setCreateExpeditorError(messageFromStaffCreateError(e));
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/expeditors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
      setDeactivateExpeditor(null);
    }
  });

  const filteredRows = useMemo(() => {
    const src = listQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return src;
    return src.filter((r) =>
      [
        r.fio,
        r.login,
        r.phone ?? "",
        r.code ?? "",
        r.branch ?? "",
        r.warehouse ?? "",
        ...(r.price_types ?? [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
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

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(r.id)),
    [filteredRows, selectedIds]
  );

  const bulk = useStaffKomandaBulk({
    tenantSlug,
    apiSegment: "expeditors",
    invalidateQueryKeys: [
      ["expeditors", tenantSlug],
      ["expeditors-filter-options", tenantSlug]
    ],
    selectedIds,
    setSelectedIds,
    selectedRows
  });

  const toggleExpeditorSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllExpeditorsOnPage = (checked: boolean) => {
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

  const territoryNodes = profileQ.data?.references?.territory_nodes;
  const hasTerritoryTree = (territoryNodes?.length ?? 0) > 0;

  /** Oblasts/cities: daraxt kaskadi (oblast → shahar); daraxt bo‘lmasa — alohida API ro‘yxatlari */
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

  function expeditorExportCellString(r: ExpeditorRow, colId: string): string {
    switch (colId) {
      case "fio":
        return formatPersonDisplayName(r);
      case "login":
        return r.login;
      case "phone":
        return r.phone ?? "";
      case "warehouse":
        return r.warehouse ?? "";
      case "apk_version":
        return r.apk_version ?? "";
      case "pinfl":
        return r.pinfl ?? "";
      case "territory":
        return (r.work_slot_territories?.length
          ? r.work_slot_territories.join(" · ")
          : null) ?? r.territory ?? "";
      case "device_name":
        return r.device_name ?? "";
      case "last_sync":
        return r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("ru-RU") : "";
      case "branch":
        return r.branch ?? "";
      case "created_at":
        return new Date(r.created_at).toLocaleDateString("ru-RU");
      default:
        return "";
    }
  }

  function renderExpeditorDataCell(colId: string, r: ExpeditorRow) {
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
      case "warehouse":
        return <StaffKomandaWarehouseCell warehouse={r.warehouse} />;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "territory":
        return (
          <StaffKomandaTerritoryCell
            territory={r.territory}
            territories={r.work_slot_territories}
          />
        );
      case "device_name":
        return <StaffKomandaDeviceCell name={r.device_name} />;
      case "last_sync":
        return <StaffKomandaLastSyncCell at={r.last_sync_at} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "created_at":
        return <StaffKomandaCreatedAtCell at={r.created_at} />;
      default:
        return "—";
    }
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Экспедиторы"
        subtitle="Управление экспедиторами, привязками к заявкам и доступом к приложению"
        addLabel="Добавить экспедитора"
        canAdd={perms.canCreate}
        onAdd={() => {
          setCreateExpeditorError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <ExpeditorsFiltersRow
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
        onToggleAllOnPage={toggleAllExpeditorsOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, логину…"
        onExport={
          perms.canExport
            ? () => {
                const order = tablePrefs.visibleColumnOrder;
                const headers = order.map((id) => EXPEDITOR_COLUMN_LABEL_BY_ID.get(id) ?? id);
                const exportData = filteredRows.map((r) =>
                  order.map((colId) => expeditorExportCellString(r, colId))
                );
                downloadXlsxSheet(
                  `expeditors_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Экспедиторы",
                  headers,
                  exportData
                );
              }
            : undefined
        }
        onImport={perms.canImport ? () => staffImport.setOpen(true) : undefined}
        onRefresh={() => void listQ.refetch()}
        isFetching={listQ.isFetching}
      />

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Выберите видимые столбцы и порядок. Сохраняется для вашей учётной записи."
        columns={EXPEDITOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={EXPEDITOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="экспедиторов"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selectedIds}
        onToggleSelection={toggleExpeditorSelection}
        onToggleAllOnPage={toggleAllExpeditorsOnPage}
        renderCell={(colId, row) =>
          renderExpeditorDataCell(colId, pageRows.find((r) => r.id === row.id)!)
        }
        renderActions={(row) => {
          if (!perms.canAnyRowAction) return null;
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              {perms.canUpdate ? (
                <AgentIconButton title="Изменить пароль" onClick={() => setPasswordRow(r)}>
                  <KeyRound className="h-4 w-4" />
                </AgentIconButton>
              ) : null}
              {perms.canUpdate ? (
                <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                  <Pencil className="h-4 w-4 text-amber-600" />
                </AgentIconButton>
              ) : null}
              {tab === "active" && perms.canDeactivate ? (
                <AgentIconButton title="Деактивировать" onClick={() => setDeactivateExpeditor(r)}>
                  <UserMinus className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
            </div>
          );
        }}
      />

      {perms.canUpdate || perms.canDeactivate || perms.canActivate ? (
        <StaffBulkFloatingBar
          count={selectedIds.size}
          isActiveTab={tab === "active"}
          busy={bulk.bulkBusy}
          onToggleActive={
            (tab === "active" && perms.canDeactivate) || (tab === "inactive" && perms.canActivate)
              ? () => bulk.onRequestToggleActive(tab === "active")
              : undefined
          }
          onClearSelection={() => setSelectedIds(new Set())}
        />
      ) : null}

      <AgentTemplateConfirmDialog
        open={bulk.confirmBulk != null}
        message={bulk.confirmMessage}
        busy={bulk.bulkBusy}
        onCancel={() => bulk.setConfirmBulk(null)}
        onConfirm={bulk.handleConfirmBulk}
      />

      <AgentAddDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setCreateExpeditorError(null);
        }}
        tenantSlug={tenantSlug}
        loading={createMut.isPending}
        submitError={createExpeditorError}
        onSubmit={(body) => {
          setCreateExpeditorError(null);
          createMut.mutate(body);
        }}
      />

      <AgentEditDialog
        row={editRow}
        onClose={() => setEditRow(null)}
        tenantSlug={tenantSlug}
        onPatch={(id, body) => patchMut.mutateAsync({ id, body })}
      />

      <StaffPasswordChangeDialog
        open={passwordRow != null}
        tenantSlug={tenantSlug}
        apiSegment="expeditors"
        userId={passwordRow?.id ?? null}
        login={passwordRow?.login ?? ""}
        onClose={() => setPasswordRow(null)}
        onDone={() => {
          setPasswordRow(null);
          void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
        }}
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
            void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
            void qc.invalidateQueries({ queryKey: ["expeditors-filter-options", tenantSlug] });
          });
        }}
      />

      <Dialog open={Boolean(deactivateExpeditor)} onOpenChange={(o) => !o && setDeactivateExpeditor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать экспедитора</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать экспедитора?</p>
          <DialogFooter className="flex-row justify-end gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => setDeactivateExpeditor(null)}>
              Нет
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateMut.isPending}
              onClick={() => deactivateExpeditor && deactivateMut.mutate(deactivateExpeditor.id)}
            >
              Да
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffWorkspaceLayout>
  );
}

function mergeTerritorySelectOptions(current: string, base: string[]): string[] {
  const s = new Set(base);
  const t = current.trim();
  if (t) s.add(t);
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

function AgentAddDialog({
  open,
  onOpenChange,
  tenantSlug,
  loading,
  submitError,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantSlug: string;
  loading: boolean;
  submitError: string | null;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agent_type, setAgentType] = useState("Экспедитор");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [kpi_color, setKpi] = useState("#ef4444");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirst("");
    setLast("");
    setMid("");
    setPhone("");
    setEmail("");
    setAgentType("Экспедитор");
    setPinfl("");
    setLogin("");
    setPassword(randomPassword());
    setKpi("#ef4444");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить экспедитора</DialogTitle>
        </DialogHeader>
        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}
        <WorkplaceMovedNotice className="mb-2" variant="expeditor" />
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          <Input placeholder="Имя *" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="text-xs text-muted-foreground">
            Тип
            <select
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
              value={agent_type}
              onChange={(e) => setAgentType(e.target.value)}
            >
              <option value="Экспедитор">Экспедитор</option>
              <option value="Водитель">Водитель</option>
            </select>
          </label>
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input placeholder="Логин *" value={login} onChange={(e) => setLogin(e.target.value)} />
          <div className="flex gap-2">
            <Input
              placeholder="Пароль *"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>
              ↻
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPw((s) => !s)}>
              👁
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            KPI цвет
            <input type="color" value={kpi_color} onChange={(e) => setKpi(e.target.value)} className="h-8 w-12" />
          </label>
        </div>
        <DialogFooter className="flex-col gap-2 border-0 bg-transparent p-0 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={loading || !first_name.trim() || !login.trim() || password.length < 6}
            onClick={() =>
              onSubmit({
                first_name: first_name.trim(),
                last_name: last_name.trim() || null,
                middle_name: middle_name.trim() || null,
                phone: phone.trim() || null,
                email: email.trim() || null,
                agent_type: agent_type.trim() || null,
                pinfl: pinfl.trim() || null,
                login: login.trim().toLowerCase(),
                password,
                kpi_color: kpi_color || null,
                can_authorize: true
              })
            }
          >
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentEditDialog({
  row,
  onClose,
  tenantSlug,
  onPatch
}: {
  row: ExpeditorRow | null;
  onClose: () => void;
  tenantSlug: string;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const detailQ = useQuery({
    queryKey: ["expeditor-detail", tenantSlug, row?.id],
    enabled: Boolean(row),
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<{ data: ExpeditorRow }>(`/api/${tenantSlug}/expeditors/${row!.id}`);
      return data.data;
    }
  });

  const r = detailQ.data ?? row;
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agent_type, setAgentType] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [kpi_color, setKpi] = useState("#ef4444");
  const [pwMode, setPwMode] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!r) return;
    const parts = r.fio.split(/\s+/);
    setFirst(parts[1] ?? parts[0] ?? "");
    setLast(parts[0] ?? "");
    setMid(parts[2] ?? "");
    setPhone(r.phone ?? "");
    setEmail(r.email ?? "");
    setAgentType(r.agent_type ?? "");
    setPinfl(r.pinfl ?? "");
    setLogin(r.login);
    setKpi(r.kpi_color || "#ef4444");
    setPwMode(false);
    setPassword("");
  }, [r]);

  if (!row || !r) return null;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        first_name: first_name.trim(),
        last_name: last_name.trim() || null,
        middle_name: middle_name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        agent_type: agent_type.trim() || null,
        pinfl: pinfl.trim() || null,
        kpi_color: kpi_color || null,
        login: login.trim().toLowerCase()
      };
      if (pwMode && password.length >= 6) body.password = password;
      await onPatch(r.id, body);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать экспедитора</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice
          className="mb-2"
          variant="expeditor"
          workSlotId={r.work_slot_id ?? undefined}
          openConfig
        />
        <div className="grid max-h-[calc(92vh-8rem)] gap-3 overflow-y-auto pr-1">
          <StaffFaceReferencePanel
            tenantSlug={tenantSlug}
            userId={r.id}
            enabled
            displayName={r.fio}
          />
          <Input placeholder="Имя *" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Тип" value={agent_type} onChange={(e) => setAgentType(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input
            placeholder="Логин *"
            value={login}
            onChange={(e) => setLogin(e.target.value.toLowerCase())}
            className="font-mono"
          />
          {!pwMode ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setPwMode(true)}>
              Изменить пароль
            </Button>
          ) : (
            <Input
              placeholder="Новый пароль (мин. 6)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            KPI цвет
            <input type="color" value={kpi_color} onChange={(e) => setKpi(e.target.value)} className="h-8 w-12" />
          </label>
        </div>
        <DialogFooter className="flex-col gap-2 border-0 bg-transparent p-0 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={saving || !first_name.trim() || !login.trim()}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

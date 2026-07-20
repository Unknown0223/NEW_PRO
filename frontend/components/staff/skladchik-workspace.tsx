"use client";

import type { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { firstMessagePerField, firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { FilterSelect, filterSelectClassName } from "@/components/ui/filter-select";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  KeyRound,
  MonitorSmartphone,
  Pencil,
  Settings,
  UserRoundCheck,
  UserRoundX
} from "lucide-react";
import Link from "next/link";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import {
  StaffFilterSelect,
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { formatPersonDisplayName } from "@/lib/person-display";
import {
  StaffKomandaActiveSessionsCell,
  StaffKomandaAppAccessToggle,
  StaffKomandaBranchCell,
  StaffKomandaCodeCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaMaxSessionsCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaPositionCell,
  StaffKomandaTagList,
  StaffKomandaYesNoCell
} from "@/components/staff/staff-komanda-table-cells";

const POSITION_PRESETS_SETTINGS_HREF = "/settings/web-staff-position-presets";

function FieldHint({ name, errors }: { name: string; errors: Record<string, string> }) {
  const t = errors[name];
  if (!t) return null;
  return <p className="text-xs text-destructive">{t}</p>;
}

const tealPrimary =
  "bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-600/40 disabled:opacity-60";

type WebStaffRow = {
  id: number;
  kind: string;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  login: string;
  phone: string | null;
  email: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  is_active: boolean;
  can_authorize: boolean;
  app_access: boolean;
  active_session_count: number;
  max_sessions: number;
  warehouses: Array<{ id: number; name: string }>;
  warehouse_staff_entitlements: Record<string, boolean>;
};

type FilterOptions = { branches: string[]; positions: string[]; position_presets: string[] };

type WarehousePickerRow = { id: number; name: string };

const SKLADCHIK_COLS = [
  "Ф.И.О",
  "Авторизоваться",
  "Код",
  "ПИНФЛ",
  "Email",
  "Склад",
  "Телефон",
  "Филиал",
  "Должность",
  "Количество активных сессий",
  "Максимальное количество сессий",
  "Доступ к приложение",
  "Авторизация"
] as const;

const SKLADCHIK_TABLE_ID = "staff.skladchik.v1";

const SKLADCHIK_COLUMN_IDS = [
  "fio",
  "login",
  "code",
  "pinfl",
  "email",
  "warehouses",
  "phone",
  "branch",
  "position",
  "active_sessions",
  "max_sessions",
  "app_access",
  "can_authorize"
] as const;

const SKLADCHIK_COLUMNS = SKLADCHIK_COLUMN_IDS.map((id, i) => ({
  id,
  label: SKLADCHIK_COLS[i] ?? id
}));
const SKLADCHIK_COLUMN_LABEL_BY_ID = new Map<string, string>(
  SKLADCHIK_COLUMNS.map((c) => [c.id, c.label])
);

function skladExportCellString(r: WebStaffRow, colId: string): string {
  switch (colId) {
    case "fio":
      return formatPersonDisplayName(r);
    case "login":
      return r.login;
    case "code":
      return r.code ?? "";
    case "pinfl":
      return r.pinfl ?? "";
    case "email":
      return r.email ?? "";
    case "position":
      return r.position ?? "";
    case "warehouses":
      return (r.warehouses ?? []).map((w) => w.name).join("; ");
    case "phone":
      return r.phone ?? "";
    case "branch":
      return r.branch ?? "";
    case "active_sessions":
      return String(r.active_session_count);
    case "max_sessions":
      return String(r.max_sessions);
    case "app_access":
      return r.app_access ? "Да" : "Нет";
    case "can_authorize":
      return r.can_authorize ? "Да" : "Нет";
    default:
      return "";
  }
}

function renderSkladDataCell(colId: string, r: WebStaffRow) {
  switch (colId) {
    case "fio":
      return (
        <StaffKomandaFioCell
          first_name={r.first_name}
          last_name={r.last_name}
          middle_name={r.middle_name}
          fio={r.fio}
        />
      );
    case "login":
      return <StaffKomandaLoginCell login={r.login} />;
    case "code":
      return <StaffKomandaCodeCell code={r.code} />;
    case "pinfl":
      return <StaffKomandaPinflCell pinfl={r.pinfl} />;
    case "email":
      return <span className="text-xs text-slate-700">{r.email ?? "—"}</span>;
    case "position":
      return <StaffKomandaPositionCell position={r.position} />;
    case "warehouses":
      return (
        <StaffKomandaTagList items={(r.warehouses ?? []).map((w) => w.name)} maxVisible={2} />
      );
    case "phone":
      return <StaffKomandaPhoneCell phone={r.phone} />;
    case "branch":
      return <StaffKomandaBranchCell branch={r.branch} />;
    case "max_sessions":
      return <StaffKomandaMaxSessionsCell max={r.max_sessions} />;
    case "can_authorize":
      return <StaffKomandaYesNoCell value={r.can_authorize} />;
    default:
      return "—";
  }
}

type Props = { tenantSlug: string };

export function SkladchikWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [appliedPosition, setAppliedPosition] = useState("");
  const [appliedWarehouseId, setAppliedWarehouseId] = useState("");

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [editRow, setEditRow] = useState<WebStaffRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<WebStaffRow | null>(null);
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);
  const [bulkLimitsOpen, setBulkLimitsOpen] = useState(false);
  /** Modallarda qulflash: ochilgan paytdagi qatorlar (tanlov yoki joriy ro‘yxat) */
  const [bulkRevokeRows, setBulkRevokeRows] = useState<WebStaffRow[] | null>(null);
  const [bulkLimitsRows, setBulkLimitsRows] = useState<WebStaffRow[] | null>(null);
  const [limitsDraft, setLimitsDraft] = useState<Record<number, number>>({});
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sessionRow, setSessionRow] = useState<WebStaffRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [configRow, setConfigRow] = useState<WebStaffRow | null>(null);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: SKLADCHIK_TABLE_ID,
    defaultColumnOrder: [...SKLADCHIK_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;

  const filterOptsQ = useQuery({
    queryKey: ["skladchik", tenantSlug, "filter-options"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/skladchik/meta/filter-options`
      );
      return data.data;
    }
  });

  const warehousesPickerQ = useQuery({
    queryKey: ["skladchik", tenantSlug, "warehouses-picker"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", "true");
      params.set("page", "1");
      params.set("limit", "500");
      const { data } = await api.get<{ data: WarehousePickerRow[] }>(
        `/api/${tenantSlug}/warehouses/table?${params.toString()}`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["skladchik", tenantSlug, tab, appliedBranch, appliedPosition, appliedWarehouseId],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.live,
    refetchInterval: 45_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedBranch.trim()) params.set("branch", appliedBranch.trim());
      if (appliedPosition.trim()) params.set("position", appliedPosition.trim());
      if (appliedWarehouseId.trim()) params.set("warehouse_id", appliedWarehouseId.trim());
      const { data } = await api.get<{ data: WebStaffRow[] }>(
        `/api/${tenantSlug}/skladchik?${params.toString()}`
      );
      return data.data.map((r) => ({
        ...r,
        warehouse_staff_entitlements: r.warehouse_staff_entitlements ?? {}
      }));
    }
  });

  const bulkRevokeMut = useMutation({
    mutationFn: async (userIds: number[]) => {
      await api.post(`/api/${tenantSlug}/skladchik/bulk/sessions/revoke`, { user_ids: userIds });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
      setBulkRevokeOpen(false);
      setBulkRevokeRows(null);
      setSelected(new Set());
    }
  });

  const bulkLimitsMut = useMutation({
    mutationFn: async (updates: { user_id: number; max_sessions: number }[]) => {
      await api.post(`/api/${tenantSlug}/skladchik/bulk/max-sessions`, { updates });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
      setBulkLimitsOpen(false);
      setBulkLimitsRows(null);
      setSelected(new Set());
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (row: WebStaffRow) => {
      await api.patch(`/api/${tenantSlug}/skladchik/${row.id}`, {
        is_active: !row.is_active
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
    }
  });

  const appAccessMut = useMutation({
    mutationFn: async (vars: { id: number; app_access: boolean }) => {
      await api.patch(`/api/${tenantSlug}/skladchik/${vars.id}`, { app_access: vars.app_access });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
    }
  });

  function renderDataCell(colId: string, r: WebStaffRow) {
    if (colId === "active_sessions") {
      return (
        <StaffKomandaActiveSessionsCell
          count={r.active_session_count}
          max={r.max_sessions}
          onClick={() => setSessionRow(r)}
        />
      );
    }
    if (colId === "app_access") {
      return (
        <StaffKomandaAppAccessToggle
          checked={r.app_access}
          disabled={appAccessMut.isPending}
          onChange={(next) => appAccessMut.mutate({ id: r.id, app_access: next })}
        />
      );
    }
    return renderSkladDataCell(colId, r);
  }

  const rows = useMemo(() => {
    const src = listQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return src;
    return src.filter(
      (r) =>
        r.fio.toLowerCase().includes(q) ||
        r.login.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase().includes(q) ||
        (r.pinfl ?? "").toLowerCase().includes(q)
    );
  }, [listQ.data, search]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [tab, appliedBranch, appliedPosition, appliedWarehouseId, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, appliedBranch, appliedPosition, appliedWarehouseId, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedBranch(filterBranch);
    setAppliedPosition(filterPosition);
    setAppliedWarehouseId(filterWarehouseId);
  };

  const resetFilters = () => {
    setFilterBranch("");
    setFilterPosition("");
    setFilterWarehouseId("");
    setAppliedBranch("");
    setAppliedPosition("");
    setAppliedWarehouseId("");
    setPage(1);
  };

  /** Guruh amali: tanlov bo‘lsa faqat tanlanganlar, aks holda joriy jadvaldagi hammasi */
  function computeBulkTargets(): WebStaffRow[] {
    if (selected.size > 0) return rows.filter((r) => selected.has(r.id));
    return rows;
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected]
  );

  const bulk = useStaffKomandaBulk({
    tenantSlug,
    apiSegment: "skladchik",
    invalidateQueryKeys: [["skladchik", tenantSlug]],
    selectedIds: selected,
    setSelectedIds: setSelected,
    selectedRows
  });

  function toggleAllOnPage(checked: boolean) {
    if (checked) setSelected(new Set(pageRows.map((r) => r.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openBulkLimits() {
    const targets = computeBulkTargets();
    if (!targets.length) return;
    const draft: Record<number, number> = {};
    for (const r of targets) {
      draft[r.id] = r.max_sessions;
    }
    setLimitsDraft(draft);
    setBulkLimitsRows(targets);
    setBulkLimitsOpen(true);
  }

  function openBulkRevoke() {
    const targets = computeBulkTargets();
    if (!targets.length) return;
    setBulkRevokeRows(targets);
    setBulkRevokeOpen(true);
  }

  function adjustLimit(id: number, delta: number) {
    setLimitsDraft((d) => {
      const cur = d[id] ?? 1;
      const next = Math.min(99, Math.max(1, cur + delta));
      return { ...d, [id]: next };
    });
  }

  function setAllLimitsTo(n: number) {
    if (!Number.isFinite(n) || n < 1 || n > 99) return;
    setLimitsDraft((d) => {
      const next = { ...d };
      for (const id of Object.keys(next).map(Number)) {
        next[id] = n;
      }
      return next;
    });
  }

  function bumpAllLimits(delta: number) {
    setLimitsDraft((d) => {
      const next = { ...d };
      for (const id of Object.keys(next).map(Number)) {
        next[id] = Math.min(99, Math.max(1, (next[id] ?? 1) + delta));
      }
      return next;
    });
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Складчик"
        subtitle="Управление сотрудниками склада, привязкой к складам и сессиями"
        addLabel="Добавить сотрудника"
        onAdd={() => setCreateOpen(true)}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <>
            <StaffFilterSelect
              label="Филиал"
              value={filterBranch}
              onChange={setFilterBranch}
              emptyLabel="Все филиалы"
            >
              {(filterOptsQ.data?.branches ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </StaffFilterSelect>
            <StaffFilterSelect
              label="Должность"
              value={filterPosition}
              onChange={setFilterPosition}
              emptyLabel="Все должности"
            >
              {(filterOptsQ.data?.positions ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </StaffFilterSelect>
            <StaffFilterSelect
              label="Склад"
              value={filterWarehouseId}
              onChange={setFilterWarehouseId}
              emptyLabel="Все склады"
            >
              {(warehousesPickerQ.data ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </StaffFilterSelect>
          </>
        }
        onReset={resetFilters}
        onApply={applyFilters}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => tablePrefs.setPageSize(n)}
        allOnPageSelected={allOnPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, логину, коду…"
        onExport={() => {
          const order = tablePrefs.visibleColumnOrder;
          const headers = order.map((id) => SKLADCHIK_COLUMN_LABEL_BY_ID.get(id) ?? id);
          const dataRows = rows.map((r) => order.map((colId) => skladExportCellString(r, colId)));
          downloadXlsxSheet(
            `skladchik_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            "Складчики",
            headers,
            dataRows
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
        columns={SKLADCHIK_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={SKLADCHIK_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="сотрудников"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={toggleOne}
        renderCell={(colId, row) =>
          renderDataCell(colId, pageRows.find((r) => r.id === row.id)!)
        }
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Конфигурации" onClick={() => setConfigRow(r)}>
                <Settings className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Активные сессии" onClick={() => setSessionRow(r)}>
                <MonitorSmartphone className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Изменить пароль" onClick={() => setPasswordRow(r)}>
                <KeyRound className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                <Pencil className="h-4 w-4 text-amber-600" />
              </AgentIconButton>
              {tab === "active" ? (
                <AgentIconButton
                  title="Деактивировать"
                  onClick={() => {
                    if (window.confirm(`${r.fio} — деактивировать пользователя?`)) {
                      deactivateMut.mutate(r);
                    }
                  }}
                >
                  <UserRoundX className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : (
                <AgentIconButton title="Активировать" onClick={() => deactivateMut.mutate(r)}>
                  <UserRoundCheck className="h-4 w-4 text-teal-600" />
                </AgentIconButton>
              )}
            </div>
          );
        }}
      />

      <StaffBulkFloatingBar
        count={selected.size}
        allAccessOn={bulk.allAccessOn}
        isActiveTab={tab === "active"}
        busy={bulk.bulkBusy}
        onToggleAccess={bulk.onToggleAccess}
        onToggleActive={() => bulk.onRequestToggleActive(tab === "active")}
        onClearSessions={bulk.onClearSessions}
        onClearSelection={() => setSelected(new Set())}
      />

      <AgentTemplateConfirmDialog
        open={bulk.confirmBulk != null}
        message={bulk.confirmMessage}
        busy={bulk.bulkBusy}
        onCancel={() => bulk.setConfirmBulk(null)}
        onConfirm={bulk.handleConfirmBulk}
      />

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Skladchik</strong> — ombor xodimlari (<code className="text-foreground">skladchik</code>{" "}
        JWT). Bir nechta ombor biriktirish mumkin. Lavozim shablonlari:{" "}
        <Link href="/settings/web-staff-position-presets" className="text-primary underline">
          Veb xodim lavozimlari
        </Link>
        . Faol sessiyalar taxminan <code className="text-foreground">45 s</code> da yangilanadi.
      </p>

      <WebStaffEditDialog
        row={editRow}
        tenantSlug={tenantSlug}
        filterOptions={filterOptsQ.data}
        onClose={() => setEditRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
          setEditRow(null);
        }}
      />

      <WebStaffPasswordDialog
        row={passwordRow}
        tenantSlug={tenantSlug}
        onClose={() => setPasswordRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
          setPasswordRow(null);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionRow != null}
        onOpenChange={(open) => {
          if (!open) setSessionRow(null);
        }}
        tenantSlug={tenantSlug}
        staffKind="skladchik"
        userId={sessionRow?.id ?? null}
        maxSessions={sessionRow?.max_sessions ?? 1}
        onPatched={() => {
          void qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
        }}
        contentClassName="sm:max-w-2xl"
      />

      <SkladchikCreateModal
        tenantSlug={tenantSlug}
        open={createOpen}
        onOpenChange={setCreateOpen}
        filterOptions={filterOptsQ.data}
        warehouses={warehousesPickerQ.data ?? []}
        onCreated={async () => {
          await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
        }}
      />

      <SkladchikConfigModal
        row={configRow}
        open={configRow != null}
        onOpenChange={(o) => {
          if (!o) setConfigRow(null);
        }}
      />

      <Dialog
        open={bulkRevokeOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBulkRevokeOpen(false);
            setBulkRevokeRows(null);
          }
        }}
      >
        <DialogContent className="max-w-lg border border-teal-800/20 shadow-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Veb-sessiyalarni yopish</DialogTitle>
            <p className="text-xs font-normal text-muted-foreground">
              {bulkRevokeRows && bulkRevokeRows.length > 0 ? (
                <>
                  <strong className="text-foreground">{bulkRevokeRows.length}</strong> ta xodimning barcha faol
                  refresh-sessiyalari yopiladi.
                  {selected.size === 0 ? (
                    <span> (Tanlov qilinmagan — joriy ro‘yxatdagi hammasi.)</span>
                  ) : null}
                </>
              ) : null}
            </p>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {(bulkRevokeRows ?? []).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 rounded border px-2 py-1.5">
                <span>{r.fio}</span>
                <span className="tabular-nums text-muted-foreground">
                  faol sessiyalar: {r.active_session_count}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkRevokeOpen(false);
                setBulkRevokeRows(null);
              }}
            >
              Bekor
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                bulkRevokeMut.isPending || !bulkRevokeRows || bulkRevokeRows.length === 0
              }
              onClick={() => {
                if (!bulkRevokeRows?.length) return;
                bulkRevokeMut.mutate(bulkRevokeRows.map((r) => r.id));
              }}
            >
              {bulkRevokeMut.isPending ? "…" : "Sessiyalarni yopish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkLimitsOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBulkLimitsOpen(false);
            setBulkLimitsRows(null);
          }
        }}
      >
        <DialogContent className="max-w-lg border border-teal-800/20 shadow-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Sessiya limitlarini o‘zgartirish</DialogTitle>
            <p className="text-xs font-normal text-muted-foreground">
              {bulkLimitsRows && bulkLimitsRows.length > 0 ? (
                <>
                  <strong className="text-foreground">{bulkLimitsRows.length}</strong> ta xodim uchun maksimal
                  parallel sessiya yangilanadi.
                  {selected.size === 0 ? (
                    <span> (Tanlov qilinmagan — joriy ro‘yxatdagi hammasi.)</span>
                  ) : null}
                </>
              ) : null}
            </p>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" size="sm" variant="secondary" onClick={() => bumpAllLimits(-1)}>
              Hammasiga −1
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => bumpAllLimits(1)}>
              Hammasiga +1
            </Button>
            <span className="text-muted-foreground">yoki</span>
            <Input
              className="w-20"
              inputMode="numeric"
              placeholder="1–99"
              id="uniform-limit"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById("uniform-limit") as HTMLInputElement | null;
                if (el) setAllLimitsTo(Number.parseInt(el.value, 10));
              }}
            >
              Qiymatni qo‘llash
            </Button>
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {(bulkLimitsRows ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{r.fio}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => adjustLimit(r.id, -1)}>
                    −
                  </Button>
                  <span className="w-8 text-center tabular-nums">{limitsDraft[r.id] ?? r.max_sessions}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => adjustLimit(r.id, 1)}>
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkLimitsOpen(false);
                setBulkLimitsRows(null);
              }}
            >
              Bekor
            </Button>
            <Button
              type="button"
              className={tealPrimary}
              disabled={
                bulkLimitsMut.isPending || !bulkLimitsRows || bulkLimitsRows.length === 0
              }
              onClick={() => {
                if (!bulkLimitsRows?.length) return;
                const updates = bulkLimitsRows.map((r) => ({
                  user_id: r.id,
                  max_sessions: limitsDraft[r.id] ?? r.max_sessions
                }));
                bulkLimitsMut.mutate(updates);
              }}
            >
              {bulkLimitsMut.isPending ? "…" : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffWorkspaceLayout>
  );
}

function SkladchikCreateModal({
  tenantSlug,
  open,
  onOpenChange,
  filterOptions,
  warehouses,
  onCreated
}: {
  tenantSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterOptions: FilterOptions | undefined;
  warehouses: WarehousePickerRow[];
  onCreated: () => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    login: "",
    password: "",
    phone: "",
    email: "",
    code: "",
    pinfl: "",
    branch: "",
    position: "",
    max_sessions: "1",
    app_access: false,
    can_authorize: true
  });
  const [warehouseIds, setWarehouseIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setFieldErrors({});
    setForm({
      first_name: "",
      last_name: "",
      middle_name: "",
      login: "",
      password: "",
      phone: "",
      email: "",
      code: "",
      pinfl: "",
      branch: "",
      position: "",
      max_sessions: "1",
      app_access: false,
      can_authorize: true
    });
    setWarehouseIds([]);
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const max_sessions = Number.parseInt(form.max_sessions, 10);
      const body: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        middle_name: form.middle_name.trim() || null,
        login: form.login.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        code: form.code.trim() || null,
        pinfl: form.pinfl.trim() || null,
        position: form.position.trim() || null,
        max_sessions: Number.isFinite(max_sessions) ? max_sessions : 1,
        app_access: form.app_access,
        can_authorize: form.can_authorize,
        is_active: true
      };
      await api.post(`/api/${tenantSlug}/skladchik`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
      onOpenChange(false);
      setFieldErrors({});
      await onCreated();
    },
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        setFieldErrors(firstMessagePerField(flat));
        const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
        setLocalError(top ? withApiSupportLine(top, e) : null);
      } else {
        setFieldErrors({});
        setLocalError(messageFromStaffCreateError(e));
      }
    }
  });

  const branches = filterOptions?.branches ?? [];
  const positions = filterOptions?.positions ?? [];
  const tealPrimaryLocal =
    "bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-600/40 disabled:opacity-60";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="scrollbar-none max-h-[90vh] max-w-lg overflow-y-auto border border-teal-800/25 shadow-xl sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Добавить</DialogTitle>
          <p className="text-xs font-normal text-muted-foreground">Yangi skladchik — login noyob bo‘lishi kerak.</p>
        </DialogHeader>
        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Ism *</span>
            <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            <FieldHint name="first_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Familiya</span>
            <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            <FieldHint name="last_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Otasining ismi</span>
            <Input value={form.middle_name} onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))} />
            <FieldHint name="middle_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Login *</span>
            <Input className="font-mono" value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} />
            <FieldHint name="login" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Parol * (min 6)</span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
            <FieldHint name="password" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Telefon</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <FieldHint name="phone" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <FieldHint name="email" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Kod</span>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <FieldHint name="code" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">PINFL</span>
            <Input value={form.pinfl} onChange={(e) => setForm((f) => ({ ...f, pinfl: e.target.value }))} />
            <FieldHint name="pinfl" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Lavozim</span>
            <FilterSelect
              className={cn(filterSelectClassName, "h-9 w-full max-w-none")}
              emptyLabel="—"
              aria-label="Lavozim"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </FilterSelect>
            <FieldHint name="position" errors={fieldErrors} />
          </label>
          <WorkplaceMovedNotice />
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Maks. sessiya</span>
            <Input
              inputMode="numeric"
              value={form.max_sessions}
              onChange={(e) => setForm((f) => ({ ...f, max_sessions: e.target.value.replace(/\D/g, "") }))}
            />
            <FieldHint name="max_sessions" errors={fieldErrors} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.app_access}
              onChange={(e) => setForm((f) => ({ ...f, app_access: e.target.checked }))}
            />
            Mobil ilova
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.can_authorize}
              onChange={(e) => setForm((f) => ({ ...f, can_authorize: e.target.checked }))}
            />
            Kirish
          </label>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor
          </Button>
          <Button
            type="button"
            className={tealPrimaryLocal}
            disabled={createMut.isPending || !form.first_name.trim() || !form.login.trim() || form.password.length < 6}
            onClick={() => {
              setLocalError(null);
              createMut.mutate();
            }}
          >
            {createMut.isPending ? "…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkladchikConfigModal({
  row,
  open,
  onOpenChange
}: {
  row: WebStaffRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Конфигурации</DialogTitle>
          <p className="text-sm text-muted-foreground">{row.fio}</p>
        </DialogHeader>
        <WorkplaceMovedNotice />
        <p className="text-sm text-muted-foreground">
          Разрешения панели складчика настраиваются на рабочем месте типа «skladchik».
        </p>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebStaffPasswordDialog({
  row,
  onClose,
  tenantSlug,
  onDone
}: {
  row: WebStaffRow | null;
  onClose: () => void;
  tenantSlug: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [passErr, setPassErr] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setPassErr(null);
  }, [row?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await api.patch(`/api/${tenantSlug}/skladchik/${row.id}`, { password });
    },
    onMutate: () => {
      setPassErr(null);
    },
    onSuccess: () => void onDone(),
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const per = firstMessagePerField(flat);
        const under = per.password ?? per.new_password;
        if (under) setPassErr(under);
        else {
          const hint = firstValidationUserHint(flat);
          setPassErr(hint ? withApiSupportLine(hint, e) : withApiSupportLine("Parolni tekshiring.", e));
        }
        return;
      }
      setPassErr(getUserFacingError(e, "Parolni saqlab bo‘lmadi."));
    }
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm border border-teal-800/20 shadow-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Parolni o‘zgartirish — {row.login}</DialogTitle>
        </DialogHeader>
        {passErr ? (
          <p className="text-sm text-destructive" role="alert">
            {passErr}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Yangi parol (min 6)</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            type="button"
            className={tealPrimary}
            disabled={mut.isPending || password.trim().length < 6}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebStaffEditDialog({
  row,
  onClose,
  tenantSlug,
  filterOptions,
  onDone
}: {
  row: WebStaffRow | null;
  onClose: () => void;
  tenantSlug: string;
  filterOptions: FilterOptions | undefined;
  onDone: () => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [max_sessions, setMaxS] = useState("1");
  const [app_access, setAppAccess] = useState(false);
  const [can_authorize, setCanAuth] = useState(true);
  const [warehouseIds, setWarehouseIds] = useState<number[]>([]);
  const [patchBannerError, setPatchBannerError] = useState<string | null>(null);
  const [patchFieldErrors, setPatchFieldErrors] = useState<Record<string, string>>({});

  const warehousesForEditQ = useQuery({
    queryKey: ["skladchik", tenantSlug, "warehouses-picker"],
    staleTime: STALE.reference,
    enabled: Boolean(tenantSlug) && row != null,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", "true");
      params.set("page", "1");
      params.set("limit", "500");
      const { data } = await api.get<{ data: WarehousePickerRow[] }>(
        `/api/${tenantSlug}/warehouses/table?${params.toString()}`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!row) return;
    setPatchBannerError(null);
    setPatchFieldErrors({});
    setFirst((row.first_name ?? "").trim() || row.fio);
    setLast((row.last_name ?? "").trim());
    setMid((row.middle_name ?? "").trim());
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setCode(row.code ?? "");
    setPinfl(row.pinfl ?? "");
    setBranch(row.branch ?? "");
    setPosition(row.position ?? "");
    setMaxS(String(row.max_sessions));
    setAppAccess(row.app_access);
    setCanAuth(row.can_authorize);
    setWarehouseIds((row.warehouses ?? []).map((w) => w.id));
  }, [row]);

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const ms = Number.parseInt(max_sessions, 10);
      await api.patch(`/api/${tenantSlug}/skladchik/${row.id}`, {
        first_name: first_name.trim(),
        last_name: last_name.trim() || null,
        middle_name: middle_name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        code: code.trim() || null,
        pinfl: pinfl.trim() || null,
        position: position.trim() || null,
        max_sessions: Number.isFinite(ms) ? ms : row.max_sessions,
        app_access,
        can_authorize
      });
    },
    onMutate: () => {
      setPatchBannerError(null);
      setPatchFieldErrors({});
    },
    onSuccess: () => void onDone(),
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        setPatchFieldErrors(firstMessagePerField(flat));
        const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
        setPatchBannerError(top ? withApiSupportLine(top, e) : null);
      } else {
        setPatchFieldErrors({});
        setPatchBannerError(getUserFacingError(e, "Saqlab bo‘lmadi."));
      }
    }
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="scrollbar-none max-h-[90vh] max-w-md overflow-y-auto border border-teal-800/20 shadow-lg sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Tahrirlash — {row.login}</DialogTitle>
        </DialogHeader>
        {patchBannerError ? (
          <p className="text-sm text-destructive" role="alert">
            {patchBannerError}
          </p>
        ) : null}
        <div className="grid gap-2 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Ism *</span>
            <Input value={first_name} onChange={(e) => setFirst(e.target.value)} />
            <FieldHint name="first_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Familiya</span>
            <Input value={last_name} onChange={(e) => setLast(e.target.value)} />
            <FieldHint name="last_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Otasining ismi</span>
            <Input value={middle_name} onChange={(e) => setMid(e.target.value)} />
            <FieldHint name="middle_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Telefon</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <FieldHint name="phone" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldHint name="email" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Kod</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
            <FieldHint name="code" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">PINFL</span>
            <Input value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
            <FieldHint name="pinfl" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Lavozim</span>
            <Input
              list="webstaff-positions-edit"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <datalist id="webstaff-positions-edit">
              {(filterOptions?.positions ?? []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <span className="text-[11px] leading-snug text-muted-foreground">
              Shablonlar ro‘yxatini{" "}
              <Link
                href={POSITION_PRESETS_SETTINGS_HREF}
                className="text-primary underline underline-offset-2 hover:text-primary/90"
              >
                bu yerda
              </Link>{" "}
              boshqarasiz.
            </span>
            <FieldHint name="position" errors={patchFieldErrors} />
          </label>
          <WorkplaceMovedNotice />
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Maks. veb-sessiyalar</span>
            <Input
              inputMode="numeric"
              value={max_sessions}
              onChange={(e) => setMaxS(e.target.value.replace(/\D/g, ""))}
            />
            <FieldHint name="max_sessions" errors={patchFieldErrors} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={app_access} onChange={(e) => setAppAccess(e.target.checked)} />
            Mobil ilova
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuth(e.target.checked)} />
            Kirish ruxsati
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            type="button"
            className={tealPrimary}
            disabled={patchMut.isPending}
            onClick={() => patchMut.mutate()}
          >
            {patchMut.isPending ? "…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

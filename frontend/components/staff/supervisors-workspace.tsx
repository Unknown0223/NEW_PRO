"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStaffCrudPermissions } from "@/lib/use-staff-crud-permissions";
import { STALE } from "@/lib/query-stale";
import { activeBranchNamesFromProfile } from "@/lib/branch-options";
import { Button } from "@/components/ui/button";
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
import { Pencil, KeyRound, UserMinus } from "lucide-react";
import { SupervisorFormModal } from "@/components/staff/supervisor-form-modal";
import { StaffFloatingToast, useStaffFloatingToast } from "@/components/staff/staff-floating-toast";
import { messageFromStaffCreateError, messageFromSupervisorPatchError } from "@/lib/staff-api-errors";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import { StaffPasswordChangeDialog } from "@/components/staff/staff-password-change-dialog";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { formatPersonDisplayName } from "@/lib/person-display";
import {
  StaffKomandaApkCell,
  StaffKomandaBranchCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaPinflCell
} from "@/components/staff/staff-komanda-table-cells";

export type SuperviseeRow = {
  id: number;
  fio: string;
  code: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  is_active?: boolean;
};

export type SupervisorRow = {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  apk_version: string | null;
  app_access: boolean;
  active_session_count: number;
  max_sessions: number;
  login: string;
  is_active: boolean;
  supervisees: SuperviseeRow[];
  phone: string | null;
  email: string | null;
  kpi_color: string | null;
  consignment: boolean;
  agent_entitlements?: {
    price_types?: string[];
    product_rules?: unknown;
    mobile_config?: unknown;
  };
  work_slot_id?: number | null;
  work_slot_code?: string | null;
  has_face_reference?: boolean;
};

type TenantProfile = {
  references: {
    branches?: Array<{ id: string; name: string; active?: boolean }>;
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
  "Агент",
  "Авторизоваться",
  "ПИНФЛ",
  "Филиал",
  "Версия APK"
] as const;

/** v2: код / должность / сессии / app_access olib tashlandi — Рабочее место */
const SUPERVISOR_TABLE_ID = "staff.supervisors.v2";
const SUPERVISOR_COLUMN_IDS = [
  "fio",
  "supervisees",
  "login",
  "pinfl",
  "branch",
  "apk_version"
] as const;
const SUPERVISOR_COLUMNS = SUPERVISOR_COLUMN_IDS.map((id, i) => ({
  id,
  label: COLS[i] ?? id
}));
const SUPERVISOR_COLUMN_LABEL_BY_ID = new Map<string, string>(
  SUPERVISOR_COLUMNS.map((c) => [c.id, c.label])
);

type Props = { tenantSlug: string; initialCreateOpen?: boolean };

function SuperviseeCell({ list }: { list: SuperviseeRow[] }) {
  if (!list.length) return <span className="text-slate-500">—</span>;

  const active = list.filter((s) => s.is_active !== false);
  const inactive = list.filter((s) => s.is_active === false);
  const maxVisible = 3;

  const visibleActive = active.slice(0, maxVisible);
  const slotsLeft = maxVisible - visibleActive.length;
  const visibleInactive = slotsLeft > 0 ? inactive.slice(0, slotsLeft) : [];
  const hiddenActive = Math.max(0, active.length - visibleActive.length);
  const hiddenInactive = Math.max(0, inactive.length - visibleInactive.length);

  return (
    <div className="flex flex-wrap gap-1">
      {visibleActive.map((a) => (
        <span
          key={a.id}
          className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200"
        >
          {formatPersonDisplayName(a)}
        </span>
      ))}
      {visibleInactive.map((a) => (
        <span
          key={a.id}
          className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200"
          title="Неактивный агент — открепите в редактировании"
        >
          {formatPersonDisplayName(a)}
        </span>
      ))}
      {hiddenActive > 0 ? (
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-slate-600">ещё {hiddenActive}</span>
      ) : null}
      {hiddenInactive > 0 ? (
        <span
          className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200"
          title="Неактивные агенты — открепите в редактировании"
        >
          ещё {hiddenInactive} неакт.
        </span>
      ) : null}
    </div>
  );
}

export function SupervisorsWorkspace({ tenantSlug, initialCreateOpen = false }: Props) {
  const perms = useStaffCrudPermissions("supervayzer");
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: SUPERVISOR_TABLE_ID,
    defaultColumnOrder: [...SUPERVISOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;
  const staffImport = useStaffExcelImport(tenantSlug, "supervisor");

  const [editRow, setEditRow] = useState<SupervisorRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<SupervisorRow | null>(null);
  const [addOpen, setAddOpen] = useState(initialCreateOpen);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<SupervisorRow | null>(null);
  const { toast, toastTone, setToast } = useStaffFloatingToast();

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "supervisors-ws"],
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

  const listQ = useQuery({
    queryKey: ["supervisors", tenantSlug, tab],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      const { data } = await api.get<{ data: SupervisorRow[] }>(
        `/api/${tenantSlug}/supervisors?${params.toString()}`
      );
      return data.data;
    }
  });

  const createMut = useMutation({
    mutationFn: async (vars: { body: Record<string, unknown> }) => {
      const { data } = await api.post<SupervisorRow>(`/api/${tenantSlug}/supervisors`, vars.body);
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      setToast("Сохранено");
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug, "staff-agent-dropdown"] });
    },
    onError: (e: Error) => {
      setCreateError(messageFromStaffCreateError(e));
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<SupervisorRow>(`/api/${tenantSlug}/supervisors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      setToast("Сохранено");
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisor-detail", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug, "staff-agent-dropdown"] });
      void qc.invalidateQueries({ queryKey: ["agents", tenantSlug, "supervisors-ws-pick"] });
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/supervisors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
      setDeactivateRow(null);
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
        r.position ?? "",
        ...r.supervisees.map((s) => `${s.fio} ${s.code ?? ""}`)
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
  }, [tab, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, safePage, pageSize]);

  const toggleSupervisorSelection = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllSupervisorsOnPage = (checked: boolean) => {
    if (checked) setSelected(new Set(pageRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(r.id)),
    [filteredRows, selected]
  );

  const bulk = useStaffKomandaBulk({
    tenantSlug,
    apiSegment: "supervisors",
    invalidateQueryKeys: [["supervisors", tenantSlug]],
    selectedIds: selected,
    setSelectedIds: setSelected,
    selectedRows
  });

  function supervisorExportCellString(r: SupervisorRow, colId: string): string {
    switch (colId) {
      case "fio":
        return formatPersonDisplayName(r);
      case "supervisees":
        return r.supervisees.map((s) => formatPersonDisplayName(s)).join("; ");
      case "login":
        return r.login;
      case "pinfl":
        return r.pinfl ?? "";
      case "branch":
        return r.branch ?? "";
      case "apk_version":
        return r.apk_version ?? "";
      default:
        return "";
    }
  }

  function renderSupervisorDataCell(colId: string, r: SupervisorRow) {
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
      case "supervisees":
        return <SuperviseeCell list={r.supervisees} />;
      case "login":
        return <StaffKomandaLoginCell login={r.login} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      default:
        return "—";
    }
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Супервайзер"
        subtitle="Управление супервайзерами и привязкой агентов"
        addLabel="Добавить супервайзера"
        canAdd={perms.canCreate}
        onAdd={() => {
          setCreateError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={null}
        onReset={() => setPage(1)}
        onApply={() => setPage(1)}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => tablePrefs.setPageSize(n)}
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={toggleAllSupervisorsOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, логину…"
        onExport={
          perms.canExport
            ? () => {
                const order = tablePrefs.visibleColumnOrder;
                const headers = order.map((id) => SUPERVISOR_COLUMN_LABEL_BY_ID.get(id) ?? id);
                const exportData = filteredRows.map((r) =>
                  order.map((colId) => supervisorExportCellString(r, colId))
                );
                downloadXlsxSheet(
                  `supervisors_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Супервайзеры",
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
        columns={SUPERVISOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={SUPERVISOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="супервайзеров"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={toggleSupervisorSelection}
        onToggleAllOnPage={toggleAllSupervisorsOnPage}
        renderCell={(colId, row) => renderSupervisorDataCell(colId, pageRows.find((r) => r.id === row.id)!)}
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
                <AgentIconButton title="Деактивировать" onClick={() => setDeactivateRow(r)}>
                  <UserMinus className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
            </div>
          );
        }}
      />

      {perms.canUpdate || perms.canDeactivate || perms.canActivate ? (
        <StaffBulkFloatingBar
          count={selected.size}
          isActiveTab={tab === "active"}
          busy={bulk.bulkBusy}
          onToggleActive={
            (tab === "active" && perms.canDeactivate) || (tab === "inactive" && perms.canActivate)
              ? () => bulk.onRequestToggleActive(tab === "active")
              : undefined
          }
          onClearSelection={() => setSelected(new Set())}
        />
      ) : null}

      <AgentTemplateConfirmDialog
        open={bulk.confirmBulk != null}
        message={bulk.confirmMessage}
        busy={bulk.bulkBusy}
        onCancel={() => bulk.setConfirmBulk(null)}
        onConfirm={bulk.handleConfirmBulk}
      />

      <SupervisorFormModal
        mode="create"
        open={addOpen}
        row={null}
        tenantSlug={tenantSlug}
        branchOptions={branchOptions}
        loading={createMut.isPending}
        errorMessage={createError}
        onClose={() => {
          setAddOpen(false);
          setCreateError(null);
        }}
        onSubmitCreate={(body) => {
          setCreateError(null);
          createMut.mutate({ body });
        }}
        onSubmitEdit={async () => {}}
      />

      <SupervisorFormModal
        mode="edit"
        open={editRow != null}
        row={editRow}
        tenantSlug={tenantSlug}
        branchOptions={branchOptions}
        loading={patchMut.isPending}
        errorMessage={editError}
        onClose={() => {
          setEditRow(null);
          setEditError(null);
        }}
        onSubmitCreate={() => {}}
        onSubmitEdit={async (id, body) => {
          try {
            setEditError(null);
            await patchMut.mutateAsync({ id, body });
            setEditRow(null);
          } catch (e) {
            setEditError(messageFromSupervisorPatchError(e));
            throw e;
          }
        }}
      />

      <StaffPasswordChangeDialog
        open={passwordRow != null}
        tenantSlug={tenantSlug}
        apiSegment="supervisors"
        userId={passwordRow?.id ?? null}
        login={passwordRow?.login ?? ""}
        onClose={() => setPasswordRow(null)}
        onDone={() => {
          setPasswordRow(null);
          void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
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
            void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
          });
        }}
      />


      <Dialog open={Boolean(deactivateRow)} onOpenChange={(o) => !o && setDeactivateRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать супервайзера</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать супервайзера?</p>
          <DialogFooter className="flex-row justify-end gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => setDeactivateRow(null)}>
              Нет
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateMut.isPending}
              onClick={() => deactivateRow && deactivateMut.mutate(deactivateRow.id)}
            >
              Да
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StaffFloatingToast message={toast} tone={toastTone} />
    </StaffWorkspaceLayout>
  );
}

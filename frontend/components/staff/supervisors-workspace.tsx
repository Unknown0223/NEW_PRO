"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { MonitorSmartphone, Pencil, Settings2, UserMinus } from "lucide-react";
import { AgentConfigurationsDialog } from "@/components/staff/agent-configurations-dialog";
import { SupervisorFormModal } from "@/components/staff/supervisor-form-modal";
import { messageFromStaffCreateError, messageFromSupervisorPatchError } from "@/lib/staff-api-errors";
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
  StaffKomandaApkCell,
  StaffKomandaAppAccessToggle,
  StaffKomandaBranchCell,
  StaffKomandaCodeCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaMaxSessionsCell,
  StaffKomandaPinflCell,
  StaffKomandaPositionCell
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
  "Код",
  "Авторизоваться",
  "ПИНФЛ",
  "Филиал",
  "Должность",
  "Версия APK",
  "Доступ к приложение",
  "Количество активных сессий",
  "Максимальное количество сессий"
] as const;

const SUPERVISOR_TABLE_ID = "staff.supervisors.v1";
const SUPERVISOR_COLUMN_IDS = [
  "fio",
  "supervisees",
  "code",
  "login",
  "pinfl",
  "branch",
  "position",
  "apk_version",
  "app_access",
  "active_sessions",
  "max_sessions"
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
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [draftPos, setDraftPos] = useState("");
  const [appliedPos, setAppliedPos] = useState("");
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

  const [editRow, setEditRow] = useState<SupervisorRow | null>(null);
  const [addOpen, setAddOpen] = useState(initialCreateOpen);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [sessionSup, setSessionSup] = useState<SupervisorRow | null>(null);
  const [configSup, setConfigSup] = useState<SupervisorRow | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [deactivateRow, setDeactivateRow] = useState<SupervisorRow | null>(null);

  const filterOptQ = useQuery({
    queryKey: ["supervisors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { positions: string[] } }>(
        `/api/${tenantSlug}/supervisors/filter-options`
      );
      return data.data;
    }
  });

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
    queryKey: ["supervisors", tenantSlug, tab, appliedPos],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedPos.trim()) params.set("position", appliedPos.trim());
      const { data } = await api.get<{ data: SupervisorRow[] }>(
        `/api/${tenantSlug}/supervisors?${params.toString()}`
      );
      return data.data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "supervisors-ws-pick"],
    enabled: Boolean(tenantSlug) && (Boolean(editRow) || addOpen),
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", "true");
      const { data } = await api.get<{
        data: { id: number; fio: string; code: string | null; supervisor_user_id: number | null }[];
      }>(`/api/${tenantSlug}/agents?${params.toString()}`);
      return data.data;
    }
  });

  const createMut = useMutation({
    mutationFn: async (vars: { body: Record<string, unknown>; superviseeIds: number[] }) => {
      const { data } = await api.post<SupervisorRow>(`/api/${tenantSlug}/supervisors`, vars.body);
      if (vars.superviseeIds.length > 0) {
        await api.patch(`/api/${tenantSlug}/supervisors/${data.id}`, {
          supervisee_agent_ids: vars.superviseeIds
        });
      }
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisors-filter-options", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug, "staff-agent-dropdown"] });
      void qc.invalidateQueries({ queryKey: ["agents", tenantSlug, "supervisors-ws-pick"] });
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
      void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisor-detail", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["supervisors-filter-options", tenantSlug] });
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
  }, [tab, appliedPos, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, appliedPos, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedPos(draftPos);
  };

  const resetFilters = () => {
    setDraftPos("");
    setAppliedPos("");
    setPage(1);
  };

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
    invalidateQueryKeys: [
      ["supervisors", tenantSlug],
      ["supervisors-filter-options", tenantSlug]
    ],
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
      case "code":
        return r.code ?? "";
      case "login":
        return r.login;
      case "pinfl":
        return r.pinfl ?? "";
      case "branch":
        return r.branch ?? "";
      case "position":
        return r.position ?? "";
      case "apk_version":
        return r.apk_version ?? "";
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
          />
        );
      case "supervisees":
        return <SuperviseeCell list={r.supervisees} />;
      case "code":
        return <StaffKomandaCodeCell code={r.code} />;
      case "login":
        return <StaffKomandaLoginCell login={r.login} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "position":
        return <StaffKomandaPositionCell position={r.position} />;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
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
            onClick={() => setSessionSup(r)}
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
        title="Супервайзер"
        subtitle="Управление супервайзерами и привязкой агентов"
        addLabel="Добавить супервайзера"
        onAdd={() => {
          setCreateError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <StaffFilterSelect
            label="Должность"
            value={draftPos}
            onChange={setDraftPos}
            emptyLabel="Все должности"
          >
            {(filterOptQ.data?.positions ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </StaffFilterSelect>
        }
        onReset={resetFilters}
        onApply={applyFilters}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => tablePrefs.setPageSize(n)}
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={toggleAllSupervisorsOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, логину…"
        onExport={() => {
          const order = tablePrefs.visibleColumnOrder;
          const headers = order.map((id) => SUPERVISOR_COLUMN_LABEL_BY_ID.get(id) ?? id);
          const exportData = filteredRows.map((r) => order.map((colId) => supervisorExportCellString(r, colId)));
          downloadXlsxSheet(
            `supervisors_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            "Супервайзеры",
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
        renderCell={(colId, row) => renderSupervisorDataCell(colId, pageRows.find((r) => r.id === row.id)!)}
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Конфигурации" onClick={() => setConfigSup(r)}>
                <Settings2 className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Сессии" onClick={() => setSessionSup(r)}>
                <MonitorSmartphone className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                <Pencil className="h-4 w-4 text-amber-600" />
              </AgentIconButton>
              {tab === "active" ? (
                <AgentIconButton title="Деактивировать" onClick={() => setDeactivateRow(r)}>
                  <UserMinus className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
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

      <AgentConfigurationsDialog
        open={configSup != null}
        agent={
          configSup
            ? {
                id: configSup.id,
                fio: configSup.fio,
                code: configSup.code,
                login: configSup.login,
                agent_entitlements: configSup.agent_entitlements ?? {}
              }
            : null
        }
        variant="supervisor"
        saving={configSaving}
        paymentMethodEntries={profileQ.data?.references?.payment_method_entries}
        onClose={() => setConfigSup(null)}
        onSave={async (ent) => {
          if (!configSup) return;
          setConfigSaving(true);
          try {
            await patchMut.mutateAsync({ id: configSup.id, body: { agent_entitlements: ent } });
            setConfigSup(null);
          } finally {
            setConfigSaving(false);
          }
        }}
      />

      <SupervisorFormModal
        mode="create"
        open={addOpen}
        row={null}
        tenantSlug={tenantSlug}
        branchOptions={branchOptions}
        positionSuggestions={filterOptQ.data?.positions ?? []}
        agents={agentsQ.data ?? []}
        supervisorId={null}
        loading={createMut.isPending}
        errorMessage={createError}
        onClose={() => {
          setAddOpen(false);
          setCreateError(null);
        }}
        onSubmitCreate={(body, superviseeIds) => {
          setCreateError(null);
          createMut.mutate({ body, superviseeIds });
        }}
        onSubmitEdit={async () => {}}
      />

      <SupervisorFormModal
        mode="edit"
        open={editRow != null}
        row={editRow}
        tenantSlug={tenantSlug}
        branchOptions={branchOptions}
        positionSuggestions={filterOptQ.data?.positions ?? []}
        agents={agentsQ.data ?? []}
        supervisorId={editRow?.id ?? null}
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

      <StaffActiveSessionsDialog
        open={sessionSup != null}
        onOpenChange={(o) => !o && setSessionSup(null)}
        tenantSlug={tenantSlug}
        staffKind="supervisor"
        userId={sessionSup?.id ?? null}
        maxSessions={sessionSup?.max_sessions ?? 1}
        onPatched={() => {
          void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
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
    </StaffWorkspaceLayout>
  );
}

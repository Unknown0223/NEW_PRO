"use client";

import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStaffCrudPermissions } from "@/lib/use-staff-crud-permissions";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { Pencil, KeyRound, UserMinus } from "lucide-react";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { StaffPasswordChangeDialog } from "@/components/staff/staff-password-change-dialog";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import {
  StaffFilterSelect,
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { formatPersonDisplayName } from "@/lib/person-display";
import { buildTerritoryTreeOnlyCascade } from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import {
  StaffKomandaApkCell,
  StaffKomandaBranchCell,
  StaffKomandaDeviceCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaTerritoryCell
} from "@/components/staff/staff-komanda-table-cells";

type AuditorRow = {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  login: string;
  phone: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  apk_version: string | null;
  app_access: boolean;
  territory: string | null;
  work_slot_territories?: string[];
  device_name: string | null;
  active_session_count: number;
  max_sessions: number;
  is_active: boolean;
  agent_entitlements?: Record<string, unknown> & { mobile_config?: unknown };
  work_slot_id?: number | null;
  work_slot_code?: string | null;
};

const COLS = [
  "Ф.И.О",
  "Авторизоваться",
  "Телефон",
  "Территория",
  "Версия APK",
  "ПИНФЛ",
  "Филиал",
  "Название устройства"
] as const;

/** v2: код / должность / сессии / app_access olib tashlandi — Рабочее место */
const AUDITOR_TABLE_ID = "staff.auditors.v2";
const AUDITOR_COLUMN_IDS = [
  "fio",
  "login",
  "phone",
  "territory",
  "apk_version",
  "pinfl",
  "branch",
  "device_name"
] as const;
const AUDITOR_COLUMNS = AUDITOR_COLUMN_IDS.map((id, i) => ({
  id,
  label: COLS[i] ?? id
}));
const AUDITOR_COLUMN_LABEL_BY_ID = new Map<string, string>(
  AUDITOR_COLUMNS.map((c) => [c.id, c.label])
);

type Props = { tenantSlug: string };

export function AuditorsWorkspace({ tenantSlug }: Props) {
  const perms = useStaffCrudPermissions("auditor");
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [draftOblast, setDraftOblast] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [appliedOblast, setAppliedOblast] = useState("");
  const [appliedCity, setAppliedCity] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<AuditorRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<AuditorRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivateRow, setDeactivateRow] = useState<AuditorRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: AUDITOR_TABLE_ID,
    defaultColumnOrder: [...AUDITOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;
  const staffImport = useStaffExcelImport(tenantSlug, "auditor");

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const filterQ = useQuery({
    queryKey: ["auditors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          positions: string[];
          territories: string[];
          territory_oblasts?: string[];
          territory_cities?: string[];
        };
      }>(`/api/${tenantSlug}/auditors/filter-options`);
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "auditors-workspace"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references: { territory_nodes?: TerritoryNode[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
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
    return filterQ.data?.territory_oblasts ?? [];
  }, [hasTerritoryTree, territoryNodes, draftOblast, filterQ.data]);

  const cityOptions = useMemo(() => {
    if (hasTerritoryTree) {
      const cascaded = buildTerritoryTreeOnlyCascade(territoryNodes, {
        zones: [],
        regions: draftOblast ? [draftOblast] : []
      });
      return cascaded.cities.map((o) => o.value);
    }
    return filterQ.data?.territory_cities ?? [];
  }, [hasTerritoryTree, territoryNodes, draftOblast, filterQ.data]);

  useEffect(() => {
    if (!draftCity) return;
    if (cityOptions.length > 0 && !cityOptions.some((c) => c === draftCity)) {
      setDraftCity("");
    }
  }, [cityOptions, draftCity]);

  const listQ = useQuery({
    queryKey: ["auditors", tenantSlug, tab, appliedOblast, appliedCity],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("is_active", tab === "active" ? "true" : "false");
      if (appliedOblast.trim()) p.set("territory_oblast", appliedOblast.trim());
      if (appliedCity.trim()) p.set("territory_city", appliedCity.trim());
      const { data } = await api.get<{ data: AuditorRow[] }>(`/api/${tenantSlug}/auditors?${p.toString()}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<AuditorRow>(`/api/${tenantSlug}/auditors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["auditors-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<AuditorRow>(`/api/${tenantSlug}/auditors`, body);
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["auditors-filter-options", tenantSlug] });
    },
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const hint = firstValidationUserHint(flat);
        setCreateError(withApiSupportLine(hint ?? "Ma'lumotlarni tekshiring.", e));
        return;
      }
      setCreateError(messageFromStaffCreateError(e));
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/auditors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      setDeactivateRow(null);
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
    }
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src = listQ.data ?? [];
    if (!q) return src;
    return src.filter((r) =>
      [
        r.fio,
        r.login,
        r.phone ?? "",
        r.code ?? "",
        r.pinfl ?? "",
        r.branch ?? "",
        r.position ?? "",
        r.device_name ?? "",
        r.territory ?? ""
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
  }, [tab, appliedOblast, appliedCity, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, appliedOblast, appliedCity, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedOblast(draftOblast);
    setAppliedCity(draftCity);
  };

  const resetFilters = () => {
    setDraftOblast("");
    setDraftCity("");
    setAppliedOblast("");
    setAppliedCity("");
    setPage(1);
  };

  const toggleSelection = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    if (checked) setSelected(new Set(pageRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(r.id)),
    [filteredRows, selected]
  );

  const bulk = useStaffKomandaBulk({
    tenantSlug,
    apiSegment: "auditors",
    invalidateQueryKeys: [
      ["auditors", tenantSlug],
      ["auditors-filter-options", tenantSlug]
    ],
    selectedIds: selected,
    setSelectedIds: setSelected,
    selectedRows
  });

  function exportCellString(r: AuditorRow, colId: string): string {
    switch (colId) {
      case "fio":
        return formatPersonDisplayName(r);
      case "login":
        return r.login;
      case "phone":
        return r.phone ?? "";
      case "territory":
        return r.territory ?? "";
      case "apk_version":
        return r.apk_version ?? "";
      case "pinfl":
        return r.pinfl ?? "";
      case "branch":
        return r.branch ?? "";
      case "device_name":
        return r.device_name ?? "";
      default:
        return "";
    }
  }

  function renderDataCell(colId: string, r: AuditorRow) {
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
      case "phone":
        return <StaffKomandaPhoneCell phone={r.phone} />;
      case "territory":
        return (
          <StaffKomandaTerritoryCell
            territory={r.territory}
            territories={r.work_slot_territories}
          />
        );
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "device_name":
        return <StaffKomandaDeviceCell name={r.device_name} />;
      default:
        return "—";
    }
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Аудиторы"
        subtitle="Управление аудиторами: территории, доступ к приложению и контроль сессий"
        addLabel="Добавить аудитора"
        canAdd={perms.canCreate}
        onAdd={() => {
          setCreateError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <>
            <StaffFilterSelect
              label="Область"
              value={draftOblast}
              onChange={(v) => {
                setDraftOblast(v);
                setDraftCity("");
              }}
              emptyLabel="Все области"
            >
              {oblastOptions.map((x) => (
                <option key={`obl-${x}`} value={x}>
                  {x}
                </option>
              ))}
            </StaffFilterSelect>
            <StaffFilterSelect
              label="Город"
              value={draftCity}
              onChange={setDraftCity}
              emptyLabel="Все города"
            >
              {cityOptions.map((x) => (
                <option key={`city-${x}`} value={x}>
                  {x}
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
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, логину…"
        onExport={
          perms.canExport
            ? () => {
                const order = tablePrefs.visibleColumnOrder;
                const headers = order.map((id) => AUDITOR_COLUMN_LABEL_BY_ID.get(id) ?? id);
                const exportData = filteredRows.map((r) =>
                  order.map((colId) => exportCellString(r, colId))
                );
                downloadXlsxSheet(
                  `auditors_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Аудиторы",
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
        columns={AUDITOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={AUDITOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="аудиторов"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={toggleSelection}
        onToggleAllOnPage={toggleAllOnPage}
        renderCell={(colId, row) => renderDataCell(colId, pageRows.find((r) => r.id === row.id)!)}
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

      <AuditorEditDialog
        row={editRow}
        tenantSlug={tenantSlug}
        onClose={() => setEditRow(null)}
        onPatch={(id, body) => patchMut.mutateAsync({ id, body })}
      />
      <StaffPasswordChangeDialog
        open={passwordRow != null}
        tenantSlug={tenantSlug}
        apiSegment="auditors"
        userId={passwordRow?.id ?? null}
        login={passwordRow?.login ?? ""}
        onClose={() => setPasswordRow(null)}
        onDone={() => {
          setPasswordRow(null);
          void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
        }}
      />
      <AuditorAddDialog
        open={addOpen}
        tenantSlug={tenantSlug}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setCreateError(null);
        }}
        loading={createMut.isPending}
        submitError={createError}
        onSubmit={(body) => {
          setCreateError(null);
          createMut.mutate(body);
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
            void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
            void qc.invalidateQueries({ queryKey: ["auditors-filter-options", tenantSlug] });
          });
        }}
      />


      <Dialog open={Boolean(deactivateRow)} onOpenChange={(o) => !o && setDeactivateRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать аудитора</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать аудитора?</p>
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

function AuditorEditDialog({
  row,
  tenantSlug,
  onClose,
  onPatch
}: {
  row: AuditorRow | null;
  tenantSlug: string;
  onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");

  useEffect(() => {
    if (!row) return;
    const parts = row.fio.split(/\s+/);
    setLast(parts[0] ?? "");
    setFirst(parts[1] ?? parts[0] ?? "");
    setMid(parts[2] ?? "");
    setPhone(row.phone ?? "");
    setPinfl(row.pinfl ?? "");
    setLogin(row.login);
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice className="mb-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input
            className="font-mono sm:col-span-2"
            placeholder="Логин *"
            value={login}
            onChange={(e) => setLogin(e.target.value.toLowerCase())}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving || !row || !login.trim()}
            onClick={async () => {
              if (!row) return;
              setSaving(true);
              try {
                await onPatch(row.id, {
                  first_name: first_name.trim(),
                  last_name: last_name.trim() || null,
                  middle_name: middle_name.trim() || null,
                  phone: phone.trim() || null,
                  pinfl: pinfl.trim() || null,
                  login: login.trim().toLowerCase()
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditorAddDialog({
  open,
  onOpenChange,
  tenantSlug,
  loading,
  submitError,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  loading: boolean;
  submitError: string | null;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [can_authorize, setCanAuthorize] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Добавить аудитор</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice className="mb-1" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя *" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input className="font-mono" placeholder="Логин *" value={login} onChange={(e) => setLogin(e.target.value)} />
          <Input className="sm:col-span-2" type="password" placeholder="Пароль * (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuthorize(e.target.checked)} />
            Авторизация включена
          </label>
        </div>
        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={loading || !first_name.trim() || !login.trim() || password.trim().length < 6}
            onClick={() =>
              onSubmit({
                first_name: first_name.trim(),
                last_name: last_name.trim() || null,
                middle_name: middle_name.trim() || null,
                phone: phone.trim() || null,
                pinfl: pinfl.trim() || null,
                login: login.trim(),
                password,
                can_authorize
              })
            }
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

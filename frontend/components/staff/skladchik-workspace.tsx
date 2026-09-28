"use client";

import type { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStaffCrudPermissions } from "@/lib/use-staff-crud-permissions";
import { firstMessagePerField, firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
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
  Pencil,
  UserRoundCheck,
  UserRoundX
} from "lucide-react";
import Link from "next/link";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
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
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { formatPersonDisplayName } from "@/lib/person-display";
import {
  StaffKomandaBranchCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaTagList,
  StaffKomandaYesNoCell
} from "@/components/staff/staff-komanda-table-cells";

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
  work_slot_id?: number | null;
  work_slot_code?: string | null;
};

type FilterOptions = {
  branches: string[];
  positions: string[];
  position_presets: string[];
  warehouses?: Array<{ id: number; name: string; branches: string[] }>;
};

type WarehousePickerRow = { id: number; name: string };

const SKLADCHIK_COLS = [
  "Ф.И.О",
  "Авторизоваться",
  "ПИНФЛ",
  "Email",
  "Склад",
  "Телефон",
  "Филиал",
  "Авторизация"
] as const;

/** v2: код / должность / сессии / app_access olib tashlandi — Рабочее место */
const SKLADCHIK_TABLE_ID = "staff.skladchik.v2";

const SKLADCHIK_COLUMN_IDS = [
  "fio",
  "login",
  "pinfl",
  "email",
  "warehouses",
  "phone",
  "branch",
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
    case "pinfl":
      return r.pinfl ?? "";
    case "email":
      return r.email ?? "";
    case "warehouses":
      return (r.warehouses ?? []).map((w) => w.name).join("; ");
    case "phone":
      return r.phone ?? "";
    case "branch":
      return r.branch ?? "";
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
    case "pinfl":
      return <StaffKomandaPinflCell pinfl={r.pinfl} />;
    case "email":
      return <span className="text-xs text-slate-700">{r.email ?? "—"}</span>;
    case "warehouses":
      return (
        <StaffKomandaTagList items={(r.warehouses ?? []).map((w) => w.name)} maxVisible={2} />
      );
    case "phone":
      return <StaffKomandaPhoneCell phone={r.phone} />;
    case "branch":
      return <StaffKomandaBranchCell branch={r.branch} />;
    case "can_authorize":
      return <StaffKomandaYesNoCell value={r.can_authorize} />;
    default:
      return "—";
  }
}

type Props = { tenantSlug: string };

export function SkladchikWorkspace({ tenantSlug }: Props) {
  const perms = useStaffCrudPermissions("skladchik");
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [appliedWarehouseId, setAppliedWarehouseId] = useState("");

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [editRow, setEditRow] = useState<WebStaffRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<WebStaffRow | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: SKLADCHIK_TABLE_ID,
    defaultColumnOrder: [...SKLADCHIK_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;
  const staffImport = useStaffExcelImport(tenantSlug, "skladchik");

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

  const warehouseFilterOptions = useMemo(() => {
    const fromOpts = filterOptsQ.data?.warehouses;
    if (fromOpts && fromOpts.length > 0) {
      const branch = filterBranch.trim();
      if (!branch) return fromOpts.map((w) => ({ id: w.id, name: w.name }));
      const linked = fromOpts.filter((w) =>
        w.branches.some((b) => b.localeCompare(branch, "ru", { sensitivity: "accent" }) === 0)
      );
      // Filialda bog‘langan ombor bo‘lmasa — barcha (bo‘sh dropdown emas)
      return (linked.length > 0 ? linked : fromOpts).map((w) => ({ id: w.id, name: w.name }));
    }
    return warehousesPickerQ.data ?? [];
  }, [filterOptsQ.data?.warehouses, filterBranch, warehousesPickerQ.data]);

  useEffect(() => {
    if (!filterWarehouseId) return;
    if (!warehouseFilterOptions.some((w) => String(w.id) === filterWarehouseId)) {
      setFilterWarehouseId("");
    }
  }, [warehouseFilterOptions, filterWarehouseId]);

  const listQ = useQuery({
    queryKey: ["skladchik", tenantSlug, tab, appliedBranch, appliedWarehouseId],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.live,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedBranch.trim()) params.set("branch", appliedBranch.trim());
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

  function renderDataCell(colId: string, r: WebStaffRow) {
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
  }, [tab, appliedBranch, appliedWarehouseId, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, appliedBranch, appliedWarehouseId, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedBranch(filterBranch);
    setAppliedWarehouseId(filterWarehouseId);
  };

  const resetFilters = () => {
    setFilterBranch("");
    setFilterWarehouseId("");
    setAppliedBranch("");
    setAppliedWarehouseId("");
    setPage(1);
  };

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

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Складчик"
        subtitle="Управление сотрудниками склада и привязкой к складам"
        addLabel="Добавить сотрудника"
        canAdd={perms.canCreate}
        onAdd={() => setCreateOpen(true)}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <>
            <StaffFilterSelect
              label="Филиал"
              value={filterBranch}
              onChange={(v) => {
                setFilterBranch(v);
                setFilterWarehouseId("");
              }}
              emptyLabel="Все филиалы"
            >
              {(filterOptsQ.data?.branches ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </StaffFilterSelect>
            <StaffFilterSelect
              label="Склад"
              value={filterWarehouseId}
              onChange={setFilterWarehouseId}
              emptyLabel="Все склады"
            >
              {warehouseFilterOptions.map((w) => (
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
        onExport={
          perms.canExport
            ? () => {
                const order = tablePrefs.visibleColumnOrder;
                const headers = order.map((id) => SKLADCHIK_COLUMN_LABEL_BY_ID.get(id) ?? id);
                const dataRows = rows.map((r) => order.map((colId) => skladExportCellString(r, colId)));
                downloadXlsxSheet(
                  `skladchik_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Складчики",
                  headers,
                  dataRows
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
        onToggleAllOnPage={toggleAllOnPage}
        renderCell={(colId, row) =>
          renderDataCell(colId, pageRows.find((r) => r.id === row.id)!)
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
                <AgentIconButton
                  title="Деактивировать"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Деактивировать",
                        message: `${r.fio} — деактивировать пользователя?`,
                        confirmLabel: "Да",
                        cancelLabel: "Нет",
                        destructive: true
                      });
                      if (ok) deactivateMut.mutate(r);
                    })();
                  }}
                >
                  <UserRoundX className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
              {tab === "inactive" && perms.canActivate ? (
                <AgentIconButton title="Активировать" onClick={() => deactivateMut.mutate(r)}>
                  <UserRoundCheck className="h-4 w-4 text-teal-600" />
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
      {confirmDialog}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Складчик</strong> — сотрудники склада (роль{" "}
        <code className="text-foreground">skladchik</code> в JWT). Можно привязать несколько складов.
        Код места, должность и сессии — в{" "}
        <Link href="/work-slots" className="text-primary underline">
          Рабочее место
        </Link>
        .
      </p>

      <WebStaffEditDialog
        row={editRow}
        tenantSlug={tenantSlug}
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
            void qc.invalidateQueries({ queryKey: ["skladchik", tenantSlug] });
          });
        }}
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
    pinfl: "",
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
      pinfl: "",
      can_authorize: true
    });
    setWarehouseIds([]);
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        middle_name: form.middle_name.trim() || null,
        login: form.login.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        pinfl: form.pinfl.trim() || null,
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

  const tealPrimaryLocal =
    "bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-600/40 disabled:opacity-60";

  void filterOptions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="scrollbar-none max-h-[90vh] max-w-lg overflow-y-auto border border-teal-800/25 shadow-xl sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Добавить</DialogTitle>
          <p className="text-xs font-normal text-muted-foreground">Новый кладовщик — логин должен быть уникальным.</p>
        </DialogHeader>
        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Имя *</span>
            <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            <FieldHint name="first_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Фамилия</span>
            <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            <FieldHint name="last_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Отчество</span>
            <Input value={form.middle_name} onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))} />
            <FieldHint name="middle_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Логин *</span>
            <Input className="font-mono" value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} />
            <FieldHint name="login" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Пароль * (мин. 6)</span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
            <FieldHint name="password" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Телефон</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <FieldHint name="phone" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <FieldHint name="email" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">ПИНФЛ</span>
            <Input value={form.pinfl} onChange={(e) => setForm((f) => ({ ...f, pinfl: e.target.value }))} />
            <FieldHint name="pinfl" errors={fieldErrors} />
          </label>
          <WorkplaceMovedNotice />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.can_authorize}
              onChange={(e) => setForm((f) => ({ ...f, can_authorize: e.target.checked }))}
            />
            Доступ для входа
          </label>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
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
          setPassErr(hint ? withApiSupportLine(hint, e) : withApiSupportLine("Проверьте пароль.", e));
        }
        return;
      }
      setPassErr(getUserFacingError(e, "Не удалось сохранить пароль."));
    }
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm border border-teal-800/20 shadow-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Смена пароля — {row.login}</DialogTitle>
        </DialogHeader>
        {passErr ? (
          <p className="text-sm text-destructive" role="alert">
            {passErr}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Новый пароль (мин. 6)</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            className={tealPrimary}
            disabled={mut.isPending || password.trim().length < 6}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "…" : "Сохранить"}
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
  onDone
}: {
  row: WebStaffRow | null;
  onClose: () => void;
  tenantSlug: string;
  onDone: () => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
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
    setPinfl(row.pinfl ?? "");
    setLogin(row.login);
    setCanAuth(row.can_authorize);
    setWarehouseIds((row.warehouses ?? []).map((w) => w.id));
  }, [row]);

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await api.patch(`/api/${tenantSlug}/skladchik/${row.id}`, {
        first_name: first_name.trim(),
        last_name: last_name.trim() || null,
        middle_name: middle_name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        pinfl: pinfl.trim() || null,
        login: login.trim().toLowerCase(),
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
        const ax = e as AxiosError<{ error?: string; message?: string }>;
        if (ax.response?.status === 409 && ax.response?.data?.error === "LoginExists") {
          setPatchBannerError(withApiSupportLine("Этот логин уже занят. Укажите другой логин.", e));
        } else {
          setPatchBannerError(getUserFacingError(e, "Не удалось сохранить."));
        }
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
          <DialogTitle>Редактирование — {row.login}</DialogTitle>
        </DialogHeader>
        {patchBannerError ? (
          <p className="text-sm text-destructive" role="alert">
            {patchBannerError}
          </p>
        ) : null}
        <div className="grid gap-2 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Имя *</span>
            <Input value={first_name} onChange={(e) => setFirst(e.target.value)} />
            <FieldHint name="first_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Фамилия</span>
            <Input value={last_name} onChange={(e) => setLast(e.target.value)} />
            <FieldHint name="last_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Отчество</span>
            <Input value={middle_name} onChange={(e) => setMid(e.target.value)} />
            <FieldHint name="middle_name" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Логин *</span>
            <Input
              className="font-mono"
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase())}
            />
            <FieldHint name="login" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Телефон</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <FieldHint name="phone" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldHint name="email" errors={patchFieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">ПИНФЛ</span>
            <Input value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
            <FieldHint name="pinfl" errors={patchFieldErrors} />
          </label>
          <WorkplaceMovedNotice />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuth(e.target.checked)} />
            Доступ для входа
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            className={tealPrimary}
            disabled={patchMut.isPending || !login.trim()}
            onClick={() => patchMut.mutate()}
          >
            {patchMut.isPending ? "…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

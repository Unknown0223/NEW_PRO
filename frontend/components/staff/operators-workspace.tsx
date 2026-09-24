"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStaffCrudPermissions } from "@/lib/use-staff-crud-permissions";
import { STALE } from "@/lib/query-stale";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { WebOperatorCreateWorkspace } from "@/components/staff/web-operator-create-workspace";
import { KeyRound, Pencil, UserRoundCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { WEB_ACCESS_ROLE_LABELS } from "@/lib/distribution-roles";
import { StaffFioCell } from "@/components/staff/staff-fio-cell";
import { formatPersonDisplayName } from "@/lib/person-display";
import { AgentIconButton } from "@/components/staff/agent-workspace-template-ui";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { StaffImportDialog } from "@/components/staff/staff-import-dialog";
import { useStaffExcelImport } from "@/components/staff/use-staff-excel-import";

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
};

/** v2: код / должность / сессии / app_access olib tashlandi */
const OPERATOR_TABLE_ID = "staff.operators.v2";

const OPERATOR_COLUMN_IDS = [
  "fio",
  "login",
  "pinfl",
  "email",
  "kind",
  "phone",
  "can_authorize"
] as const;

const OPERATOR_COLUMNS = OPERATOR_COLUMN_IDS.map((id) => ({
  id,
  label:
    {
      fio: "Ф.И.О.",
      login: "Логин",
      pinfl: "ПИНФЛ",
      email: "Email",
      kind: "Системная роль",
      phone: "Телефон",
      can_authorize: "Авторизоваться"
    }[id] ?? id
}));

const OPERATOR_COLUMN_LABEL_BY_ID = new Map(OPERATOR_COLUMNS.map((c) => [c.id, c.label]));

function operatorExportCellString(r: WebStaffRow, colId: string): string {
  switch (colId) {
    case "fio":
      return formatPersonDisplayName(r);
    case "login":
      return r.login;
    case "pinfl":
      return r.pinfl ?? "";
    case "email":
      return r.email ?? "";
    case "kind":
      return WEB_ACCESS_ROLE_LABELS[r.kind] ?? r.kind;
    case "phone":
      return r.phone ?? "";
    case "can_authorize":
      return r.can_authorize ? "Да" : "Нет";
    default:
      return "";
  }
}

function renderOperatorDataCell(colId: string, r: WebStaffRow) {
  switch (colId) {
    case "fio":
      return (
        <StaffFioCell
          first_name={r.first_name}
          last_name={r.last_name}
          middle_name={r.middle_name}
          fio={r.fio}
        />
      );
    case "login":
      return <span className="font-mono text-xs">{r.login}</span>;
    case "pinfl":
      return <span className="text-xs">{r.pinfl ?? "—"}</span>;
    case "email":
      return <span className="text-xs">{r.email ?? "—"}</span>;
    case "kind":
      return (
        <span className="text-xs text-muted-foreground">{WEB_ACCESS_ROLE_LABELS[r.kind] ?? r.kind}</span>
      );
    case "phone":
      return <span className="text-xs">{r.phone ?? "—"}</span>;
    case "can_authorize":
      return <span className="text-xs">{r.can_authorize ? "Да" : "Нет"}</span>;
    default:
      return "—";
  }
}

type Props = { tenantSlug: string };

export function OperatorsWorkspace({ tenantSlug }: Props) {
  const perms = useStaffCrudPermissions("sotrudniki");
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [editRow, setEditRow] = useState<WebStaffRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<WebStaffRow | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [createOperatorOpen, setCreateOperatorOpen] = useState(false);
  const [createOperatorFormKey, setCreateOperatorFormKey] = useState(0);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: OPERATOR_TABLE_ID,
    defaultColumnOrder: [...OPERATOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;
  const staffImport = useStaffExcelImport(tenantSlug, "operator");

  const listQ = useQuery({
    queryKey: ["operators", tenantSlug, tab],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.live,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      const { data } = await api.get<{ data: WebStaffRow[] }>(
        `/api/${tenantSlug}/operators?${params.toString()}`
      );
      return data.data;
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (row: WebStaffRow) => {
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, {
        is_active: !row.is_active
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
    }
  });

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
    setSelected(new Set());
    setPage(1);
  }, [tab, search]);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function toggleAllOnPage(checked: boolean) {
    if (checked) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of pageRows) next.add(r.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of pageRows) next.delete(r.id);
        return next;
      });
    }
  }

  function resetFilters() {
    setPage(1);
  }

  function applyFilters() {
    setPage(1);
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Сотрудники"
        subtitle="Веб-пользователи: логин и учётные данные"
        addLabel="Добавить сотрудника"
        canAdd={perms.canCreate}
        onAdd={() => {
          setCreateOperatorFormKey((k) => k + 1);
          setCreateOperatorOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={null}
        onReset={resetFilters}
        onApply={applyFilters}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          tablePrefs.setPageSize(n);
          setPage(1);
        }}
        allOnPageSelected={allOnPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, логину, телефону…"
        onExport={
          perms.canExport
            ? () => {
                const order = tablePrefs.visibleColumnOrder;
                const headers = order.map(
                  (id) =>
                    OPERATOR_COLUMN_LABEL_BY_ID.get(id as (typeof OPERATOR_COLUMN_IDS)[number]) ?? id
                );
                const dataRows = rows.map((r) =>
                  order.map((colId) =>
                    operatorExportCellString(r, colId as (typeof OPERATOR_COLUMN_IDS)[number])
                  )
                );
                downloadXlsxSheet(
                  `sotrudniki_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Сотрудники",
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
        columns={OPERATOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={OPERATOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="сотрудников"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={(id, checked) => {
          if (checked) {
            setSelected((prev) => new Set(prev).add(id));
          } else {
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        }}
        onToggleAllOnPage={toggleAllOnPage}
        renderCell={(colId, row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return renderOperatorDataCell(colId as (typeof OPERATOR_COLUMN_IDS)[number], r);
        }}
        renderActions={(row) => {
          if (!perms.canAnyRowAction) return null;
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              {perms.canUpdate ? (
                <AgentIconButton title="Сменить пароль" onClick={() => setPasswordRow(r)}>
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

      <p className="text-xs text-slate-500">
        <strong className="text-slate-700">Системная роль</strong> сейчас только{" "}
        <code className="text-slate-700">operator</code> (JWT). Код места, должность и сессии — в{" "}
        <Link href="/work-slots" className="text-teal-700 underline">
          Рабочее место
        </Link>
        .
      </p>

      <Dialog open={createOperatorOpen} onOpenChange={setCreateOperatorOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Yangi veb xodim</DialogTitle>
            <DialogDescription>
              Login va parol noyob bo‘lishi kerak.
            </DialogDescription>
          </DialogHeader>
          <WebOperatorCreateWorkspace
            key={createOperatorFormKey}
            tenantSlug={tenantSlug}
            layout="embedded"
            onCancel={() => setCreateOperatorOpen(false)}
            onCreated={() => setCreateOperatorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <WebStaffEditDialog
        row={editRow}
        tenantSlug={tenantSlug}
        onClose={() => setEditRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
          setEditRow(null);
        }}
      />

      <WebStaffPasswordDialog
        row={passwordRow}
        tenantSlug={tenantSlug}
        onClose={() => setPasswordRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
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
            void qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
          });
        }}
      />
      {confirmDialog}
    </StaffWorkspaceLayout>
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

  useEffect(() => {
    setPassword("");
  }, [row?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, { password });
    },
    onSuccess: () => void onDone()
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Parolni o‘zgartirish — {row.login}</DialogTitle>
        </DialogHeader>
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

  useEffect(() => {
    if (!row) return;
    setFirst((row.first_name ?? "").trim() || row.fio);
    setLast((row.last_name ?? "").trim());
    setMid((row.middle_name ?? "").trim());
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setPinfl(row.pinfl ?? "");
    setLogin(row.login);
    setCanAuth(row.can_authorize);
  }, [row]);

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, {
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
    onSuccess: () => void onDone()
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>Tahrirlash — {row.login}</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice />
        <div className="grid gap-2 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Ism *</span>
            <Input value={first_name} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Familiya</span>
            <Input value={last_name} onChange={(e) => setLast(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Otasining ismi</span>
            <Input value={middle_name} onChange={(e) => setMid(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Login *</span>
            <Input
              className="font-mono"
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase())}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Telefon</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">PINFL</span>
            <Input value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
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
          <Button type="button" disabled={patchMut.isPending || !login.trim()} onClick={() => patchMut.mutate()}>
            {patchMut.isPending ? "…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

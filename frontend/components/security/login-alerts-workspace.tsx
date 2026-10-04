"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import {
  LOGIN_ALERT_KIND_LABEL,
  LOGIN_ALERT_RISK_LABEL,
  LOGIN_ALERT_STATUS_LABEL,
  alertMatchText,
  fmtAlertDate,
  loginAlertErrorMessage,
  riskVariant,
  roleLabel,
  statusVariant,
  useExportLoginAlerts,
  useLoginAlerts,
  type LoginAlertFilters,
  type LoginAlertKind,
  type LoginAlertRisk,
  type LoginAlertStatus
} from "@/lib/security/login-alerts-api";
import { usePermissions } from "@/lib/use-permissions";
import { Download, Network, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { IpWhitelistDialog } from "./ip-whitelist-dialog";
import { LoginAlertDetailDialog } from "./login-alert-detail-dialog";

const LIMIT = 50;
const PERM = "audit.podozritelnye_vhody";
const EMPTY: LoginAlertFilters = { status: "open", risk: "", kind: "", from: "", to: "", q: "" };
const RISKS: LoginAlertRisk[] = ["high", "medium", "low"];

export function LoginAlertsWorkspace({ initialAlertId }: { initialAlertId?: number | null }) {
  const { has } = usePermissions();
  const canUpdate = has(`${PERM}.update`);
  const canExport = has(`${PERM}.export`);
  const canCreateIp = has(`${PERM}.create`);
  const canDeleteIp = has(`${PERM}.delete`);
  const exportRows = useExportLoginAlerts();

  const [filters, setFilters] = useState<LoginAlertFilters>(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(initialAlertId ?? null);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const listQ = useLoginAlerts(filters, page, LIMIT);
  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const openCounts = listQ.data?.open_counts ?? {};
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const setFilter = <K extends keyof LoginAlertFilters>(k: K, v: LoginAlertFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const exportXlsx = async () => {
    setExportErr(null);
    setExporting(true);
    try {
      const all = await exportRows(filters);
      await downloadXlsxSheet(
        `suspicious-logins-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Подозрительные входы",
        ["№", "Тип", "Риск", "Статус", "Аккаунты", "Устройство / IP", "Повторов", "Впервые", "Последний раз", "Комментарий"],
        all.map((r) => [
          r.id,
          LOGIN_ALERT_KIND_LABEL[r.kind] ?? r.kind,
          LOGIN_ALERT_RISK_LABEL[r.risk] ?? r.risk,
          LOGIN_ALERT_STATUS_LABEL[r.status] ?? r.status,
          r.users.map((u) => `${u.name} (${u.login})`).join(", "),
          alertMatchText(r),
          r.occurrences,
          fmtAlertDate(r.first_seen_at),
          fmtAlertDate(r.last_seen_at),
          r.review_note ?? ""
        ]),
        { colWidths: [6, 32, 10, 14, 44, 30, 9, 16, 16, 30] }
      );
    } catch (e) {
      setExportErr(loginAlertErrorMessage(e, "Не удалось выгрузить Excel"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Подозрительные входы"
        description="Система сравнивает устройства и IP при входе в веб и мобильное приложение. Если одним устройством или аккаунтом пользуются разные люди — появляется предупреждение, а руководитель решает: норма или нарушение."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setWhitelistOpen(true)}>
              <Network className="mr-1 size-4" />
              Белый список IP
            </Button>
            {canExport ? (
              <Button type="button" variant="outline" size="sm" disabled={exporting || total === 0} onClick={() => void exportXlsx()}>
                <Download className="mr-1 size-4" />
                Excel
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {RISKS.map((risk) => (
          <button
            key={risk}
            type="button"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm hover:bg-muted/30"
            onClick={() => {
              setFilters((f) => ({ ...f, status: "open", risk }));
              setPage(1);
            }}
          >
            <span className="text-sm text-muted-foreground">Не проверено · риск {LOGIN_ALERT_RISK_LABEL[risk].toLowerCase()}</span>
            <Badge variant={riskVariant(risk)} className="text-base tabular-nums">
              {openCounts[risk] ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <FilterSelect
          emptyLabel="Все статусы"
          value={filters.status === "all" ? "" : filters.status}
          onChange={(e) => setFilter("status", (e.target.value || "all") as LoginAlertStatus | "all")}
        >
          <option value="open">Не проверено</option>
          <option value="ok">Норма</option>
          <option value="confirmed">Нарушение</option>
        </FilterSelect>
        <FilterSelect emptyLabel="Любой риск" value={filters.risk} onChange={(e) => setFilter("risk", e.target.value as LoginAlertRisk | "")}>
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {LOGIN_ALERT_RISK_LABEL[r]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect emptyLabel="Все типы" value={filters.kind} onChange={(e) => setFilter("kind", e.target.value as LoginAlertKind | "")}>
          {(Object.keys(LOGIN_ALERT_KIND_LABEL) as LoginAlertKind[]).map((k) => (
            <option key={k} value={k}>
              {LOGIN_ALERT_KIND_LABEL[k]}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          С
          <Input type="date" className="h-9 w-[9.5rem]" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          по
          <Input type="date" className="h-9 w-[9.5rem]" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        <Input className="h-9 w-56" placeholder="Сотрудник или логин…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters(EMPTY);
            setSearch("");
            setPage(1);
          }}
        >
          Сбросить
        </Button>
        <Button type="button" variant="ghost" size="icon" title="Обновить" onClick={() => void listQ.refetch()}>
          <RefreshCw className={listQ.isFetching ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {exportErr ? <p className="text-sm text-destructive">{exportErr}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Риск</th>
              <th className="px-3 py-2">Что случилось</th>
              <th className="px-3 py-2">Аккаунты</th>
              <th className="px-3 py-2">Устройство / IP</th>
              <th className="px-3 py-2">Последний раз</th>
              <th className="px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {listQ.isLoading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Загрузка…</td></tr>
            ) : listQ.isError ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-destructive">Не удалось загрузить список.</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Подозрительных входов нет</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailId(r.id)}>
                  <td className="px-3 py-2">
                    <Badge variant={riskVariant(r.risk)}>{LOGIN_ALERT_RISK_LABEL[r.risk]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{LOGIN_ALERT_KIND_LABEL[r.kind] ?? r.kind}</span>
                    {r.occurrences > 1 ? <span className="text-xs text-muted-foreground"> · ×{r.occurrences}</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    {r.users.slice(0, 3).map((u) => (
                      <div key={u.id}>
                        {u.name} <span className="text-xs text-muted-foreground">· {roleLabel(u.role)}</span>
                      </div>
                    ))}
                    {r.users.length > 3 ? <div className="text-xs text-muted-foreground">и ещё {r.users.length - 3}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{alertMatchText(r)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtAlertDate(r.last_seen_at)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(r.status)}>{LOGIN_ALERT_STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Всего: {total}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Вперёд
          </Button>
        </div>
      </div>

      <LoginAlertDetailDialog alertId={detailId} onClose={() => setDetailId(null)} canUpdate={canUpdate} />
      <IpWhitelistDialog open={whitelistOpen} onOpenChange={setWhitelistOpen} canCreate={canCreateIp} canDelete={canDeleteIp} />
    </PageShell>
  );
}

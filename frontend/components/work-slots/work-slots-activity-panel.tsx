"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import type { WorkSlotActivityReport } from "@/lib/work-slots-types";
import { SlotBadge } from "./slot-badge";
import { formatSlotDate } from "./work-slots-utils";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

type Props = {
  tenant: string;
  slotType?: string;
  branchCode?: string;
};

export function WorkSlotsActivityPanel({ tenant, slotType, branchCode }: Props) {
  const initial = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [report, setReport] = useState<WorkSlotActivityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        date_from: `${dateFrom}T00:00:00.000Z`,
        date_to: `${dateTo}T23:59:59.999Z`,
        limit: "100"
      });
      if (slotType) p.set("slot_type", slotType);
      if (branchCode?.trim()) p.set("branch_code", branchCode.trim());
      const res = await apiFetch<{ data: WorkSlotActivityReport }>(
        `/api/${tenant}/work-slots/activity-report?${p.toString()}`
      );
      setReport(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [tenant, dateFrom, dateTo, slotType, branchCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Активность по рабочим местам (KPI)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Кто, когда и на каком рабочем месте работал — срез истории закреплений.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ws-act-from">С</Label>
            <Input
              id="ws-act-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-act-to">По</Label>
            <Input
              id="ws-act-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? "Загрузка…" : "Показать"}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {report ? (
          <p className="text-xs text-muted-foreground">
            Всего записей: {report.total} (показано: {report.rows.length})
          </p>
        ) : null}
        {report && report.rows.length > 0 ? (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Начало</TableHead>
                  <TableHead>Окончание</TableHead>
                  <TableHead className="text-right">Дней</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r) => (
                  <TableRow key={r.link_id}>
                    <TableCell>
                      <SlotBadge code={r.slot_code} />
                    </TableCell>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatSlotDate(r.started_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.ended_at ? formatSlotDate(r.ended_at) : "Сейчас"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.days_on_slot}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : report && !loading ? (
          <p className="text-sm text-muted-foreground">За выбранный период записей нет.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

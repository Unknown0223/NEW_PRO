"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, payrollWarnText, roleLabel } from "@/lib/payroll/payroll-api";
import { toBody, ymFromInput, ymToInputStr, type Explain, type SchemeDraft, type SchemeMatch, type SchemePreview } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { Labeled, MINI } from "./scheme-fields";

function fitsDraft(m: SchemeMatch, d: SchemeDraft): boolean {
  if (!d.roles.includes(m.role)) return false;
  if (d.branches.length && (!m.branch || !d.branches.includes(m.branch))) return false;
  if (d.trade_direction_ids.length && (m.trade_direction_id == null || !d.trade_direction_ids.includes(m.trade_direction_id))) return false;
  if (d.positions.length && (!m.position || !d.positions.includes(m.position))) return false;
  return true;
}

const warnText = (w: string, d: SchemeDraft) => payrollWarnText(w, (code) => d.rules.find((r) => r.code === code)?.name);

export function ExplainView({ explain }: { explain: Explain | null | undefined }) {
  if (!explain) return null;
  return (
    <div className="grid gap-1 text-[11.5px] text-muted-foreground">
      {explain.text ? <span className="font-mono">{explain.text}</span> : null}
      {explain.parts?.length ? (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left">
              <th className="font-medium">Часть</th>
              <th className="text-right font-medium">План</th>
              <th className="text-right font-medium">Факт</th>
              <th className="text-right font-medium">Вып.</th>
              <th className="text-right font-medium">Платим</th>
              <th className="text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {explain.parts.map((p, i) => (
              <tr key={i} className="border-t border-[var(--pr-line)]">
                <td className="py-0.5 pr-1">
                  {p.label}
                  {p.share != null ? <span className="text-muted-foreground/70"> · {money(p.share, 2)}%</span> : null}
                </td>
                <td className="text-right tabular-nums">{p.plan != null ? money(p.plan) : "—"}</td>
                <td className="text-right tabular-nums">{p.fact != null ? money(p.fact) : "—"}</td>
                <td className={cn("text-right tabular-nums", (p.pct ?? 0) >= 100 ? "text-emerald-600" : "")}>{p.pct != null ? `${money(p.pct, 1)}%` : "—"}</td>
                <td className="text-right tabular-nums">{p.pay_pct != null ? `${money(p.pay_pct, 1)}%` : "—"}</td>
                <td className="text-right font-medium tabular-nums text-foreground">{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {explain.notes?.length ? <span className="text-amber-700">{explain.notes.join(" · ")}</span> : null}
    </div>
  );
}

export function SchemePreviewPanel({ draft, matches }: { draft: SchemeDraft; matches: SchemeMatch[] }) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const cur = currentYm();
  const [ym, setYm] = useState(cur.year * 100 + cur.month);
  const candidates = useMemo(() => matches.filter((m) => fitsDraft(m, draft)), [matches, draft]);
  const [userId, setUserId] = useState<number | null>(null);
  const effectiveUser = userId != null && candidates.some((c) => c.user_id === userId) ? userId : candidates[0]?.user_id ?? null;

  const body = useMemo(() => JSON.stringify(toBody(draft).rules), [draft]);
  const [debounced, setDebounced] = useState(body);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(body), 600);
    return () => clearTimeout(t);
  }, [body]);

  const q = useQuery({
    queryKey: ["payroll-scheme-preview", tenant, debounced, effectiveUser, ym],
    enabled: Boolean(tenant) && effectiveUser != null && draft.rules.length > 0,
    retry: false,
    queryFn: () =>
      api.send<SchemePreview>("POST", "/schemes/preview", {
        rules: JSON.parse(debounced),
        user_id: effectiveUser,
        year: Math.floor(ym / 100),
        month: ym % 100
      })
  });
  const r = q.data;
  const diff = r && r.current_gross != null ? r.gross - r.current_gross : null;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Labeled label={`Сотрудник (подходят: ${candidates.length})`}>
          <select className={MINI} value={effectiveUser ?? ""} onChange={(e) => setUserId(Number(e.target.value) || null)}>
            {!candidates.length ? <option value="">— никто не подходит под условия —</option> : null}
            {candidates.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.name} · {roleLabel(c.role)}
                {c.branch ? ` · ${c.branch}` : ""}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Месяц">
          <input type="month" className={MINI} value={ymToInputStr(ym)} onChange={(e) => setYm(ymFromInput(e.target.value) ?? ym)} />
        </Labeled>
      </div>

      {q.isFetching ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Считаем…
        </div>
      ) : null}
      {q.error ? <div className="whitespace-pre-line rounded-md bg-rose-50 px-2.5 py-2 text-[12px] text-rose-700">{payrollErrorText(q.error)}</div> : null}

      {r ? (
        <div className="grid gap-2">
          <div className="rounded-lg bg-[var(--pr-brand-50)] px-3 py-2">
            <div className="text-[11px] font-medium text-muted-foreground">Начислено за месяц</div>
            <div className="text-[20px] font-bold tabular-nums text-[var(--pr-brand-700)]">{money(r.gross)}</div>
            {diff != null ? (
              <div className={cn("text-[12px]", diff > 0 ? "text-emerald-700" : diff < 0 ? "text-rose-600" : "text-muted-foreground")}>
                Сейчас в ведомости {money(r.current_gross)} · разница {diff > 0 ? "+" : ""}
                {money(diff)}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            <span>Дни: <b className="text-foreground/80">{r.facts.worked_days}/{r.facts.plan_days}</b></span>
            <span>План: <b className="text-foreground/80">{r.facts.plan_sum > 0 ? `${money((r.facts.sales_sum / r.facts.plan_sum) * 100, 1)}%` : "нет"}</b></span>
            <span>АКБ: <b className="text-foreground/80">{r.facts.acb}</b></span>
          </div>
          <div className="divide-y divide-[var(--pr-line)] rounded-lg border border-[var(--pr-border)]">
            <div className="grid gap-0.5 px-2.5 py-2">
              <div className="flex justify-between text-[12.5px] font-medium">
                <span>Оклад</span>
                <span className="tabular-nums">{money(r.base_salary)}</span>
              </div>
              <ExplainView explain={r.base_explain} />
            </div>
            {r.lines.map((l) => (
              <div key={l.item_id} className="grid gap-0.5 px-2.5 py-2">
                <div className="flex justify-between text-[12.5px] font-medium">
                  <span>
                    {l.name}
                    {l.source === "manual" ? <span className="font-normal text-muted-foreground"> · вручную</span> : null}
                  </span>
                  <span className={cn("tabular-nums", l.type === "deduction" && "text-rose-600")}>
                    {l.type === "deduction" ? "−" : ""}
                    {money(l.amount)}
                  </span>
                </div>
                <ExplainView explain={l.explain} />
              </div>
            ))}
          </div>
          {[...r.errors, ...r.warnings].length ? (
            <div className="grid gap-1 rounded-md bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {r.errors.map((e) => (
                <span key={e} className="flex gap-1.5 text-rose-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {e}
                </span>
              ))}
              {[...new Set(r.warnings)].map((w) => (
                <span key={w} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {warnText(w, draft)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

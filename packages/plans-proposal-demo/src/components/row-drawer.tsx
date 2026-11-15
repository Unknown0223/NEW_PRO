import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleAlert, EyeOff, Info, RotateCcw, Save } from "lucide-react";
import { parseMoneyInput, type Money } from "@salec/plans-proposal";
import type { ProposalController } from "@/hooks/use-proposal";
import { KPI_GROUPS } from "@/data/demo-data";
import { fmt, formulaLabel, moneyDecimal, rowStatus } from "@/lib/format";
import { Badge, Button, Field, Modal, cx } from "./ui";

export type InspectState = { key: string; kpiGroupId: number } | null;

export function RowDrawer({
  c,
  state,
  onClose
}: {
  c: ProposalController;
  state: InspectState;
  onClose: () => void;
}) {
  const kpi = state ? c.result.kpis.find((k) => k.kpiGroupId === state.kpiGroupId) : undefined;
  const row = kpi?.result.rows.find((r) => r.key === state?.key);
  const config = state ? c.configs[String(state.kpiGroupId)] : undefined;
  const [manual, setManual] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!row || !config || !state) return;
    const existing = config.overrides[row.key];
    setManual(existing ? moneyDecimal(existing.value) : row.value ? moneyDecimal(row.value) : "");
    setReason(existing?.reason ?? "");
    setError(null);
  }, [state?.key, state?.kpiGroupId, config?.overrides]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!row || !state || !config)
    return (
      <Modal open={false} onClose={onClose} title="Xodim">
        <div />
      </Modal>
    );
  const e = row.employee;
  const excluded = row.origin === "excluded";
  const groupName = KPI_GROUPS.find((g) => g.id === state.kpiGroupId)?.name;
  const saveManual = () => {
    let value: Money;
    try {
      value = parseMoneyInput(manual);
      if (BigInt(value) <= 0n) throw new Error();
    } catch {
      setError("Musbat summa kiriting (ko‘pi bilan 2 kasr xonasi).");
      return;
    }
    if (!reason.trim()) {
      setError("Qo‘lda o‘zgartirish sababi majburiy.");
      return;
    }
    c.setManual(state.kpiGroupId, row.key, { value, reason: reason.trim() });
    c.notify(`${e.name} · ${groupName}: qo‘lda reja saqlandi`);
    setError(null);
  };
  return (
    <Modal
      open={Boolean(state)}
      onClose={onClose}
      title={e.name}
      subtitle={`${e.code} · ${e.branch} · ${e.supervisor} · KPI: ${groupName}`}
      wide
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={row.ready ? "green" : excluded ? "neutral" : "amber"}>{rowStatus(row)}</Badge>
        <Badge tone="neutral">{e.linked ? "KPIga biriktirilgan" : "KPIga biriktirilmagan"}</Badge>
        <span className="ml-auto text-[10px] text-[#98a49b]">Barcha summalar — so‘m</span>
      </div>
      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-[#e4ebe6] p-4">
          <h3 className="mb-3 text-xs font-semibold">Manba va hisob izohi</h3>
          <dl className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-[#8b9a90]">Sof fakt</dt>
              <dd className="numeric font-bold">{fmt(e.fact?.net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#8b9a90]">Eski reja</dt>
              <dd className="numeric">{fmt(e.previousPlan?.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#8b9a90]">Qaytarishlar</dt>
              <dd className="numeric text-amber-600">{fmt(e.fact?.returns)}</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-lg bg-brand-50/70 p-3">
            <p className="mb-1 text-[9px] font-semibold tracking-wide text-brand-600 uppercase">
              Hisob zanjiri
            </p>
            <p className="text-[11px] font-medium text-brand-800">
              {excluded
                ? "Qator hisobdan chiqarilgan"
                : row.origin === "manual"
                  ? `Qo‘lda: ${config.overrides[row.key]?.reason}`
                  : formulaLabel(row.formula)}
            </p>
            <p className="numeric mt-2 text-xs text-[#658371]">
              {fmt(row.base)} → <strong className="text-brand-700">{fmt(row.value)}</strong>
            </p>
            <p className="mt-1 text-[9px] text-[#92a297]">
              Yaxlitlashdan keyin. Qoida: {row.ruleName}
            </p>
          </div>
          <div className="mt-4 space-y-2.5">
            {row.issues.length === 0 && (
              <p className="flex items-center gap-2 text-[11px] text-brand-600">
                <Check size={13} /> Muammo aniqlanmadi
              </p>
            )}
            {row.issues.map((i, n) => (
              <div key={`${i.code}-${n}`} className="flex items-start gap-2">
                <span
                  className={cx(
                    "mt-0.5 shrink-0",
                    i.severity === "blocking"
                      ? "text-red-500"
                      : i.severity === "warning"
                        ? "text-amber-500"
                        : "text-sky-500"
                  )}
                >
                  {i.severity === "blocking" ? (
                    <CircleAlert size={13} />
                  ) : i.severity === "warning" ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <Info size={13} />
                  )}
                </span>
                <p className="text-[10px] leading-4 text-[#7d8e82]">{i.message}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-[#e4ebe6] p-4">
            <h3 className="mb-3 text-xs font-semibold">Qo‘lda reja kiritish</h3>
            <div className="space-y-3">
              <Field label="TAKLIF SUMMASI, SO‘M">
                <input
                  className="field numeric"
                  inputMode="decimal"
                  value={manual}
                  onChange={(ev) => setManual(ev.target.value)}
                  placeholder="Masalan, 120000000"
                  disabled={excluded}
                />
              </Field>
              <Field label="SABAB (MAJBURIY)">
                <textarea
                  className="field h-20 resize-none py-2 leading-5"
                  maxLength={2000}
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  placeholder="Masalan: yangi hudud, bir martalik yirik savdo…"
                  disabled={excluded}
                />
              </Field>
              {error && <p className="text-[10px] text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1 text-[10px]"
                  onClick={saveManual}
                  disabled={excluded}
                >
                  <Save size={12} /> Qo‘lda saqlash
                </Button>
                {config.overrides[row.key] && (
                  <Button
                    className="text-[10px]"
                    onClick={() => {
                      c.setManual(state.kpiGroupId, row.key, null);
                      c.notify("Qo‘lda kiritish olib tashlandi. Formula hisobi qaytdi.", "info");
                    }}
                  >
                    <RotateCcw size={12} /> Qaytarish
                  </Button>
                )}
              </div>
              <p className="text-[9px] leading-4 text-[#98a49b]">
                Qo‘lda qiymat barcha formulalardan ustun. Sabab draft bilan saqlanadi va CSVga
                chiqadi.
              </p>
            </div>
          </section>
          <Button
            variant={excluded ? "secondary" : "ghost"}
            className="w-full text-[10px]"
            onClick={() => {
              c.toggleExcluded(state.kpiGroupId, row.key);
              c.notify(
                excluded ? "Katak hisobga qaytarildi" : "Katak taklif hisobidan chiqarildi",
                "info"
              );
            }}
          >
            <EyeOff size={12} /> {excluded ? "Hisobga qaytarish" : "Bu katakni hisobdan chiqarish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { useState } from "react";
import { Clock3, Download } from "lucide-react";
import type { AuditEntry } from "@taklifiy/lib/audit";
import { ACTION_LABELS, auditCsv, auditTime } from "@taklifiy/lib/audit";
import { downloadText } from "@taklifiy/lib/format";
import { Badge, Button, EmptyState, Modal } from "./ui";

function ActionBadge({ action }: { action: AuditEntry["action"] }) {
  const tone =
    action === "delete" || action === "excluded"
      ? "red"
      : action === "formula" || action === "manual" || action === "rename"
        ? "green"
        : action === "created" || action === "import" || action === "restore"
          ? "blue"
          : "neutral";
  return <Badge tone={tone}>{ACTION_LABELS[action]}</Badge>;
}

const COLUMNS = ["SANA VA VAQT", "KIM", "XODIM", "KPI", "AMAL", "MAYDON", "AVVAL", "KEYIN", "IZOH"];

export function AuditRows({ entries }: { entries: AuditEntry[] }) {
  return (
    <>
      {entries.map((e) => (
        <tr key={e.id} className="border-t border-[#edf1ee] hover:bg-[#fafcfb]">
          <td className="px-3 py-2 whitespace-nowrap">{auditTime(e.at)}</td>
          <td className="px-3 py-2 font-semibold whitespace-nowrap">{e.actor}</td>
          <td className="px-3 py-2 whitespace-nowrap">{e.employeeName ?? "—"}</td>
          <td className="px-3 py-2 whitespace-nowrap">
            {e.kpiGroupId == null ? "—" : `KPI ${e.kpiGroupId}`}
          </td>
          <td className="px-3 py-2">
            <ActionBadge action={e.action} />
          </td>
          <td className="px-3 py-2 whitespace-nowrap">{e.field}</td>
          <td className="max-w-[180px] truncate px-3 py-2 text-[#98a69c]">{e.before ?? "—"}</td>
          <td className="max-w-[180px] truncate px-3 py-2 font-medium">{e.after ?? "—"}</td>
          <td className="max-w-[280px] px-3 py-2 text-[10px] text-[#7d8e82]">{e.summary}</td>
        </tr>
      ))}
    </>
  );
}

/** Umumiy audit tarixi — jadval ko‘rinishida, qidiruv va CSV eksport bilan. */
export function AuditTable({ audit }: { audit: AuditEntry[] }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const sorted = [...audit].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sorted.filter((e) =>
        [e.actor, e.employeeName, e.field, e.before, e.after, e.summary]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : sorted;
  const shown = all ? filtered : filtered.slice(0, 12);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eee9] px-5 py-4">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <Clock3 size={16} className="text-brand-600" /> Kim, nima va qachon o‘zgartirgani
          </h3>
          <p className="mt-1 text-[10px] text-[#98a69c]">
            {audit.length} ta yozuv · barcha foydalanuvchilar uchun bitta umumiy jurnal
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="field h-9 w-[172px] text-[11px]"
            aria-label="Audit tarixida qidirish"
            placeholder="Xodim yoki amal…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            onClick={() =>
              downloadText(
                `salec-audit-${new Date().toISOString().slice(0, 10)}.csv`,
                auditCsv(filtered),
                "text/csv;charset=utf-8"
              )
            }
          >
            <Download size={13} /> Tarix CSV
          </Button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="Tarix yozuvlari yo‘q"
          description="Birinchi o‘zgartirishdan so‘ng bu jadval to‘ladi."
        />
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[1080px] border-collapse text-left text-[11px] text-[#5d7264]"
            aria-label="Umumiy o‘zgartirishlar tarixi"
          >
            <thead className="table-head">
              <tr>
                {COLUMNS.map((h) => (
                  <th key={h} className="px-3 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AuditRows entries={shown} />
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 12 && (
        <div className="border-t border-[#e8eee9] px-5 py-3 text-right">
          <button
            className="text-[11px] font-semibold text-brand-700 hover:underline"
            onClick={() => setAll((v) => !v)}
          >
            {all
              ? "Birinchi 12 tasini ko‘rsatish"
              : `Barcha ${filtered.length} ta yozuvni ko‘rsatish`}
          </button>
        </div>
      )}
    </section>
  );
}

/** Har bir xodim×KPI katagining bitta tugmasi ochadigan tarix. */
export function CellHistoryModal({
  open,
  onClose,
  employeeName,
  kpiGroupId,
  entries
}: {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  kpiGroupId: number;
  entries: AuditEntry[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${employeeName} · KPI ${kpiGroupId} tarixi`}
      subtitle={`Kim, qachon va nimani o‘zgartirgani · ${entries.length} ta yozuv`}
      xwide
    >
      {entries.length === 0 ? (
        <EmptyState
          title="Bu katak hali o‘zgartirilmagan"
          description="Formulani tahrirlasangiz yoki qatorni o‘chirsangiz, bu yerga yoziladi."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#e8eee9]">
          <table
            className="w-full min-w-[680px] border-collapse text-left text-[11px] text-[#5d7264]"
            aria-label="Katak o‘zgartirishlari tarixi"
          >
            <thead className="table-head">
              <tr>
                {["SANA VA VAQT", "KIM", "AMAL", "MAYDON", "AVVAL", "KEYIN", "IZOH"].map((h) => (
                  <th key={h} className="px-3 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-[#edf1ee]">
                  <td className="px-3 py-2 whitespace-nowrap">{auditTime(e.at)}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{e.actor}</td>
                  <td className="px-3 py-2">
                    <ActionBadge action={e.action} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.field}</td>
                  <td className="max-w-[150px] truncate px-3 py-2 text-[#98a69c]">
                    {e.before ?? "—"}
                  </td>
                  <td className="max-w-[150px] truncate px-3 py-2 font-medium">{e.after ?? "—"}</td>
                  <td className="max-w-[240px] px-3 py-2 text-[10px] text-[#7d8e82]">
                    {e.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

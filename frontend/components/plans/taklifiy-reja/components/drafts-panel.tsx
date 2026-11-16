import { useEffect, useRef, useState } from "react";
import { employeeKey, periodLabel } from "@salec/plans-proposal";
import {
  CalendarDays,
  Download,
  FolderOpen,
  HardDrive,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Users
} from "lucide-react";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { directionLabel } from "@taklifiy/lib/catalog";
import { auditTime, cellAudit } from "@taklifiy/lib/audit";
import { downloadText } from "@taklifiy/lib/format";
import { parseSharedDraft } from "@taklifiy/lib/storage";
import type { CellRefState, DraftRow } from "@taklifiy/lib/draft-rows";
import { AuditTable, CellHistoryModal } from "./audit-history";
import { DraftMatrix } from "./draft-matrix";
import { Badge, Button, Field, Modal } from "./ui";

export function DraftsPanel({ c }: { c: ProposalController }) {
  const [deleting, setDeleting] = useState<DraftRow | null>(null);
  const [resetting, setResetting] = useState(false);
  const [historyCell, setHistoryCell] = useState<CellRefState>(null);
  const [name, setName] = useState(c.sharedDraft.name);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = c.sharedDraft;
  const direction = directionLabel(c, c.context.directionId);
  const rowCount =
    c.input.datasets.reduce((n, d) => n + d.employees.length, 0) - draft.removed.length;
  useEffect(() => setName(draft.name), [draft.name]);
  const historyEntries = historyCell
    ? cellAudit(c.audit, historyCell.kpiGroupId, historyCell.key)
    : [];

  return (
    <div className="animate-enter space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Users size={17} className="text-brand-600" /> Hamma uchun bitta umumiy draft
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#8c9b91]">
              Har davr va yo‘nalish uchun faqat bitta jadval. Shaxsiy nusxalar yo‘q: har bir tahrir,
              o‘chirish va tiklash darhol saqlanadi hamda kim/qachon/nima jurnaliga yoziladi.
            </p>
          </div>
          <Badge tone="green" className="shrink-0">
            <Users size={11} /> UMUMIY · {c.auditActor}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="DRAFT NOMI">
            <div className="flex gap-1.5">
              <input
                className="field h-9 text-[11px]"
                aria-label="Draft nomi"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && c.renameDraft(name)}
              />
              <Button
                aria-label="Nomni saqlash"
                className="h-9 px-2.5"
                disabled={!name.trim() || name.trim() === draft.name}
                onClick={() => c.renameDraft(name)}
              >
                <Save size={13} />
              </Button>
            </div>
          </Field>
          <div className="rounded-lg bg-[#f7faf8] p-3">
            <p className="text-[9px] font-semibold tracking-wide text-[#8b9a90]">
              DAVR / YO‘NALISH
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#4c6256]">
              <CalendarDays size={12} /> {periodLabel(c.context.target)}
            </p>
            <p className="mt-0.5 text-[10px] text-[#98a69c]">
              {direction} · manba {periodLabel(c.context.source)}
            </p>
          </div>
          <div className="rounded-lg bg-[#f7faf8] p-3">
            <p className="text-[9px] font-semibold tracking-wide text-[#8b9a90]">OXIRGI SAQLASH</p>
            <p className="mt-1 text-[11px] font-semibold text-[#4c6256]">
              {auditTime(draft.savedAt)}
            </p>
            <p className="mt-0.5 text-[10px] text-[#98a69c]">
              {draft.updatedBy} · {rowCount} qator · {c.audit.length} yozuv
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!c.draftId || c.saving}
            onClick={() => void c.applyDraft()}
          >
            <Save size={13} /> Draft targetlarga yozish
          </Button>
          <Button onClick={() => c.setTab("calculator")}>
            <Pencil size={13} /> Hisob-kitob sahifasida tahrirlash
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <FolderOpen size={13} /> JSON import
          </Button>
          <Button
            title="JSON yuklab olish"
            onClick={() =>
              downloadText(
                `salec-umumiy-draft-${draft.key.replace(/:/g, "-")}.json`,
                JSON.stringify(draft, null, 2),
                "application/json"
              )
            }
          >
            <Download size={13} /> JSON eksport
          </Button>
          <Button variant="ghost" className="hover:text-red-600" onClick={() => setResetting(true)}>
            <Trash2 size={13} /> Draftni tozalash
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Draft JSON fayli"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000) throw new Error("Fayl 5 MB dan katta bo‘lmasin");
                c.importDraft(parseSharedDraft(await file.text()));
              } catch (err) {
                c.notify(err instanceof Error ? err.message : "Import xatosi", "error");
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-[11px] leading-5 text-sky-800">
          <HardDrive size={15} className="mt-0.5 shrink-0" />
          <p>
            Draft <strong>serverda</strong> saqlanadi (davr + yo‘nalish uchun bitta). Apply faqat
            maqsad reja/target <strong>draft</strong> bo‘lsa ishlaydi — approved/pending overwrite
            qilinmaydi.
          </p>
        </div>
      </section>

      <DraftMatrix c={c} onDelete={setDeleting} onHistory={setHistoryCell} />

      {draft.removed.length > 0 && (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#5d7264]">
              O‘chirilgan qatorlar: {draft.removed.length} ta
            </p>
            <Button onClick={c.restoreAllRows}>
              <RotateCcw size={13} /> Barchasini tiklash
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draft.removed.map((r) => {
              const employee = c.input.datasets
                .find((d) => d.kpiGroupId === r.kpiGroupId)
                ?.employees.find((e) => employeeKey(e.employeeId, e.workSlotId) === r.key);
              const employeeName = employee?.name ?? r.key;
              return (
                <button
                  key={`${r.kpiGroupId}:${r.key}`}
                  aria-label={`${employeeName} KPI ${r.kpiGroupId} qatorini tiklash`}
                  className="flex items-center gap-1 rounded-md border border-[#e1e8e3] bg-[#f8faf9] px-2 py-1 text-[10px] text-[#6d8375] hover:border-brand-300 hover:text-brand-700"
                  onClick={() => c.restoreDraftRow(r.kpiGroupId, r.key, employeeName)}
                >
                  <RotateCcw size={10} /> {employeeName} · KPI {r.kpiGroupId}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <AuditTable audit={c.audit} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Qatorni o‘chirish?"
        subtitle={
          deleting ? `${deleting.employeeName} · ${deleting.kpiName} — umumiy draftdan olinadi` : ""
        }
      >
        <p className="text-xs leading-5 text-[#839388]">
          Qator jadvaldan olib tashlanadi, lekin hisob qoidalari va audit tarixi saqlanadi. Istalgan
          vaqt «O‘chirilgan qatorlar» bo‘limidan tiklash mumkin.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setDeleting(null)}>Bekor qilish</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting)
                c.deleteDraftRow(deleting.kpiGroupId, deleting.key, deleting.employeeName);
              setDeleting(null);
            }}
          >
            O‘chirish
          </Button>
        </div>
      </Modal>

      <Modal
        open={resetting}
        onClose={() => setResetting(false)}
        title="Umumiy draftni tozalash?"
        subtitle={`${draft.name} · barcha qatorlar va tarix qayta yaratiladi`}
      >
        <p className="text-xs leading-5 text-[#839388]">
          Bu amalni ortga qaytarib bo‘lmaydi. Kerakli bo‘lsa, avval JSON nusxasini yuklab oling.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setResetting(false)}>Bekor qilish</Button>
          <Button
            variant="danger"
            onClick={() => {
              c.deleteDraft();
              setResetting(false);
            }}
          >
            Tozalash
          </Button>
        </div>
      </Modal>

      <CellHistoryModal
        open={Boolean(historyCell)}
        onClose={() => setHistoryCell(null)}
        employeeName={historyCell?.employeeName ?? ""}
        kpiGroupId={historyCell?.kpiGroupId ?? 0}
        entries={historyEntries}
      />
    </div>
  );
}

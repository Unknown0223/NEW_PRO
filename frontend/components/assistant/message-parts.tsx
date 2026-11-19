"use client";

import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import type { AiAction, AiDenied, AiExportLink, AiTableResult, QuickPrompt } from "@/components/assistant/types";
import { AiSpark } from "@/components/assistant/brand";
import { cn } from "@/lib/utils";

export const PROMPT_ICONS: Record<string, typeof Sparkles> = {
  layout: Sparkles,
  trend: ArrowUpRight,
  users: CheckCircle2,
  file: FileSpreadsheet,
  wallet: RefreshCw,
  pie: RefreshCw,
  box: FileSpreadsheet,
  shield: ShieldCheck
};

function toneForCell(cell: string) {
  if (/kritik|xavf|kechik|tasdiq kutmoqda|kutilmoqda/i.test(cell)) return "text-[#d97746]";
  if (/kam|ogohlantir|limit/i.test(cell)) return "text-[var(--ai-amber)]";
  if (/yetarli|o‘sish|tasdiqlangan|yetkazildi|barqaror|bajarildi/i.test(cell)) {
    return "text-[var(--ai-teal)]";
  }
  return "text-[var(--ai-muted)]";
}

export function TableView({
  table,
  onCopy
}: {
  table: AiTableResult;
  onCopy?: (t: AiTableResult) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--ai-line)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ai-line)] bg-[var(--ai-surface-2)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[12px] font-semibold text-[var(--ai-text)]">{table.title}</p>
          <span className="shrink-0 rounded-full bg-[var(--ai-surface)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--ai-faint)]">
            {table.rows.length} qator
          </span>
        </div>
        <div className="flex items-center gap-2">
          {table.summary ? (
            <span className="hidden text-[10px] text-[var(--ai-faint)] sm:inline">{table.summary}</span>
          ) : null}
          {onCopy ? (
            <button
              type="button"
              onClick={() => onCopy(table)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--ai-line)] bg-[var(--ai-surface)] px-2 py-1 text-[9.5px] font-semibold text-[var(--ai-muted)] transition hover:text-[var(--ai-teal)]"
            >
              <Copy size={11} /> Jadvalni nusxalash
            </button>
          ) : null}
        </div>
      </div>
      <div className="ai-scroll overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[var(--ai-faint)]">
              {table.columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-[var(--ai-line)] px-4 py-2 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="transition-colors hover:bg-[var(--ai-surface-2)]">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "whitespace-nowrap border-b border-[var(--ai-line)] px-4 py-2.5 last:border-b-0",
                      ci === 0 ? "font-semibold text-[var(--ai-text)]" : toneForCell(cell)
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.truncated ? (
        <div className="border-t border-[var(--ai-line)] bg-[var(--ai-surface-2)] px-4 py-2 text-[10.5px] text-[var(--ai-muted)]">
          Qatorlar cheklangan. To‘liq ma’lumot uchun eksportdan foydalaning.
        </div>
      ) : null}
    </div>
  );
}

export function ExportButton({ data }: { data: AiExportLink }) {
  return (
    <a
      href={data.url}
      download
      className="group mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#bfe4dc] bg-[var(--ai-teal-soft)] p-3 text-left transition-all hover:border-[var(--ai-teal)]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0f9d89] text-white">
        <FileSpreadsheet size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-[var(--ai-text)]">
          Excel / CSV eksport tayyor
        </span>
        <span className="block truncate text-[10px] text-[var(--ai-muted)]">
          {data.format.toUpperCase()} · {data.rows} qator
          {data.truncated ? " · cheklangan" : ""}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ai-teal)]">
        <Download size={13} /> Yuklab olish
      </span>
    </a>
  );
}

export function ActionCard({
  action,
  resolved,
  busy,
  onConfirm,
  onCancel
}: {
  action: AiAction;
  resolved?: "done" | "cancelled";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#f0d59c] bg-[#fffaf0] p-4 dark:border-[#6b5526] dark:bg-[#2d2718]">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e09b25]/20 text-[var(--ai-amber)]">
          <ShieldCheck size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-[var(--ai-text)]">{action.title}</p>
          <p className="mt-0.5 text-[11px] text-[var(--ai-muted)]">{action.summary}</p>
        </div>
      </div>
      {action.rows?.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#f0d59c] dark:border-[#6b5526]">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr>
                {action.columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-[#f0d59c] px-3 py-2 font-semibold text-[var(--ai-muted)] dark:border-[#6b5526]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {action.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[#f0d59c] last:border-b-0 dark:border-[#6b5526]">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2",
                        ci === 0 ? "font-medium text-[var(--ai-muted)]" : "font-semibold text-[var(--ai-text)]"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-2.5 text-[10px] leading-relaxed text-[var(--ai-muted)]">
        Amal faqat bitta martalik token bilan bajariladi va ruxsat bo‘yicha tekshiriladi.
      </p>
      {resolved ? (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold",
            resolved === "done"
              ? "bg-[var(--ai-teal-soft)] text-[var(--ai-teal)]"
              : "bg-[var(--ai-surface-2)] text-[var(--ai-muted)]"
          )}
        >
          {resolved === "done" ? <CheckCircle2 size={14} /> : <X size={14} />}
          {resolved === "done"
            ? "Amal bajarildi va audit jurnaliga yozildi"
            : "Amal bekor qilindi — hech narsa o‘zgarmadi"}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-[#e09b25] px-3.5 py-2 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Check size={14} /> Tasdiqlash
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-xl border border-[#e6cf9e] bg-white/60 px-3.5 py-2 text-[11px] font-semibold text-[var(--ai-muted)] transition hover:bg-white disabled:opacity-50 dark:bg-transparent"
          >
            <X size={14} /> Bekor qilish
          </button>
        </div>
      )}
    </div>
  );
}

export function DeniedBanner({ denied }: { denied: AiDenied[] }) {
  if (!denied.length) return null;
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="text-[11px] text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Ruxsat cheklangan:</p>
          <ul className="mt-1 list-inside list-disc text-[10.5px]">
            {denied.map((d) => (
              <li key={d.tool}>
                {d.tool}: {d.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PromptCard({
  prompt,
  onClick
}: {
  prompt: QuickPrompt;
  onClick: (text: string) => void;
}) {
  const Icon = PROMPT_ICONS[prompt.icon] ?? Sparkles;
  return (
    <button
      type="button"
      onClick={() => onClick(prompt.text)}
      className="group flex items-center gap-2.5 rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#8fd6c9] hover:shadow-[var(--ai-shadow-sm)]"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ai-teal-soft)] text-[var(--ai-teal)] transition group-hover:bg-[#0f9d89] group-hover:text-white">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-[var(--ai-text)]">
          {prompt.short}
        </span>
        <span className="mt-0.5 block text-[9.5px] text-[var(--ai-faint)]">{prompt.group} bo‘limi</span>
      </span>
      <ArrowUpRight
        size={13}
        className="shrink-0 text-[var(--ai-faint)] transition group-hover:text-[var(--ai-teal)]"
      />
    </button>
  );
}

export function TypingIndicator() {
  return (
    <div className="ai-fade-in flex gap-3">
      <div className="relative mt-0.5">
        <div className="ai-pulse-ring absolute inset-0 rounded-xl bg-[#35c8ae]/30" />
        <div className="relative flex size-8 items-center justify-center rounded-xl bg-[#16233f] text-white">
          <AiSpark size={16} />
        </div>
      </div>
      <div className="ai-panel flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ai-typing-dot size-1.5 rounded-full bg-[var(--ai-teal)]"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <span className="text-[11px] text-[var(--ai-muted)]">
          So‘rov tushinilmoqda · ruxsat tekshirilmoqda · ma&apos;lumot yig‘ilmoqda…
        </span>
      </div>
    </div>
  );
}

"use client";

import { Check, CheckCircle2, Copy, Database, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { AiSpark, SalecAiIcon } from "@/components/assistant/brand";
import {
  ActionCard,
  DeniedBanner,
  ExportButton,
  TableView
} from "@/components/assistant/message-parts";
import type { AiAction, AiTableResult, ChatMessage } from "@/components/assistant/types";
import { cn } from "@/lib/utils";

export function UserBubble({
  text,
  time,
  initials
}: {
  text: string;
  time: string;
  initials: string;
}) {
  return (
    <div className="ai-fade-up flex justify-end gap-2">
      <div className="max-w-[82%]">
        <div className="ai-bubble-user rounded-2xl rounded-br-md px-4 py-3 text-[12.5px] leading-relaxed text-white">
          {text}
        </div>
        <p className="mt-1 text-right text-[9.5px] text-[var(--ai-faint)]">{time} · siz</p>
      </div>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4d8ff0] to-[#1e63c9] text-[10px] font-bold text-white">
        {initials}
      </span>
    </div>
  );
}

export function AssistantMessage({
  message,
  resolved,
  copied,
  liked,
  busy,
  onCopy,
  onRegenerate,
  onLike,
  onConfirm,
  onCancel,
  onTableCopy
}: {
  message: ChatMessage;
  resolved?: "done" | "cancelled";
  copied: boolean;
  liked: "up" | "down" | null;
  busy?: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onLike: (v: "up" | "down") => void;
  onConfirm: (action: AiAction) => void;
  onCancel: () => void;
  onTableCopy: (t: AiTableResult) => void;
}) {
  const answer = message.answer;

  if (!answer) {
    return (
      <div className="ai-fade-up flex gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ai-teal-soft)] text-[var(--ai-teal)]">
          <CheckCircle2 size={16} />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--ai-line)] bg-[var(--ai-surface-2)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[var(--ai-text)]">
          {message.text}
        </div>
      </div>
    );
  }

  /* summary va lines ko‘pincha bir xil — ikkalasini qo‘shib takrorlamaslik. */
  const textBlocks = (answer.summary.length ? answer.summary : answer.lines).filter(Boolean);
  const lead = textBlocks[0] || message.text;
  const paragraphs = textBlocks.slice(1);
  const sources = answer.meta?.tools?.length
    ? answer.meta.tools
    : answer.intent
      ? [answer.intent]
      : [];
  const confirmAction =
    answer.actions?.length && !answer.denied?.length ? answer.actions[0] : null;

  return (
    <div className="ai-fade-up flex gap-3">
      <div className="relative mt-0.5">
        <div className="absolute -inset-1 rounded-2xl bg-[#35c8ae]/20 blur-[6px]" />
        <div className="relative overflow-hidden rounded-[12px] border border-white/20 bg-[#16233f]">
          <SalecAiIcon size={32} rounded={false} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-[var(--ai-text)]">SALEC AI</span>
          <span className="rounded-full bg-[var(--ai-teal-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--ai-teal)]">
            tahlil tugallandi
          </span>
          {answer.intent ? (
            <code className="rounded-md bg-[var(--ai-surface-2)] px-1.5 py-0.5 text-[9px] text-[var(--ai-faint)]">
              {answer.intent}
            </code>
          ) : null}
          <span className="ml-auto text-[10px] text-[var(--ai-faint)]">{message.time}</span>
        </div>

        <div className="ai-panel p-4 sm:p-5">
          {answer.denied?.length ? <DeniedBanner denied={answer.denied} /> : null}

          <div className="flex items-start gap-2">
            <AiSpark size={17} className="mt-0.5 text-[var(--ai-teal)]" />
            <h3 className="text-[15px] font-bold leading-snug tracking-tight text-[var(--ai-text)]">
              {answer.title || "Javob"}
            </h3>
          </div>
          {lead ? (
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ai-muted)]">
              {lead}
            </p>
          ) : null}
          {paragraphs.map((p, i) => (
            <p
              key={`${i}-${p.slice(0, 24)}`}
              className="mt-2.5 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ai-muted)]"
            >
              {p}
            </p>
          ))}

          {answer.groups?.map((group, gi) => (
            <TableView
              key={`g-${gi}-${group.title}-${group.columns.join("-")}`}
              table={group}
              onCopy={onTableCopy}
            />
          ))}
          {answer.export ? <ExportButton data={answer.export} /> : null}
          {confirmAction ? (
            <ActionCard
              action={confirmAction}
              resolved={resolved}
              busy={busy}
              onConfirm={() => onConfirm(confirmAction)}
              onCancel={onCancel}
            />
          ) : null}

          {sources.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--ai-line)] pt-3">
              <Database size={12} className="mr-0.5 text-[var(--ai-faint)]" />
              {sources.map((src) => (
                <code
                  key={src}
                  className="rounded-md bg-[var(--ai-surface-2)] px-1.5 py-1 text-[9px] text-[var(--ai-faint)]"
                >
                  {src}
                </code>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-medium text-[var(--ai-muted)] transition hover:bg-[var(--ai-surface-2)] hover:text-[var(--ai-teal)]"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Nusxalandi" : "Nusxalash"}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-medium text-[var(--ai-muted)] transition hover:bg-[var(--ai-surface-2)] hover:text-[var(--ai-teal)]"
            >
              <RefreshCw size={13} /> Qayta so‘rash
            </button>
            <span className="mx-1 h-3 w-px bg-[var(--ai-line)]" />
            <button
              type="button"
              onClick={() => onLike("up")}
              className={cn(
                "rounded-lg p-1.5 transition hover:bg-[var(--ai-surface-2)]",
                liked === "up" ? "text-[var(--ai-teal)]" : "text-[var(--ai-faint)]"
              )}
              aria-label="Foydali"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => onLike("down")}
              className={cn(
                "rounded-lg p-1.5 transition hover:bg-[var(--ai-surface-2)]",
                liked === "down" ? "text-[#cf6242]" : "text-[var(--ai-faint)]"
              )}
              aria-label="Foydasiz"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

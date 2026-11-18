"use client";

import { type Ref } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { AiSpark } from "@/components/assistant/brand";
import { PROMPT_GROUPS, QUICK_PROMPTS } from "@/components/assistant/prompts";
import { cn } from "@/lib/utils";

export function AssistantComposer({
  input,
  setInput,
  group,
  setGroup,
  busy,
  confirmPending,
  inputRef,
  onSend
}: {
  input: string;
  setInput: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  busy: boolean;
  confirmPending: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  onSend: (text: string) => void;
}) {
  const filtered =
    group === "Barchasi"
      ? QUICK_PROMPTS.slice(0, 4)
      : QUICK_PROMPTS.filter((p) => p.group === group).slice(0, 4);

  return (
    <div className="border-t border-[var(--ai-line)] bg-[var(--ai-surface-2)]/60 px-4 pb-3 pt-2.5 sm:px-5">
      <div className="ai-no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
        {PROMPT_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition",
              group === g
                ? "border-[#0f9d89] bg-[#0f9d89] text-white shadow-[0_6px_16px_-8px_rgba(15,157,137,0.9)]"
                : "ai-chip"
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {filtered.map((p) => (
          <button
            key={p.text}
            type="button"
            disabled={busy || confirmPending}
            onClick={() => onSend(p.text)}
            className="ai-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium disabled:opacity-50"
          >
            <AiSpark size={11} className="text-[var(--ai-teal)]" /> {p.short}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--ai-line-strong)] bg-[var(--ai-surface)] p-2 transition focus-within:border-[#8fd6c9] focus-within:ring-2 focus-within:ring-[#0f9d89]/10">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
          rows={2}
          disabled={busy || confirmPending}
          placeholder="Savol bering: masalan, «Bugun savdo qancha bo‘ldi?»"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-[12.5px] leading-relaxed text-[var(--ai-text)] outline-none placeholder:text-[var(--ai-faint)] disabled:opacity-60"
        />
        <div className="flex items-center gap-1.5 border-t border-[var(--ai-line)] pt-2">
          <span className="hidden text-[9.5px] text-[var(--ai-faint)] sm:inline">Enter — yuborish</span>
          <span className="ml-auto text-[9.5px] text-[var(--ai-faint)]">{input.length}/500</span>
          <button
            type="button"
            onClick={() => onSend(input)}
            disabled={!input.trim() || busy || confirmPending}
            className="ai-send-btn flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-white transition"
          >
            <Send size={13} /> Yuborish
          </button>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-center text-[9px] text-[var(--ai-faint)]">
        <ShieldCheck size={10} className="text-[var(--ai-teal)]" />
        O‘qish amallari avtomatik · yozish amallari tasdiq va audit talab qiladi · ma&apos;lumot
        dilerdan tashqariga chiqmaydi
      </p>
    </div>
  );
}

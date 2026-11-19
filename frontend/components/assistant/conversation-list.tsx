"use client";

import { Clock3, History, LockKeyhole, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";
import type { Conversation, ConversationGroup } from "@/components/assistant/types";
import { cn } from "@/lib/utils";

const GROUPS: ConversationGroup[] = ["Bugun", "Kecha", "Oldingi"];

export function ConversationList({
  conversations,
  activeId,
  search,
  onSearch,
  onSelect,
  onDelete,
  onNew,
  onClear
}: {
  conversations: Conversation[];
  activeId: number;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
  onClear: () => void;
}) {
  const q = search.toLocaleLowerCase("uz");
  const filtered = conversations.filter((c) => {
    if (!q) return true;
    return (
      c.title.toLocaleLowerCase("uz").includes(q) ||
      c.messages.some((m) =>
        (m.text || m.answer?.title || "").toLocaleLowerCase("uz").includes(q)
      )
    );
  });

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--ai-line)] px-3.5 py-3">
        <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--ai-teal-soft)] text-[var(--ai-teal)]">
          <History size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[12.5px] font-bold text-[var(--ai-text)]">Suhbatlar</h2>
          <p className="text-[9.5px] text-[var(--ai-faint)]">{conversations.length} ta yozishma</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          title="Yangi suhbat"
          className="flex size-8 items-center justify-center rounded-xl bg-[#16233f] text-white transition hover:bg-[#1e63c9]"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="px-2.5 pb-2 pt-2.5">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ai-faint)]"
          />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Suhbatlardan qidirish…"
            className="h-8 w-full rounded-lg border border-[var(--ai-line)] bg-[var(--ai-surface-2)] pl-8 pr-7 text-[10.5px] text-[var(--ai-text)] outline-none transition focus:border-[#8fd6c9]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--ai-faint)] hover:text-[#cf6242]"
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="ai-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-8 text-center">
            <Search size={20} className="text-[var(--ai-faint)]" />
            <p className="mt-2 text-[11px] font-semibold text-[var(--ai-text)]">Suhbat topilmadi</p>
            <p className="mt-0.5 text-[9.5px] text-[var(--ai-faint)]">Boshqa so‘z bilan qidirib ko‘ring</p>
          </div>
        ) : null}

        {GROUPS.map((group) => {
          const items = filtered.filter((c) => c.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-2.5">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-[var(--ai-faint)]">
                  {group}
                </p>
                <span className="rounded bg-[var(--ai-surface-2)] px-1 text-[8.5px] font-semibold text-[var(--ai-faint)]">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1">
                {items.map((c) => {
                  const active = c.id === activeId;
                  const last = c.messages[c.messages.length - 1];
                  const snippet = last
                    ? last.role === "assistant"
                      ? last.answer?.title || last.text
                      : last.text
                    : "Yangi suhbat — savolingizni yozing";
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "group relative rounded-xl border p-2.5 transition",
                        active
                          ? "border-[#a5ded2] bg-[var(--ai-teal-soft)] shadow-[0_8px_18px_-16px_rgba(15,157,137,0.9)]"
                          : "border-transparent hover:border-[var(--ai-line)] hover:bg-[var(--ai-surface-2)]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg",
                            active
                              ? "bg-[#0f9d89] text-white"
                              : "bg-[var(--ai-surface-3)] text-[var(--ai-teal)]"
                          )}
                        >
                          <MessageSquare size={12} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate pr-4 text-[11px] font-semibold text-[var(--ai-text)]">
                            {c.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[9.5px] text-[var(--ai-faint)]">
                            {snippet}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[8.5px] text-[var(--ai-faint)]">
                            <Clock3 size={9} /> {c.time}
                            <span className="text-[var(--ai-line-strong)]">•</span>
                            {c.messages.filter((m) => m.role === "user").length} savol
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        title="Suhbatni o‘chirish"
                        className="absolute right-1.5 top-1.5 hidden size-6 items-center justify-center rounded-lg bg-[var(--ai-surface)] text-[var(--ai-faint)] transition hover:text-[#cf6242] group-hover:flex"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--ai-line)] p-2.5">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--ai-teal-soft)] py-2 text-[10.5px] font-bold text-[var(--ai-teal)] transition hover:bg-[#d2f0e9] dark:hover:bg-[#1c5a50]"
        >
          <Plus size={13} /> Yangi suhbat boshlash
        </button>
        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="inline-flex items-center gap-1 text-[8.5px] text-[var(--ai-faint)]">
            <LockKeyhole size={9} /> Tarix brauzerda
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[8.5px] font-medium text-[var(--ai-faint)] transition hover:text-[#cf6242]"
          >
            <Trash2 size={9} /> Tozalash
          </button>
        </div>
      </div>
    </>
  );
}

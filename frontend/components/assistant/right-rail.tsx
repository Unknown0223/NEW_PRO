"use client";

import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  LockKeyhole,
  Package,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet
} from "lucide-react";
import { CAPABILITIES, SECTION_ACCESS } from "@/components/assistant/prompts";
import { PROMPT_ICONS } from "@/components/assistant/message-parts";
import { cn } from "@/lib/utils";

export function AssistantRightRail({ onAsk }: { onAsk: (text: string) => void }) {
  return (
    <aside className="hidden min-w-0 flex-col gap-4 2xl:flex">
      <div className="ai-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes size={14} className="text-[var(--ai-teal)]" />
            <h3 className="text-[12px] font-bold text-[var(--ai-text)]">Bo‘limlar qamrovi</h3>
          </div>
          <span className="rounded-full bg-[var(--ai-teal-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--ai-teal)]">
            {SECTION_ACCESS.length} ta
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SECTION_ACCESS.map((section) => {
            const Icon = PROMPT_ICONS[section.icon] ?? Sparkles;
            return (
              <button
                key={section.name}
                type="button"
                onClick={() => onAsk(section.question)}
                title={section.question}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-[var(--ai-line)] bg-[var(--ai-surface-2)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--ai-muted)] transition hover:border-[#8fd6c9] hover:bg-[var(--ai-teal-soft)] hover:text-[var(--ai-teal)]"
              >
                <Icon size={11} /> {section.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes size={14} className="text-[var(--ai-teal)]" />
            <h3 className="text-[12px] font-bold text-[var(--ai-text)]">Nima qila oladi</h3>
          </div>
          <span className="text-[9px] text-[var(--ai-faint)]">9 bo‘lim</span>
        </div>
        <div className="space-y-1.5">
          {CAPABILITIES.map((c) => {
            const Icon =
              c.icon === "trend"
                ? TrendingUp
                : c.icon === "wallet"
                  ? Wallet
                  : c.icon === "box"
                    ? Package
                    : ShieldCheck;
            return (
              <button
                key={c.title}
                type="button"
                onClick={() => onAsk(c.question)}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition hover:border-[var(--ai-line)] hover:bg-[var(--ai-surface-2)]"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-xl",
                    c.tone === "teal"
                      ? "bg-[var(--ai-teal-soft)] text-[var(--ai-teal)]"
                      : c.tone === "blue"
                        ? "bg-[#e6efff] text-[#1e63c9] dark:bg-[#1c3558]"
                        : c.tone === "amber"
                          ? "bg-[#fff2dc] text-[#e09b25] dark:bg-[#3b3020]"
                          : "bg-[#f0eaff] text-[#7c5cd6] dark:bg-[#2d2745]"
                  )}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-[var(--ai-text)]">{c.title}</span>
                  <span className="block truncate text-[9.5px] text-[var(--ai-faint)]">{c.desc}</span>
                </span>
                <ChevronRight
                  size={13}
                  className="text-[var(--ai-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ai-teal)]"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-panel p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={14} className="text-[var(--ai-teal)]" />
          <h3 className="text-[12px] font-bold text-[var(--ai-text)]">Xavfsizlik</h3>
        </div>
        <div className="space-y-2">
          {[
            "Faqat diler ma'lumotlari (tenant izolyatsiyasi)",
            "Ruxsat (RBAC) tekshiruvi har bir so‘rovda",
            "Yozish amallari token + tasdiq bilan",
            "Barcha so‘rovlar audit jurnalida"
          ].map((t) => (
            <div key={t} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--ai-teal)]" />
              <span className="text-[10.5px] leading-snug text-[var(--ai-muted)]">{t}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--ai-teal-soft)] px-3 py-2 text-[10px] font-semibold text-[var(--ai-teal)]">
          <LockKeyhole size={12} /> Ma&apos;lumot diler konturi ichida qoladi
        </div>
      </div>
    </aside>
  );
}

export function AssistantMobileSections({ onAsk }: { onAsk: (text: string) => void }) {
  return (
    <section className="ai-panel p-4 2xl:hidden">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes size={14} className="text-[var(--ai-teal)]" />
          <h3 className="text-[12px] font-bold text-[var(--ai-text)]">Bo‘limlar qamrovi</h3>
        </div>
        <span className="rounded-full bg-[var(--ai-teal-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--ai-teal)]">
          {SECTION_ACCESS.length} ta
        </span>
      </div>
      <div className="ai-no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SECTION_ACCESS.map((section) => {
          const Icon = PROMPT_ICONS[section.icon] ?? Sparkles;
          return (
            <button
              key={section.name}
              type="button"
              onClick={() => onAsk(section.question)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--ai-line)] bg-[var(--ai-surface-2)] px-3 py-2 text-[10.5px] font-semibold text-[var(--ai-muted)] transition hover:border-[#8fd6c9] hover:text-[var(--ai-teal)]"
            >
              <Icon size={12} /> {section.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

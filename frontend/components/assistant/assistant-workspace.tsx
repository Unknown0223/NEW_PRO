"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, History, LockKeyhole, MessageSquare, Plus, ShieldCheck, X } from "lucide-react";
import { Forbidden403 } from "@/components/access/forbidden-403";
import { AssistantMessage, UserBubble } from "@/components/assistant/assistant-message";
import { BrandLockup, AiSpark, SalecAiIcon } from "@/components/assistant/brand";
import { AssistantComposer } from "@/components/assistant/composer";
import { ConversationList } from "@/components/assistant/conversation-list";
import { PromptCard, TypingIndicator } from "@/components/assistant/message-parts";
import { QUICK_PROMPTS } from "@/components/assistant/prompts";
import { AssistantMobileSections, AssistantRightRail } from "@/components/assistant/right-rail";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { PageShell } from "@/components/dashboard/page-shell";
import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

function roleInitials(role: string | null) {
  if (!role) return "SZ";
  return role.slice(0, 2).toUpperCase();
}

export function AssistantWorkspace() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const router = useRouter();
  const { has, isLoading: permsLoading } = usePermissions();
  const canChat = role === "admin" || has("assistant.chat.view");
  const chat = useAssistantChat(slug);
  const initials = roleInitials(role);

  if (!permsLoading && !canChat) {
    return (
      <Forbidden403
        deniedPage="AI Yordamchi"
        onRefresh={() => router.refresh()}
        onBack={() => router.push("/dashboard")}
        onRequestAccess={() => router.push("/access")}
      />
    );
  }

  return (
    <PageShell className="assistant-workspace space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-[18px] bg-[#35c8ae]/20 blur-md" />
            <SalecAiIcon size={42} className="relative" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[21px] font-extrabold tracking-[-0.03em] text-[var(--ai-text)] sm:text-[23px]">
                AI Yordamchi
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#bfe4dc] bg-[var(--ai-teal-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--ai-teal)]">
                <span className="size-1.5 rounded-full bg-[var(--ai-teal)]" /> Lokal
              </span>
            </div>
            <p className="mt-0.5 max-w-[560px] text-[11.5px] leading-relaxed text-[var(--ai-muted)]">
              Savdo, qarz, kassa va ombor bo‘yicha savol bering — javob faqat sizning ruxsatingiz
              doirasidagi ma&apos;lumotdan olinadi.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { icon: LockKeyhole, label: "Tenant izolyatsiya" },
            { icon: ShieldCheck, label: "RBAC" },
            { icon: History, label: "Audit" }
          ].map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ai-line)] bg-[var(--ai-surface)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--ai-muted)]"
            >
              <b.icon size={11} className="text-[var(--ai-teal)]" /> {b.label}
            </span>
          ))}
          <button
            type="button"
            onClick={chat.newChat}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16233f] px-3 py-2 text-[10.5px] font-semibold text-white transition hover:bg-[#1e63c9]"
          >
            <Plus size={13} /> Yangi suhbat
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[252px_minmax(0,1fr)] 2xl:grid-cols-[252px_minmax(0,1fr)_296px]">
        <aside className="ai-panel sticky top-4 hidden h-[calc(100vh-168px)] min-h-[560px] max-h-[768px] flex-col overflow-hidden self-start lg:flex">
          <ConversationList
            conversations={chat.conversations}
            activeId={chat.activeId}
            search={chat.convSearch}
            onSearch={chat.setConvSearch}
            onSelect={(id) => {
              chat.setActiveId(id);
            }}
            onDelete={chat.deleteConversation}
            onNew={chat.newChat}
            onClear={chat.clearConversations}
          />
        </aside>

        <section className="ai-panel flex h-[calc(100vh-168px)] min-h-[560px] max-h-[768px] min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ai-line)] px-4 py-3 sm:px-5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--ai-teal-soft)] text-[var(--ai-teal)]">
              <MessageSquare size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[12.5px] font-bold text-[var(--ai-text)]">
                {chat.activeConversation?.title ?? "Yangi suhbat"}
              </h2>
              <p className="truncate text-[9.5px] text-[var(--ai-faint)]">
                {chat.messages.length
                  ? `${chat.messages.length} xabar · ${chat.activeConversation?.time}`
                  : "Savolingizni yozing yoki tayyor shablondan tanlang"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => chat.setConvOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ai-line)] px-2.5 py-2 text-[10.5px] font-medium text-[var(--ai-muted)] transition hover:bg-[var(--ai-surface-2)] lg:hidden"
              >
                <History size={13} /> Suhbatlar
              </button>
              <button
                type="button"
                onClick={chat.newChat}
                className="flex items-center gap-1.5 rounded-xl bg-[#16233f] px-3 py-2 text-[10.5px] font-semibold text-white transition hover:bg-[#1e63c9]"
              >
                <Plus size={13} /> <span className="hidden sm:inline">Yangi</span>
              </button>
            </div>
          </div>

          <div
            ref={chat.chatRef}
            onScroll={chat.handleChatScroll}
            className="ai-scroll relative min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5"
          >
            {chat.messages.length === 0 && !chat.busy ? (
              <div className="ai-fade-in flex h-full flex-col justify-center">
                <div className="mx-auto w-full max-w-[560px] text-center">
                  <div className="relative mx-auto mb-4 flex size-[62px] items-center justify-center">
                    <div className="absolute inset-0 rounded-[22px] bg-[#35c8ae]/15 blur-xl" />
                    <SalecAiIcon size={58} className="relative" />
                    <AiSpark
                      size={16}
                      className="ai-sparkle absolute -right-2 -top-1 text-[var(--ai-teal)]"
                    />
                  </div>
                  <h3 className="text-[18px] font-bold tracking-tight text-[var(--ai-text)]">
                    Yangi suhbat
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-[400px] text-[11.5px] leading-relaxed text-[var(--ai-muted)]">
                    Savdo, qarz, kassa yoki ombor bo‘yicha savol bering. Quyidagi tayyor
                    shablonlardan ham foydalanishingiz mumkin.
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
                    {QUICK_PROMPTS.slice(0, 6).map((p) => (
                      <PromptCard key={p.text} prompt={p} onClick={(t) => void chat.ask(t)} />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[var(--ai-faint)]">
                    <LockKeyhole size={12} /> Javoblar faqat sizning ruxsatingizdagi
                    ma&apos;lumotlardan shakllanadi
                  </div>
                </div>
              </div>
            ) : null}

            {chat.messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.text} time={m.time} initials={initials} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  resolved={chat.resolved[m.id]}
                  copied={chat.copiedId === m.id}
                  liked={chat.likes[m.id] ?? null}
                  busy={chat.busy}
                  onCopy={() => chat.handleCopy(m)}
                  onRegenerate={() =>
                    void chat.ask(chat.lastQuestion || chat.activeConversation?.title || "")
                  }
                  onLike={(v) => {
                    chat.setLikes((prev) => ({ ...prev, [m.id]: v }));
                    chat.setToast(
                      v === "up"
                        ? "Rahmat! Javob foydali deb belgilandi"
                        : "Rahmat! Javob sifatini oshiramiz"
                    );
                  }}
                  onTableCopy={chat.handleTableCopy}
                  onConfirm={(action) => void chat.confirmAction(m.id, action)}
                  onCancel={() => {
                    chat.setResolved((prev) => ({ ...prev, [m.id]: "cancelled" }));
                    chat.setToast("Amal bekor qilindi — hech narsa o‘zgarmadi");
                  }}
                />
              )
            )}
            {chat.busy ? <TypingIndicator /> : null}
            {!chat.atBottom ? (
              <button
                type="button"
                onClick={chat.scrollToBottom}
                className="ai-fade-in sticky bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--ai-line)] bg-[var(--ai-surface)] px-3 py-1.5 text-[10px] font-semibold text-[var(--ai-muted)] shadow-[var(--ai-shadow-sm)] transition hover:text-[var(--ai-teal)]"
              >
                <ChevronDown size={12} /> Pastga o‘tish
              </button>
            ) : null}
          </div>

          {chat.error ? (
            <p className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 sm:mx-5 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              {chat.error}
            </p>
          ) : null}

          <AssistantComposer
            input={chat.input}
            setInput={chat.setInput}
            group={chat.group}
            setGroup={chat.setGroup}
            busy={chat.busy}
            confirmPending={chat.hasPendingConfirm}
            inputRef={chat.inputRef}
            onSend={(t) => void chat.ask(t)}
          />
        </section>

        <AssistantRightRail onAsk={(t) => void chat.ask(t)} />
      </div>

      <AssistantMobileSections onAsk={(t) => void chat.ask(t)} />

      {chat.convOpen ? (
        <>
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => chat.setConvOpen(false)}
            className="fixed inset-0 z-[55] bg-[#0b1725]/60 backdrop-blur-sm lg:hidden"
          />
          <aside className="ai-panel ai-fade-in fixed inset-y-0 left-0 z-[60] flex w-[300px] max-w-[86vw] flex-col overflow-hidden rounded-none border-0 lg:hidden">
            <div className="flex items-center justify-between border-b border-[var(--ai-line)] px-3.5 py-2.5">
              <BrandLockup compact />
              <button
                type="button"
                onClick={() => chat.setConvOpen(false)}
                className="rounded-lg border border-[var(--ai-line)] p-1.5 text-[var(--ai-muted)]"
              >
                <X size={15} />
              </button>
            </div>
            <ConversationList
              conversations={chat.conversations}
              activeId={chat.activeId}
              search={chat.convSearch}
              onSearch={chat.setConvSearch}
              onSelect={(id) => {
                chat.setActiveId(id);
                chat.setConvOpen(false);
              }}
              onDelete={chat.deleteConversation}
              onNew={chat.newChat}
              onClear={chat.clearConversations}
            />
          </aside>
        </>
      ) : null}

      {chat.toast ? (
        <div className="ai-fade-up fixed bottom-5 right-5 z-[80] flex max-w-[340px] items-center gap-2.5 rounded-2xl border border-white/10 bg-[#16233f] px-4 py-3 text-[11.5px] font-medium text-white shadow-2xl">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#35c8ae]/20 text-[#5fe0c4]">
            <Check size={13} />
          </span>
          {chat.toast}
        </div>
      ) : null}
    </PageShell>
  );
}

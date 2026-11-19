"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import type {
  AiAction,
  AiAnswer,
  AiTableResult,
  ChatMessage,
  Conversation
} from "@/components/assistant/types";
import { formatChatTime, shortTitle } from "@/components/assistant/types";
import { api } from "@/lib/api";

function freshConversation(id: number): Conversation {
  return { id, title: "Yangi suhbat", group: "Bugun", time: "Hozir", messages: [] };
}

export function useAssistantChat(slug: string | null) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(() => [freshConversation(1)]);
  const [activeId, setActiveId] = useState(1);
  const [convSearch, setConvSearch] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [input, setInput] = useState("");
  const [group, setGroup] = useState("Barchasi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [likes, setLikes] = useState<Record<number, "up" | "down">>({});
  const [resolved, setResolved] = useState<Record<number, "done" | "cancelled">>({});
  const [lastQuestion, setLastQuestion] = useState("");
  const [atBottom, setAtBottom] = useState(true);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(1000);
  const nextConvId = useRef(2);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const hasPendingConfirm = messages.some(
    (m) =>
      m.role === "assistant" &&
      m.answer?.actions?.length &&
      !m.answer.denied?.length &&
      !resolved[m.id]
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const el = chatRef.current;
    if (el && atBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, atBottom, activeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConvOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!slug || !text || busy || hasPendingConfirm) return;
      const convId = activeConversation?.id;
      if (!convId) return;

      setInput("");
      setError("");
      setConvOpen(false);
      setAtBottom(true);
      setBusy(true);
      setLastQuestion(text);

      const userMsg: ChatMessage = {
        id: idRef.current++,
        role: "user",
        text,
        time: formatChatTime()
      };

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: c.messages.length === 0 ? shortTitle(text) : c.title,
                group: "Bugun" as const,
                time: "Hozir",
                messages: [...c.messages, userMsg]
              }
            : c
        );
        const current = updated.find((c) => c.id === convId);
        if (!current) return updated;
        return [current, ...updated.filter((c) => c.id !== convId)];
      });

      try {
        const res = await api.post<AiAnswer>(`/api/${slug}/ai/ask`, { question: text });
        const data = res.data;
        const fallback = [data.title, ...data.summary, ...data.lines].filter(Boolean).join("\n");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  time: formatChatTime(),
                  messages: [
                    ...c.messages,
                    {
                      id: idRef.current++,
                      role: "assistant" as const,
                      text: fallback,
                      answer: data,
                      time: formatChatTime()
                    }
                  ]
                }
              : c
          )
        );
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 403) {
          router.replace(`/forbidden?from=${encodeURIComponent("AI Yordamchi")}`);
          return;
        }
        setError("Javob olinmadi. Server va AI sozlamalarini tekshiring.");
      } finally {
        setBusy(false);
      }
    },
    [slug, busy, hasPendingConfirm, activeConversation?.id, router]
  );

  async function confirmAction(messageId: number, action: AiAction) {
    if (!slug || busy || !activeConversation) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AiAnswer>(`/api/${slug}/ai/confirm`, { token: action.token });
      const data = res.data;
      const body = [data.title, ...data.summary, ...data.lines].filter(Boolean).join("\n");
      setResolved((prev) => ({ ...prev, [messageId]: "done" }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: idRef.current++,
                    role: "assistant" as const,
                    system: true,
                    text: body || `«${action.title}» amali tasdiqlandi va bajarildi.`,
                    answer: data,
                    time: formatChatTime()
                  }
                ]
              }
            : c
        )
      );
      setToast("Amal bajarildi · audit jurnaliga yozildi");
    } catch {
      setError("Tasdiqlash bajarilmadi. Qaytadan urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    if (busy) return;
    setError("");
    setInput("");
    setConvOpen(false);
    setAtBottom(true);
    if (activeConversation && activeConversation.messages.length === 0) {
      setToast("Yangi suhbat allaqachon ochiq");
      inputRef.current?.focus();
      return;
    }
    const fresh = freshConversation(nextConvId.current++);
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setToast("Yangi suhbat boshlandi");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function deleteConversation(id: number) {
    const rest = conversations.filter((c) => c.id !== id);
    if (activeId === id) {
      if (rest.length) {
        setActiveId(rest[0].id);
      } else {
        const fresh = freshConversation(nextConvId.current++);
        setConversations([fresh]);
        setActiveId(fresh.id);
        setToast("Suhbat o‘chirildi");
        return;
      }
    }
    setConversations(rest);
    setToast("Suhbat tarixdan o‘chirildi");
  }

  function clearConversations() {
    const fresh = freshConversation(nextConvId.current++);
    setConversations([fresh]);
    setActiveId(fresh.id);
    setConvSearch("");
    setResolved({});
    setLikes({});
    setToast("Suhbatlar tarixi tozalandi");
  }

  function handleCopy(message: ChatMessage) {
    const a = message.answer;
    const text = a
      ? [a.title, ...a.summary, ...a.lines].filter(Boolean).join("\n\n")
      : message.text;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1800);
    setToast("Javob nusxalandi");
  }

  function handleTableCopy(table: AiTableResult) {
    const text = [table.columns, ...table.rows].map((row) => row.join("\t")).join("\n");
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setToast(`«${table.title}» jadvali nusxalandi`);
  }

  function handleChatScroll() {
    const el = chatRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  }

  function scrollToBottom() {
    setAtBottom(true);
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }

  return {
    conversations,
    activeId,
    setActiveId,
    convSearch,
    setConvSearch,
    convOpen,
    setConvOpen,
    input,
    setInput,
    group,
    setGroup,
    busy,
    error,
    toast,
    copiedId,
    likes,
    setLikes,
    setToast,
    resolved,
    setResolved,
    lastQuestion,
    atBottom,
    chatRef,
    inputRef,
    activeConversation,
    messages,
    hasPendingConfirm,
    ask,
    confirmAction,
    newChat,
    deleteConversation,
    clearConversations,
    handleCopy,
    handleTableCopy,
    handleChatScroll,
    scrollToBottom
  };
}

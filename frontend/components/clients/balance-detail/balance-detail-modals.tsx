"use client";

import { X } from "lucide-react";
import { fmtDateTime, fmtMoney, fmtUZS } from "@/lib/client-balance-detail/format";
import type { BalanceDetailColumnDef, BalanceDetailRow } from "@/lib/client-balance-detail/types";

export function BalanceDetailTransactionModal({
  row,
  onClose
}: {
  row: BalanceDetailRow | null;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#333]">{row.typeLabel}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f0f0f0]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="space-y-2 px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Дата</dt>
            <dd>{fmtDateTime(row.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Долг</dt>
            <dd className="tabular-nums text-red-600">{row.debt ? fmtMoney(Math.abs(row.debt)) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Оплата</dt>
            <dd className="tabular-nums text-[#1aa096]">{row.payment ? fmtMoney(row.payment) : "—"}</dd>
          </div>
          {row.balanceAfter != null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[#888]">Баланс после</dt>
              <dd className="tabular-nums">{fmtMoney(row.balanceAfter)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Способ оплаты</dt>
            <dd>{row.paymentMethod || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Агент</dt>
            <dd>{row.agent || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Комментарий</dt>
            <dd className="max-w-[60%] text-right">{row.comment || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#888]">Кто создал</dt>
            <dd>{row.createdBy || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function BalanceDetailExportModal({
  open,
  onClose,
  onConfirm,
  busy
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-[15px] font-semibold">Экспорт в Excel</h2>
        <p className="mb-4 text-[13px] text-[#666]">Два листа: «Общий» и «Подробно», как в шаблоне.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#d0d5dd] px-3 py-1.5 text-[13px] hover:bg-[#f5f5f5]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-[#1aa096] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#158f86] disabled:opacity-50"
          >
            {busy ? "Экспорт…" : "Скачать"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BalanceDetailColumnsModal({
  open,
  columns,
  onChange,
  onClose
}: {
  open: boolean;
  columns: BalanceDetailColumnDef[];
  onChange: (cols: BalanceDetailColumnDef[]) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-[15px] font-semibold">Видимые колонки</h2>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {columns.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[#f5f5f5]">
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => {
                  onChange(columns.map((c) => (c.key === col.key ? { ...c, visible: !c.visible } : c)));
                }}
              />
              <span className="text-[13px]">{col.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#1aa096] px-3 py-1.5 text-[13px] font-medium text-white"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

export function BalanceDetailOverallModal({
  open,
  onClose,
  cards,
  territory
}: {
  open: boolean;
  onClose: () => void;
  cards: { id: string; title: string; amount: number; cash: number; transfer: number; terminal: number; oldDebtIncome: number }[];
  territory?: string;
}) {
  if (!open || !cards.length) return null;

  const total = cards.reduce((s, c) => s + c.amount, 0);
  const agentCount = Math.max(0, cards.filter((c) => c.id !== "main").length);
  const channels = [
    { label: "Наличные (Naqd)", value: cards.reduce((s, c) => s + c.cash, 0), cls: "text-green-700" },
    { label: "Перечисление (Pereches)", value: cards.reduce((s, c) => s + c.transfer, 0), cls: "text-blue-700" },
    { label: "Терминал", value: cards.reduce((s, c) => s + c.terminal, 0), cls: "text-purple-700" },
    {
      label: "Эски карздан кирим",
      value: cards.reduce((s, c) => s + c.oldDebtIncome, 0),
      cls: "text-gray-700"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-[16px] font-semibold text-gray-800">Общий блок · Сводный баланс</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between rounded-lg bg-[#113B3B] p-5 text-white">
            <div>
              <div className="mb-1 text-[12px] text-teal-200/70">Итоговый баланс клиента (все агенты)</div>
              <div className={`text-[28px] font-bold tabular-nums ${total < 0 ? "text-red-400" : "text-white"}`}>
                {fmtMoney(total)} So&apos;m
              </div>
            </div>
            <div className="text-right text-[12px] text-teal-200/70">
              Территория: <span className="text-white">{territory || "—"}</span>
              <br />
              Агентов: <span className="text-white">{agentCount}</span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase text-gray-500">Разбивка по агентам</div>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {cards.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                  <span className="text-gray-700">{c.title}</span>
                  <span className={`font-semibold tabular-nums ${c.amount < 0 ? "text-red-600" : "text-gray-800"}`}>
                    {fmtUZS(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase text-gray-500">Разбивка по каналам оплаты</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {channels.map((ch) => (
                <div key={ch.label} className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[11px] text-gray-500">{ch.label}</div>
                  <div className={`text-[15px] font-bold tabular-nums ${ch.cls}`}>{fmtUZS(ch.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

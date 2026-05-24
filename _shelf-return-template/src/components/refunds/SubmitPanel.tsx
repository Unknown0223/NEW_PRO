import { useState } from "react";
import { Icon } from "../Icon";
import { useRefundStore } from "../../store/refundStore";
import { formatMoney } from "../../utils/format";
import { CUSTOMERS, WAREHOUSES, AGENTS } from "../../data/mock";

export default function SubmitPanel() {
  const {
    customerId, warehouseId, items, comment, reset, getTotals,
  } = useRefundStore();

  const [status, setStatus] = useState<"idle" | "saving" | "submitting" | "done">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const totals = getTotals();
  const valid = customerId && warehouseId && items.length > 0;

  const validate = () => {
    const errs: string[] = [];
    if (!customerId) errs.push("Выберите клиента");
    if (!warehouseId) errs.push("Выберите склад для возврата");
    if (items.length === 0) errs.push("Добавьте хотя бы один товар");
    return errs;
  };

  const doAction = async (type: "draft" | "refund") => {
    const errs = validate();
    if (errs.length) {
      setErrors(errs);
      setTimeout(() => setErrors([]), 4000);
      return;
    }
    setStatus(type === "draft" ? "saving" : "submitting");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("done");
    const num = Math.floor(10000 + Math.random() * 90000);
    setToast(
      type === "draft"
        ? `Черновик №${num} сохранён`
        : `Возврат №${num} успешно создан и отправлен на склад`
    );
    setTimeout(() => {
      reset();
      setShowConfirm(false);
      setToast(null);
      setStatus("idle");
    }, 2400);
  };

  const customer = customerId ? CUSTOMERS.find((c) => c.id === customerId) : null;
  const warehouse = warehouseId ? WAREHOUSES.find((w) => w.id === warehouseId) : null;

  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 -mb-6 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:-mx-6 lg:px-6">
        {errors.length > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="list-disc pl-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div>
              <span className="text-slate-400">Клиент: </span>
              <span className="font-semibold text-slate-800">
                {customer?.name ?? <span className="text-rose-500">не выбран</span>}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Склад: </span>
              <span className="font-semibold text-slate-800">
                {warehouse?.name ?? <span className="text-rose-500">не выбран</span>}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Позиций: </span>
              <span className="font-semibold text-slate-800">{items.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Сумма: </span>
              <span className="font-semibold text-slate-800">
                {formatMoney(totals.amount)}
              </span>
            </div>
            {comment && (
              <div>
                <span className="text-slate-400">Комментарий: </span>
                <span className="font-semibold text-slate-800">добавлен</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              onClick={() => doAction("draft")}
              disabled={status !== "idle" || !valid}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
              ) : (
                <Icon name="save" className="h-4 w-4" />
              )}
              Сохранить черновик
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={status !== "idle" || !valid}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "submitting" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Icon name="arrow-left" className="h-4 w-4" />
              )}
              Оформить возврат
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Icon name="arrow-left" className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Подтвердите возврат
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  После оформления заявка будет отправлена на склад и не может быть изменена.
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Клиент</span>
                <span className="font-medium text-slate-800">{customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Склад</span>
                <span className="font-medium text-slate-800">{warehouse?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Агент</span>
                <span className="font-medium text-slate-800">
                  {AGENTS[0].name}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">Сумма к возврату</span>
                <span className="font-bold text-indigo-600">
                  {formatMoney(totals.amount)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={() => doAction("refund")}
                className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700"
              >
                Подтвердить возврат
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-5 py-4 shadow-2xl animate-in slide-in-from-bottom">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Icon name="check" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Успешно
            </div>
            <div className="text-sm font-medium text-slate-900">{toast}</div>
          </div>
        </div>
      )}
    </>
  );
}

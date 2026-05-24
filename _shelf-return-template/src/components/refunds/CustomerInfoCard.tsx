import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { CUSTOMERS } from "../../data/mock";
import { useRefundStore } from "../../store/refundStore";

export default function CustomerInfoCard() {
  const { customerId, setCustomer } = useRefundStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(debounced.toLowerCase()) ||
      c.phone.includes(debounced) ||
      c.region.toLowerCase().includes(debounced.toLowerCase())
  ).slice(0, 6);

  const selected = customerId ? CUSTOMERS.find((c) => c.id === customerId) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Icon name="users" className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">
          Информация о клиенте
        </h2>
        <span className="ml-auto text-xs text-slate-500">Шаг 1 из 5</span>
      </div>

      <div ref={boxRef} className="relative">
        <label className="mb-1.5 block text-xs font-medium text-slate-600">
          Клиент <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q || selected?.name || ""}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              if (selected) setCustomer(null);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Введите название, телефон или регион..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                setCustomer(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && !selected && (
          <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Клиенты не найдены
              </div>
            ) : (
              <ul>
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setCustomer(c.id);
                        setQ("");
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-indigo-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-semibold text-white">
                        {c.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {c.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                          <span>{c.phone}</span>
                          <span>•</span>
                          <span>{c.region}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        #{c.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Телефон
            </div>
            <div className="font-medium text-slate-800">{selected.phone}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Регион
            </div>
            <div className="font-medium text-slate-800">{selected.region}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Адрес
            </div>
            <div className="font-medium text-slate-800">{selected.address}</div>
          </div>
        </div>
      )}
    </div>
  );
}

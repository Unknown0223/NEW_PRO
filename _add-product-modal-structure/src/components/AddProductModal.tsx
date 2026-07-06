import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { emptyForm, type ProductForm } from "../types";
import { MainInfoStep, DimensionsStep, PackagingStep } from "./steps";
import { X, Check, FileText, Ruler, Box } from "./ui";

const DRAFT_KEY = "add-product-draft";

const STEPS = [
  { id: 0, label: "Asosiy", icon: FileText },
  { id: 1, label: "O'lchamlar", icon: Ruler },
  { id: 2, label: "Qadoqlash", icon: Box },
];

export default function AddProductModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: ProductForm) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [draftSaved, setDraftSaved] = useState(false);

  /* restore draft when opened */
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      setForm(raw ? { ...emptyForm, ...JSON.parse(raw) } : emptyForm);
    } catch {
      setForm(emptyForm);
    }
  }, [open]);

  /* auto-save draft (debounced) */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftSaved(true);
      const h = setTimeout(() => setDraftSaved(false), 1500);
      return () => clearTimeout(h);
    }, 600);
    return () => clearTimeout(t);
  }, [form, open]);

  /* esc to close */
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const update = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  };

  const validateStep1 = () => {
    const e: Record<string, boolean> = {
      name: !form.name.trim(),
      category: !form.category,
      unit: !form.unit,
      tradeDirections: form.tradeDirections.length === 0,
    };
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  const progress = useMemo(() => {
    const required = [form.name, form.category, form.unit];
    const filled = required.filter(Boolean).length + (form.tradeDirections.length ? 1 : 0);
    return Math.round((filled / 4) * 100);
  }, [form]);

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  const save = () => {
    if (!validateStep1()) {
      setStep(0);
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    onSave(form);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="animate-modal relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:w-[700px] sm:rounded-3xl lg:w-[900px] lg:max-w-[95vw]">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mahsulot qo'shish</h2>
            <p
              className={cn(
                "text-xs transition-opacity",
                draftSaved ? "text-teal-600 opacity-100" : "text-slate-400"
              )}
            >
              {draftSaved ? "✓ Qoralama saqlandi" : "Ma'lumotlar avtomatik saqlanadi"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* stepper */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const current = step === s.id;
              return (
                <div key={s.id} className={cn("flex items-center", i > 0 && "flex-1")}>
                  {i > 0 && (
                    <div
                      className={cn(
                        "mx-3 h-0.5 flex-1 rounded-full transition-colors duration-300",
                        done || current ? "bg-teal-500" : "bg-slate-200"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => (s.id < step || validateStep1() ? setStep(s.id) : null)}
                    className="group flex items-center gap-2.5"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                        done
                          ? "bg-teal-500 text-white"
                          : current
                          ? "bg-teal-50 text-teal-600 ring-2 ring-teal-500"
                          : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span
                      className={cn(
                        "hidden text-sm font-medium sm:block",
                        current ? "text-teal-700" : done ? "text-slate-700" : "text-slate-400"
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {/* progress */}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && <MainInfoStep form={form} update={update} errors={errors} />}
          {step === 1 && <DimensionsStep form={form} update={update} errors={errors} />}
          {step === 2 && <PackagingStep form={form} update={update} errors={errors} />}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Bekor qilish
          </button>
          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Orqaga
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                onClick={next}
                className="rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-600 active:scale-[0.98]"
              >
                Keyingi →
              </button>
            ) : (
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-600 active:scale-[0.98]"
              >
                Saqlash
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

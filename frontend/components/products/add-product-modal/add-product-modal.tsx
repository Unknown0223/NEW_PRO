"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Box, Check, FileText, Ruler, X } from "lucide-react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { PRODUCT_UNIT_CUSTOM } from "@/lib/product-units";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./form-ui";
import { DimensionsStep, MainInfoStep, PackagingStep, buildProductPayload, validateMainStep } from "./steps";
import { emptyProductAddForm, productAddDraftKey, type ProductAddForm } from "./types";

const STEPS = [
  { id: 0, label: "Asosiy", icon: FileText },
  { id: 1, label: "O'lchamlar", icon: Ruler },
  { id: 2, label: "Qadoqlash", icon: Box }
] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantSlug: string | null;
  onDone: () => void;
};

type CatRow = { id: number; name: string; code: string | null };
type RefRow = { id: number; name: string; code?: string | null };

function toOptions(rows: RefRow[], withCode = false): SelectOption[] {
  return rows.map((r) => ({
    value: String(r.id),
    label: withCode && r.code ? `${r.name} (${r.code})` : r.name
  }));
}

export function ProductAddModal({ open, onOpenChange, tenantSlug, onDone }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProductAddForm>(emptyProductAddForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const draftKey = productAddDraftKey(tenantSlug);

  const catsQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "add-modal"],
    enabled: Boolean(tenantSlug) && open,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CatRow[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    }
  });

  const catalogOpts = (path: string, key: string) => ({
    queryKey: ["catalog-opts", path, tenantSlug, "add-modal", key],
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "500", is_active: "true" });
      const { data } = await api.get<{ data: RefRow[] }>(`/api/${tenantSlug}/${path}?${params}`);
      return data.data;
    },
    enabled: Boolean(tenantSlug) && open
  });

  const { data: brands = [] } = useQuery(catalogOpts("catalog/brands", "brands"));
  const { data: segments = [] } = useQuery(catalogOpts("catalog/segments", "segments"));

  const tradeDirsQ = useQuery({
    queryKey: ["trade-directions", tenantSlug, "add-modal"],
    enabled: Boolean(tenantSlug) && open,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: RefRow[] }>(`/api/${tenantSlug}/trade-directions?is_active=true`);
      return data.data ?? [];
    }
  });

  const catalogs = useMemo(
    () => ({
      categories: toOptions(catsQ.data ?? [], true),
      brands: toOptions(brands),
      segments: toOptions(segments),
      tradeDirections: toOptions(tradeDirsQ.data ?? [], true)
    }),
    [catsQ.data, brands, segments, tradeDirsQ.data]
  );

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    setMsg(null);
    try {
      const raw = localStorage.getItem(draftKey);
      setForm(raw ? { ...emptyProductAddForm, ...JSON.parse(raw) } : emptyProductAddForm);
    } catch {
      setForm(emptyProductAddForm);
    }
  }, [open, draftKey]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(form));
      setDraftSaved(true);
      const h = window.setTimeout(() => setDraftSaved(false), 1500);
      return () => window.clearTimeout(h);
    }, 600);
    return () => window.clearTimeout(t);
  }, [form, open, draftKey]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  const update = <K extends keyof ProductAddForm>(key: K, value: ProductAddForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  };

  const progress = useMemo(() => {
    const unitOk =
      form.unit !== PRODUCT_UNIT_CUSTOM ? Boolean(form.unit) : Boolean(form.unitCustom.trim());
    const required = [form.name.trim(), form.categoryId, unitOk];
    const filled = required.filter(Boolean).length + (form.tradeDirectionIds.length ? 1 : 0);
    return Math.round((filled / 4) * 100);
  }, [form]);

  const validateStep1 = () => {
    const e = validateMainStep(form);
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("Tenant topilmadi");
      if (!validateStep1()) throw new Error("Asosiy maydonlarni to'ldiring");

      const payload = buildProductPayload(form);
      await api.post(`/api/${tenantSlug}/products`, payload);
    },
    onSuccess: async () => {
      const savedName = form.name.trim();
      localStorage.removeItem(draftKey);
      setMsg(null);
      setForm(emptyProductAddForm);
      setStep(0);
      void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      onDone();
      onOpenChange(false);
      setToast(`"${savedName}" muvaffaqiyatli qo'shildi`);
      window.setTimeout(() => setToast(null), 3500);
    },
    onError: (e: unknown) => {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const hint = firstValidationUserHint(flat);
          setMsg(
            hint
              ? withApiSupportLine(`Tekshiruv: ${hint}`, e)
              : withApiSupportLine(getUserFacingError(e, "Xato"), e)
          );
          return;
        }
      }
      setMsg(getUserFacingError(e, "Saqlashda xato"));
    }
  });

  const save = () => {
    if (!validateStep1()) {
      setStep(0);
      return;
    }
    saveMut.mutate();
  };

  return (
    <>
      {toast ? (
        <div className="animate-add-product-toast fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500">
              <Check className="h-3.5 w-3.5" />
            </span>
            {toast}
          </div>
        </div>
      ) : null}

      {!open ? null : (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="animate-add-product-modal relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:w-[700px] sm:rounded-3xl lg:w-[900px] lg:max-w-[95vw]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mahsulot qo&apos;shish</h2>
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
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const current = step === s.id;
              return (
                <div key={s.id} className={cn("flex items-center", i > 0 && "flex-1")}>
                  {i > 0 ? (
                    <div
                      className={cn(
                        "mx-3 h-0.5 flex-1 rounded-full transition-colors duration-300",
                        done || current ? "bg-teal-500" : "bg-slate-200"
                      )}
                    />
                  ) : null}
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
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 ? (
            <MainInfoStep form={form} update={update} errors={errors} catalogs={catalogs} />
          ) : null}
          {step === 1 ? (
            <DimensionsStep form={form} update={update} errors={errors} catalogs={catalogs} />
          ) : null}
          {step === 2 ? (
            <PackagingStep form={form} update={update} errors={errors} catalogs={catalogs} />
          ) : null}
        </div>

        {msg ? <p className="px-6 pb-2 text-sm text-destructive">{msg}</p> : null}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Bekor qilish
          </button>
          <div className="flex items-center gap-2.5">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Orqaga
              </button>
            ) : null}
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
                disabled={saveMut.isPending}
                className="rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-600 active:scale-[0.98] disabled:opacity-60"
              >
                {saveMut.isPending ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
}

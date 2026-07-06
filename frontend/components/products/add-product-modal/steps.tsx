"use client";

import { useRef, useState } from "react";
import { Barcode, Box, Check, Image as ImageIcon, Plus, Trash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRODUCT_UNIT_CUSTOM,
  PRODUCT_UNIT_OPTIONS,
  resolveUnitFromForm
} from "@/lib/product-units";
import {
  Field,
  MultiSelect,
  SectionTitle,
  Select,
  Switch,
  TextInput,
  type SelectOption
} from "./form-ui";
import {
  PACKAGING_TEMPLATES,
  calcVolume,
  type Packaging,
  type ProductAddForm
} from "./types";

export type CatalogRefs = {
  categories: SelectOption[];
  brands: SelectOption[];
  segments: SelectOption[];
  tradeDirections: SelectOption[];
};

interface StepProps {
  form: ProductAddForm;
  update: <K extends keyof ProductAddForm>(key: K, value: ProductAddForm[K]) => void;
  errors: Record<string, boolean>;
  catalogs: CatalogRefs;
}

const UNIT_OPTIONS: SelectOption[] = PRODUCT_UNIT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label
}));

export function MainInfoStep({ form, update, errors, catalogs }: StepProps) {
  const generateBarcode = () => {
    const code = `478${Math.floor(Math.random() * 1e10)
      .toString()
      .padStart(10, "0")}`;
    update("barcode", code);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Asosiy ma&apos;lumotlar</SectionTitle>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Nomi" required>
            <TextInput
              value={form.name}
              onChange={(v) => update("name", v)}
              placeholder="Mahsulot nomi"
              error={errors.name}
            />
          </Field>
          <Field label="Kategoriya" required>
            <Select
              value={form.categoryId}
              onChange={(v) => update("categoryId", v)}
              options={catalogs.categories}
              placeholder="Kategoriya tanlang"
              error={errors.categoryId}
            />
          </Field>
          <Field label="Mahsulot kodi (SKU)" hint={`${form.code.length} / 20`}>
            <TextInput
              value={form.code}
              onChange={(v) => v.length <= 20 && update("code", v)}
              placeholder="Masalan: PRD-0001"
              maxLength={20}
            />
          </Field>
          <Field label="Barcode">
            <TextInput
              value={form.barcode}
              onChange={(v) => update("barcode", v)}
              placeholder="Skanerlang yoki kiriting"
              suffix={
                <button
                  type="button"
                  onClick={generateBarcode}
                  title="Barcode generatsiya qilish"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition-colors hover:bg-teal-100"
                >
                  <Barcode className="h-4 w-4" />
                </button>
              }
            />
          </Field>
          <Field label="Birlik" required>
            <Select
              value={form.unit}
              onChange={(v) => update("unit", v)}
              options={UNIT_OPTIONS}
              error={errors.unit}
            />
          </Field>
          {form.unit === PRODUCT_UNIT_CUSTOM ? (
            <Field label="Boshqa birlik" required>
              <TextInput
                value={form.unitCustom}
                onChange={(v) => update("unitCustom", v)}
                placeholder="Birlik nomi"
                error={errors.unitCustom}
              />
            </Field>
          ) : (
            <Field label="Blok soni">
              <TextInput
                type="number"
                value={form.blockCount}
                onChange={(v) => update("blockCount", v.replace(/[^0-9]/g, ""))}
                placeholder="0"
              />
            </Field>
          )}
          {form.unit === PRODUCT_UNIT_CUSTOM ? (
            <Field label="Blok soni">
              <TextInput
                type="number"
                value={form.blockCount}
                onChange={(v) => update("blockCount", v.replace(/[^0-9]/g, ""))}
                placeholder="0"
              />
            </Field>
          ) : null}
          <Field label="Brand">
            <Select
              value={form.brandId}
              onChange={(v) => update("brandId", v)}
              options={catalogs.brands}
              placeholder="Brand tanlang"
            />
          </Field>
          <Field label="Segment">
            <MultiSelect
              values={form.segmentIds}
              onChange={(v) => update("segmentIds", v)}
              options={catalogs.segments}
              placeholder="Segment tanlang"
            />
          </Field>
          <Field label="Savdo yo'nalishi" required className="sm:col-span-2">
            <MultiSelect
              values={form.tradeDirectionIds}
              onChange={(v) => update("tradeDirectionIds", v)}
              options={catalogs.tradeDirections}
              placeholder="Savdo yo'nalishini tanlang"
              error={errors.tradeDirectionIds}
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Qo&apos;shimcha ma&apos;lumot</SectionTitle>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="TN VED">
            <TextInput value={form.tnved} onChange={(v) => update("tnved", v)} placeholder="TN VED kodi" />
          </Field>
          <Field label="IKPU kod">
            <TextInput value={form.ikpu} onChange={(v) => update("ikpu", v)} placeholder="IKPU kodi" />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Holati</p>
              <p className="text-xs text-slate-500">
                Mahsulot {form.active ? "faol — savdoda ko'rinadi" : "nofaol — savdoda ko'rinmaydi"}
              </p>
            </div>
            <Switch
              checked={form.active}
              onChange={(v) => update("active", v)}
              label={form.active ? "Faol" : "Nofaol"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DimensionsStep({ form, update }: StepProps) {
  const volume = calcVolume(form.width, form.height, form.length, form.dimensionUnit);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => update("image", reader.result as string);
    reader.readAsDataURL(file);
  };

  const u = form.dimensionUnit === "m" ? "m" : "sm";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <SectionTitle>O&apos;lchamlar</SectionTitle>

        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
          {(["m", "cm"] as const).map((un) => (
            <button
              key={un}
              type="button"
              onClick={() => update("dimensionUnit", un)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                form.dimensionUnit === un
                  ? "bg-white text-teal-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {un === "m" ? "Metrda" : "Santimetrda"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label={`Kenglik (${u})`}>
            <TextInput type="number" value={form.width} onChange={(v) => update("width", v)} placeholder="0" />
          </Field>
          <Field label={`Balandlik (${u})`}>
            <TextInput type="number" value={form.height} onChange={(v) => update("height", v)} placeholder="0" />
          </Field>
          <Field label={`Uzunlik (${u})`}>
            <TextInput type="number" value={form.length} onChange={(v) => update("length", v)} placeholder="0" />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Og'irlik (kg)">
            <TextInput type="number" value={form.weight} onChange={(v) => update("weight", v)} placeholder="0" />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-teal-700/70 uppercase">Hajm (real vaqtda)</p>
            <p className="text-2xl font-semibold text-teal-700 tabular-nums">
              {volume.toFixed(3)} <span className="text-sm font-medium">m³</span>
            </p>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Mahsulot rasmi</SectionTitle>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
        />
        {form.image ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.image} alt="Mahsulot" className="h-64 w-full bg-slate-50 object-contain" />
            <button
              type="button"
              onClick={() => update("image", null)}
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow transition-colors hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              e.dataTransfer.files?.[0] && readFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all",
              dragging
                ? "border-teal-400 bg-teal-50"
                : "border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/40"
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
              <ImageIcon className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-slate-600">Rasmni shu yerga tashlang</span>
            <span className="text-xs text-slate-400">yoki bosib kompyuterdan tanlang (PNG, JPG)</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function PackagingStep({ form, update }: StepProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Packaging, "id" | "isMain">>({
    name: "",
    quantity: "",
    width: "",
    height: "",
    length: ""
  });

  const addPackaging = () => {
    if (!draft.name.trim()) return;
    const pkg: Packaging = {
      ...draft,
      id: Math.random().toString(36).slice(2),
      isMain: form.packagings.length === 0
    };
    update("packagings", [...form.packagings, pkg]);
    setDraft({ name: "", quantity: "", width: "", height: "", length: "" });
    setAdding(false);
  };

  const setMain = (id: string) =>
    update(
      "packagings",
      form.packagings.map((p) => ({ ...p, isMain: p.id === id }))
    );

  const remove = (id: string) => {
    const rest = form.packagings.filter((p) => p.id !== id);
    if (rest.length > 0 && !rest.some((p) => p.isMain)) rest[0].isMain = true;
    update("packagings", rest);
  };

  return (
    <div>
      <SectionTitle>Qadoqlashlar</SectionTitle>

      <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">Shablondan tanlash</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {PACKAGING_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() =>
              update("packagings", [
                ...form.packagings,
                {
                  name: t.name,
                  quantity: t.quantity,
                  width: t.width,
                  height: t.height,
                  length: t.length,
                  id: Math.random().toString(36).slice(2),
                  isMain: form.packagings.length === 0
                }
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          >
            <Box className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {form.packagings.map((p) => (
          <div
            key={p.id}
            className={cn(
              "relative rounded-2xl border p-4 transition-all",
              p.isMain
                ? "border-teal-300 bg-teal-50/50 ring-2 ring-teal-500/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    p.isMain ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  <Box className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.quantity ? `${p.quantity} dona` : "—"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
              {[`W:${p.width || "0"}`, `H:${p.height || "0"}`, `L:${p.length || "0"}`].map((d) => (
                <span key={d} className="rounded-md bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">
                  {d} sm
                </span>
              ))}
              <span className="ml-auto rounded-md bg-slate-800 px-2 py-0.5 text-white tabular-nums">
                {calcVolume(p.width, p.height, p.length, "cm").toFixed(3)} m³
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMain(p.id)}
              className={cn(
                "mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors",
                p.isMain ? "text-teal-600" : "text-slate-400 hover:text-teal-600"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                  p.isMain ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300"
                )}
              >
                {p.isMain ? <Check className="h-3 w-3" /> : null}
              </span>
              Asosiy qadoq
            </button>
          </div>
        ))}

        {adding ? (
          <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/30 p-4 sm:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Nomi" className="col-span-2">
                <TextInput
                  value={draft.name}
                  onChange={(v) => setDraft({ ...draft, name: v })}
                  placeholder="Korobka"
                />
              </Field>
              <Field label="Soni">
                <TextInput
                  type="number"
                  value={draft.quantity}
                  onChange={(v) => setDraft({ ...draft, quantity: v })}
                  placeholder="12"
                />
              </Field>
              <Field label="W (sm)">
                <TextInput
                  type="number"
                  value={draft.width}
                  onChange={(v) => setDraft({ ...draft, width: v })}
                  placeholder="0"
                />
              </Field>
              <Field label="H / L (sm)">
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    value={draft.height}
                    onChange={(v) => setDraft({ ...draft, height: v })}
                    placeholder="H"
                  />
                  <TextInput
                    type="number"
                    value={draft.length}
                    onChange={(v) => setDraft({ ...draft, length: v })}
                    placeholder="L"
                  />
                </div>
              </Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={addPackaging}
                disabled={!draft.name.trim()}
                className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-40"
              >
                Qo&apos;shish
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 transition-all hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-600"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Qadoqlash qo&apos;shish</span>
          </button>
        )}
      </div>

      {form.packagings.length === 0 && !adding ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          Hozircha qadoqlash qo&apos;shilmagan. Shablondan tanlang yoki yangi qo&apos;shing.
        </p>
      ) : null}
    </div>
  );
}

export function validateMainStep(form: ProductAddForm): Record<string, boolean> {
  const unitOk =
    form.unit !== PRODUCT_UNIT_CUSTOM ? Boolean(form.unit) : Boolean(form.unitCustom.trim());
  return {
    name: !form.name.trim(),
    categoryId: !form.categoryId,
    unit: !unitOk,
    unitCustom: form.unit === PRODUCT_UNIT_CUSTOM && !form.unitCustom.trim(),
    tradeDirectionIds: form.tradeDirectionIds.length === 0
  };
}

export function parseDim(s: string): number | null {
  const t = s.replace(",", ".").trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function buildProductPayload(form: ProductAddForm): Record<string, unknown> {
  const cid = Number.parseInt(form.categoryId, 10);
  const unit = resolveUnitFromForm(form.unit, form.unitCustom);
  let finalSku = form.code.trim();
  if (!finalSku) finalSku = `NEW-${Date.now().toString(36)}`;

  const L = parseDim(form.length);
  const Wd = parseDim(form.width);
  const Ht = parseDim(form.height);
  let length_cm: string | null = null;
  let width_cm: string | null = null;
  let height_cm: string | null = null;
  let volume_m3: string | null = null;
  if (L != null && Wd != null && Ht != null && L > 0 && Wd > 0 && Ht > 0) {
    if (form.dimensionUnit === "m") {
      length_cm = String(L * 100);
      width_cm = String(Wd * 100);
      height_cm = String(Ht * 100);
      volume_m3 = String(L * Wd * Ht);
    } else {
      length_cm = String(L);
      width_cm = String(Wd);
      height_cm = String(Ht);
      volume_m3 = String((L * Wd * Ht) / 1_000_000);
    }
  }

  const segmentIds = form.segmentIds
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  const tradeDirectionIds = form.tradeDirectionIds
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);

  const packagings = form.packagings
    .filter((p) => p.name.trim())
    .map((p, index) => ({
      name: p.name.trim(),
      quantity: (() => {
        const n = Number.parseInt(p.quantity.replace(/[^0-9]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      width_cm: parseDim(p.width),
      height_cm: parseDim(p.height),
      length_cm: parseDim(p.length),
      is_main: p.isMain,
      sort_order: index
    }));

  return {
    sku: finalSku,
    name: form.name.trim(),
    unit: unit || "dona",
    category_id: cid,
    is_active: form.active,
    barcode: form.barcode.trim() || null,
    ikpu_code: form.ikpu.trim() || null,
    hs_code: form.tnved.trim().slice(0, 32) || null,
    brand_id: form.brandId ? Number.parseInt(form.brandId, 10) : null,
    segment_ids: segmentIds.length ? segmentIds : undefined,
    segment_id: segmentIds[0] ?? null,
    trade_direction_ids: tradeDirectionIds.length ? tradeDirectionIds : undefined,
    image_url: form.image?.trim() || null,
    packagings: packagings.length ? packagings : undefined,
    weight_kg: form.weight.trim() === "" ? null : form.weight.trim(),
    qty_per_block: (() => {
      if (form.blockCount.trim() === "") return null;
      const n = Number.parseInt(form.blockCount.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    })(),
    dimension_unit: form.dimensionUnit,
    width_cm,
    height_cm,
    length_cm,
    volume_m3
  };
}

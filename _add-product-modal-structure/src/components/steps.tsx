import { useRef, useState } from "react";
import { cn } from "../utils/cn";
import {
  Field,
  TextInput,
  Select,
  MultiSelect,
  Switch,
  SectionTitle,
  Barcode,
  Plus,
  Trash,
  Box,
  Check,
  Image as ImageIcon,
  X,
} from "./ui";
import {
  type ProductForm,
  type Packaging,
  CATEGORIES,
  UNITS,
  BRANDS,
  SEGMENTS,
  TRADE_DIRECTIONS,
  PACKAGING_TEMPLATES,
  calcVolume,
} from "../types";

interface StepProps {
  form: ProductForm;
  update: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  errors: Record<string, boolean>;
}

/* ================== STEP 1: Asosiy ma'lumotlar ================== */
export function MainInfoStep({ form, update, errors }: StepProps) {
  const generateBarcode = () => {
    const code = "478" + Math.floor(Math.random() * 1e10).toString().padStart(10, "0");
    update("barcode", code);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Asosiy ma'lumotlar</SectionTitle>
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
              value={form.category}
              onChange={(v) => update("category", v)}
              options={CATEGORIES}
              error={errors.category}
            />
          </Field>
          <Field label="Mahsulot kodi" hint={`${form.code.length} / 20`}>
            <TextInput
              value={form.code}
              onChange={(v) => v.length <= 20 && update("code", v)}
              placeholder="Masalan: PRD-0001"
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
              options={UNITS}
              error={errors.unit}
            />
          </Field>
          <Field label="Blok soni">
            <TextInput
              type="number"
              value={form.blockCount}
              onChange={(v) => update("blockCount", v)}
              placeholder="0"
            />
          </Field>
          <Field label="Brand">
            <BrandAutocomplete value={form.brand} onChange={(v) => update("brand", v)} />
          </Field>
          <Field label="Segment">
            <MultiSelect
              values={form.segments}
              onChange={(v) => update("segments", v)}
              options={SEGMENTS}
            />
          </Field>
          <Field label="Savdo yo'nalishi" required className="sm:col-span-2">
            <MultiSelect
              values={form.tradeDirections}
              onChange={(v) => update("tradeDirections", v)}
              options={TRADE_DIRECTIONS}
              error={errors.tradeDirections}
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Qo'shimcha ma'lumot</SectionTitle>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="TN VED">
            <TextInput
              value={form.tnved}
              onChange={(v) => update("tnved", v)}
              placeholder="TN VED kodi"
            />
          </Field>
          <Field label="IKPU kod">
            <TextInput
              value={form.ikpu}
              onChange={(v) => update("ikpu", v)}
              placeholder="IKPU kodi"
            />
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

/* ---------- Brand autocomplete ---------- */
function BrandAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const filtered = BRANDS.filter((b) => b.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Brand nomini yozing…"
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1.5 max-h-44 w-full overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl shadow-slate-900/10">
          {filtered.map((b) => (
            <button
              key={b}
              type="button"
              onMouseDown={() => {
                onChange(b);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================== STEP 2: O'lchamlar ================== */
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
        <SectionTitle>O'lchamlar</SectionTitle>

        {/* unit toggle */}
        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
          {(["m", "sm"] as const).map((un) => (
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

        {/* volume preview */}
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

      {/* image upload */}
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
            <img src={form.image} alt="Mahsulot" className="h-64 w-full object-contain bg-slate-50" />
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
            <span className="text-sm font-medium text-slate-600">
              Rasmni shu yerga tashlang
            </span>
            <span className="text-xs text-slate-400">yoki bosib kompyuterdan tanlang (PNG, JPG)</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ================== STEP 3: Qadoqlash ================== */
export function PackagingStep({ form, update }: StepProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Packaging, "id" | "isMain">>({
    name: "",
    quantity: "",
    width: "",
    height: "",
    length: "",
  });

  const addPackaging = () => {
    if (!draft.name.trim()) return;
    const pkg: Packaging = {
      ...draft,
      id: Math.random().toString(36).slice(2),
      isMain: form.packagings.length === 0,
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

      {/* templates */}
      <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
        Shablondan tanlash
      </p>
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
                  isMain: form.packagings.length === 0,
                },
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          >
            <Box className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* cards */}
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
                  <Box className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.quantity ? `${p.quantity} dona` : "—"}
                  </p>
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
              {["W:" + (p.width || "0"), "H:" + (p.height || "0"), "L:" + (p.length || "0")].map((d) => (
                <span key={d} className="rounded-md bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">
                  {d} sm
                </span>
              ))}
              <span className="ml-auto rounded-md bg-slate-800 px-2 py-0.5 text-white tabular-nums">
                {calcVolume(p.width, p.height, p.length, "sm").toFixed(3)} m³
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
                {p.isMain && <Check className="h-3 w-3" />}
              </span>
              Asosiy qadoq
            </button>
          </div>
        ))}

        {/* add card / form */}
        {adding ? (
          <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/30 p-4 sm:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Nomi" className="col-span-2">
                <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Korobka" />
              </Field>
              <Field label="Soni">
                <TextInput type="number" value={draft.quantity} onChange={(v) => setDraft({ ...draft, quantity: v })} placeholder="12" />
              </Field>
              <Field label="W (sm)">
                <TextInput type="number" value={draft.width} onChange={(v) => setDraft({ ...draft, width: v })} placeholder="0" />
              </Field>
              <Field label="H / L (sm)">
                <div className="flex gap-2">
                  <TextInput type="number" value={draft.height} onChange={(v) => setDraft({ ...draft, height: v })} placeholder="H" />
                  <TextInput type="number" value={draft.length} onChange={(v) => setDraft({ ...draft, length: v })} placeholder="L" />
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
                Qo'shish
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
            <span className="text-sm font-medium">Qadoqlash qo'shish</span>
          </button>
        )}
      </div>

      {form.packagings.length === 0 && !adding && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Hozircha qadoqlash qo'shilmagan. Shablondan tanlang yoki yangi qo'shing.
        </p>
      )}
    </div>
  );
}

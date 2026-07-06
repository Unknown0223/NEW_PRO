import { useState } from "react";
import AddProductModal from "./components/AddProductModal";
import { type ProductForm, calcVolume } from "./types";
import { Plus, Box, Check } from "./components/ui";

interface SavedProduct extends ProductForm {
  id: number;
}

const initialProducts: SavedProduct[] = [
  {
    id: 1,
    name: "Coca-Cola 1.5L",
    category: "Ichimliklar",
    code: "PRD-0001",
    barcode: "4780012345678",
    unit: "Dona",
    blockCount: "6",
    brand: "Coca-Cola",
    segments: ["O'rta segment"],
    tradeDirections: ["Chakana savdo", "Ulgurji savdo"],
    weight: "1.55",
    width: "9",
    height: "32",
    length: "9",
    dimensionUnit: "sm",
    tnved: "2202100000",
    ikpu: "02202001001000001",
    active: true,
    image: null,
    packagings: [
      { id: "a", name: "Blok", isMain: true, quantity: "6", width: "28", height: "33", length: "19" },
    ],
  },
  {
    id: 2,
    name: "Makfa spaghetti 400g",
    category: "Un mahsulotlari",
    code: "PRD-0002",
    barcode: "4780098765432",
    unit: "Dona",
    blockCount: "20",
    brand: "Makfa",
    segments: ["Ekonom"],
    tradeDirections: ["Distributsiya"],
    weight: "0.4",
    width: "6",
    height: "26",
    length: "9",
    dimensionUnit: "sm",
    tnved: "1902110000",
    ikpu: "",
    active: false,
    image: null,
    packagings: [],
  },
];

export default function App() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<SavedProduct[]>(initialProducts);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = (form: ProductForm) => {
    setProducts((p) => [{ ...form, id: Date.now() }, ...p]);
    setOpen(false);
    setToast(`"${form.name}" muvaffaqiyatli qo'shildi`);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25">
              <Box className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Mahsulotlar</h1>
              <p className="text-xs text-slate-500">Sozlamalar · Produktlar · Produkt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Mahsulot qo'shish
          </button>
        </div>
      </header>

      {/* table */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3.5">Nomi</th>
                  <th className="px-5 py-3.5">Kategoriya</th>
                  <th className="px-5 py-3.5">Kod</th>
                  <th className="px-5 py-3.5">Brand</th>
                  <th className="px-5 py-3.5">Hajm</th>
                  <th className="px-5 py-3.5">Qadoqlar</th>
                  <th className="px-5 py-3.5">Holati</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-9 w-9 rounded-lg bg-slate-100 object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <Box className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.barcode || "Barcode yo'q"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{p.category}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.code || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.brand || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600 tabular-nums">
                      {calcVolume(p.width, p.height, p.length, p.dimensionUnit).toFixed(3)} m³
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {p.packagings.length} ta
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          p.active
                            ? "inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
                        }
                      >
                        <span className={p.active ? "h-1.5 w-1.5 rounded-full bg-emerald-500" : "h-1.5 w-1.5 rounded-full bg-slate-400"} />
                        {p.active ? "Faol" : "Nofaol"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Jami {products.length} ta mahsulot · Yangi qo'shish uchun yuqoridagi tugmani bosing
        </p>
      </main>

      {/* toast */}
      {toast && (
        <div className="animate-toast fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500">
              <Check className="h-3.5 w-3.5" />
            </span>
            {toast}
          </div>
        </div>
      )}

      <AddProductModal open={open} onClose={() => setOpen(false)} onSave={handleSave} />
    </div>
  );
}

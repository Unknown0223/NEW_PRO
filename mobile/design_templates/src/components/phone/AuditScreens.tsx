import { useMemo, useState } from "react";
import {
  ArrowUpRight, Building2, Camera, Check, ChevronRight, Clock3, FileText, Gift, MapPin,
  Navigation, Phone, Plus, Search, ShoppingBag, Star, Target, TrendingUp, User, Wallet, X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { anim, Chip, fmt, IconBtn, ScreenHead, type Props } from "./PhoneScreens";

/* ------------------------------------------------------------------ */
/*  CLIENT DETAIL — client_detail_screen.dart                          */
/* ------------------------------------------------------------------ */

export function ClientDetailScreen({ t, accent, ctx }: Props) {
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [photos, setPhotos] = useState(3);
  const [fav, setFav] = useState(false);

  const orders = [
    { no: "№1847", date: "26.06.2026", sum: 1240000, st: "Yangi", tone: "#3E9BFF" },
    { no: "№1822", date: "22.06.2026", sum: 480000, st: "Yetkazildi", tone: "#22B573" },
    { no: "№1801", date: "18.06.2026", sum: 915000, st: "Yetkazildi", tone: "#22B573" },
  ];
  const ledger = [
    { d: "26.06", l: "Buyurtma №1847", v: -1240000 },
    { d: "24.06", l: "To'lov · naqd", v: 500000 },
    { d: "22.06", l: "Buyurtma №1822", v: -480000 },
    { d: "18.06", l: "To'lov · o'tkazma", v: 915000 },
  ];

  return (
    <div className="relative flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="MCHJ O'zbekiston Gullari"
          sub="TT-0847 · A toifa · Yunusobod"
          onBack={() => ctx.go("clients")}
          right={
            <>
              <IconBtn t={t} onClick={() => { setFav((v) => !v); ctx.toast(fav ? "Sevimlilardan olindi" : "Sevimlilarga qo'shildi"); }} active={fav}>
                <Star size={13} fill={fav ? "currentColor" : "none"} />
              </IconBtn>
              <IconBtn t={t} onClick={() => ctx.go("map")}><MapPin size={13} /></IconBtn>
            </>
          }
        />
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-20">
        {/* balance hero */}
        <div className="rounded-[18px] p-3.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: t.sub }}>Joriy balans</p>
          <p className="mt-1 font-display text-[24px] font-bold leading-none tracking-[-0.04em]" style={{ color: "#E0574B" }}>
            −1 240 000 <span className="text-[10px] font-medium" style={{ color: t.sub }}>so'm</span>
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
            {[["3.76 mln", "Kredit qoldi"], ["18 kun", "Qarz muddati"], ["2.1 mln", "Oylik aylanma"]].map(([v, l]) => (
              <div key={l} className="rounded-lg p-1.5" style={{ background: t.card2 }}>
                <p className="font-mono text-[10px] font-bold" style={{ color: t.ink }}>{v}</p>
                <p className="text-[6.5px]" style={{ color: t.sub }}>{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <button type="button" onClick={() => ctx.toast("+998 90 123 45 67")} className="flex flex-1 items-center justify-center gap-1 rounded-[9px] py-2 text-[9px] font-semibold" style={{ background: t.accSoft, color: t.accInk }}>
              <Phone size={10} /> Qo'ng'iroq
            </button>
            <button type="button" onClick={() => ctx.go("map")} className="flex flex-1 items-center justify-center gap-1 rounded-[9px] py-2 text-[9px] font-semibold" style={{ background: t.card2, color: t.ink }}>
              <Navigation size={10} /> Yo'l ko'rsatish
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {["Foto hisobot", "Buyurtmalar", "Ledger"].map((x, i) => (
            <button key={x} type="button" onClick={() => setTab(i as 0 | 1 | 2)} className="flex-1 rounded-[7px] py-1.5 text-[8.5px] font-semibold" style={{ background: tab === i ? t.card : "transparent", color: tab === i ? t.ink : t.sub, boxShadow: tab === i ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
              {x}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <div className={cn("rounded-[14px] p-3", anim(ctx, 0).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold" style={{ color: t.ink }}>Bugungi foto hisobot</p>
              <span className="rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>{photos}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {Array.from({ length: photos }).map((_, i) => (
                <div key={i} className="grid aspect-square place-items-center rounded-[10px] text-[8px] font-semibold" style={{ background: t.accSoft, color: t.accInk }}>
                  <Camera size={14} />
                </div>
              ))}
              <button type="button" onClick={() => { setPhotos((p) => p + 1); ctx.toast("Foto qo'shildi"); }} className="grid aspect-square place-items-center rounded-[10px] border border-dashed" style={{ borderColor: t.line, color: t.sub }}>
                <Plus size={15} />
              </button>
            </div>
            <p className="mt-2 text-[8px]" style={{ color: t.sub }}>Polka, narx yorliqlari va vitrina — buyurtmadan oldin majburiy.</p>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-1.5">
            {orders.map((o, i) => (
              <button key={o.no} type="button" onClick={() => ctx.go("order-detail")} className={cn("flex w-full items-center gap-2 rounded-[12px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: t.card2, color: t.sub }}><ShoppingBag size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[9.5px] font-bold" style={{ color: t.ink }}>{o.no}</span>
                  <span className="block text-[8px]" style={{ color: t.sub }}>{o.date}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[9px] font-bold" style={{ color: t.ink }}>{fmt(o.sum)}</span>
                  <span className="block text-[7px] font-bold" style={{ color: o.tone }}>{o.st}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 2 && (
          <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            {ledger.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-[9px]" style={{ borderBottom: i < ledger.length - 1 ? `1px solid ${t.line}` : "none" }}>
                <span className="font-mono" style={{ color: t.sub }}>{r.d}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: t.ink }}>{r.l}</span>
                <span className="font-mono font-bold" style={{ color: r.v > 0 ? "#22B573" : "#E0574B" }}>{r.v > 0 ? "+" : ""}{fmt(r.v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* draft banner */}
        <button type="button" onClick={() => ctx.go("drafts")} className="flex w-full items-center gap-2 rounded-[13px] p-2.5 text-left" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <FileText size={13} style={{ color: t.accText }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[9.5px] font-bold" style={{ color: t.ink }}>Qoralama mavjud</span>
            <span className="block text-[8px]" style={{ color: t.sub }}>12 pozitsiya · 450 000 so'm</span>
          </span>
          <span className="rounded-full px-2 py-1 text-[8px] font-bold on-acc" style={{ background: accent.hex }}>Davom</span>
        </button>
      </div>

      {/* sticky CTA */}
      <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t px-4 py-2.5" style={{ background: t.card, borderColor: t.line }}>
        <button type="button" onClick={() => ctx.go("start-visit")} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-semibold" style={{ background: t.card2, color: t.ink }}>
          Vizit
        </button>
        <button type="button" onClick={() => ctx.go("order")} className="flex-[1.6] rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          Buyurtma qo'shish
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NEW CLIENT — new_client_page.dart                                  */
/* ------------------------------------------------------------------ */

export function NewClientScreen({ t, accent, ctx }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [city, setCity] = useState("");
  const [tier, setTier] = useState("B");
  const [gps, setGps] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameErr = name.trim().length < 3;
  const innErr = inn.replace(/\D/g, "").length !== 9;
  const canNext = step === 0 ? !nameErr && !innErr && !!city : step === 1 ? gps : true;

  if (saved) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <span className={cn("grid size-16 place-items-center rounded-full on-acc", ctx.motion !== "off" && "auth-ring-pop")} style={{ background: accent.gradient }}>
          <Check size={28} strokeWidth={3} />
        </span>
        <p className="mt-3 font-display text-[16px] font-bold" style={{ color: t.ink }}>Mijoz qo'shildi</p>
        <p className="mt-1 text-[9px]" style={{ color: t.sub }}>{name} · TT-{1200 + Math.floor(Math.random() * 90)}</p>
        {!photo && <p className="mt-2 rounded-lg px-2 py-1 text-[8px]" style={{ background: "#FEF3C7", color: "#92400E" }}>Foto yuklanmadi — keyinroq qo'shing</p>}
        <p className="mt-3 text-[9.5px] font-semibold" style={{ color: t.ink }}>Yangi nuqta uchun buyurtma yaratasizmi?</p>
        <div className="mt-3 flex w-full gap-2">
          <button type="button" onClick={() => ctx.go("clients")} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-semibold" style={{ background: t.card2, color: t.ink }}>Keyinroq</button>
          <button type="button" onClick={() => ctx.go("order")} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.hex }}>Buyurtma</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Yangi savdo nuqtasi" sub={`Qadam ${step + 1}/3 · maydonlar konfiguratsiyaga bog'liq`} onBack={() => (step ? setStep(step - 1) : ctx.go("clients"))} />
        <div className="flex gap-1">
          {["Ma'lumot", "Lokatsiya", "Tasdiq"].map((s, i) => (
            <div key={s} className="flex-1">
              <span className="block h-[3px] rounded-full" style={{ background: i <= step ? accent.hex : t.card2 }} />
              <span className="mt-1 block text-[6.5px] font-bold uppercase" style={{ color: i <= step ? t.accText : t.sub }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2.5">
        {step === 0 && (
          <>
            <Field t={t} label="Nomi *" err={touched && nameErr ? "Kamida 3 belgi" : null}>
              <Building2 size={12} style={{ color: t.sub }} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="MCHJ / IP nomi" aria-label="Mijoz nomi" className="w-full bg-transparent text-[10px] outline-none" style={{ color: t.ink }} />
            </Field>
            <Field t={t} label="INN * (9 raqam)" err={touched && innErr ? "9 ta raqam kiriting" : null}>
              <FileText size={12} style={{ color: t.sub }} />
              <input value={inn} onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" placeholder="305412778" aria-label="INN" className="w-full bg-transparent font-mono text-[10px] outline-none" style={{ color: t.ink }} />
            </Field>
            <div>
              <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Shahar *</p>
              <div className="flex flex-wrap gap-1">
                {["Toshkent", "Samarqand", "Buxoro", "Andijon"].map((c) => (
                  <Chip key={c} t={t} accent={accent} active={city === c} onClick={() => setCity(c)}>{c}</Chip>
                ))}
              </div>
              {!city && <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>Shaharlar agentga biriktirilgan hududdan olinadi.</p>}
            </div>
            <div>
              <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Toifa</p>
              <div className="flex gap-1">
                {["A", "B", "C"].map((x) => <Chip key={x} t={t} accent={accent} active={tier === x} onClick={() => setTier(x)}>{x} toifa</Chip>)}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="relative h-[150px] overflow-hidden rounded-[14px]" style={{ background: t.isDark ? "#0D1524" : "#E4EDF6", border: `1px solid ${t.line}` }}>
              <svg className="absolute inset-0 size-full" viewBox="0 0 300 150" aria-hidden>
                <g stroke={t.isDark ? "#1C2A44" : "#fff"} strokeWidth="6" fill="none">
                  <path d="M0 50 H300" /><path d="M0 105 H300" /><path d="M90 0 V150" /><path d="M210 0 V150" />
                </g>
              </svg>
              {gps && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="absolute inset-0 -m-3 rounded-full" style={{ background: `${accent.hex}28` }} />
                  <span className="relative grid size-7 place-items-center rounded-full border-2 border-white on-acc" style={{ background: accent.hex }}><MapPin size={13} /></span>
                </span>
              )}
              <button type="button" onClick={() => { setGps(true); ctx.toast("GPS: 41.31108, 69.27973"); }} className="absolute inset-x-3 bottom-3 rounded-[10px] py-2 text-[9.5px] font-bold on-acc" style={{ background: gps ? "#22B573" : accent.hex, color: gps ? "#fff" : accent.onAccent }}>
                {gps ? "✓ Lokatsiya olindi" : "GPS orqali aniqlash"}
              </button>
            </div>
            <p className="text-[8px]" style={{ color: t.sub }}>
              {gps ? "Koordinata: 41.31108, 69.27973 · aniqlik 8 m" : "Nuqtani GPS bilan bog'lang — vizit radiusi shu yerdan hisoblanadi."}
            </p>
            <button type="button" onClick={() => { setPhoto(true); ctx.toast("Nuqta fotosi olindi"); }} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[9.5px] font-semibold" style={{ background: photo ? t.accSoft : t.card, border: `1px solid ${photo ? accent.hex : t.line}`, color: photo ? t.accInk : t.ink }}>
              <Camera size={12} /> {photo ? "Foto biriktirildi" : "Nuqta fotosini olish"}
            </button>
          </>
        )}

        {step === 2 && (
          <div className="rounded-[14px] p-3 text-[9px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            {[["Nomi", name || "—"], ["INN", inn || "—"], ["Shahar", city || "—"], ["Toifa", tier], ["GPS", gps ? "41.31108, 69.27973" : "—"], ["Foto", photo ? "Biriktirildi" : "Yo'q"]].map(([l, v], i) => (
              <div key={l} className="flex justify-between py-1" style={{ borderBottom: i < 5 ? `1px solid ${t.line}` : "none" }}>
                <span style={{ color: t.sub }}>{l}</span>
                <span className="font-semibold" style={{ color: t.ink }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => {
            setTouched(true);
            if (!canNext) { ctx.toast(step === 1 ? "GPS lokatsiyasini oling" : "Majburiy maydonlarni to'ldiring"); return; }
            setTouched(false);
            if (step < 2) setStep(step + 1);
            else { setSaved(true); ctx.toast("Mijoz saqlandi"); }
          }}
          className="w-full rounded-[11px] py-2.5 text-[10.5px] font-bold on-acc"
          style={{ background: accent.gradient, opacity: canNext ? 1 : 0.55 }}
        >
          {step < 2 ? "Davom etish →" : "Mijozni saqlash"}
        </button>
      </div>
    </div>
  );
}

function Field({ t, label, err, children }: { t: Props["t"]; label: string; err: string | null; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>{label}</p>
      <div className="flex items-center gap-2 rounded-[10px] px-2.5 py-2" style={{ background: t.card2, border: `1px solid ${err ? "#E0574B" : t.line}` }}>{children}</div>
      {err && <p className="mt-1 text-[7.5px] font-medium text-[#E0574B]">{err}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GLOBAL SEARCH — agent_search_page.dart                             */
/* ------------------------------------------------------------------ */

const SEARCH_DB = {
  clients: [
    { t: "MCHJ O'zbekiston Gullari", s: "TT-0847 · Yunusobod", go: "client-detail" as const },
    { t: "IP Karimov Store", s: "TT-0921 · Chilonzor", go: "client-detail" as const },
    { t: "OOO Navruz Shop", s: "TT-1033 · Mirzo Ulug'bek", go: "client-detail" as const },
  ],
  products: [
    { t: "Coca-Cola 1.5L", s: "12 000 so'm · qoldiq 48", go: "order" as const },
    { t: "Lay's Classic 80g", s: "9 500 so'm · qoldiq 32", go: "order" as const },
    { t: "Nescafé Gold 100g", s: "42 000 so'm · qoldiq 14", go: "order" as const },
  ],
  orders: [
    { t: "Buyurtma №1847", s: "1 240 000 so'm · Tasdiqlangan", go: "order-detail" as const },
    { t: "Buyurtma №1846", s: "480 000 so'm · Yetkazildi", go: "order-detail" as const },
  ],
};

export function SearchScreen({ t, accent, ctx }: Props) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | keyof typeof SEARCH_DB>("all");
  const [recent, setRecent] = useState(["Gullari", "Coca-Cola", "1847"]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const keys = tab === "all" ? (Object.keys(SEARCH_DB) as (keyof typeof SEARCH_DB)[]) : [tab];
    return keys
      .map((k) => ({ k, rows: SEARCH_DB[k].filter((r) => !needle || `${r.t} ${r.s}`.toLowerCase().includes(needle)) }))
      .filter((g) => g.rows.length);
  }, [q, tab]);

  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  const LABEL: Record<string, string> = { clients: "Mijozlar", products: "Mahsulotlar", orders: "Buyurtmalar" };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Qidiruv" sub="Mijoz, mahsulot va buyurtmalar" onBack={() => ctx.go("home")} />
        <div className="flex items-center gap-2 rounded-[11px] px-3 py-2.5" style={{ background: t.card, border: `1px solid ${accent.hex}` }}>
          <Search size={13} style={{ color: t.accText }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, kod yoki raqam…" aria-label="Global qidiruv" className="w-full bg-transparent text-[10.5px] outline-none" style={{ color: t.ink }} />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Tozalash" style={{ color: t.sub }}><X size={12} /></button>}
        </div>
        <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {(["all", "clients", "products", "orders"] as const).map((k) => (
            <Chip key={k} t={t} accent={accent} active={tab === k} onClick={() => setTab(k)}>{k === "all" ? "Barchasi" : LABEL[k]}</Chip>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-3 pt-2.5">
        {!q && (
          <div className="mb-3">
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>So'nggi so'rovlar</p>
            <div className="flex flex-wrap gap-1">
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => setQ(r)} className="flex items-center gap-1 rounded-full px-2 py-1 text-[8.5px]" style={{ background: t.card2, color: t.sub }}>
                  <Clock3 size={8} /> {r}
                </button>
              ))}
              {recent.length > 0 && (
                <button type="button" onClick={() => { setRecent([]); ctx.toast("Tarix tozalandi"); }} className="rounded-full px-2 py-1 text-[8.5px] font-semibold" style={{ color: "#E0574B" }}>Tozalash</button>
              )}
            </div>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.k} className="mb-2.5">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>{LABEL[g.k]} · {g.rows.length}</p>
            <div className="space-y-1">
              {g.rows.map((r, i) => (
                <button key={r.t} type="button" onClick={() => { setRecent((p) => [q || r.t, ...p.filter((x) => x !== (q || r.t))].slice(0, 5)); ctx.go(r.go); }} className={cn("flex w-full items-center gap-2 rounded-[11px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-[9px]" style={{ background: t.accSoft, color: t.accInk }}>
                    {g.k === "clients" ? <User size={12} /> : g.k === "products" ? <ShoppingBag size={12} /> : <FileText size={12} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{r.t}</span>
                    <span className="block truncate text-[8px]" style={{ color: t.sub }}>{r.s}</span>
                  </span>
                  <ChevronRight size={11} style={{ color: t.sub }} />
                </button>
              ))}
            </div>
          </div>
        ))}

        {!total && (
          <div className="grid place-items-center py-12 text-center">
            <Search size={22} style={{ color: t.sub }} />
            <p className="mt-2 text-[10px] font-bold" style={{ color: t.ink }}>Hech narsa topilmadi</p>
            <p className="text-[8.5px]" style={{ color: t.sub }}>«{q}» bo'yicha natija yo'q</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI MONTHLY CALC — agent_kpi_calc_page.dart                        */
/* ------------------------------------------------------------------ */

export function KpiCalcScreen({ t, accent, ctx }: Props) {
  const [tab, setTab] = useState<0 | 1>(0);
  const workDays = 26, elapsed = 18;
  const monthPlan = 34200000, fact = 21800000;
  const dayBase = Math.round(monthPlan / workDays);
  const pct = Math.round((fact / monthPlan) * 100);
  const pace = Math.round(((fact / elapsed) * workDays / monthPlan) * 100);
  const premium = Math.round(fact * (pct >= 100 ? 0.08 : pct >= 80 ? 0.05 : 0.03));
  const todayRemaining = Math.max(0, dayBase - 980000);
  const monthRemaining = monthPlan - fact;

  const days = Array.from({ length: 26 }, (_, i) => ({
    d: i + 1,
    state: i < elapsed ? (i % 7 === 5 ? "rest" : fact / elapsed > dayBase * (0.8 + (i % 5) * 0.1) ? "hit" : "miss") : "future",
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="KPI · Oylik hisob" sub="Iyul 2026 · Aziz Qodirov" onBack={() => ctx.go("kpi")} />
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {["Hisob-kitob", "Kunlar diagnostikasi"].map((x, i) => (
            <button key={x} type="button" onClick={() => setTab(i as 0 | 1)} className="flex-1 rounded-[7px] py-1.5 text-[8.5px] font-semibold" style={{ background: tab === i ? t.card : "transparent", color: tab === i ? t.ink : t.sub }}>{x}</button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {tab === 0 ? (
          <>
            <div className="relative overflow-hidden rounded-[18px] p-3.5 text-white" style={{ background: "linear-gradient(140deg,#0B2538,#0F4544)" }}>
              <div className="absolute -right-8 -top-10 size-28 rounded-full blur-2xl" style={{ background: `${accent.hex}55` }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/50">KPI bajarilishi</p>
              <p className="mt-1 font-display text-[28px] font-bold leading-none">{pct}<span className="text-[13px] text-[#86EFAC]">%</span></p>
              <p className="mt-1 font-mono text-[8.5px] text-white/60">{fmt(fact)} / {fmt(monthPlan)} so'm</p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div className="h-full rounded-full bg-[#86EFAC] transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[8px] text-white/70">
                <TrendingUp size={10} className="text-[#86EFAC]" />
                Temp bo'yicha prognoz: <b className="text-white">{pace}%</b>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Ish kunlari", v: `${elapsed}/${workDays}`, s: "kun", icon: Clock3 },
                { l: "Kunlik baza", v: fmt(dayBase), s: "so'm", icon: Target },
                { l: "Oylik savdo", v: `${(fact / 1e6).toFixed(1)} mln`, s: "so'm", icon: Wallet },
                { l: "Premiya", v: fmt(premium), s: `${pct >= 100 ? 8 : pct >= 80 ? 5 : 3}%`, icon: Gift },
              ].map((x, i) => (
                <div key={x.l} className={cn("rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                  <x.icon size={12} style={{ color: t.accText }} />
                  <p className="mt-1.5 font-mono text-[13px] font-bold leading-none" style={{ color: t.ink }}>{x.v}</p>
                  <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>{x.l} · {x.s}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[10px] font-bold" style={{ color: t.ink }}>Bugun nima qilish kerak</p>
              {[
                { n: 1, txt: `Marshrut summasini yoping: yana ${fmt(todayRemaining)} so'm kunlik ulushgacha.` },
                { n: 2, txt: `Oylik rejagacha: ${fmt(monthRemaining)} so'm (${pct}% bajarildi).` },
              ].map((r) => (
                <div key={r.n} className="mt-2 flex gap-2">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full font-mono text-[7.5px] font-bold on-acc" style={{ background: accent.hex }}>{r.n}</span>
                  <p className="text-[8.5px] leading-snug" style={{ color: t.sub }}>{r.txt}</p>
                </div>
              ))}
              <button type="button" onClick={() => ctx.go("route-plan")} className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-[9px] py-2 text-[9px] font-bold on-acc" style={{ background: accent.hex }}>
                Marshrutni ochish <ArrowUpRight size={10} />
              </button>
            </div>

            <div className="rounded-[12px] p-2.5 text-[8px]" style={{ background: t.accSoft, color: t.accInk }}>
              Premiya formulasi: oylik fakt × {(pct >= 100 ? 8 : pct >= 80 ? 5 : 3)}% (zinapoya). KPI guruhlari bo'yicha batafsil — «Kunlar diagnostikasi».
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold" style={{ color: t.ink }}>Kunlik baza bajarilishi</p>
                <span className="font-mono text-[8px]" style={{ color: t.sub }}>{elapsed}/{workDays} kun</span>
              </div>
              <div className="mt-2.5 grid grid-cols-7 gap-1">
                {days.map((d) => (
                  <button
                    key={d.d}
                    type="button"
                    onClick={() => d.state !== "future" && ctx.toast(`${d.d}-iyul: ${d.state === "hit" ? "baza bajarildi" : d.state === "miss" ? "baza bajarilmadi" : "dam olish"}`)}
                    className="grid aspect-square place-items-center rounded-[6px] font-mono text-[7.5px] font-bold"
                    style={{
                      background: d.state === "hit" ? "#22B57322" : d.state === "miss" ? "#E0574B22" : d.state === "rest" ? t.card2 : "transparent",
                      color: d.state === "hit" ? "#1E9E63" : d.state === "miss" ? "#E0574B" : t.sub,
                      border: `1px solid ${d.state === "future" ? t.line : "transparent"}`,
                      opacity: d.state === "future" ? 0.4 : 1,
                    }}
                  >
                    {d.d}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[7.5px]">
                {[["#22B573", "Bajarildi · 12"], ["#E0574B", "Bajarilmadi · 4"], [t.sub, "Dam olish · 2"]].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1" style={{ color: t.sub }}><span className="size-2 rounded-sm" style={{ background: c }} /> {l}</span>
                ))}
              </div>
            </div>
            <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[10px] font-bold" style={{ color: t.ink }}>KPI guruhlari</p>
              {[["Savdo hajmi", 64, 0.5], ["Faol mijozlar", 82, 0.3], ["Yangi nuqtalar", 40, 0.2]].map(([l, v, w], i) => (
                <div key={l as string} className="mt-2">
                  <div className="flex justify-between text-[8.5px]">
                    <span className="font-semibold" style={{ color: t.ink }}>{l} <span style={{ color: t.sub }}>· {(Number(w) * 100).toFixed(0)}%</span></span>
                    <span className="font-mono font-bold" style={{ color: t.accText }}>{v}%</span>
                  </div>
                  <div className="mt-1 h-[4px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                    <div className="bar-grow h-full rounded-full" style={{ width: `${v}%`, background: accent.hex, animationDelay: `${i * 80}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

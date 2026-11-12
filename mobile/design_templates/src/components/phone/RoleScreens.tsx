import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bell,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  CreditCard,
  Delete,
  FileText,
  Landmark,
  MapPin,
  Menu,
  Navigation,
  Package,
  PackageCheck,
  PenLine,
  Phone,
  Plus,
  Printer,
  Store,
  Search,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { ScreenKey } from "../../data/design";
import { cn } from "../../utils/cn";
import { anim, Chip, fmt, IconBtn, LiveClock, ScreenHead, type Props } from "./PhoneScreens";

/* ============================ EXPEDITOR ============================ */

function ExpHome({ t, accent, ctx }: Props) {
  const stops = [
    { n: "MCHJ O'zbekiston Gullari", inv: "NK-2104", sum: 1240000, state: "Yo'lda", tone: accent.hex },
    { n: "IP Karmorov Store", inv: "NK-2101", sum: 480000, state: "Yetkazildi", tone: "#22b573" },
    { n: "OOO Navruz Shop", inv: "NK-2109", sum: 2150000, state: "Navbatda", tone: t.sub },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 px-4 pb-8 pt-2 on-acc" style={{ background: accent.gradient, borderRadius: "0 0 26px 26px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-full bg-white/90 text-[11px] font-bold text-[#0E1420] shadow-sm">BR</div>
            <div>
              <p className="text-[9px] on-acc-70">Xayrli kun,</p>
              <p className="text-[13px] font-bold tracking-[-0.02em]">Bobur Rahimov</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => ctx.go("menu")} aria-label="Menyu" className="grid size-8 place-items-center rounded-full bg-white/90 text-[#0E1420] shadow-sm transition active:scale-90"><Menu size={14} /></button>
            <button type="button" onClick={() => ctx.go("notifications")} aria-label="Bildirishnomalar" className="relative grid size-8 place-items-center rounded-full bg-white/90 text-[#0E1420] shadow-sm transition active:scale-90">
              <Bell size={14} />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#EF4444]" />
            </button>
          </div>
        </div>

        <div className={cn("mt-3.5 flex items-end justify-between", anim(ctx, 0).className)}>
          <div>
            <p className="flex items-center gap-1.5 text-[8.5px] on-acc-70">
              Joriy yetkazish
              <span className="flex items-center gap-1 rounded-full bg-[#0E1420] px-1.5 py-[2px] text-[7px] font-bold text-white">
                <span className="size-1 rounded-full bg-[#FBBF24]" /> Yo'lda
              </span>
            </p>
            <p className="mt-1 font-display text-[25px] font-bold leading-none tracking-[-0.035em]">NK-2104</p>
          </div>
          <button type="button" onClick={() => ctx.go("exp-delivery")} aria-label="Yetkazishni ochish" className="grid size-9 place-items-center rounded-full bg-[#0E1420] text-white shadow-md transition active:scale-90">
            <ArrowUpRight size={15} />
          </button>
        </div>

        <div className="mt-3 flex justify-between font-mono text-[7.5px] on-acc-70">
          <span>09:40 · Ombor</span>
          <span>≈ 12:20 · Navruz Shop</span>
        </div>
        <div className="relative mt-1.5 h-6" role="img" aria-label="Yetkazish jarayoni: 4 bosqichdan 2 tasi bajarildi">
          <div className="trk-dots absolute left-2 right-2 top-1/2 h-[2px] -translate-y-1/2 opacity-70" />
          {[0, 26].map((p) => (
            <span key={p} className="absolute top-1/2 grid size-[18px] -translate-y-1/2 place-items-center rounded-full bg-[#0E1420] text-white" style={{ left: `${p}%` }}>
              <Check size={10} strokeWidth={3.5} />
            </span>
          ))}
          <span className="trk-run absolute top-1/2 -mt-[10px] flex h-5 w-[34px] items-center justify-center rounded-full bg-white text-[#0E1420] shadow-md">
            <Truck size={12} className="trk-bump" />
          </span>
          <span className="absolute right-0 top-1/2 grid size-[18px] -translate-y-1/2 place-items-center rounded-full border-2 border-current">
            <span className="size-1.5 rounded-full bg-current" />
          </span>
        </div>

        <button
          type="button"
          onClick={() => ctx.go("exp-deliveries")}
          className="absolute inset-x-4 -bottom-[18px] flex items-center gap-2 rounded-full px-3.5 py-2.5 text-left shadow-[0_10px_24px_-14px_rgba(14,20,32,.5)]"
          style={{ background: t.card, border: `1px solid ${t.line}` }}
        >
          <Search size={13} style={{ color: t.sub }} />
          <span className="text-[10px]" style={{ color: t.sub }}>"NK-2104" bo'yicha izlash…</span>
        </button>
      </div>
      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-8">
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "Yig'ilgan naqd", v: "3 870 000", u: "so'm" },
            { l: "Yetkazildi", v: "7 / 12", u: "nakladnoy" },
          ].map((x, i) => (
            <div key={x.l} className={cn("rounded-[16px] p-3", anim(ctx, i + 1).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[8px]" style={{ color: t.sub }}>{x.l}</p>
              <p className="mt-1 font-display text-[16px] font-bold leading-none tracking-[-0.02em]" style={{ color: t.ink }}>{x.v}</p>
              <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>{x.u}</p>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                <div className="h-full rounded-full" style={{ width: i ? "58%" : "72%", background: accent.hex }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { i: <Truck size={15} />, l: "Yetkazish", go: "exp-deliveries" as ScreenKey },
            { i: <FileText size={15} />, l: "Nakladnoy", go: "exp-invoices" as ScreenKey },
            { i: <Wallet size={15} />, l: "To'lov", go: "exp-payments" as ScreenKey },
            { i: <Users size={15} />, l: "Qarzdor", go: "exp-debtors" as ScreenKey },
          ].map((a, i) => (
            <button key={a.l} type="button" onClick={() => ctx.go(a.go)} className={cn("flex flex-col items-center gap-1.5 rounded-[14px] py-2.5 active:scale-95", anim(ctx, i + 2).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <span className="grid size-7 place-items-center rounded-[9px]" style={{ background: t.accSoft, color: t.accInk }}>{a.i}</span>
              <span className="text-[8.5px] font-semibold" style={{ color: t.ink }}>{a.l}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10.5px] font-bold" style={{ color: t.ink }}>Keyingi to'xtashlar</p>
            <button type="button" onClick={() => ctx.go("exp-deliveries")} className="text-[8.5px] font-semibold" style={{ color: t.accText }}>Barchasi</button>
          </div>
          <div className="space-y-1.5">
            {stops.map((s, i) => (
              <button key={s.inv} type="button" onClick={() => ctx.go("exp-delivery")} className={cn("flex w-full items-center gap-2 rounded-[13px] p-2.5 text-left active:scale-[0.99]", anim(ctx, i + 6).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: `${s.tone}1A`, color: s.tone }}><Package size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold" style={{ color: t.ink }}>{s.n}</span>
                  <span className="text-[8.5px]" style={{ color: t.sub }}>{s.inv} · {fmt(s.sum)} so'm</span>
                </span>
                <span className="rounded-full px-1.5 py-[3px] text-[7.5px] font-bold uppercase" style={{ background: `${s.tone}1A`, color: s.tone }}>{s.state}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpDeliveries({ t, accent, ctx }: Props) {
  const [f, setF] = useState(0);
  const all = [
    { n: "MCHJ O'zbekiston Gullari", inv: "NK-2104", sum: 1240000, items: 14, st: 0 },
    { n: "OOO Navruz Shop", inv: "NK-2109", sum: 2150000, items: 22, st: 0 },
    { n: "MCHJ Lalaku Savdo", inv: "NK-2110", sum: 640000, items: 6, st: 0 },
    { n: "IP Karmorov Store", inv: "NK-2101", sum: 480000, items: 8, st: 1 },
    { n: "IP Baraka Market", inv: "NK-2098", sum: 310000, items: 4, st: 1 },
  ];
  const list = all.filter((d) => (f === 0 ? true : f === 1 ? d.st === 0 : d.st === 1));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Yetkazishlar" sub="12 nakladnoy · 7 bajarildi" right={<IconBtn t={t} onClick={() => ctx.toast("Xarita rejimi")}><MapPin size={14} /></IconBtn>} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Barchasi · 12", "Navbatda · 5", "Yetkazildi · 7"].map((c, i) => <Chip key={c} t={t} accent={accent} active={f === i} onClick={() => setF(i)}>{c}</Chip>)}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {list.map((d, i) => (
          <button key={d.inv} type="button" onClick={() => ctx.go("exp-delivery")} className={cn("flex w-full items-center gap-2.5 rounded-[14px] p-2.5 text-left active:scale-[0.99]", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <span className="grid size-9 place-items-center rounded-[11px]" style={{ background: d.st ? "#22b5731A" : t.accSoft, color: d.st ? "#22b573" : t.accInk }}>{d.st ? <PackageCheck size={15} /> : <Truck size={15} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] font-semibold" style={{ color: t.ink }}>{d.n}</span>
              <span className="text-[8.5px]" style={{ color: t.sub }}>{d.inv} · {d.items} pozitsiya</span>
              <span className="block font-mono text-[9px] font-bold" style={{ color: t.ink }}>{fmt(d.sum)} so'm</span>
            </span>
            <ChevronRight size={13} style={{ color: t.sub }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ExpDelivery({ t, accent, ctx }: Props) {
  const [qty, setQty] = useState([10, 6, 12]);
  const [signed, setSigned] = useState(false);
  const items = [
    { n: "Coca-Cola 1.5L", o: 10, p: 12000 },
    { n: "Lay's Classic 80g", o: 6, p: 9500 },
    { n: "Nescafé Gold 100g", o: 12, p: 42000 },
  ];
  const total = items.reduce((s, it, i) => s + qty[i] * it.p, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="NK-2104" sub="MCHJ O'zbekiston Gullari" onBack={() => ctx.go("exp-deliveries")} right={<IconBtn t={t} onClick={() => ctx.toast("Mijozga qo'ng'iroq")}><Phone size={13} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        <div className="flex items-center gap-2 rounded-[12px] p-2.5" style={{ background: t.accSoft }}>
          <Navigation size={13} style={{ color: t.accText }} />
          <p className="flex-1 text-[9px] font-medium" style={{ color: t.accInk }}>Yunusobod 4-kv, 21 · 1.2 km · 4 daq</p>
          <button type="button" onClick={() => ctx.toast("Navigator ochildi")} className="rounded-md px-2 py-1 text-[8px] font-bold on-acc" style={{ background: accent.hex }}>Yo'l</button>
        </div>
        <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${t.line}` }}>
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Pozitsiyalar</p>
            <span className="text-[8px]" style={{ color: t.sub }}>qisman yetkazish mumkin</span>
          </div>
          {items.map((it, i) => (
            <div key={it.n} className={cn("flex items-center gap-2 px-3 py-2", anim(ctx, i).className)} style={{ borderBottom: i < 2 ? `1px solid ${t.line}` : "none" }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{it.n}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>Buyurtma: {it.o} · {fmt(it.p)}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full p-0.5" style={{ background: t.card2 }}>
                <button type="button" onClick={() => setQty((q) => q.map((v, j) => (j === i ? Math.max(0, v - 1) : v)))} className="grid size-5 place-items-center rounded-full text-[10px]" style={{ background: t.card, color: t.ink }}>−</button>
                <span className="w-4 text-center font-mono text-[9px] font-bold" style={{ color: qty[i] < it.o ? "#e0a023" : t.ink }}>{qty[i]}</span>
                <button type="button" onClick={() => setQty((q) => q.map((v, j) => (j === i ? Math.min(it.o, v + 1) : v)))} className="grid size-5 place-items-center rounded-full text-[10px] on-acc" style={{ background: accent.hex }}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => ctx.toast("Foto tasdiq olindi")} className="flex items-center justify-center gap-1 rounded-[11px] py-2.5 text-[9.5px] font-semibold" style={{ background: t.card, border: `1px solid ${t.line}`, color: t.ink }}><Camera size={12} /> Foto</button>
          <button type="button" onClick={() => { setSigned(true); ctx.toast("Imzo saqlandi"); }} className="flex items-center justify-center gap-1 rounded-[11px] py-2.5 text-[9.5px] font-semibold" style={{ background: signed ? t.accSoft : t.card, border: `1px solid ${signed ? accent.hex : t.line}`, color: signed ? t.accInk : t.ink }}>{signed ? <Check size={12} /> : <PenLine size={12} />} {signed ? "Imzolandi" : "Imzo"}</button>
        </div>
      </div>
      <div className="border-t px-4 pb-2 pt-2.5" style={{ borderColor: t.line, background: t.card }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[8px]" style={{ color: t.sub }}>Yetkaziladigan summa</p>
            <p className="font-display text-[16px] font-bold" style={{ color: t.ink }}>{fmt(total)} <span className="text-[9px] font-medium" style={{ color: t.sub }}>so'm</span></p>
          </div>
          <button type="button" onClick={() => ctx.go("exp-payments")} className="rounded-[10px] px-3.5 py-2.5 text-[10px] font-bold on-acc active:scale-95" style={{ background: accent.hex }}>To'lovga o'tish</button>
        </div>
      </div>
    </div>
  );
}

function ExpPayments({ t, accent, ctx }: Props) {
  const [method, setMethod] = useState(0);
  const [amount, setAmount] = useState("1240000");
  const due = 1240000;
  const n = Number(amount || 0);
  const press = (d: string) => setAmount((a) => (d === "⌫" ? a.slice(0, -1) : a.length < 9 ? a + d : a));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="To'lov qabul qilish" sub="NK-2104 · O'zbekiston Gullari" onBack={() => ctx.go("exp-home")} right={<IconBtn t={t} onClick={() => ctx.go("exp-pay-info")}><Landmark size={13} /></IconBtn>} />
        <div className="grid grid-cols-3 gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {[["Naqd", <Banknote size={11} key="a" />], ["Karta", <CreditCard size={11} key="b" />], ["O'tkazma", <Landmark size={11} key="c" />]].map(([l, ic], i) => (
            <button key={String(l)} type="button" onClick={() => setMethod(i)} className="flex items-center justify-center gap-1 rounded-[7px] py-1.5 text-[8.5px] font-semibold transition" style={{ background: method === i ? t.card : "transparent", color: method === i ? t.ink : t.sub, boxShadow: method === i ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>{ic}{l}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-3 pt-3">
        <div className="rounded-[16px] p-3.5 text-center" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[8px] uppercase tracking-wider" style={{ color: t.sub }}>Summa</p>
          <p className="mt-1 font-display text-[26px] font-bold tabular-nums tracking-[-0.04em]" style={{ color: t.ink }}>{fmt(n)}<span className="ml-1 text-[10px] font-medium" style={{ color: t.sub }}>so'm</span></p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[8.5px]">
            <span style={{ color: t.sub }}>Qarz: {fmt(due)}</span>
            <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ background: n >= due ? "#22b5731A" : "#e0a0231A", color: n >= due ? "#22b573" : "#e0a023" }}>{n >= due ? "To'liq" : `Qoldi ${fmt(due - n)}`}</span>
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          {[500000, 1000000, due].map((q) => (
            <button key={q} type="button" onClick={() => setAmount(String(q))} className="flex-1 rounded-lg py-1.5 font-mono text-[8px] font-semibold" style={{ background: t.card2, color: t.ink }}>{q === due ? "To'liq" : fmt(q)}</button>
          ))}
        </div>
        <div className="mt-2 grid flex-1 grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className="rounded-[10px] font-display text-[15px] font-semibold active:scale-95" style={{ background: t.card, color: t.ink, border: `1px solid ${t.line}` }}>{d === "⌫" ? <Delete size={14} className="mx-auto" /> : d}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={() => ctx.toast("Chek chop etilmoqda")} className="grid size-10 place-items-center rounded-[10px]" style={{ background: t.card2, color: t.ink }}><Printer size={14} /></button>
          <button type="button" disabled={!n} onClick={() => { ctx.toast(`${fmt(n)} so'm qabul qilindi`); ctx.go("exp-home"); }} className="flex-1 rounded-[10px] text-[10.5px] font-bold on-acc disabled:opacity-40" style={{ background: accent.hex }}>Qabul qilish</button>
        </div>
      </div>
    </div>
  );
}

function ExpReturns({ t, accent, ctx }: Props) {
  const [f, setF] = useState(0);
  const rows = [
    { n: "OOO Navruz Shop", item: "Fanta 1.5L × 6", reason: "Muddati o'tgan", st: "Kutilmoqda", tone: "#e0a023" },
    { n: "IP Karmorov Store", item: "Lay's 80g × 12", reason: "Shikastlangan", st: "Tasdiqlandi", tone: "#22b573" },
    { n: "MCHJ Lalaku Savdo", item: "Snickers × 20", reason: "Ortiqcha", st: "Rad etildi", tone: "#e0574b" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Qaytarishlar" sub="Bu hafta · 3 ta" onBack={() => ctx.go("exp-home")} right={<IconBtn t={t} onClick={() => ctx.toast("Yangi qaytarish formasi")}><Plus size={15} /></IconBtn>} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Barchasi", "Kutilmoqda", "Tasdiqlangan"].map((c, i) => <Chip key={c} t={t} accent={accent} active={f === i} onClick={() => setF(i)}>{c}</Chip>)}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {rows.filter((r) => (f === 0 ? true : f === 1 ? r.st === "Kutilmoqda" : r.st === "Tasdiqlandi")).map((r, i) => (
          <div key={r.n} className={cn("rounded-[14px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold" style={{ color: t.ink }}>{r.n}</p>
              <span className="rounded-full px-1.5 py-[3px] text-[7.5px] font-bold" style={{ background: `${r.tone}1A`, color: r.tone }}>{r.st}</span>
            </div>
            <p className="mt-1 text-[9px]" style={{ color: t.sub }}>{r.item}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="rounded-md px-1.5 py-0.5 text-[7.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>{r.reason}</span>
              <span className="flex items-center gap-0.5 text-[7.5px]" style={{ color: t.sub }}><Camera size={8} /> 2 foto</span>
              <button type="button" onClick={() => ctx.toast("Qaytarish detali")} className="ml-auto text-[8px] font-semibold" style={{ color: t.accText }}>Ochish</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => ctx.toast("Qaytarish yaratish oqimi")} className="flex w-full items-center justify-center gap-1 rounded-[12px] border border-dashed py-3 text-[9.5px] font-semibold" style={{ borderColor: t.line, color: t.sub }}><Plus size={12} /> Buyurtma bo'yicha qaytarish</button>
      </div>
    </div>
  );
}

function ExpDebtors({ t, accent, ctx }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = [
    { n: "MCHJ O'zbekiston Gullari", debt: 1240000, days: 18 },
    { n: "OOO Navruz Shop", debt: 480000, days: 6 },
    { n: "MCHJ Lalaku Savdo", debt: 120000, days: 42 },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Qarzdorlar" sub="Jami 1 840 000 so'm · 3 mijoz" right={<IconBtn t={t} onClick={() => ctx.go("debtors-by-orders")}><FileText size={13} /></IconBtn>} />
        <div className="grid grid-cols-3 gap-1.5">
          {[["0–7", 480000, "#22b573"], ["8–30", 1240000, "#e0a023"], ["30+", 120000, "#e0574b"]].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-[11px] p-2" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[7.5px] font-semibold" style={{ color: c as string }}>{l} kun</p>
              <p className="font-mono text-[9px] font-bold" style={{ color: t.ink }}>{fmt(v as number)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {rows.map((r, i) => (
          <div key={r.n} className={cn("rounded-[14px]", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <button type="button" onClick={() => setOpen(open === r.n ? null : r.n)} className="flex w-full items-center gap-2.5 p-2.5 text-left">
              <span className="grid size-8 place-items-center rounded-[10px] text-[10px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>{r.n.split(" ")[1]?.[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold" style={{ color: t.ink }}>{r.n}</span>
                <span className="text-[8px]" style={{ color: r.days > 30 ? "#e0574b" : t.sub }}>{r.days} kun · {r.days > 30 ? "muddati o'tgan" : "muddatda"}</span>
              </span>
              <span className="font-mono text-[9.5px] font-bold" style={{ color: "#e0574b" }}>−{fmt(r.debt)}</span>
            </button>
            {open === r.n && (
              <div className="space-y-1 px-2.5 pb-2.5">
                {[["12.06", "Buyurtma #1847", -1240000], ["18.06", "To'lov · naqd", 500000], ["24.06", "Buyurtma #1872", -500000]].map(([d, l, v]) => (
                  <div key={String(l)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[8.5px]" style={{ background: t.card2 }}>
                    <span className="font-mono" style={{ color: t.sub }}>{d}</span>
                    <span className="flex-1" style={{ color: t.ink }}>{l}</span>
                    <span className="font-mono font-semibold" style={{ color: (v as number) > 0 ? "#22b573" : "#e0574b" }}>{(v as number) > 0 ? "+" : ""}{fmt(v as number)}</span>
                  </div>
                ))}
                <button type="button" onClick={() => ctx.go("exp-payments")} className="mt-1 w-full rounded-lg py-2 text-[9px] font-bold on-acc" style={{ background: accent.hex }}>To'lov qabul qilish</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ SUPERVISOR ============================ */

const AGENTS = [
  { n: "Aziz Qodirov", ini: "AQ", visits: "9/12", pct: 78, last: "2 daq", online: true },
  { n: "Malika Karimova", ini: "MK", visits: "11/12", pct: 92, last: "hozir", online: true },
  { n: "Sardor Nazarov", ini: "SN", visits: "5/11", pct: 46, last: "38 daq", online: false },
  { n: "Dilshod Rasulov", ini: "DR", visits: "7/10", pct: 64, last: "5 daq", online: true },
];

function SupHome({ t, accent, ctx }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9.5px]" style={{ color: t.sub }}>Supervayzer · Toshkent Sharq</p>
            <p className="text-[15px] font-bold tracking-[-0.02em]" style={{ color: t.ink }}>Jamoa holati</p>
          </div>
          <div className="flex gap-1.5">
            <IconBtn t={t} onClick={() => ctx.go("menu")} active><Menu size={14} /></IconBtn>
            <IconBtn t={t} onClick={() => ctx.go("notifications")} dot><Bell size={14} /></IconBtn>
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-3">
        <div className={cn("relative overflow-hidden rounded-[18px] p-3.5 text-white", anim(ctx, 1).className)} style={{ background: `linear-gradient(140deg, ${accent.ink} 0%, #05080F 72%)` }}>
          <div className="absolute -right-8 -top-10 size-28 rounded-full" style={{ background: `${accent.hex}55`, filter: "blur(18px)" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/50">Hudud rejasi · bugun</p>
              <p className="mt-1 font-display text-[24px] font-bold leading-none tracking-[-0.04em]">71<span className="text-[12px] text-lime">%</span></p>
              <p className="mt-1 font-mono text-[8px] text-white/55">32 / 45 vizit · 18.4 mln</p>
            </div>
            <div className="flex -space-x-2">
              {AGENTS.map((a, i) => (
                <span key={a.ini} className="grid size-7 place-items-center rounded-full border-2 text-[8px] font-bold text-white" style={{ background: ["#5CC8F5", "#A79BFF", "#FFC24D", "#5FE3B0"][i], borderColor: "#05080F" }}>{a.ini}</span>
              ))}
            </div>
          </div>
          <div className="relative mt-3 grid grid-cols-3 gap-1.5">
            {[["12", "Faol agent", true], ["3", "Ogohlantirish", false], ["84%", "Foto tasdiq", true]].map(([v, l, ok]) => (
              <div key={String(l)} className="rounded-lg bg-white/8 p-1.5">
                <p className="font-mono text-[11px] font-bold" style={{ color: ok ? "#fff" : "#FFB84D" }}>{v}</p>
                <p className="text-[7px] text-white/55">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={cn("flex items-center gap-2 rounded-[12px] p-2.5", anim(ctx, 2).className)} style={{ background: "#FEF6E6", border: "1px solid #F3D9A4" }}>
          <AlertTriangle size={13} className="text-[#c98a0b]" />
          <p className="flex-1 text-[8.5px] font-medium text-[#8a6300]">Sardor Nazarov 38 daqiqadan beri harakatsiz</p>
          <button type="button" onClick={() => ctx.go("sup-gps")} className="text-[8px] font-bold text-[#8a6300]">Xarita</button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { i: <Users size={15} />, l: "Agentlar", go: "sup-agents" as ScreenKey },
            { i: <MapPin size={15} />, l: "GPS", go: "sup-gps" as ScreenKey },
            { i: <Store size={15} />, l: "Nuqtalar", go: "sup-outlets" as ScreenKey },
            { i: <ArrowUpRight size={15} />, l: "Hisobot", go: "sup-report" as ScreenKey },
          ].map((a, i) => (
            <button key={a.l} type="button" onClick={() => ctx.go(a.go)} className={cn("flex flex-col items-center gap-1.5 rounded-[14px] py-2.5 active:scale-95", anim(ctx, i + 3).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <span className="grid size-7 place-items-center rounded-[9px]" style={{ background: t.accSoft, color: t.accInk }}>{a.i}</span>
              <span className="text-[8.5px] font-semibold" style={{ color: t.ink }}>{a.l}</span>
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[10.5px] font-bold" style={{ color: t.ink }}>Agentlar progressi</p>
          <div className="space-y-1.5">
            {AGENTS.slice(0, 3).map((a, i) => (
              <button key={a.n} type="button" onClick={() => ctx.go("sup-agents")} className={cn("flex w-full items-center gap-2 rounded-[13px] p-2.5 text-left", anim(ctx, i + 7).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                <span className="relative grid size-8 place-items-center rounded-full text-[9px] font-bold on-acc" style={{ background: accent.gradient }}>{a.ini}<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2" style={{ background: a.online ? "#22b573" : "#9aa8a3", borderColor: t.card }} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between text-[9.5px] font-semibold" style={{ color: t.ink }}>{a.n}<span className="font-mono text-[8px]" style={{ color: t.sub }}>{a.visits}</span></span>
                  <span className="mt-1 block h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}><span className="block h-full rounded-full" style={{ width: `${a.pct}%`, background: a.pct < 50 ? "#e0a023" : accent.hex }} /></span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupAgents({ t, accent, ctx }: Props) {
  const [sort, setSort] = useState(0);
  const list = [...AGENTS].sort((a, b) => (sort === 0 ? b.pct - a.pct : a.n.localeCompare(b.n)));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Agentlar" sub="12 agent · 9 onlayn" right={<IconBtn t={t} onClick={() => ctx.toast("Agent qo'shish")}><Plus size={15} /></IconBtn>} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Reyting", "Alifbo"].map((c, i) => <Chip key={c} t={t} accent={accent} active={sort === i} onClick={() => setSort(i)}>{c}</Chip>)}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {list.map((a, i) => (
          <button key={a.n} type="button" onClick={() => ctx.toast(`${a.n} profili`)} className={cn("flex w-full items-center gap-2.5 rounded-[14px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <span className="w-4 font-mono text-[9px] font-bold" style={{ color: i === 0 ? t.accText : t.sub }}>#{i + 1}</span>
            <span className="relative grid size-9 place-items-center rounded-full text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>{a.ini}<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2" style={{ background: a.online ? "#22b573" : "#9aa8a3", borderColor: t.card }} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold" style={{ color: t.ink }}>{a.n}</span>
              <span className="flex items-center gap-1 text-[8px]" style={{ color: t.sub }}><Clock3 size={8} /> {a.last} · {a.visits} vizit</span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-[11px] font-bold" style={{ color: a.pct < 50 ? "#e0a023" : accent.hex }}>{a.pct}%</span>
              <span className="text-[7px]" style={{ color: t.sub }}>reja</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SupGps({ t, accent, ctx }: Props) {
  const [sel, setSel] = useState(0);
  const pins = [
    { x: 28, y: 32 }, { x: 62, y: 24 }, { x: 70, y: 66 }, { x: 40, y: 72 },
  ];
  return (
    <div className="relative flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden" style={{ background: t.isDark ? "#0f2a24" : "#E3EEE8" }}>
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <g stroke={t.isDark ? "#1b3f36" : "#fff"} strokeWidth="2.2" fill="none">
            <path d="M0 30 H100" /><path d="M0 62 H100" /><path d="M35 0 V100" /><path d="M68 0 V100" />
          </g>
          <g stroke={t.isDark ? "#163730" : "#f6faf8"} strokeWidth="1" fill="none">
            <path d="M0 15 H100" /><path d="M0 46 H100" /><path d="M0 80 H100" /><path d="M18 0 V100" /><path d="M52 0 V100" /><path d="M85 0 V100" />
          </g>
          <path d="M20 20 Q40 60 60 40 T85 60" fill="none" stroke={t.isDark ? "#1f5d4d" : "#B8DBD0"} strokeWidth="1.2" />
          <rect x="72" y="70" width="20" height="18" rx="3" fill={t.isDark ? "#143a46" : "#C9E6F3"} />
          <path d={`M${pins[0].x} ${pins[0].y} L${pins[1].x} ${pins[1].y} L${pins[2].x} ${pins[2].y} L${pins[3].x} ${pins[3].y}`} fill="none" stroke={accent.hex} strokeWidth="0.8" strokeDasharray="2 1.5" opacity=".7" />
          <circle cx={pins[2].x} cy={pins[2].y} r="14" fill={`${accent.hex}18`} stroke={accent.hex} strokeWidth="0.5" strokeDasharray="1.5 1" />
        </svg>
        {pins.map((p, i) => (
          <button key={i} type="button" onClick={() => setSel(i)} className="absolute -translate-x-1/2 -translate-y-full transition-transform active:scale-90" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="relative grid size-7 place-items-center rounded-full border-2 border-white text-[8px] font-bold text-white shadow-md" style={{ background: i === 2 ? "#e0a023" : accent.hex, transform: sel === i ? "scale(1.2)" : "scale(1)" }}>
              {AGENTS[i].ini}
              {i !== 2 && <span className="live-dot absolute inset-0 rounded-full" style={{ color: t.accText }} />}
            </span>
          </button>
        ))}
        <div className="absolute left-3 right-3 top-3 flex items-center gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 rounded-[11px] px-2.5 py-2 shadow-sm" style={{ background: t.card }}>
            <Search size={12} style={{ color: t.sub }} />
            <span className="text-[9.5px]" style={{ color: t.sub }}>Agent yoki hudud…</span>
          </div>
          <IconBtn t={t} onClick={() => ctx.toast("Marshrut tarixi · 24 soat")}><Clock3 size={14} /></IconBtn>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className={cn("rounded-[14px] p-2.5 shadow-lg", anim(ctx, 1).className)} key={sel} style={{ background: t.card }}>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full text-[9px] font-bold" style={{ background: sel === 2 ? "#e0a023" : accent.gradient, color: sel === 2 ? "#3A2600" : accent.onAccent }}>{AGENTS[sel].ini}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold" style={{ color: t.ink }}>{AGENTS[sel].n}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>Oxirgi signal: {AGENTS[sel].last} · {AGENTS[sel].visits} vizit · 14 km</p>
              </div>
              <button type="button" onClick={() => ctx.toast("Qo'ng'iroq")} className="grid size-7 place-items-center rounded-full" style={{ background: t.accSoft, color: t.accInk }}><Phone size={12} /></button>
            </div>
            {sel === 2 && <p className="mt-2 rounded-lg px-2 py-1.5 text-[8px] font-medium" style={{ background: "#FEF6E6", color: "#8a6300" }}>⚠ Geofence tashqarisida · 38 daq harakatsiz</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupVisits({ t, accent, ctx }: Props) {
  const [decided, setDecided] = useState<Record<number, string>>({});
  const rows = [
    { a: "Aziz Qodirov", c: "MCHJ O'zbekiston Gullari", time: "09:40 – 10:12", photos: 3, order: 1240000 },
    { a: "Malika Karimova", c: "IP Karmorov Store", time: "10:05 – 10:28", photos: 2, order: 480000 },
    { a: "Dilshod Rasulov", c: "OOO Navruz Shop", time: "11:20 – 11:31", photos: 0, order: 0 },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Vizit nazorati" sub="Tasdiq kutmoqda · 8" right={<IconBtn t={t} onClick={() => ctx.toast("Filtr")}><Search size={13} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        {rows.map((r, i) => (
          <div key={r.c} className={cn("rounded-[14px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full text-[8px] font-bold on-acc" style={{ background: accent.gradient }}>{r.a.split(" ").map((x) => x[0]).join("")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{r.c}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>{r.a} · {r.time}</p>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2].map((p) => (
                <div key={p} className="grid h-11 flex-1 place-items-center rounded-lg text-[7px]" style={{ background: p < r.photos ? t.accSoft : t.card2, color: p < r.photos ? t.accInk : t.sub }}>{p < r.photos ? <Camera size={12} /> : "—"}</div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[8px]" style={{ color: t.sub }}>
              <span>{r.photos} foto · {r.order ? `${fmt(r.order)} so'm` : "buyurtma yo'q"}</span>
              {r.photos === 0 && <span className="font-semibold text-[#e0574b]">Foto yo'q</span>}
            </div>
            {decided[i] ? (
              <div className="mt-2 rounded-lg py-1.5 text-center text-[8.5px] font-bold" style={{ background: decided[i] === "ok" ? "#22b5731A" : "#e0574b1A", color: decided[i] === "ok" ? "#22b573" : "#e0574b" }}>{decided[i] === "ok" ? "Tasdiqlandi" : "Rad etildi"}</div>
            ) : (
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => { setDecided({ ...decided, [i]: "no" }); ctx.toast("Vizit rad etildi · agentga xabar"); }} className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[8.5px] font-semibold" style={{ background: t.card2, color: "#e0574b" }}><X size={11} /> Rad</button>
                <button type="button" onClick={() => { setDecided({ ...decided, [i]: "ok" }); ctx.toast("Vizit tasdiqlandi"); }} className="flex flex-[1.4] items-center justify-center gap-1 rounded-lg py-2 text-[8.5px] font-bold on-acc" style={{ background: accent.hex }}><Check size={11} /> Tasdiqlash</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SupKpi({ t, accent, ctx }: Props) {
  const [mode, setMode] = useState(0);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Hudud KPI" sub="Iyul 2026 · Toshkent Sharq" right={<IconBtn t={t} onClick={() => ctx.toast("Excel eksport")}><ArrowUpRight size={14} /></IconBtn>} />
        <div className="flex gap-1 rounded-[9px] p-1" style={{ background: t.card2 }}>
          {["Agentlar", "Trend"].map((m, i) => <button key={m} type="button" onClick={() => setMode(i)} className="flex-1 rounded-[6px] py-1.5 text-[9px] font-semibold" style={{ background: mode === i ? t.card : "transparent", color: mode === i ? t.ink : t.sub }}>{m}</button>)}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          {[["Reja", "142 mln"], ["Fakt", "101 mln"], ["Vizit", "612 / 840"], ["Yangi mijoz", "18"]].map(([l, v]) => (
            <div key={l} className="rounded-[12px] p-2.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[8px]" style={{ color: t.sub }}>{l}</p>
              <p className="font-display text-[14px] font-bold" style={{ color: t.ink }}>{v}</p>
            </div>
          ))}
        </div>
        {mode === 0 ? (
          <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <p className="mb-2 text-[10px] font-bold" style={{ color: t.ink }}>Agentlar taqqoslash</p>
            {AGENTS.map((a, i) => (
              <div key={a.n} className={cn("mb-2 flex items-center gap-2", anim(ctx, i).className)}>
                <span className="w-16 truncate text-[8.5px] font-medium" style={{ color: t.ink }}>{a.n.split(" ")[0]}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-md" style={{ background: t.card2 }}>
                  <div className="bar-grow h-full rounded-md" style={{ width: `${a.pct}%`, background: i === 1 ? "#C8F56A" : accent.hex, transformOrigin: "left" }} />
                </div>
                <span className="w-7 text-right font-mono text-[8.5px] font-bold" style={{ color: t.ink }}>{a.pct}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <p className="mb-2 text-[10px] font-bold" style={{ color: t.ink }}>Haftalik trend</p>
            <div className="flex h-[90px] items-end gap-1.5">
              {[52, 61, 58, 72, 69, 81, 71, 88].map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="bar-grow w-full rounded-t" style={{ height: `${v}%`, background: i === 7 ? "#C8F56A" : `${accent.hex}${i > 4 ? "" : "66"}`, animationDelay: `${i * 50}ms` }} />
                  <span className="text-[6.5px]" style={{ color: t.sub }}>H{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SupClients({ t, accent, ctx }: Props) {
  const [ok, setOk] = useState<number[]>([]);
  const rows = [
    { n: "IP Yangi Bozor", by: "Aziz Qodirov", addr: "Yunusobod 9-kv", inn: "305 412 778" },
    { n: "OOO Fayz Market", by: "Dilshod Rasulov", addr: "Mirzo Ulug'bek 3", inn: "304 567 890" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Mijozlar boshqaruvi" sub="Tasdiq kutmoqda · 2 · jami 1 208" right={<IconBtn t={t} onClick={() => ctx.go("new-client")}><Plus size={15} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        {rows.map((r, i) => (
          <div key={r.n} className={cn("rounded-[14px] p-3", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${ok.includes(i) ? accent.hex : t.line}` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10.5px] font-semibold" style={{ color: t.ink }}>{r.n}</p>
                <p className="text-[8.5px]" style={{ color: t.sub }}>{r.addr} · INN {r.inn}</p>
              </div>
              <span className="rounded-full px-1.5 py-[3px] text-[7px] font-bold uppercase" style={{ background: ok.includes(i) ? `${accent.hex}1A` : "#e0a0231A", color: ok.includes(i) ? accent.hex : "#e0a023" }}>{ok.includes(i) ? "Tasdiqlandi" : "Yangi"}</span>
            </div>
            <p className="mt-2 flex items-center gap-1 text-[8px]" style={{ color: t.sub }}><Users size={9} /> Yaratdi: {r.by}</p>
            {!ok.includes(i) && (
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => ctx.toast("Tahrirlash formasi")} className="flex-1 rounded-lg py-2 text-[8.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>Tahrirlash</button>
                <button type="button" onClick={() => { setOk([...ok, i]); ctx.toast(`${r.n} tasdiqlandi va agentga biriktirildi`); }} className="flex-[1.4] rounded-lg py-2 text-[8.5px] font-bold on-acc" style={{ background: accent.hex }}>Tasdiqlash</button>
              </div>
            )}
          </div>
        ))}
        <div className="rounded-[14px] p-3" style={{ background: t.card2 }}>
          <p className="text-[9px] font-bold" style={{ color: t.ink }}>Tezkor statistika</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
            {[["1 208", "Jami"], ["42", "Bu oy yangi"], ["6", "Biriktirilmagan"]].map(([v, l]) => (
              <div key={l}><p className="font-mono text-[10px] font-bold" style={{ color: t.ink }}>{v}</p><p className="text-[7px]" style={{ color: t.sub }}>{l}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ CASHIER ============================ */

const TRANSFERS = [
  { id: "TR-8841", from: "MCHJ O'zbekiston Gullari", bank: "Kapitalbank", sum: 1240000, time: "12:41", st: 0, match: "#1847" },
  { id: "TR-8839", from: "OOO Navruz Shop", bank: "Ipoteka", sum: 480000, time: "11:58", st: 0, match: "" },
  { id: "TR-8835", from: "IP Karmorov Store", bank: "NBU", sum: 2150000, time: "10:22", st: 1, match: "#1832" },
  { id: "TR-8830", from: "MCHJ Lalaku Savdo", bank: "Hamkor", sum: 640000, time: "09:15", st: 1, match: "#1829" },
];

function CashHome({ t, accent, ctx }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9.5px]" style={{ color: t.sub }}>Kassir · Markaziy ofis</p>
            <p className="text-[15px] font-bold tracking-[-0.02em]" style={{ color: t.ink }}>Kunlik kassa</p>
          </div>
          <IconBtn t={t} onClick={() => ctx.go("notifications")} dot><Bell size={14} /></IconBtn>
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-3">
        <div className={cn("relative overflow-hidden rounded-[20px] p-3.5 on-acc", anim(ctx, 1).className)} style={{ background: accent.gradient }}>
          <div className="absolute -right-6 -top-8 size-24 rounded-full bg-white/10" />
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] on-acc-60">Bugun qabul qilindi</p>
          <p className="mt-1 font-display text-[24px] font-bold leading-none tracking-[-0.04em]">14 820 000 <span className="text-[10px] font-medium on-acc-60">so'm</span></p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[["Naqd", "8.4 mln", <Banknote size={10} key="1" />], ["Karta", "2.1 mln", <CreditCard size={10} key="2" />], ["O'tkazma", "4.3 mln", <Landmark size={10} key="3" />]].map(([l, v, ic]) => (
              <div key={String(l)} className="rounded-lg bg-white/14 p-1.5">
                <p className="flex items-center gap-1 text-[7px] on-acc-65">{ic}{l}</p>
                <p className="font-mono text-[10px] font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => ctx.go("cash-inbox")} className={cn("flex w-full items-center gap-2.5 rounded-[14px] p-3 text-left", anim(ctx, 2).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <span className="relative grid size-9 place-items-center rounded-[11px]" style={{ background: t.accSoft, color: t.accInk }}><Landmark size={16} /><span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#e0574b] text-[7px] font-bold text-white">2</span></span>
          <span className="flex-1">
            <span className="block text-[10.5px] font-semibold" style={{ color: t.ink }}>Bank o'tkazmalar inbox</span>
            <span className="text-[8.5px]" style={{ color: t.sub }}>2 ta tasdiq kutmoqda · 1 ta bog'lanmagan</span>
          </span>
          <ChevronRight size={14} style={{ color: t.sub }} />
        </button>
        <div className="grid grid-cols-2 gap-2">
          {[["Tasdiqlangan", "18", "#22b573"], ["Qaytarilgan", "1", "#e0574b"], ["Eksport", "Bugun 17:00", accent.hex], ["Ekspeditorlar", "6 / 6 topshirdi", accent.hex]].map(([l, v, c], i) => (
            <div key={String(l)} className={cn("rounded-[13px] p-2.5", anim(ctx, i + 3).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[8px]" style={{ color: t.sub }}>{l}</p>
              <p className="mt-0.5 text-[12px] font-bold" style={{ color: c as string }}>{v}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-bold" style={{ color: t.ink }}>Oxirgi operatsiyalar</p>
          <div className="space-y-1.5">
            {TRANSFERS.slice(0, 3).map((tr, i) => (
              <button key={tr.id} type="button" onClick={() => ctx.go("cash-detail")} className={cn("flex w-full items-center gap-2 rounded-[12px] p-2.5 text-left", anim(ctx, i + 7).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
                <span className="grid size-7 place-items-center rounded-full" style={{ background: tr.st ? "#22b5731A" : "#e0a0231A", color: tr.st ? "#22b573" : "#e0a023" }}><ArrowDownLeft size={12} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{tr.from}</span>
                  <span className="text-[8px]" style={{ color: t.sub }}>{tr.bank} · {tr.time}</span>
                </span>
                <span className="font-mono text-[9.5px] font-bold" style={{ color: t.ink }}>+{fmt(tr.sum)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CashInbox({ t, accent, ctx }: Props) {
  const [f, setF] = useState(0);
  const list = TRANSFERS.filter((x) => (f === 0 ? true : f === 1 ? x.st === 0 : x.st === 1));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="O'tkazmalar inbox" sub="Bugun · 24 ta · 4.3 mln" right={<IconBtn t={t} onClick={() => ctx.toast("Excel eksport tayyor")}><FileText size={13} /></IconBtn>} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Barchasi", "Kutilmoqda · 2", "Tasdiqlangan"].map((c, i) => <Chip key={c} t={t} accent={accent} active={f === i} onClick={() => setF(i)}>{c}</Chip>)}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {list.map((tr, i) => (
          <button key={tr.id} type="button" onClick={() => ctx.go("cash-detail")} className={cn("w-full rounded-[14px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: t.accSoft, color: t.accInk }}><Landmark size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold" style={{ color: t.ink }}>{tr.from}</span>
                <span className="font-mono text-[8px]" style={{ color: t.sub }}>{tr.id} · {tr.bank} · {tr.time}</span>
              </span>
              <span className="font-mono text-[10px] font-bold" style={{ color: t.ink }}>{fmt(tr.sum)}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {tr.match ? (
                <span className="rounded-md px-1.5 py-0.5 text-[7.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>Buyurtma {tr.match}</span>
              ) : (
                <span className="rounded-md px-1.5 py-0.5 text-[7.5px] font-semibold" style={{ background: "#e0574b1A", color: "#e0574b" }}>Bog'lanmagan</span>
              )}
              <span className="ml-auto rounded-full px-1.5 py-[2px] text-[7px] font-bold uppercase" style={{ background: tr.st ? "#22b5731A" : "#e0a0231A", color: tr.st ? "#22b573" : "#e0a023" }}>{tr.st ? "Tasdiqlangan" : "Kutilmoqda"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CashDetail({ t, accent, ctx }: Props) {
  const [state, setState] = useState<"idle" | "ok" | "no">("idle");
  const tr = TRANSFERS[0];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title={tr.id} sub={`${tr.bank} · ${tr.time}`} onBack={() => ctx.go("cash-inbox")} right={<IconBtn t={t} onClick={() => ctx.toast("PDF yuklab olindi")}><FileText size={13} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        <div className="rounded-[16px] p-3.5 text-center" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[8px] uppercase tracking-wider" style={{ color: t.sub }}>Kelgan summa</p>
          <p className="mt-1 font-display text-[24px] font-bold tracking-[-0.04em]" style={{ color: t.ink }}>{fmt(tr.sum)} <span className="text-[10px] font-medium" style={{ color: t.sub }}>so'm</span></p>
          <p className="mt-1 text-[9px]" style={{ color: t.sub }}>{tr.from}</p>
        </div>
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[9.5px] font-bold" style={{ color: t.ink }}>Buyurtma bilan solishtirish</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg p-2" style={{ background: t.card2 }}>
              <p className="text-[7.5px]" style={{ color: t.sub }}>O'tkazma</p>
              <p className="font-mono text-[10px] font-bold" style={{ color: t.ink }}>{fmt(tr.sum)}</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: t.accSoft }}>
              <p className="text-[7.5px]" style={{ color: t.accInk }}>Buyurtma #1847</p>
              <p className="font-mono text-[10px] font-bold" style={{ color: t.accInk }}>{fmt(1240000)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "#22b5731A" }}>
            <Check size={11} className="text-[#22b573]" />
            <span className="text-[8.5px] font-semibold text-[#1a8a57]">Summa to'liq mos · farq 0 so'm</span>
          </div>
        </div>
        <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          {[["To'lovchi INN", "304 567 890"], ["Maqsad", "Tovar uchun to'lov, sh/f 1847"], ["Agent", "Aziz Qodirov"], ["Ekspeditor", "Bobur Rahimov"]].map(([l, v], i) => (
            <div key={l} className="flex items-center justify-between px-3 py-2 text-[8.5px]" style={{ borderBottom: i < 3 ? `1px solid ${t.line}` : "none" }}>
              <span style={{ color: t.sub }}>{l}</span><span className="font-medium" style={{ color: t.ink }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t px-4 pb-2 pt-2.5" style={{ borderColor: t.line, background: t.card }}>
        {state === "idle" ? (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { setState("no"); ctx.toast("O'tkazma qaytarildi"); }} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-semibold" style={{ background: t.card2, color: "#e0574b" }}>Qaytarish</button>
            <button type="button" onClick={() => { setState("ok"); ctx.toast("Tasdiqlandi · buyurtma yopildi"); }} className="flex-[1.5] rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.hex }}>Tasdiqlash va yopish</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[10px] font-bold" style={{ background: state === "ok" ? "#22b5731A" : "#e0574b1A", color: state === "ok" ? "#22b573" : "#e0574b" }}>
            {state === "ok" ? <CheckCheck size={13} /> : <X size={13} />} {state === "ok" ? "Tasdiqlangan · eksportga qo'shildi" : "Qaytarilgan"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ SHARED ============================ */

function Attendance({ t, accent, ctx }: Props) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Davomat" sub="Dushanba, 7 iyul" right={<IconBtn t={t} onClick={() => ctx.toast("Oylik tabel")}><FileText size={13} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="relative overflow-hidden rounded-[20px] p-4 text-center" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="mx-auto grid size-24 place-items-center rounded-full" style={{ background: t.accSoft }}>
            <div className="grid size-[76px] place-items-center rounded-full border-2 border-dashed" style={{ borderColor: accent.hex, color: t.accText }}>
              {checked ? <Check size={28} strokeWidth={3} /> : <Camera size={26} />}
            </div>
          </div>
          <p className="mt-3 text-[12px] font-bold" style={{ color: t.ink }}>{checked ? "Kelish qayd etildi" : "Selfie + GPS bilan belgilang"}</p>
          <p className="mt-0.5 text-[8.5px]" style={{ color: t.sub }}>{checked ? "08:52 · Ofis, 24 m radius ichida" : "Ofisdan 24 m masofadasiz"}</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[8.5px]">
            <span className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: t.card2, color: t.ink }}><MapPin size={9} style={{ color: t.accText }} /> GPS aniq</span>
            <span className="rounded-full px-2 py-1 font-mono" style={{ background: t.card2, color: t.ink }}><LiveClock start={32340} accent={accent} /></span>
          </div>
          <button type="button" onClick={() => { setChecked(!checked); ctx.toast(checked ? "Ketish qayd etildi" : "Kelish qayd etildi · 08:52"); }} className="mt-3 w-full rounded-[11px] py-2.5 text-[10.5px] font-bold text-white" style={{ background: checked ? "#e0574b" : accent.hex }}>{checked ? "Ketishni belgilash" : "Kelishni belgilash"}</button>
        </div>
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Bu hafta</p>
            <span className="font-mono text-[8px]" style={{ color: t.sub }}>38 soat 20 daq</span>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((d, i) => (
              <div key={d} className="text-center">
                <div className="grid h-9 place-items-center rounded-lg text-[7px] font-bold" style={{ background: i < 4 ? accent.hex : i === 4 ? "#e0a023" : t.card2, color: i < 5 ? "#fff" : t.sub }}>{i < 4 ? "8:3" : i === 4 ? "6:1" : "—"}</div>
                <p className="mt-1 text-[7px]" style={{ color: t.sub }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tasks({ t, accent, ctx }: Props) {
  const [done, setDone] = useState<number[]>([1]);
  const list = [
    { title: "Navruz Shop — foto hisobot qayta yuklash", from: "Supervayzer", due: "Bugun 16:00", pri: "Yuqori" },
    { title: "Yangi mijoz: IP Yangi Bozor hujjatlari", from: "Supervayzer", due: "Kecha", pri: "O'rta" },
    { title: "Lalaku Savdo qarzi bo'yicha qo'ng'iroq", from: "Kassir", due: "Ertaga", pri: "O'rta" },
    { title: "Oylik KPI o'zini baholash", from: "HR", due: "10 iyul", pri: "Past" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Vazifalar" sub={`${list.length - done.length} ta ochiq · ${done.length} bajarildi`} right={<IconBtn t={t} onClick={() => ctx.go("task-create")}><Plus size={15} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
        {list.map((task, i) => {
          const isDone = done.includes(i);
          return (
            <button key={task.title} type="button" onClick={() => { setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i])); ctx.toast(isDone ? "Qayta ochildi" : "Vazifa bajarildi"); }} className={cn("flex w-full items-start gap-2.5 rounded-[14px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}`, opacity: isDone ? 0.65 : 1 }}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: isDone ? accent.hex : t.line, background: isDone ? accent.hex : "transparent", color: "#fff" }}>{isDone && <Check size={11} strokeWidth={3.5} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold leading-snug" style={{ color: t.ink, textDecoration: isDone ? "line-through" : "none" }}>{task.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[8px]" style={{ color: t.sub }}>
                  <span>{task.from}</span>
                  <span className="flex items-center gap-0.5" style={{ color: task.due === "Kecha" && !isDone ? "#e0574b" : t.sub }}><Clock3 size={8} /> {task.due}</span>
                  <span className="rounded px-1 py-[1px] text-[6.5px] font-bold uppercase" style={{ background: task.pri === "Yuqori" ? "#e0574b1A" : t.card2, color: task.pri === "Yuqori" ? "#e0574b" : t.sub }}>{task.pri}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RoleScreenRenderer({ screen, ...rest }: Props & { screen: ScreenKey }) {
  switch (screen) {
    case "exp-home": return <ExpHome {...rest} />;
    case "exp-deliveries": return <ExpDeliveries {...rest} />;
    case "exp-delivery": return <ExpDelivery {...rest} />;
    case "exp-payments": return <ExpPayments {...rest} />;
    case "exp-returns": return <ExpReturns {...rest} />;
    case "exp-debtors": return <ExpDebtors {...rest} />;
    case "sup-home": return <SupHome {...rest} />;
    case "sup-agents": return <SupAgents {...rest} />;
    case "sup-gps": return <SupGps {...rest} />;
    case "sup-visits": return <SupVisits {...rest} />;
    case "sup-kpi": return <SupKpi {...rest} />;
    case "sup-clients": return <SupClients {...rest} />;
    case "cash-home": return <CashHome {...rest} />;
    case "cash-inbox": return <CashInbox {...rest} />;
    case "cash-detail": return <CashDetail {...rest} />;
    case "attendance": return <Attendance {...rest} />;
    case "tasks": return <Tasks {...rest} />;
    default: return <Tasks {...rest} />;
  }
}

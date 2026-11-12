import { useState } from "react";
import {
  Bell, Building2, Camera, Check, Clock3, Copy, FileText, Filter, MapPin, Navigation,
  Package, PackageCheck, Plus, QrCode, Search, Send, ShieldCheck, Users, Warehouse, X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { anim, Chip, fmt, IconBtn, ScreenHead, type Props } from "./PhoneScreens";

/* ------------------------------------------------------------------ */
/*  DEBTORS BY ORDERS — agent_debtors_by_orders_page.dart              */
/* ------------------------------------------------------------------ */

export function DebtorsByOrdersScreen({ t, accent, ctx }: Props) {
  const [bucket, setBucket] = useState<"all" | "0" | "8" | "30">("all");
  const [paid, setPaid] = useState<string[]>([]);
  const rows = [
    { no: "№1847", client: "O'zbekiston Gullari", date: "26.06", sum: 1240000, days: 18, b: "8" as const },
    { no: "№1822", client: "Navruz Shop", date: "22.06", sum: 480000, days: 6, b: "0" as const },
    { no: "№1790", client: "Lalaku Savdo", date: "12.06", sum: 120000, days: 42, b: "30" as const },
    { no: "№1771", client: "Baraka Market", date: "08.06", sum: 310000, days: 46, b: "30" as const },
  ];
  const list = rows.filter((r) => !paid.includes(r.no) && (bucket === "all" || r.b === bucket));
  const total = list.reduce((s, r) => s + r.sum, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Buyurtma bo'yicha qarz" sub={`${list.length} nakladnoy · ${fmt(total)} so'm`} onBack={() => ctx.go("exp-debtors")} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {([["all", "Barchasi"], ["0", "0–7 kun"], ["8", "8–30 kun"], ["30", "30+ kun"]] as const).map(([k, l]) => (
            <Chip key={k} t={t} accent={accent} active={bucket === k} onClick={() => setBucket(k)}>{l}</Chip>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {list.map((r, i) => {
          const tone = r.b === "30" ? "#E0574B" : r.b === "8" ? "#E0A023" : "#22B573";
          return (
            <div key={r.no} className={cn("rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold" style={{ color: t.ink }}>{r.no}</span>
                <span className="rounded-full px-1.5 py-[2px] text-[7px] font-bold" style={{ background: `${tone}1E`, color: tone }}>{r.days} kun</span>
              </div>
              <p className="mt-1 truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{r.client}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[8px]" style={{ color: t.sub }}>{r.date}.2026</span>
                <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: tone }}>−{fmt(r.sum)}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => ctx.toast(`Eslatma yuborildi · ${r.no}`)} className="flex flex-1 items-center justify-center gap-1 rounded-[8px] py-1.5 text-[8.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>
                  <Bell size={9} /> Eslatma
                </button>
                <button type="button" onClick={() => { setPaid((p) => [...p, r.no]); ctx.toast(`${r.no} · to'lov qabul qilindi`); }} className="flex flex-[1.3] items-center justify-center gap-1 rounded-[8px] py-1.5 text-[8.5px] font-bold on-acc" style={{ background: accent.hex }}>
                  <Check size={9} strokeWidth={3.5} /> To'lov olindi
                </button>
              </div>
            </div>
          );
        })}
        {!list.length && (
          <div className="grid place-items-center py-12 text-center">
            <PackageCheck size={22} style={{ color: "#22B573" }} />
            <p className="mt-2 text-[10px] font-bold" style={{ color: t.ink }}>Bu guruhda qarz yo'q</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EXPEDITOR INVOICES — expeditor_invoices_page.dart                  */
/* ------------------------------------------------------------------ */

const INVOICES = [
  { id: "NK-2104", wh: "Markaziy", st: "Yo'lda", date: "07.07 09:40", sum: 1240000, items: 14 },
  { id: "NK-2101", wh: "Markaziy", st: "Tasdiqlangan", date: "07.07 08:15", sum: 480000, items: 8 },
  { id: "NK-2098", wh: "Chilonzor", st: "Kutilmoqda", date: "06.07 17:20", sum: 310000, items: 4 },
  { id: "NK-2090", wh: "Sergeli", st: "Tasdiqlangan", date: "06.07 14:05", sum: 2150000, items: 22 },
];

export function ExpInvoicesScreen({ t, accent, ctx }: Props) {
  const [kind, setKind] = useState<0 | 1>(0);
  const [q, setQ] = useState("");
  const [wh, setWh] = useState("Barchasi");
  const [open, setOpen] = useState<string | null>(null);
  const list = INVOICES.filter((r) => (wh === "Barchasi" || r.wh === wh) && (!q || r.id.toLowerCase().includes(q.toLowerCase())));
  const cur = INVOICES.find((r) => r.id === open);

  return (
    <div className="relative flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Nakladnoylar" sub="Jo'natma va qaytarma hujjatlar" onBack={() => ctx.go("exp-home")} right={<IconBtn t={t} onClick={() => ctx.toast("Filtr tozalandi")}><Filter size={13} /></IconBtn>} />
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {["Jo'natma nakladnoy", "Qaytarma nakladnoy"].map((x, i) => (
            <button key={x} type="button" onClick={() => setKind(i as 0 | 1)} className="flex-1 rounded-[7px] py-1.5 text-[8.5px] font-semibold" style={{ background: kind === i ? t.card : "transparent", color: kind === i ? t.ink : t.sub }}>{x}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-[10px] px-2.5 py-2" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Search size={12} style={{ color: t.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nakladnoy raqami…" aria-label="Nakladnoy qidirish" className="w-full bg-transparent text-[9.5px] outline-none" style={{ color: t.ink }} />
        </div>
        <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1">
          {["Barchasi", "Markaziy", "Chilonzor", "Sergeli"].map((w) => (
            <Chip key={w} t={t} accent={accent} active={wh === w} onClick={() => setWh(w)}>{w}</Chip>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2">
        {kind === 0 ? list.map((r, i) => (
          <button key={r.id} type="button" onClick={() => setOpen(r.id)} className={cn("flex w-full items-center gap-2.5 rounded-[13px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px]" style={{ background: t.accSoft, color: t.accInk }}><FileText size={14} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10px] font-bold" style={{ color: t.ink }}>{r.id}</span>
              <span className="block text-[8px]" style={{ color: t.sub }}>{r.wh} · {r.date} · {r.items} pozitsiya</span>
              <span className="mt-0.5 block font-mono text-[9px] font-bold" style={{ color: t.accText }}>{fmt(r.sum)} so'm</span>
            </span>
            <span className="rounded-full px-1.5 py-[2px] text-[7px] font-bold" style={{ background: r.st === "Tasdiqlangan" ? "#22B5731E" : r.st === "Yo'lda" ? `${accent.hex}1E` : "#E0A0231E", color: r.st === "Tasdiqlangan" ? "#1E9E63" : r.st === "Yo'lda" ? t.accText : "#B77A08" }}>{r.st}</span>
          </button>
        )) : (
          <div className="grid place-items-center py-12 text-center">
            <Package size={22} style={{ color: t.sub }} />
            <p className="mt-2 text-[10px] font-bold" style={{ color: t.ink }}>Hozircha bo'sh</p>
            <p className="text-[8.5px]" style={{ color: t.sub }}>Qaytarma nakladnoylar shu yerda chiqadi</p>
            <button type="button" onClick={() => ctx.go("exp-returns")} className="mt-2 rounded-full px-3 py-1.5 text-[8.5px] font-bold on-acc" style={{ background: accent.hex }}>Qaytarish yaratish</button>
          </div>
        )}
      </div>

      {cur && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/45" onClick={() => setOpen(null)}>
          <div className={cn("w-full rounded-t-[22px] p-4", ctx.motion !== "off" && "auth-slide-up")} style={{ background: t.card }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: t.line }} />
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[13px] font-bold" style={{ color: t.ink }}>{cur.id}</p>
                <p className="text-[8.5px]" style={{ color: t.sub }}>Yaratilgan: {cur.date} · {cur.wh} ombor</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Yopish" className="grid size-6 place-items-center rounded-full" style={{ background: t.card2, color: t.sub }}><X size={12} /></button>
            </div>
            <div className="mt-3 space-y-1">
              {[["Coca-Cola 1.5L", "6 × 12 000"], ["Lay's Classic 80g", "12 × 9 500"], ["Snickers 50g", "24 × 6 000"]].map(([n, v]) => (
                <div key={n} className="flex justify-between rounded-lg px-2 py-1.5 text-[8.5px]" style={{ background: t.card2 }}>
                  <span style={{ color: t.ink }}>{n}</span><span className="font-mono" style={{ color: t.sub }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex justify-between text-[10.5px] font-bold" style={{ color: t.ink }}>
              <span>Jami</span><span className="font-mono">{fmt(cur.sum)} so'm</span>
            </div>
            <button type="button" onClick={() => { setOpen(null); ctx.go("exp-delivery"); }} className="mt-3 w-full rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
              Yetkazishni ochish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EXPEDITOR VISITS — expeditor_visits_page + unfinished              */
/* ------------------------------------------------------------------ */

export function ExpVisitsScreen({ t, accent, ctx }: Props) {
  const [tab, setTab] = useState<0 | 1>(0);
  const done = [
    { n: "IP Karimov Store", time: "09:12 – 09:38", res: "Yetkazildi · 480 000", ok: true },
    { n: "MCHJ Lalaku Savdo", time: "10:05 – 10:24", res: "Qisman · 2 pozitsiya qaytdi", ok: true },
  ];
  const undone = [
    { n: "OOO Navruz Shop", time: "11:40", res: "Mijoz joyida emas", why: "Qayta tashrif kerak" },
    { n: "IP Baraka Market", time: "13:15", res: "To'lov olinmadi", why: "Naqd yetmadi · 310 000" },
  ];
  const list = tab === 0 ? done : undone;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Vizitlar" sub="Bugun · 4 tashrif · 2 tugallanmagan" onBack={() => ctx.go("exp-home")} right={<IconBtn t={t} onClick={() => ctx.go("map")}><MapPin size={13} /></IconBtn>} />
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {[`Bajarilgan · ${done.length}`, `Tugallanmagan · ${undone.length}`].map((x, i) => (
            <button key={x} type="button" onClick={() => setTab(i as 0 | 1)} className="flex-1 rounded-[7px] py-1.5 text-[8.5px] font-semibold" style={{ background: tab === i ? t.card : "transparent", color: tab === i ? (i ? "#E0A023" : t.ink) : t.sub }}>{x}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {list.map((r, i) => (
          <div key={r.n} className={cn("rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${tab ? "#E0A02355" : t.line}` }}>
            <div className="flex items-start gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: tab ? "#E0A0231E" : "#22B5731E", color: tab ? "#B77A08" : "#1E9E63" }}>
                {tab ? <Clock3 size={13} /> : <Check size={13} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold" style={{ color: t.ink }}>{r.n}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>{r.time}</p>
                <p className="mt-0.5 text-[8.5px] font-medium" style={{ color: tab ? "#B77A08" : t.accText }}>{r.res}</p>
                {"why" in r && <p className="mt-1 rounded px-1.5 py-1 text-[7.5px]" style={{ background: t.card2, color: t.sub }}>{r.why}</p>}
              </div>
            </div>
            {tab === 1 && (
              <button type="button" onClick={() => ctx.go("exp-delivery")} className="mt-2 w-full rounded-[9px] py-2 text-[9px] font-bold on-acc" style={{ background: accent.hex }}>
                Davom ettirish
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAYMENT INFO — expeditor_payments_info_page.dart                   */
/* ------------------------------------------------------------------ */

export function ExpPayInfoScreen({ t, accent, ctx }: Props) {
  const rows = [
    ["Kompaniya", "SALEC Distribution MChJ"],
    ["Hisob raqam", "2020 8000 9001 4477 001"],
    ["Bank", "Kapitalbank, Toshkent"],
    ["MFO", "00446"],
    ["INN", "305 412 778"],
    ["Shartnoma", "SH-2026/0847"],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="To'lov rekvizitlari" sub="Mijozga o'tkazma uchun" onBack={() => ctx.go("exp-payments")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="grid place-items-center rounded-[16px] p-4" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="grid size-[104px] place-items-center rounded-[12px]" style={{ background: t.isDark ? "#fff" : "#0E1420" }}>
            <QrCode size={76} style={{ color: t.isDark ? "#0E1420" : "#fff" }} />
          </div>
          <p className="mt-2 text-[9px] font-bold" style={{ color: t.ink }}>To'lov uchun QR</p>
          <p className="text-[8px]" style={{ color: t.sub }}>Mijoz bank ilovasida skanerlaydi</p>
        </div>
        <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          {rows.map(([l, v], i) => (
            <button key={l} type="button" onClick={() => { navigator.clipboard?.writeText(v).catch(() => {}); ctx.toast(`${l} nusxalandi`); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${t.line}` : "none" }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[7.5px] uppercase tracking-wider" style={{ color: t.sub }}>{l}</span>
                <span className="block truncate font-mono text-[9.5px] font-semibold" style={{ color: t.ink }}>{v}</span>
              </span>
              <Copy size={11} style={{ color: t.accText }} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => ctx.toast("Rekvizitlar SMS orqali yuborildi")} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          <Send size={11} /> Mijozga yuborish
        </button>
        <div className="flex items-start gap-2 rounded-[12px] p-2.5 text-[8px]" style={{ background: t.accSoft, color: t.accInk }}>
          <ShieldCheck size={12} className="mt-[1px] shrink-0" />
          O'tkazma «To'lov maqsadi» maydonida shartnoma raqamini ko'rsatish shart — kassa avtomatik moslashtiradi.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUPERVISOR OUTLETS — supervisor_outlets_page.dart                  */
/* ------------------------------------------------------------------ */

export function SupOutletsScreen({ t, accent, ctx }: Props) {
  const [region, setRegion] = useState("Barchasi");
  const outlets = [
    { n: "MCHJ O'zbekiston Gullari", r: "Yunusobod", a: "Aziz Q.", cov: 100, tier: "A" },
    { n: "IP Karimov Store", r: "Chilonzor", a: "Malika K.", cov: 86, tier: "B" },
    { n: "OOO Navruz Shop", r: "Mirzo Ulug'bek", a: "Aziz Q.", cov: 64, tier: "A" },
    { n: "MCHJ Lalaku Savdo", r: "Uchtepa", a: "Dilshod R.", cov: 42, tier: "B" },
    { n: "IP Baraka Market", r: "Olmazor", a: "—", cov: 0, tier: "C" },
  ];
  const list = outlets.filter((o) => region === "Barchasi" || o.r === region);
  const avg = Math.round(list.reduce((s, o) => s + o.cov, 0) / (list.length || 1));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Nuqtalar bazasi" sub="1 208 nuqta · qamrov nazorati" onBack={() => ctx.go("sup-home")} right={<IconBtn t={t} onClick={() => ctx.go("new-client")}><Plus size={14} /></IconBtn>} />
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between text-[8.5px]">
            <span className="font-semibold" style={{ color: t.ink }}>Oylik qamrov</span>
            <span className="font-mono font-bold" style={{ color: avg >= 70 ? "#22B573" : "#E0A023" }}>{avg}%</span>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${avg}%`, background: avg >= 70 ? "#22B573" : "#E0A023" }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[7px]" style={{ color: t.sub }}>
            <span>{list.filter((o) => o.cov > 0).length} faol</span>
            <span>{list.filter((o) => o.cov === 0).length} biriktirilmagan</span>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {["Barchasi", "Yunusobod", "Chilonzor", "Uchtepa"].map((r) => (
            <Chip key={r} t={t} accent={accent} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2">
        {list.map((o, i) => (
          <button key={o.n} type="button" onClick={() => ctx.go("client-detail")} className={cn("flex w-full items-center gap-2.5 rounded-[13px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${o.cov === 0 ? "#E0574B44" : t.line}` }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] font-mono text-[10px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>{o.tier}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[9.5px] font-bold" style={{ color: t.ink }}>{o.n}</span>
              <span className="block text-[8px]" style={{ color: t.sub }}>{o.r} · {o.a}</span>
              <span className="mt-1 block h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                <span className="block h-full rounded-full" style={{ width: `${o.cov}%`, background: o.cov >= 70 ? "#22B573" : o.cov > 0 ? "#E0A023" : "#E0574B" }} />
              </span>
            </span>
            <span className="shrink-0 font-mono text-[9px] font-bold" style={{ color: o.cov === 0 ? "#E0574B" : t.ink }}>{o.cov}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUPERVISOR REPORT — supervisor_report_page.dart                    */
/* ------------------------------------------------------------------ */

export function SupReportScreen({ t, accent, ctx }: Props) {
  const agents = [
    { n: "Malika K.", plan: 12, fact: 11.4, pct: 95 },
    { n: "Aziz Q.", plan: 12.4, fact: 8.1, pct: 65 },
    { n: "Dilshod R.", plan: 10, fact: 6.4, pct: 64 },
    { n: "Sardor N.", plan: 11, fact: 5.1, pct: 46 },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Hudud hisoboti" sub="Toshkent Sharq · iyul 2026" onBack={() => ctx.go("sup-home")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {[["Reja", "142 mln", "#0E1420"], ["Fakt", "101 mln", accent.hex], ["Vizitlar", "612/840", "#0E1420"], ["Qamrov", "73%", "#22B573"]].map(([l, v, c], i) => (
            <div key={l} className={cn("rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[8px]" style={{ color: t.sub }}>{l}</p>
              <p className="mt-0.5 font-display text-[15px] font-bold" style={{ color: t.isDark ? t.ink : c }}>{v}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Agentlar kesimi (mln so'm)</p>
          <div className="mt-2.5 space-y-2">
            {agents.map((a, i) => (
              <div key={a.n}>
                <div className="flex justify-between text-[8.5px]">
                  <span className="font-semibold" style={{ color: t.ink }}>{a.n}</span>
                  <span className="font-mono" style={{ color: t.sub }}>{a.fact} / {a.plan}</span>
                </div>
                <div className="mt-1 flex h-3 items-center gap-1">
                  <span className="relative h-full flex-1 overflow-hidden rounded-[4px]" style={{ background: t.card2 }}>
                    <span className="bar-grow absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${a.pct}%`, background: a.pct >= 80 ? "#22B573" : a.pct >= 60 ? accent.hex : "#E0A023", animationDelay: `${i * 90}ms` }} />
                  </span>
                  <span className="w-7 text-right font-mono text-[8px] font-bold" style={{ color: t.ink }}>{a.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Diqqat talab qiladi</p>
          {[["Sardor N.", "Reja 46% · 3 kun past temp", "#E0574B"], ["Olmazor hududi", "12 nuqta biriktirilmagan", "#E0A023"], ["Foto hisobot", "8 vizit tasdiq kutmoqda", accent.hex]].map(([n, d, c]) => (
            <div key={n} className="mt-2 flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: c }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-semibold" style={{ color: t.ink }}>{n}</span>
                <span className="block text-[8px]" style={{ color: t.sub }}>{d}</span>
              </span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => ctx.toast("Hisobot Excelga eksport qilindi")} className="w-full rounded-[11px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          Excelga eksport
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TASK CREATE — task_create_page.dart                                */
/* ------------------------------------------------------------------ */

export function TaskCreateScreen({ t, accent, ctx }: Props) {
  const [title, setTitle] = useState("");
  const [who, setWho] = useState("");
  const [prio, setPrio] = useState("O'rta");
  const [due, setDue] = useState("");
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const ok = title.trim().length >= 3 && !!who;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Yangi vazifa" sub="Ijrochi va muddat majburiy" onBack={() => ctx.go("tasks")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Nima qilish kerak *</p>
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={2} placeholder="Vazifa matni…" aria-label="Vazifa matni" className="w-full resize-none rounded-[10px] px-2.5 py-2 text-[10px] outline-none" style={{ background: t.card2, color: t.ink, border: `1px solid ${touched && title.trim().length < 3 ? "#E0574B" : t.line}` }} />
        </div>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Ijrochi *</p>
          <div className="flex flex-wrap gap-1">
            {["Aziz Qodirov", "Malika Karimova", "Sardor Nazarov", "Dilshod Rasulov"].map((a) => (
              <Chip key={a} t={t} accent={accent} active={who === a} onClick={() => setWho(a)}>{a}</Chip>
            ))}
          </div>
          {touched && !who && <p className="mt-1 text-[7.5px] text-[#E0574B]">Ijrochini tanlang</p>}
        </div>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Muddat</p>
          <div className="flex flex-wrap gap-1">
            {["Bugun 18:00", "Ertaga 12:00", "10-iyul"].map((d) => (
              <Chip key={d} t={t} accent={accent} active={due === d} onClick={() => setDue(d)}>{d}</Chip>
            ))}
          </div>
          {!due && <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>Muddat ko'rsatilmasa — ochiq vazifa</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Prioritet</p>
            <div className="flex gap-1">
              {["Past", "O'rta", "Yuqori"].map((p) => (
                <Chip key={p} t={t} accent={accent} active={prio === p} onClick={() => setPrio(p)}>{p}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Turi</p>
            <div className="flex gap-1">
              {["Vizit", "Qo'ng'iroq"].map((x) => (
                <Chip key={x} t={t} accent={accent} active={type === x} onClick={() => setType(type === x ? "" : x)}>{x}</Chip>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Batafsil</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Izoh, manzil, telefon…" aria-label="Batafsil" className="w-full resize-none rounded-[10px] px-2.5 py-2 text-[10px] outline-none" style={{ background: t.card2, color: t.ink, border: `1px solid ${t.line}` }} />
        </div>
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => { setTouched(true); if (!ok) { ctx.toast("Matn va ijrochi majburiy"); return; } ctx.toast("Vazifa biriktirildi"); ctx.go("task-detail"); }} className="w-full rounded-[11px] py-2.5 text-[10.5px] font-bold on-acc" style={{ background: accent.gradient, opacity: ok ? 1 : 0.55 }}>
          Vazifani biriktirish
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TASK DETAIL — task_detail_page.dart                                */
/* ------------------------------------------------------------------ */

export function TaskDetailScreen({ t, accent, ctx }: Props) {
  const [done, setDone] = useState(false);
  const [text, setText] = useState("");
  const [comments, setComments] = useState([
    { who: "Supervayzer", txt: "Foto hisobotni qayta yuklang, sifat past.", time: "10:24", mine: false },
    { who: "Aziz Q.", txt: "Tushdan keyin nuqtaga boraman.", time: "10:31", mine: true },
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Vazifa #T-241" sub="Supervayzer → Aziz Qodirov" onBack={() => ctx.go("tasks")} right={<IconBtn t={t} onClick={() => ctx.toast("Vazifa nusxalandi")}><Copy size={12} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${done ? "#22B57355" : t.line}` }}>
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => { setDone((v) => !v); ctx.toast(done ? "Vazifa qayta ochildi" : "Vazifa bajarildi"); }} aria-label="Bajarildi" className="mt-[2px] grid size-5 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: done ? "#22B573" : t.line, background: done ? "#22B573" : "transparent", color: "#fff" }}>
              {done && <Check size={11} strokeWidth={4} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold leading-snug" style={{ color: t.ink, textDecoration: done ? "line-through" : "none" }}>
                Navruz Shop — foto hisobotni qayta yuklash
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="rounded px-1.5 py-0.5 text-[7px] font-bold" style={{ background: "#E0574B1E", color: "#E0574B" }}>Yuqori</span>
                <span className="rounded px-1.5 py-0.5 text-[7px] font-semibold" style={{ background: t.card2, color: t.sub }}>Vizit</span>
                <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[7px] font-semibold" style={{ background: t.card2, color: t.sub }}><Clock3 size={7} /> Bugun 16:00</span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[8.5px] leading-relaxed" style={{ color: t.sub }}>
            Mijoz: OOO Navruz Shop · TT-1033 · Mirzo Ulug'bek tumani. Polka va narx yorliqlari aniq ko'rinsin.
          </p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => ctx.go("client-detail")} className="flex flex-1 items-center justify-center gap-1 rounded-[9px] py-2 text-[8.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>
              <Building2 size={10} /> Mijoz
            </button>
            <button type="button" onClick={() => ctx.go("map")} className="flex flex-1 items-center justify-center gap-1 rounded-[9px] py-2 text-[8.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>
              <Navigation size={10} /> Xarita
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Izohlar · {comments.length}</p>
          <div className="space-y-1.5">
            {comments.map((c, i) => (
              <div key={i} className={cn("max-w-[86%] rounded-[12px] p-2.5", c.mine && "ml-auto", anim(ctx, i).className)} style={{ background: c.mine ? t.accSoft : t.card, border: `1px solid ${c.mine ? "transparent" : t.line}` }}>
                <p className="text-[7.5px] font-bold" style={{ color: c.mine ? t.accInk : t.sub }}>{c.who} · {c.time}</p>
                <p className="mt-0.5 text-[9px] leading-snug" style={{ color: t.ink }}>{c.txt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-2.5" style={{ borderColor: t.line, background: t.card }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Izoh yozing…" aria-label="Izoh" className="flex-1 rounded-full px-3 py-2 text-[9.5px] outline-none" style={{ background: t.card2, color: t.ink }} />
        <button type="button" onClick={() => { if (!text.trim()) return; setComments((c) => [...c, { who: "Aziz Q.", txt: text.trim(), time: "hozir", mine: true }]); setText(""); ctx.toast("Izoh yuborildi"); }} aria-label="Yuborish" className="grid size-8 shrink-0 place-items-center rounded-full on-acc" style={{ background: accent.hex, opacity: text.trim() ? 1 : 0.5 }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  START VISIT — start_visit_screen.dart                              */
/* ------------------------------------------------------------------ */

export function StartVisitScreen({ t, accent, ctx }: Props) {
  const [gps, setGps] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const ready = gps && selfie;
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Vizitni boshlash" sub="MCHJ O'zbekiston Gullari · TT-0847" onBack={() => ctx.go("client-detail")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="rounded-[16px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          {[
            { l: "GPS aniqligi", ok: gps, okTxt: "8 m · nuqta radiusida (50 m)", noTxt: "Aniqlanmoqda…", act: () => { setGps(true); ctx.toast("GPS: 8 m aniqlik"); }, btn: "Aniqlash", icon: MapPin },
            { l: "Selfie tasdiq", ok: selfie, okTxt: "Yuz tanildi · 09:41", noTxt: "Kamera talab qilinadi", act: () => { setSelfie(true); ctx.toast("Selfie tasdiqlandi"); }, btn: "Selfie olish", icon: Camera },
          ].map((r) => (
            <div key={r.l} className="flex items-center gap-2.5 py-2" style={{ borderBottom: r.l === "GPS aniqligi" ? `1px solid ${t.line}` : "none" }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: r.ok ? "#22B5731E" : t.card2, color: r.ok ? "#1E9E63" : t.sub }}>
                {r.ok ? <Check size={14} strokeWidth={3} /> : <r.icon size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-bold" style={{ color: t.ink }}>{r.l}</span>
                <span className="block text-[8px]" style={{ color: r.ok ? "#1E9E63" : t.sub }}>{r.ok ? r.okTxt : r.noTxt}</span>
              </span>
              {!r.ok && (
                <button type="button" onClick={r.act} className="rounded-full px-2.5 py-1.5 text-[8.5px] font-bold on-acc" style={{ background: accent.hex }}>{r.btn}</button>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Vizit rejasi</p>
          {["Foto hisobot (polka, narx)", "Buyurtma yoki rad etish sababi", "Qarz bo'yicha suhbat", "Vizitni yakunlash"].map((s, i) => (
            <div key={s} className="mt-1.5 flex items-center gap-2">
              <span className="grid size-4 shrink-0 place-items-center rounded-full font-mono text-[7px] font-bold" style={{ background: t.card2, color: t.sub }}>{i + 1}</span>
              <span className="text-[8.5px]" style={{ color: t.sub }}>{s}</span>
            </div>
          ))}
        </div>
        <p className="px-1 text-[8px]" style={{ color: t.sub }}>Vizit faqat nuqta radiusida boshlanadi. GPS o'chirilgan bo'lsa, sozlamalardan yoqing.</p>
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => { if (!ready) { ctx.toast("GPS va selfie tasdig'i kerak"); return; } ctx.toast("Vizit boshlandi · 09:41"); ctx.go("visits"); }} className="w-full rounded-[11px] py-2.5 text-[10.5px] font-bold on-acc" style={{ background: accent.gradient, opacity: ready ? 1 : 0.55 }}>
          Vizitni boshlash
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PERMISSIONS — permission_gate_page.dart                            */
/* ------------------------------------------------------------------ */

export function PermissionsScreen({ t, accent, ctx }: Props) {
  const [state, setState] = useState<Record<string, boolean>>({ gps: true, cam: false, notif: false, storage: true });
  const items = [
    { k: "gps", l: "Joylashuv (GPS)", d: "Vizit radiusi va marshrut uchun", icon: MapPin, req: true },
    { k: "cam", l: "Kamera", d: "Foto hisobot va selfie tasdiq", icon: Camera, req: true },
    { k: "notif", l: "Bildirishnomalar", d: "Vazifa va buyurtma holati", icon: Bell, req: false },
    { k: "storage", l: "Xotira", d: "Oflayn kesh va fotolar", icon: Warehouse, req: false },
  ];
  const missing = items.filter((i) => i.req && !state[i.k]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Ruxsatlar" sub="Ilova to'liq ishlashi uchun" onBack={() => ctx.go("home")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
        {items.map((it, i) => (
          <div key={it.k} className={cn("flex items-center gap-2.5 rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${state[it.k] ? t.line : it.req ? "#E0A02355" : t.line}` }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px]" style={{ background: state[it.k] ? "#22B5731E" : t.card2, color: state[it.k] ? "#1E9E63" : t.sub }}>
              <it.icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[9.5px] font-bold" style={{ color: t.ink }}>{it.l}</span>
                {it.req && <span className="rounded px-1 text-[6.5px] font-bold" style={{ background: "#E0A0231E", color: "#B77A08" }}>Majburiy</span>}
              </span>
              <span className="block text-[8px]" style={{ color: t.sub }}>{it.d}</span>
            </span>
            <button type="button" onClick={() => { setState((s) => ({ ...s, [it.k]: !s[it.k] })); ctx.toast(`${it.l}: ${state[it.k] ? "o'chirildi" : "berildi"}`); }} className="relative h-[18px] w-8 shrink-0 rounded-full transition-colors" style={{ background: state[it.k] ? accent.hex : t.line }} aria-label={it.l}>
              <span className="absolute top-[2px] size-[14px] rounded-full bg-white transition-all" style={{ left: state[it.k] ? 16 : 2 }} />
            </button>
          </div>
        ))}
        {missing.length > 0 && (
          <div className="rounded-[12px] p-2.5 text-[8.5px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
            {missing.length} ta majburiy ruxsat yo'q — vizit va foto hisobot ishlamaydi.
          </div>
        )}
      </div>
      <div className="flex gap-2 px-4 pb-3">
        <button type="button" onClick={() => ctx.go("home")} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-semibold" style={{ background: t.card2, color: t.ink }}>Keyinroq</button>
        <button type="button" onClick={() => { setState({ gps: true, cam: true, notif: true, storage: true }); ctx.toast("Barcha ruxsatlar berildi"); ctx.go("home"); }} className="flex-[1.5] rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          Hammasiga ruxsat berish
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SYNC SUCCESS — sync_success_screen.dart                            */
/* ------------------------------------------------------------------ */

export function SyncSuccessScreen({ t, accent, ctx }: Props) {
  const stats = [
    { l: "Buyurtma yuborildi", v: 12, icon: Send },
    { l: "Foto yuklandi", v: 8, icon: Camera },
    { l: "Mijoz yangilandi", v: 342, icon: Users },
    { l: "Qoldiq olindi", v: 1208, icon: Package },
  ];
  return (
    <div className="flex h-full flex-col items-center px-5 pt-8 text-center">
      <div className="relative">
        {ctx.motion !== "off" && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <span key={i} className="sm-particle absolute block size-1 rounded-full" style={{ background: [accent.hex, "#22B573", "#C8F56A", accent.bright][i % 4], "--cx": `${Math.cos(a) * 54}px`, "--cy": `${Math.sin(a) * 54}px`, "--cr": `${i * 30}deg`, "--d": `${i * 28}ms` } as React.CSSProperties} />;
            })}
          </span>
        )}
        <span className={cn("grid size-[68px] place-items-center rounded-full text-white", ctx.motion !== "off" && "auth-ring-pop")} style={{ background: "linear-gradient(140deg,#22B573,#0E8C7A)", boxShadow: "0 18px 36px -18px #22B573" }}>
          <Check size={30} strokeWidth={3} />
        </span>
      </div>
      <p className="mt-3.5 font-display text-[17px] font-bold" style={{ color: t.ink }}>Sinxronlash muvaffaqiyatli</p>
      <p className="mt-1 text-[9px]" style={{ color: t.sub }}>12:48 · 4.2 MB · 0 xato · 3.1 soniya</p>

      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        {stats.map((s, i) => (
          <div key={s.l} className={cn("rounded-[13px] p-2.5 text-left", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <s.icon size={12} style={{ color: t.accText }} />
            <p className="mt-1.5 font-mono text-[15px] font-bold leading-none" style={{ color: t.ink }}>{s.v}</p>
            <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 w-full rounded-[12px] p-2.5 text-left text-[8.5px]" style={{ background: t.accSoft, color: t.accInk }}>
        Keyingi avtomatik sinxron: 13:18. Oflayn navbat bo'sh — barcha ma'lumot serverda.
      </div>

      <div className="mt-auto flex w-full gap-2 pb-4 pt-3">
        <button type="button" onClick={() => ctx.go("sync")} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-semibold" style={{ background: t.card2, color: t.ink }}>Batafsil</button>
        <button type="button" onClick={() => ctx.go("home")} className="flex-[1.5] rounded-[10px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>Bosh sahifa</button>
      </div>
    </div>
  );
}

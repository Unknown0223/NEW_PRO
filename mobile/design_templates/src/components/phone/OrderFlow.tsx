import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Fingerprint,
  Gift,
  Link2,
  Loader2,
  Lock,
  Minus,
  PackageCheck,
  Pencil,
  Percent,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { fmt, ScreenHead, type Props } from "./PhoneScreens";

/* ------------------------------------------------------------------ */
/*  Domain data — mirrors create_order_screen.dart + bonus-rules       */
/* ------------------------------------------------------------------ */

type Stage = "client" | "setup" | "checks" | "cats" | "products" | "bonus" | "submit" | "held" | "done";

export const ORDER_CLIENTS = [
  { id: "c1", name: "MCHJ O'zbekiston Gullari", code: "TT-0847", balance: -1240000, creditLeft: 3760000, consign: "ok" as const, consignLeft: 2000000 },
  { id: "c2", name: "IP Karimov Store", code: "TT-0921", balance: 0, creditLeft: 2000000, consign: "admin" as const, consignLeft: 0 },
  { id: "c3", name: "OOO Navruz Shop", code: "TT-1033", balance: -480000, creditLeft: 520000, consign: "debt" as const, consignLeft: 0 },
];

const CONSIGN_REASON = {
  ok: null,
  admin: "Konsignatsiya bu mijoz uchun administrator tomonidan taqiqlangan",
  debt: "Konsignatsiya taqiqlangan: mijozda konsignatsiya qarzi bor",
} as const;

export const ORDER_CATS = [
  { id: "drinks", name: "Ichimliklar", emoji: "🥤" },
  { id: "snacks", name: "Sneklar", emoji: "🍟" },
  { id: "sweets", name: "Shirinliklar", emoji: "🍫" },
  { id: "coffee", name: "Kofe va choy", emoji: "☕" },
  { id: "dairy", name: "Sut mahsulotlari", emoji: "🥛" },
  { id: "home", name: "Maishiy kimyo", emoji: "🧴" },
];

export const ORDER_PRODUCTS = [
  { id: "p1", cat: "drinks", name: "Coca-Cola 1.5L", emoji: "🥤", price: 12000, stock: 48, perBox: 6 },
  { id: "p5", cat: "drinks", name: "Fanta Apelsin 1.5L", emoji: "🍊", price: 12000, stock: 36, perBox: 6 },
  { id: "p6", cat: "drinks", name: "Sprite 1.0L", emoji: "🍋", price: 9500, stock: 60, perBox: 12 },
  { id: "p2", cat: "snacks", name: "Lay's Classic 80g", emoji: "🍟", price: 9500, stock: 32, perBox: 16 },
  { id: "p7", cat: "snacks", name: "Cheetos Pishloq 70g", emoji: "🧀", price: 7500, stock: 8, perBox: 4 },
  { id: "p3", cat: "sweets", name: "Snickers 50g", emoji: "🍫", price: 6000, stock: 120, perBox: 24 },
  { id: "p8", cat: "sweets", name: "Twix 55g", emoji: "🍪", price: 6500, stock: 85, perBox: 24 },
  { id: "p4", cat: "coffee", name: "Nescafé Gold 100g", emoji: "☕", price: 42000, stock: 14, perBox: 6 },
  { id: "p9", cat: "dairy", name: "Sut Musaffo 1L", emoji: "🥛", price: 14500, stock: 26, perBox: 12 },
  { id: "p10", cat: "home", name: "Fairy Limon 450ml", emoji: "🧴", price: 18000, stock: 19, perBox: 12 },
];

/** qty rule, in_blocks: floor(q / step) × bonus, capped by max_bonus_qty */
export const qtyBonus = (purchased: number, step: number, bonus: number, max: number | null, inBlocks: boolean) => {
  if (inBlocks) {
    const raw = Math.floor(purchased / step) * bonus;
    return max != null ? Math.min(raw, max) : raw;
  }
  if (purchased < step) return 0;
  return max != null ? Math.min(bonus, max) : bonus;
};

const DISCOUNTS = [
  { id: 11, name: "Hajm skidkasi", pct: 3, minSum: 200000, linked: null as number | null },
  { id: 12, name: "VIP mijoz", pct: 5, minSum: 400000, linked: null as number | null },
  { id: 13, name: "Coca-Cola aksiyasi", pct: 2, minSum: 0, linked: 1 as number | null },
];

const CHECKS = [
  { k: "sync", label: "Majburiy sinxron", ok: "Bugun 12:48 da yangilangan" },
  { k: "client", label: "Mijoz holati", ok: "Faol · buyurtmaga ruxsat bor" },
  { k: "net", label: "Internet aloqasi", ok: "Online · 41 ms" },
  { k: "visit", label: "Faol vizit", ok: "09:40 da boshlangan" },
  { k: "gps", label: "GPS aniqligi", ok: "12 m · nuqta radiusida" },
  { k: "photo", label: "Foto hisobot", ok: "Bugungi foto biriktirildi" },
  { k: "stock", label: "Qoldiq snapshot", ok: "Bugungi qoldiq olingan" },
  { k: "ship", label: "Yuklash sanasi", ok: "Sana tanlangan" },
];

const PIPE = [
  { k: "limit", label: "Limit tekshiruvi" },
  { k: "policy", label: "Majburiy shartlar" },
  { k: "bio", label: "Biometrik tasdiq" },
  { k: "stock", label: "Ombor qoldig'i" },
  { k: "price", label: "Narx turi" },
  { k: "photo", label: "Fotoni buyurtmaga bog'lash" },
  { k: "queue", label: "Navbatga qo'yish" },
];

const RAIL = ["Mijoz", "Shartlar", "Tovar", "Bonus", "Yuborish"];
const railIndex = (s: Stage) => (s === "client" ? 0 : s === "setup" || s === "checks" ? 1 : s === "cats" || s === "products" ? 2 : s === "bonus" ? 3 : 4);

/* ------------------------------------------------------------------ */

export function FullOrderScreen({ t, accent, ctx }: Props) {
  const fast = ctx.motion === "off";
  const [stage, setStage] = useState<Stage>("client");
  const [clientId, setClientId] = useState("c1");
  const client = ORDER_CLIENTS.find((c) => c.id === clientId) ?? ORDER_CLIENTS[0];

  const [wh, setWh] = useState("Markaziy ombor");
  const [price, setPrice] = useState("Chakana");
  const [consign, setConsign] = useState(false);
  const [ship, setShip] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState(false);
  const [checkIdx, setCheckIdx] = useState(0);

  const [cat, setCat] = useState("drinks");
  const [boxes, setBoxes] = useState(false);
  const [q, setQ] = useState("");

  const [section, setSection] = useState<0 | 1>(0);
  const [bonusMode, setBonusMode] = useState<"auto" | "none">("auto");
  const [discMode, setDiscMode] = useState<"auto" | "none" | "manual">("auto");
  const [discPick, setDiscPick] = useState<number | null>(null);
  const [stratPick, setStratPick] = useState<number | null>(null);
  const [giftEdit, setGiftEdit] = useState<number | null>(null);

  const [pipeIdx, setPipeIdx] = useState(0);
  const [pipeFail, setPipeFail] = useState<string | null>(null);
  const [heldLeft, setHeldLeft] = useState(300);

  /* ---------- cart math ---------- */
  const qty = (id: string) => ctx.cart[id] || 0;
  const count = ORDER_PRODUCTS.reduce((s, p) => s + qty(p.id), 0);
  const subtotal = ORDER_PRODUCTS.reduce((s, p) => s + qty(p.id) * p.price, 0);
  const fingerprint = ORDER_PRODUCTS.map((p) => `${p.id}:${qty(p.id)}`).join("|");
  const snacks = qty("p2") + qty("p7");

  /* ---------- bonus rules (server preview equivalent) ---------- */
  const earned: Record<number, number> = {
    1: qtyBonus(qty("p1"), 5, 1, 6, true), // 5+1, bloklarda, max 6
    2: qtyBonus(snacks, 10, 2, null, false), // 10 dona → 2, bir marta
    3: subtotal >= 300000 ? 1 : 0, // summa bo'yicha
  };
  const needsChoice = earned[2] > 0 && earned[3] > 0; // strategiya: 2 tadan 1
  const activeRules =
    bonusMode === "none"
      ? []
      : [
          ...(earned[1] > 0 ? [1] : []),
          ...(needsChoice ? (stratPick ? [stratPick] : []) : [2, 3].filter((r) => earned[r] > 0)),
        ];
  const bonusApplied = activeRules.length > 0;

  // category_stock gift: default = eng katta qoldiqli SKU, jami saqlanadi
  const availLays = Math.max(0, 32 - qty("p2"));
  const availCheetos = Math.max(0, 8 - qty("p7"));
  const autoLays = Math.min(earned[2], availLays >= availCheetos ? Math.max(availLays, earned[2]) : Math.max(0, earned[2] - availCheetos));
  const giftLays = activeRules.includes(2) ? Math.max(0, Math.min(earned[2], giftEdit ?? autoLays)) : 0;
  const giftCheetos = activeRules.includes(2) ? earned[2] - giftLays : 0;
  const shortage = Math.max(0, giftLays - availLays) + Math.max(0, giftCheetos - availCheetos);
  const giftLines = [
    ...(activeRules.includes(1) ? [{ name: "Coca-Cola 1.5L", n: earned[1] }] : []),
    ...(giftLays > 0 ? [{ name: "Lay's Classic 80g", n: giftLays }] : []),
    ...(giftCheetos > 0 ? [{ name: "Cheetos Pishloq 70g", n: giftCheetos }] : []),
    ...(activeRules.includes(3) ? [{ name: "Nescafé Gold 100g", n: 1 }] : []),
  ];
  const giftTotal = giftLines.reduce((s, g) => s + g.n, 0);

  /* ---------- discounts: linked pair vs exclusive stack ---------- */
  const discRows = DISCOUNTS.map((d) => {
    const eligible = d.linked ? earned[d.linked] > 0 : subtotal >= d.minSum;
    const usable = eligible && (d.linked ? bonusApplied && activeRules.includes(d.linked) : !bonusApplied);
    return { ...d, eligible, usable };
  });
  const autoDisc = discRows.filter((d) => d.usable).sort((a, b) => b.pct - a.pct)[0] ?? null;
  const pickedDisc = discRows.find((d) => d.id === discPick) ?? null;
  const applied = discMode === "none" ? null : discMode === "auto" ? autoDisc : pickedDisc && pickedDisc.usable ? pickedDisc : null;
  const discPct = applied?.pct ?? 0;
  const discSum = Math.round((subtotal * discPct) / 100);
  const total = subtotal - discSum;

  const blockers: string[] = [];
  if (bonusMode === "auto" && needsChoice && !stratPick) blockers.push("Bonus strategiyasi qoidasini tanlang");
  if (discMode === "manual" && pickedDisc && !pickedDisc.usable) {
    blockers.push(pickedDisc.linked ? "Skidka uchun bog'langan bonusni tanlang" : "Faqat bonus yoki skidka tanlanadi");
  }
  if (discMode === "manual" && !pickedDisc) blockers.push("Skidkani tanlang yoki «Avto»ga qayting");

  const limitReason = consign
    ? total > client.consignLeft
      ? `Konsignatsiya limiti oshdi · qoldi ${fmt(client.consignLeft)} so'm`
      : null
    : total > client.creditLeft
      ? `Kredit limiti oshdi · qoldi ${fmt(client.creditLeft)} so'm`
      : null;

  /* ---------- effects: sequences ---------- */
  useEffect(() => setGiftEdit(null), [fingerprint]);
  useEffect(() => {
    if (!needsChoice) setStratPick(null);
  }, [needsChoice]);

  useEffect(() => {
    if (stage !== "checks" || checkIdx >= CHECKS.length) return;
    if (CHECKS[checkIdx].k === "photo" && !photo) return;
    const id = setTimeout(() => setCheckIdx((i) => i + 1), fast ? 15 : 400);
    return () => clearTimeout(id);
  }, [stage, checkIdx, photo, fast]);

  useEffect(() => {
    if (stage !== "submit" || pipeFail) return;
    if (pipeIdx >= PIPE.length) {
      const id = setTimeout(() => {
        setHeldLeft(300);
        setStage("held");
      }, fast ? 15 : 450);
      return () => clearTimeout(id);
    }
    if (PIPE[pipeIdx].k === "limit" && limitReason) {
      setPipeFail(limitReason);
      return;
    }
    const id = setTimeout(() => setPipeIdx((i) => i + 1), fast ? 15 : PIPE[pipeIdx].k === "bio" ? 950 : 380);
    return () => clearTimeout(id);
  }, [stage, pipeIdx, pipeFail, fast, limitReason]);

  useEffect(() => {
    if (stage !== "held") return;
    if (heldLeft <= 0) {
      setStage("done");
      return;
    }
    const id = setTimeout(() => setHeldLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, heldLeft]);

  /* ---------- actions ---------- */
  const add = (p: (typeof ORDER_PRODUCTS)[number], sign: 1 | -1) => {
    const step = boxes ? p.perBox : 1;
    const cur = qty(p.id);
    if (sign > 0 && cur + step > p.stock) {
      ctx.toast(`Omborda yetarli emas · ${p.stock} dona`);
      return;
    }
    ctx.setQty(p.id, sign * Math.min(step, sign < 0 ? cur : step));
  };
  const hintFor = (pid: string) => {
    if (pid === "p1") return earned[1] >= 6 ? null : { rem: 5 - (qty("p1") % 5), inc: 1, have: earned[1] };
    if (pid === "p2" || pid === "p7") return snacks >= 10 ? null : { rem: 10 - snacks, inc: 2, have: 0 };
    return null;
  };
  const startSubmit = () => {
    if (blockers.length) {
      ctx.toast(blockers[0]);
      return;
    }
    setPipeIdx(0);
    setPipeFail(null);
    setStage("submit");
  };
  const back = () => {
    const prev: Record<Stage, Stage | null> = { client: null, setup: "client", checks: "setup", cats: "checks", products: "cats", bonus: "cats", submit: "bonus", held: null, done: null };
    const p = prev[stage];
    if (p) setStage(p);
    else if (stage === "client") ctx.go("home");
  };
  const reset = () => {
    ctx.clearCart();
    setStage("client");
    setPhoto(false);
    setCheckIdx(0);
    setShip(null);
    setConsign(false);
    setBonusMode("auto");
    setDiscMode("auto");
    setDiscPick(null);
  };

  const ri = railIndex(stage);
  const titles: Record<Stage, string> = {
    client: "Yangi buyurtma",
    setup: "Buyurtma parametrlari",
    checks: "Majburiy shartlar",
    cats: "Kategoriyalar",
    products: ORDER_CATS.find((c) => c.id === cat)?.name ?? "Mahsulotlar",
    bonus: "Bonus va skidka",
    submit: "Tasdiqlash",
    held: "Kutish oynasi",
    done: "Yuborildi",
  };
  const card = { background: t.card, border: `1px solid ${t.line}` };
  const cta = "w-full rounded-[11px] py-2.5 text-[10.5px] font-bold on-acc transition active:scale-[0.985] disabled:opacity-40";
  const list = ORDER_PRODUCTS.filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.cat === cat));

  return (
    <div className="relative flex h-full flex-col" data-order-stage={stage}>
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title={titles[stage]}
          sub={stage === "client" ? "Mijozni tanlang" : `${client.name} · ${client.code}`}
          onBack={stage === "held" || stage === "done" ? undefined : back}
          right={
            <span className="flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[8.5px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
              <ShoppingBag size={10} /> {count}
            </span>
          }
        />
        {/* stage rail */}
        <div className="flex items-center gap-1">
          {RAIL.map((r, i) => (
            <div key={r} className="flex flex-1 flex-col gap-1">
              <span className="h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                <span
                  className="block h-full rounded-full transition-all duration-500"
                  style={{ width: i < ri ? "100%" : i === ri ? "55%" : "0%", background: accent.hex }}
                />
              </span>
              <span className="text-[6.5px] font-bold uppercase tracking-wider" style={{ color: i <= ri ? t.accText : t.sub }}>
                {r}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div key={stage} className={cn("no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2.5", !fast && "screen-enter-soft")}>
        {/* ───────── 1. CLIENT ───────── */}
        {stage === "client" && (
          <div className="space-y-1.5">
            {ORDER_CLIENTS.map((c, i) => {
              const on = c.id === clientId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={cn("w-full rounded-[14px] p-2.5 text-left transition active:scale-[0.99]", !fast && "stagger-item")}
                  style={{ ...card, borderColor: on ? accent.hex : t.line, boxShadow: on ? `0 0 0 2px ${accent.hex}22` : "none", ...( { "--stagger": `${i * 60}ms` } as React.CSSProperties) }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px]" style={{ color: t.sub }}>{c.code}</span>
                    {on && <span className="grid size-4 place-items-center rounded-full on-acc" style={{ background: accent.hex }}><Check size={9} strokeWidth={4} /></span>}
                  </div>
                  <p className="mt-0.5 text-[11px] font-bold" style={{ color: t.ink }}>{c.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[7.5px] font-semibold">
                    <span className="rounded px-1.5 py-0.5" style={{ background: c.balance < 0 ? "#E0574B18" : "#22B57318", color: c.balance < 0 ? "#E0574B" : "#1E9E63" }}>
                      {c.balance < 0 ? `Qarz ${fmt(-c.balance)}` : "Qarz yo'q"}
                    </span>
                    <span className="rounded px-1.5 py-0.5" style={{ background: t.card2, color: t.sub }}>Kredit qoldi {fmt(c.creditLeft)}</span>
                    <span className="rounded px-1.5 py-0.5" style={{ background: c.consign === "ok" ? t.accSoft : t.card2, color: c.consign === "ok" ? t.accInk : t.sub }}>
                      {c.consign === "ok" ? "Konsignatsiya ✓" : "Konsignatsiya ✕"}
                    </span>
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setStage("setup")} className={cn(cta, "mt-1")} style={{ background: accent.gradient }}>
              Parametrlarga o'tish →
            </button>
          </div>
        )}

        {/* ───────── 2. SETUP SHEET ───────── */}
        {stage === "setup" && (
          <div className="space-y-2">
            <div className="rounded-[14px] p-3" style={card}>
              <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}><Warehouse size={9} /> Ombor</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["Markaziy ombor", "Chilonzor", "Sergeli"].map((w) => (
                  <Pill key={w} on={wh === w} onClick={() => setWh(w)} t={t} accent={accent}>{w}</Pill>
                ))}
              </div>
              <p className="mt-2.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>Narx turi</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["Chakana", "Ulgurji", "VIP"].map((p) => (
                  <Pill key={p} on={price === p} onClick={() => setPrice(p)} t={t} accent={accent}>{p}</Pill>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] p-3" style={card}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold" style={{ color: t.ink }}>Konsignatsiya</p>
                  <p className="text-[7.5px]" style={{ color: t.sub }}>
                    {client.consign === "ok" ? `Limit qoldi ${fmt(client.consignLeft)} so'm` : "Bu mijoz uchun yopiq"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consign}
                  aria-label="Konsignatsiya"
                  onClick={() => {
                    const reason = CONSIGN_REASON[client.consign];
                    if (reason) ctx.toast(reason);
                    else setConsign((v) => !v);
                  }}
                  className="relative h-[18px] w-8 rounded-full transition-colors"
                  style={{ background: consign ? accent.hex : t.line, opacity: client.consign === "ok" ? 1 : 0.5 }}
                >
                  <span className="absolute top-[2px] size-[14px] rounded-full bg-white shadow transition-all" style={{ left: consign ? 16 : 2 }} />
                </button>
              </div>
              {CONSIGN_REASON[client.consign] && (
                <p className="mt-2 flex items-start gap-1 rounded-lg p-1.5 text-[7.5px] font-medium" style={{ background: "#E0574B14", color: "#C8463B" }}>
                  <Lock size={9} className="mt-[1px] shrink-0" /> {CONSIGN_REASON[client.consign]}
                </p>
              )}
              {consign && (
                <p className="auth-slide-up mt-2 rounded-lg p-1.5 text-[8px] font-medium" style={{ background: t.accSoft, color: t.accInk }}>
                  To'lov muddati: <b className="font-mono">21.07.2026</b> · 14 kun
                </p>
              )}
            </div>

            <div className="rounded-[14px] p-3" style={card}>
              <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: t.sub }}>
                <CalendarDays size={9} /> Yuklash sanasi <span style={{ color: "#E0574B" }}>*</span>
              </p>
              <div className="mt-1.5 flex gap-1">
                {["Bugun · 07.07", "Ertaga · 08.07", "09.07"].map((s) => (
                  <Pill key={s} on={ship === s} onClick={() => setShip(s)} t={t} accent={accent}>{s}</Pill>
                ))}
              </div>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Izoh (ixtiyoriy)…"
                aria-label="Izoh"
                className="mt-2.5 w-full rounded-[9px] px-2.5 py-2 text-[9.5px] outline-none"
                style={{ background: t.card2, color: t.ink }}
              />
            </div>

            <button
              type="button"
              disabled={!ship}
              onClick={() => {
                setCheckIdx(0);
                setStage("checks");
              }}
              className={cta}
              style={{ background: accent.gradient }}
            >
              {ship ? "Shartlarni tekshirish →" : "Avval yuklash sanasini tanlang"}
            </button>
          </div>
        )}

        {/* ───────── 3. MANDATORY CHECKS ───────── */}
        {stage === "checks" && (
          <div className="space-y-2">
            <div className="rounded-[14px] p-3" style={card}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold" style={{ color: t.ink }}>Buyurtma oldi tekshiruvi</p>
                <span className="font-mono text-[8.5px] font-bold" style={{ color: t.accText }}>{Math.min(checkIdx, CHECKS.length)}/{CHECKS.length}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: t.card2 }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.min(checkIdx, CHECKS.length) / CHECKS.length) * 100}%`, background: accent.hex }} />
              </div>
              <div className="relative mt-2.5 space-y-[7px]">
                <span className="absolute bottom-2 left-[8px] top-2 w-px" style={{ background: t.line }} />
                {CHECKS.map((c, i) => {
                  const done = i < checkIdx;
                  const running = i === checkIdx;
                  const blocked = running && c.k === "photo" && !photo;
                  return (
                    <div key={c.k} className="relative flex items-start gap-2">
                      <span
                        className="relative z-10 grid size-[17px] shrink-0 place-items-center rounded-full transition-all duration-300"
                        style={{
                          background: done ? accent.hex : blocked ? "#E0A023" : t.card2,
                          color: done ? accent.onAccent : blocked ? "#3A2600" : t.sub,
                          boxShadow: running && !blocked ? `0 0 0 3px ${accent.hex}2E` : "none",
                        }}
                      >
                        {done ? <Check size={10} strokeWidth={3.5} className={fast ? undefined : "pop-in"} /> : blocked ? <TriangleAlert size={9} /> : running ? <Loader2 size={10} className="animate-spin" /> : <span className="size-1 rounded-full bg-current" />}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-[9.5px] font-semibold" style={{ color: done || running ? t.ink : t.sub }}>{c.label}</span>
                        <span className="block text-[7.5px]" style={{ color: blocked ? "#B77A08" : t.sub }}>
                          {done ? (c.k === "ship" ? ship : c.ok) : blocked ? "Foto hisobot qo'shish kerak" : running ? "tekshirilmoqda…" : "navbatda"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {checkIdx < CHECKS.length && CHECKS[checkIdx].k === "photo" && !photo && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(true);
                  ctx.toast("Foto hisobot biriktirildi");
                }}
                className={cn(cta, "auth-slide-up flex items-center justify-center gap-1.5")}
                style={{ background: "#E0A023", color: "#3A2600" }}
              >
                <Camera size={12} /> Foto hisobot olish
              </button>
            )}
            <button type="button" disabled={checkIdx < CHECKS.length} onClick={() => setStage("cats")} className={cta} style={{ background: accent.gradient }}>
              {checkIdx < CHECKS.length ? "Tekshirilmoqda…" : "Hammasi joyida — katalogga o'tish →"}
            </button>
          </div>
        )}

        {/* ───────── 4a. CATEGORIES ───────── */}
        {stage === "cats" && (
          <div className="grid grid-cols-2 gap-2">
            {ORDER_CATS.map((c, i) => {
              const inCat = ORDER_PRODUCTS.filter((p) => p.cat === c.id).reduce((s, p) => s + qty(p.id), 0);
              const promo = c.id === "drinks" ? "5+1" : c.id === "snacks" ? "10→2" : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCat(c.id);
                    setQ("");
                    setStage("products");
                  }}
                  className={cn("relative rounded-[15px] p-2.5 text-left transition active:scale-95", !fast && "stagger-item")}
                  style={{ ...card, borderColor: inCat ? accent.hex : t.line, ...({ "--stagger": `${i * 45}ms` } as React.CSSProperties) }}
                >
                  {inCat > 0 && <span className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold on-acc" style={{ background: accent.hex }}>{inCat}</span>}
                  <span className="grid size-9 place-items-center rounded-xl text-[18px]" style={{ background: t.card2 }}>{c.emoji}</span>
                  <p className="mt-1.5 text-[10.5px] font-bold" style={{ color: t.ink }}>{c.name}</p>
                  <p className="flex items-center gap-1 text-[8px]" style={{ color: t.sub }}>
                    {ORDER_PRODUCTS.filter((p) => p.cat === c.id).length} SKU
                    {promo && <span className="rounded bg-[#FEF08A] px-1 font-mono text-[7px] font-bold text-[#854D0E]">🎁 {promo}</span>}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* ───────── 4b. PRODUCTS ───────── */}
        {stage === "products" && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <label className="flex flex-1 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5" style={card}>
                <Search size={11} style={{ color: t.sub }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Barcha mahsulotlardan izlash…" aria-label="Mahsulot qidirish" className="w-full bg-transparent text-[9.5px] outline-none" style={{ color: t.ink }} />
                {q && <button type="button" onClick={() => setQ("")} aria-label="Tozalash" style={{ color: t.sub }}><X size={11} /></button>}
              </label>
              <button type="button" onClick={() => setBoxes((b) => !b)} aria-pressed={boxes} className="rounded-[10px] px-2 font-mono text-[8.5px] font-bold" style={{ background: boxes ? accent.hex : t.card, color: boxes ? accent.onAccent : t.ink, border: `1px solid ${boxes ? accent.hex : t.line}` }}>
                {boxes ? "korobka" : "dona"}
              </button>
            </div>
            {list.map((p) => {
              const n = qty(p.id);
              const hint = hintFor(p.id);
              return (
                <div key={p.id} className="rounded-[13px] p-2" style={{ ...card, borderColor: n ? accent.hex : t.line }}>
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[17px]" style={{ background: t.card2 }}>{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold" style={{ color: t.ink }}>{p.name}</p>
                      <p className="text-[7.5px]" style={{ color: n >= p.stock ? "#E0574B" : t.sub }}>Qoldiq {p.stock - n} · {p.perBox} dona/kor</p>
                      <p className="font-mono text-[9px] font-bold" style={{ color: t.accText }}>{fmt(p.price)}</p>
                    </div>
                    {n === 0 ? (
                      <button type="button" onClick={() => add(p, 1)} aria-label={`${p.name} qo'shish`} className="grid size-7 place-items-center rounded-full on-acc active:scale-90" style={{ background: accent.hex }}>
                        <Plus size={13} strokeWidth={3} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: t.accSoft }}>
                        <button type="button" onClick={() => add(p, -1)} aria-label="Kamaytirish" className="grid size-6 place-items-center rounded-full" style={{ background: t.card, color: t.accInk }}><Minus size={10} strokeWidth={3} /></button>
                        <span key={n} className={cn("min-w-[22px] text-center font-mono text-[9.5px] font-bold", !fast && "pop-in")} style={{ color: t.accInk }}>
                          {boxes ? `${(n / p.perBox).toFixed(1)}k` : n}
                        </span>
                        <button type="button" onClick={() => add(p, 1)} aria-label="Ko'paytirish" className="grid size-6 place-items-center rounded-full on-acc" style={{ background: accent.hex }}><Plus size={10} strokeWidth={3} /></button>
                      </div>
                    )}
                  </div>
                  {hint && (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1" style={{ background: "#FEF9C3" }}>
                      <Gift size={9} className="shrink-0 text-[#A16207]" />
                      <span className="flex-1 text-[7.5px] font-semibold text-[#854D0E]">
                        {hint.have > 0 && <b key={hint.have} className={cn("mr-1 rounded bg-[#CA8A04] px-1 text-white", !fast && "pop-in")}>+{hint.have} bonus bor</b>}
                        yana {hint.rem} dona → +{hint.inc} bonus
                      </span>
                      <span className="h-1 w-10 overflow-hidden rounded-full bg-[#FDE68A]">
                        <span className="block h-full rounded-full bg-[#CA8A04] transition-all duration-500" style={{ width: `${p.id === "p1" ? ((qty("p1") % 5) / 5) * 100 : (snacks / 10) * 100}%` }} />
                      </span>
                    </div>
                  )}
                  {!hint && (p.id === "p1" || p.id === "p2" || p.id === "p7") && (earned[1] > 0 || earned[2] > 0) && (
                    <p className="mt-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[7.5px] font-bold" style={{ background: "#DCFCE7", color: "#166534" }}>
                      <Check size={9} strokeWidth={3.5} /> Bonus sharti bajarildi
                    </p>
                  )}
                </div>
              );
            })}
            {!list.length && <p className="py-8 text-center text-[9.5px]" style={{ color: t.sub }}>Hech narsa topilmadi</p>}
          </div>
        )}

        {/* ───────── 5. BONUS + DISCOUNT SHEET ───────── */}
        {stage === "bonus" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1 rounded-[11px] p-1" style={{ background: t.card2 }}>
              {[
                { l: "Bonus", n: giftTotal ? `${giftTotal} dona` : "—", icon: Gift },
                { l: "Skidka", n: discPct ? `−${discPct}%` : "—", icon: Percent },
              ].map((s, i) => (
                <button key={s.l} type="button" onClick={() => setSection(i as 0 | 1)} aria-pressed={section === i} className="flex items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[9.5px] font-bold transition" style={{ background: section === i ? t.card : "transparent", color: section === i ? t.ink : t.sub, boxShadow: section === i ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}>
                  <s.icon size={11} /> {s.l}
                  <span className="rounded-full px-1.5 py-[1px] font-mono text-[7.5px]" style={{ background: t.accSoft, color: t.accInk }}>{s.n}</span>
                </button>
              ))}
            </div>

            {section === 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  <Pill on={bonusMode === "auto"} onClick={() => setBonusMode("auto")} t={t} accent={accent}>Avto</Pill>
                  <Pill on={bonusMode === "none"} onClick={() => setBonusMode("none")} t={t} accent={accent}>Bonussiz</Pill>
                </div>

                {bonusMode === "none" ? (
                  <p className="rounded-[12px] p-3 text-center text-[9px]" style={{ ...card, color: t.sub }}>Bonus qo'llanmaydi — endi oddiy skidkalar ochiladi</p>
                ) : earned[1] + earned[2] + earned[3] === 0 ? (
                  <p className="rounded-[12px] p-3 text-center text-[9px]" style={{ ...card, color: t.sub }}>Bu buyurtma uchun faol bonus yo'q</p>
                ) : (
                  <>
                    {earned[1] > 0 && (
                      <RuleCard t={t} accent={accent} fast={fast} name="Coca-Cola 5+1" kind="Miqdor · bloklarda" formula={`⌊${qty("p1")} ÷ 5⌋ × 1 = ${earned[1]} · max 6`} earned={earned[1]} active>
                        <GiftRow t={t} name="Coca-Cola 1.5L" note="avto · qulflangan" n={earned[1]} />
                        <p className="mt-1 flex items-center gap-1 text-[7.5px] font-semibold" style={{ color: t.accText }}><Link2 size={8} /> «Coca-Cola aksiyasi −2%» skidkasi bilan bog'langan</p>
                      </RuleCard>
                    )}

                    {needsChoice && (
                      <div className="rounded-[12px] border border-dashed p-2" style={{ borderColor: stratPick ? t.line : "#E0A023", background: stratPick ? "transparent" : "#E0A02312" }}>
                        <p className="text-[8.5px] font-bold" style={{ color: t.ink }}>Strategiya: Yoz aksiyasi</p>
                        <p className="text-[7.5px]" style={{ color: stratPick ? t.sub : "#B77A08" }}>2 ta qoidadan 1 tasini tanlang</p>
                      </div>
                    )}

                    {earned[2] > 0 && (
                      <RuleCard
                        t={t} accent={accent} fast={fast}
                        name="Sneklar: 10 dona → 2 sovg'a" kind="Miqdor · bir martalik" formula={`${snacks} ≥ 10 → 2 dona`} earned={earned[2]}
                        active={activeRules.includes(2)}
                        onPick={needsChoice ? () => setStratPick(2) : undefined}
                      >
                        {activeRules.includes(2) && (
                          <>
                            <p className="mb-1 text-[7.5px]" style={{ color: t.sub }}>Sovg'ani taqsimlang — jami {earned[2]} dona saqlanadi</p>
                            {[
                              { name: "Lay's Classic 80g", n: giftLays, avail: availLays },
                              { name: "Cheetos Pishloq 70g", n: giftCheetos, avail: availCheetos },
                            ].map((g, gi) => (
                              <div key={g.name} className="mt-1 flex items-center gap-1.5 rounded-lg px-1.5 py-1" style={{ background: t.card2 }}>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[8.5px] font-semibold" style={{ color: t.ink }}>{g.name}</span>
                                  <span className="block text-[7px]" style={{ color: g.n > g.avail ? "#E0574B" : t.sub }}>
                                    {g.n > g.avail ? `Yetishmaydi: ${g.n - g.avail} dona` : `Bonus uchun mavjud: ${g.avail}`}
                                  </span>
                                </span>
                                <button type="button" aria-label={`${g.name} kamaytirish`} onClick={() => setGiftEdit(gi === 0 ? Math.max(0, giftLays - 1) : Math.min(earned[2], giftLays + 1))} className="grid size-5 place-items-center rounded-full" style={{ background: t.card, color: t.ink }}><Minus size={9} /></button>
                                <span key={g.n} className={cn("w-4 text-center font-mono text-[9px] font-bold", !fast && "pop-in")} style={{ color: t.ink }}>{g.n}</span>
                                <button type="button" aria-label={`${g.name} ko'paytirish`} onClick={() => setGiftEdit(gi === 0 ? Math.min(earned[2], giftLays + 1) : Math.max(0, giftLays - 1))} className="grid size-5 place-items-center rounded-full on-acc" style={{ background: accent.hex }}><Plus size={9} /></button>
                              </div>
                            ))}
                            {shortage > 0 && (
                              <p className="auth-slide-up mt-1.5 flex items-start gap-1 rounded-lg p-1.5 text-[7.5px] font-medium" style={{ background: "#E0574B14", color: "#C8463B" }}>
                                <TriangleAlert size={9} className="mt-[1px] shrink-0" /> Omborda bonus uchun yetarli emas — izohga avtomatik qo'shiladi
                              </p>
                            )}
                          </>
                        )}
                      </RuleCard>
                    )}

                    {earned[3] > 0 && (
                      <RuleCard
                        t={t} accent={accent} fast={fast}
                        name="300 000+ so'm → Nescafé" kind="Summa · mijozga 1 marta" formula={`${fmt(subtotal)} ≥ 300 000`} earned={1}
                        active={activeRules.includes(3)}
                        onPick={needsChoice ? () => setStratPick(3) : undefined}
                      >
                        {activeRules.includes(3) && <GiftRow t={t} name="Nescafé Gold 100g" note="avto · qulflangan" n={1} />}
                      </RuleCard>
                    )}
                  </>
                )}
              </div>
            )}

            {section === 1 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  <Pill on={discMode === "auto"} onClick={() => setDiscMode("auto")} t={t} accent={accent}>Avto</Pill>
                  <Pill on={discMode === "none"} onClick={() => setDiscMode("none")} t={t} accent={accent}>Skidkasiz</Pill>
                  <Pill on={discMode === "manual"} onClick={() => setDiscMode("manual")} t={t} accent={accent}>Tanlash</Pill>
                </div>
                <p className="flex items-start gap-1 rounded-lg p-1.5 text-[7.5px] font-medium" style={{ background: t.accSoft, color: t.accInk }}>
                  {bonusApplied ? <Lock size={9} className="mt-[1px] shrink-0" /> : <Check size={9} className="mt-[1px] shrink-0" />}
                  {bonusApplied ? "Bonus qo'llangan: faqat bonus bilan bog'langan skidka ishlaydi" : "Bonus yo'q: oddiy skidkalar ochiq, eng kattasi tanlanadi"}
                </p>
                {discRows.map((dr) => {
                  const on = discMode !== "none" && applied?.id === dr.id;
                  const picked = discMode === "manual" && discPick === dr.id;
                  return (
                    <button
                      key={dr.id}
                      type="button"
                      disabled={discMode !== "manual"}
                      onClick={() => setDiscPick(dr.id)}
                      className="flex w-full items-center gap-2 rounded-[12px] p-2 text-left transition"
                      style={{ ...card, borderColor: on ? accent.hex : picked ? "#E0A023" : t.line, opacity: dr.eligible ? 1 : 0.5 }}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] font-mono text-[10px] font-bold" style={{ background: on ? accent.hex : "#FFEDD5", color: on ? accent.onAccent : "#C2410C" }}>
                        −{dr.pct}%
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] font-bold" style={{ color: t.ink }}>{dr.name}</span>
                        <span className="block text-[7.5px]" style={{ color: t.sub }}>
                          {dr.linked ? "Coca-Cola 5+1 bonusi bilan bog'langan" : `${fmt(dr.minSum)} so'mdan`}
                          {!dr.eligible ? " · shart bajarilmagan" : !dr.usable ? (dr.linked ? " · bonus kerak" : " · bonus bilan birga emas") : ""}
                        </span>
                      </span>
                      {on ? <Check size={13} style={{ color: t.accText }} /> : dr.linked ? <Link2 size={11} style={{ color: t.sub }} /> : null}
                    </button>
                  );
                })}
                {discMode === "none" && <p className="text-center text-[8px]" style={{ color: t.sub }}>Skidka buyurtmaga qo'llanmaydi</p>}
              </div>
            )}

            {/* totals */}
            <div className="rounded-[13px] p-2.5 text-[8.5px]" style={card}>
              <Row t={t} l={`Tovarlar · ${count} dona`} v={`${fmt(subtotal)}`} />
              <Row t={t} l={`Skidka${applied ? ` · ${applied.name}` : ""}`} v={discSum ? `−${fmt(discSum)}` : "0"} tone={discSum ? "#EA580C" : undefined} />
              <Row t={t} l="Bonus sovg'alar" v={giftTotal ? `${giftTotal} dona · 0 so'm` : "—"} tone={giftTotal ? "#A16207" : undefined} />
              <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-[10.5px] font-bold" style={{ borderColor: t.line, color: t.ink }}>
                <span>To'lanadigan</span>
                <span key={total} className={cn("font-mono", !fast && "pop-in")}>{fmt(total)} so'm</span>
              </div>
            </div>

            {blockers.length > 0 && (
              <p className="flex items-start gap-1 rounded-lg p-2 text-[8px] font-semibold" style={{ background: "#E0A02318", color: "#9A6508" }}>
                <TriangleAlert size={10} className="mt-[1px] shrink-0" /> {blockers[0]}
              </p>
            )}
            <button type="button" onClick={startSubmit} className={cn(cta, "flex items-center justify-center gap-1.5")} style={{ background: accent.gradient, opacity: blockers.length ? 0.55 : 1 }}>
              <ShieldCheck size={12} /> Buyurtmani tasdiqlash
            </button>
          </div>
        )}

        {/* ───────── 6. SUBMIT PIPELINE ───────── */}
        {stage === "submit" && (
          <div className="space-y-2">
            <div className="rounded-[14px] p-3" style={card}>
              <div className="relative space-y-2">
                <span className="absolute bottom-2 left-[8px] top-2 w-px" style={{ background: t.line }} />
                {PIPE.map((s, i) => {
                  const done = i < pipeIdx;
                  const running = i === pipeIdx && !pipeFail;
                  const failed = i === pipeIdx && !!pipeFail;
                  return (
                    <div key={s.k} className="relative flex items-center gap-2">
                      <span className="relative z-10 grid size-[17px] shrink-0 place-items-center rounded-full transition-all duration-300" style={{ background: failed ? "#E0574B" : done ? accent.hex : t.card2, color: failed ? "#fff" : done ? accent.onAccent : t.sub, boxShadow: running ? `0 0 0 3px ${accent.hex}2E` : "none" }}>
                        {failed ? <X size={10} strokeWidth={3.5} /> : done ? <Check size={10} strokeWidth={3.5} /> : running ? (s.k === "bio" ? <Fingerprint size={10} className="auth-blink" /> : <Loader2 size={10} className="animate-spin" />) : <span className="size-1 rounded-full bg-current" />}
                      </span>
                      <span className="flex-1 text-[9.5px] font-semibold" style={{ color: done || running || failed ? t.ink : t.sub }}>{s.label}</span>
                      <span className="font-mono text-[7.5px]" style={{ color: failed ? "#E0574B" : t.sub }}>{failed ? "to'xtadi" : done ? "ok" : running ? "…" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {pipeFail && (
              <div className="auth-slide-up rounded-[12px] p-2.5" style={{ background: "#E0574B14", border: "1px solid #E0574B44" }}>
                <p className="flex items-start gap-1.5 text-[9px] font-semibold" style={{ color: "#C8463B" }}><TriangleAlert size={11} className="mt-[1px] shrink-0" /> {pipeFail}</p>
                <button type="button" onClick={() => setStage("products")} className="mt-2 w-full rounded-lg py-2 text-[9px] font-bold" style={{ background: t.card, color: t.ink }}>Savatni kamaytirish</button>
              </div>
            )}
          </div>
        )}

        {/* ───────── 7. HELD WINDOW ───────── */}
        {stage === "held" && (
          <div className="space-y-2.5 text-center">
            <div className="relative mx-auto mt-1 size-[118px]">
              <svg viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="43" fill="none" stroke={t.card2} strokeWidth="7" />
                <circle cx="50" cy="50" r="43" fill="none" stroke={accent.hex} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(heldLeft / 300) * 270} 270`} style={{ transition: "stroke-dasharray 1s linear" }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div>
                  <Clock3 size={13} className="mx-auto" style={{ color: t.accText }} />
                  <p className="font-mono text-[19px] font-bold tabular-nums leading-tight" style={{ color: t.ink }}>
                    {String(Math.floor(heldLeft / 60)).padStart(2, "0")}:{String(heldLeft % 60).padStart(2, "0")}
                  </p>
                  <p className="text-[7px]" style={{ color: t.sub }}>avto-yuborish</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] font-bold" style={{ color: t.ink }}>Buyurtma kutish oynasida</p>
            <p className="mx-auto max-w-[220px] text-[8.5px] leading-snug" style={{ color: t.sub }}>Shu vaqt ichida tahrirlash mumkin. Vaqt tugagach serverga o'zi yuboriladi.</p>
            <div className="rounded-[13px] p-2.5 text-left text-[8.5px]" style={card}>
              <Row t={t} l="Jami" v={`${fmt(total)} so'm`} />
              <Row t={t} l="Skidka" v={discPct ? `−${discPct}%` : "—"} />
              <Row t={t} l="Bonus" v={giftTotal ? `${giftTotal} dona` : "—"} />
              <Row t={t} l="To'lov" v={consign ? "Konsignatsiya · 14 kun" : price} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setStage("products")} className="flex items-center justify-center gap-1 rounded-[10px] py-2 text-[9px] font-semibold" style={{ ...card, color: t.ink }}><Pencil size={10} /> Tahrirlash</button>
              <button type="button" onClick={() => { setHeldLeft((s) => s + 300); ctx.toast("Yuborish 5 daqiqaga kechiktirildi"); }} className="flex items-center justify-center gap-1 rounded-[10px] py-2 text-[9px] font-semibold" style={{ ...card, color: t.ink }}><Clock3 size={10} /> +5 daqiqa</button>
            </div>
            <button type="button" onClick={() => setStage("done")} className={cn(cta, "flex items-center justify-center gap-1.5")} style={{ background: accent.gradient }}><Send size={11} /> Hozir yuborish</button>
          </div>
        )}

        {/* ───────── 8. DONE ───────── */}
        {stage === "done" && (
          <div className="relative space-y-2.5 text-center">
            {!fast && (
              <div className="pointer-events-none absolute inset-x-0 top-10 h-0">
                {Array.from({ length: 14 }).map((_, i) => {
                  const a = (i / 14) * Math.PI * 2;
                  return <span key={i} className="rs-confetti absolute left-1/2 block size-1 rounded-full" style={{ background: [accent.hex, "#FACC15", "#22B573", "#F472B6"][i % 4], "--cx": `${Math.cos(a) * (50 + (i % 3) * 22)}px`, "--cy": `${Math.sin(a) * (50 + (i % 3) * 22)}px`, "--cr": `${i * 40}deg`, "--d": `${i * 22}ms` } as React.CSSProperties} />;
                })}
              </div>
            )}
            <div className={cn("mx-auto mt-2 grid size-16 place-items-center rounded-full on-acc", !fast && "auth-ring-pop")} style={{ background: accent.gradient, boxShadow: `0 14px 30px -12px ${accent.hex}` }}>
              <PackageCheck size={28} />
            </div>
            <p className="font-display text-[15px] font-bold" style={{ color: t.ink }}>Buyurtma №1848 yuborildi</p>
            <p className="text-[9px]" style={{ color: t.sub }}>Endi vizitni yakunlang</p>
            <div className="rounded-[13px] p-2.5 text-left text-[8.5px]" style={card}>
              <Row t={t} l={client.name} v={client.code} />
              <Row t={t} l={`${count} dona + ${giftTotal} sovg'a`} v={`${fmt(total)} so'm`} />
              {giftLines.map((g) => <Row key={g.name} t={t} l={`🎁 ${g.name}`} v={`${g.n} × 0`} tone="#A16207" />)}
              {shortage > 0 && <Row t={t} l="Izoh" v="Bonus — omborda yetishmaydi" tone="#C8463B" />}
              {comment && <Row t={t} l="Izoh" v={comment} />}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={reset} className="rounded-[10px] py-2.5 text-[9.5px] font-semibold" style={{ ...card, color: t.ink }}>Yangi buyurtma</button>
              <button type="button" onClick={() => { ctx.clearCart(); ctx.toast("Buyurtma №1848 yuborildi"); ctx.go("home"); }} className="rounded-[10px] py-2.5 text-[9.5px] font-bold on-acc" style={{ background: accent.hex }}>Bosh sahifa</button>
            </div>
          </div>
        )}
      </div>

      {/* sticky cart bar */}
      {(stage === "cats" || stage === "products") && (
        <div className="border-t px-4 pb-2 pt-2" style={{ borderColor: t.line, background: t.card }}>
          {subtotal > 0 && subtotal < 300000 && (
            <p className="mb-1.5 flex items-center gap-1 text-[7.5px] font-semibold" style={{ color: "#A16207" }}>
              <Gift size={9} /> yana {fmt(300000 - subtotal)} so'm → Nescafé sovg'a
              <span className="ml-auto h-1 w-14 overflow-hidden rounded-full bg-[#FDE68A]"><span className="block h-full rounded-full bg-[#CA8A04] transition-all duration-500" style={{ width: `${(subtotal / 300000) * 100}%` }} /></span>
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1 text-[7.5px]" style={{ color: t.sub }}>
                {count} dona
                {earned[1] + earned[2] + earned[3] > 0 && <span key={earned[1] + earned[2] + earned[3]} className={cn("rounded bg-[#FEF08A] px-1 font-mono font-bold text-[#854D0E]", !fast && "pop-in")}>🎁 +{earned[1] + earned[2] + earned[3]}</span>}
              </p>
              <p className="font-display text-[15px] font-bold leading-tight" style={{ color: t.ink }}>{fmt(subtotal)} <span className="text-[8.5px] font-medium" style={{ color: t.sub }}>so'm</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!count) ctx.toast("Kamida bitta mahsulot tanlang");
                else {
                  setSection(0);
                  setStage("bonus");
                }
              }}
              className="flex items-center gap-1 rounded-[10px] px-3 py-2.5 text-[9.5px] font-bold on-acc active:scale-95"
              style={{ background: accent.gradient, opacity: count ? 1 : 0.5 }}
            >
              Bonus va skidka <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small parts                                                        */
/* ------------------------------------------------------------------ */

function Pill({ on, onClick, t, accent, children }: { on: boolean; onClick: () => void; t: Props["t"]; accent: Props["accent"]; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full px-2.5 py-1.5 text-[9px] font-semibold transition active:scale-95"
      style={{ background: on ? accent.hex : t.card2, color: on ? accent.onAccent : t.sub, border: `1px solid ${on ? accent.hex : t.line}` }}
    >
      {children}
    </button>
  );
}

function Row({ t, l, v, tone }: { t: Props["t"]; l: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[2px]">
      <span className="truncate" style={{ color: t.sub }}>{l}</span>
      <span className="shrink-0 font-mono font-semibold" style={{ color: tone ?? t.ink }}>{v}</span>
    </div>
  );
}

function GiftRow({ t, name, note, n }: { t: Props["t"]; name: string; note: string; n: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1" style={{ background: t.card2 }}>
      <Gift size={10} className="shrink-0 text-[#CA8A04]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[8.5px] font-semibold" style={{ color: t.ink }}>{name}</span>
        <span className="block text-[7px]" style={{ color: t.sub }}>{note}</span>
      </span>
      <span className="font-mono text-[9px] font-bold" style={{ color: t.ink }}>× {n}</span>
    </div>
  );
}

function RuleCard({
  t, accent, fast, name, kind, formula, earned, active, onPick, children,
}: {
  t: Props["t"]; accent: Props["accent"]; fast: boolean; name: string; kind: string; formula: string; earned: number; active: boolean; onPick?: () => void; children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[13px] p-2.5 transition", !fast && "auth-slide-up")} style={{ background: t.card, border: `1px solid ${active ? accent.hex : t.line}`, opacity: active || onPick ? 1 : 0.6 }}>
      <div className="flex items-start gap-2">
        {onPick && (
          <button type="button" onClick={onPick} aria-pressed={active} aria-label={`${name} qoidasini tanlash`} className="mt-[1px] grid size-4 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: active ? accent.hex : t.line, background: active ? accent.hex : "transparent", color: accent.onAccent }}>
            {active && <Check size={9} strokeWidth={4} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-bold" style={{ color: t.ink }}>{name}</p>
          <p className="text-[7.5px]" style={{ color: t.sub }}>{kind}</p>
          <p className="mt-0.5 font-mono text-[7.5px]" style={{ color: t.accText }}>{formula}</p>
        </div>
        <span key={earned} className={cn("rounded-full bg-[#FEF08A] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#854D0E]", !fast && "pop-in")}>+{earned}</span>
      </div>
      {children && <div className="mt-1.5">{children}</div>}
      {onPick && !active && (
        <button type="button" onClick={onPick} className="mt-1.5 flex items-center gap-0.5 text-[8px] font-bold" style={{ color: t.accText }}>
          Shu qoidani tanlash <ChevronRight size={9} />
        </button>
      )}
    </div>
  );
}

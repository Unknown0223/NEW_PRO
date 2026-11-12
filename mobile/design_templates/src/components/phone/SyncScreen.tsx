import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { roles, type RoleKey } from "../../data/design";
import { BRAND } from "./Brand";
import { BrandSync } from "./BrandSync";
import { ScreenHead, type Props } from "./PhoneScreens";

const SYNC_ITEMS: Record<RoleKey, { label: string; count: string }[]> = {
  agent: [
    { label: "Savdo nuqtalari", count: "342" },
    { label: "Katalog va narxlar", count: "1 208" },
    { label: "Ombor qoldiqlari", count: "3 ombor" },
    { label: "Bonus va skidka qoidalari", count: "6" },
    { label: "Kunlik marshrut", count: "12 vizit" },
    { label: "Tabel va KPI", count: "iyul" },
  ],
  expeditor: [
    { label: "Mashina profili", count: "01 A 777" },
    { label: "Nakladnoylar", count: "12" },
    { label: "Yetkazish marshruti", count: "21 km" },
    { label: "Qarz kitobi", count: "48 mijoz" },
    { label: "Qaytarish turlari", count: "3" },
    { label: "Chek printeri", count: "ulangan" },
  ],
  supervisor: [
    { label: "Hudud va jamoa", count: "Sharq" },
    { label: "Agentlar", count: "12" },
    { label: "GPS va geofence", count: "24 soat" },
    { label: "Tasdiq kutayotgan vizitlar", count: "8" },
    { label: "Hudud KPI", count: "142 mln" },
    { label: "Yangi mijozlar", count: "2" },
  ],
  cashier: [
    { label: "Kassa sozlamalari", count: "Markaz" },
    { label: "Bank inbox", count: "24" },
    { label: "Buyurtmaga moslash", count: "22 / 24" },
    { label: "Ekspeditor topshiriqlari", count: "6 / 6" },
    { label: "Eksport shablonlari", count: "Excel" },
    { label: "Audit jurnali", count: "OK" },
  ],
};

/**
 * Sync screen with the Sales Arena branded motion: pressing the button
 * opens the animated sequence (mark draws, brand wave rises with the
 * progress, the role vehicle keeps moving, success check + particles).
 */
export function SyncScreen({ t, accent, ctx }: Props) {
  const roleDef = roles.find((r) => r.key === ctx.role) ?? roles[0];
  const items = SYNC_ITEMS[ctx.role];
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState("12:48");
  const tone = t.isDark ? BRAND.bright : BRAND.blue;

  if (running) {
    return (
      <div className="relative h-full" data-sync-screen-running="1">
        <BrandSync
          role={ctx.role}
          accent={accent}
          variant="full"
          motion={ctx.motion}
          onDone={() => { setRunning(false); setLast("hozir"); ctx.toast("Sinxronlandi"); ctx.go("sync-success"); }}
          onClose={() => setRunning(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Sinxronlash" sub={`${roleDef.name} · oxirgi: ${last}`} onBack={() => ctx.go(roleDef.homeScreen)} />
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-3">
        <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          {items.map((it, i) => (
            <div key={it.label} className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: i < items.length - 1 ? `1px solid ${t.line}` : "none" }}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ background: t.card2, color: tone }}>
                <Check size={11} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px]" style={{ color: t.ink }}>{it.label}</span>
              <span className="shrink-0 font-mono text-[8.5px]" style={{ color: t.sub }}>{it.count}</span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 px-1 text-[8.5px] leading-relaxed" style={{ color: t.sub }}>
          Ma'lumotlar qurilmada saqlanadi — internet bo'lmasa ham ishlashingiz mumkin.
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-[11px] px-2.5 py-2" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <RefreshCw size={11} style={{ color: tone }} />
          <span className="flex-1 text-[8.5px]" style={{ color: t.sub }}>Avto sinxron har 30 daqiqada</span>
          <span className="font-mono text-[8px] font-bold" style={{ color: tone }}>ON</span>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3 pt-2">
        <button type="button" onClick={() => ctx.go(roleDef.homeScreen)} className="flex-1 rounded-[10px] py-2.5 text-[10px] font-medium" style={{ background: t.card, border: `1px solid ${t.line}`, color: t.ink }}>
          Bosh sahifa
        </button>
        <button type="button" onClick={() => setRunning(true)} className="flex-[1.4] rounded-[10px] py-2.5 text-[10px] font-semibold text-white" style={{ background: BRAND.blue }}>
          Hozir sinxronlash
        </button>
      </div>
    </div>
  );
}

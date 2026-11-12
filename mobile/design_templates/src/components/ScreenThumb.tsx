import type { Template } from "../data/design";

export type ThumbTint = { hex: string; soft: string; ink: string; deep: string; on?: string };

const DEFAULT_TINT: ThumbTint = { hex: "#3457D5", soft: "#E9EDFF", ink: "#1B338F", deep: "#131F55", on: "#FFFFFF" };

const Line = ({ w = "100%", h = 4, c = "#DCE7E3", r = 3 }: { w?: string; h?: number; c?: string; r?: number }) => (
  <span style={{ width: w, height: h, background: c, borderRadius: r, display: "block" }} />
);

const Row = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex items-center gap-1 rounded-[5px] bg-white p-1 ${className}`} style={{ border: "1px solid #EDF3F0" }}>
    {children}
  </div>
);

export default function ScreenThumb({ kind, tint }: { kind: Template["kind"]; tint?: ThumbTint }) {
  const c = tint ?? DEFAULT_TINT;
  const tintVars = {
    "--tc": c.hex,
    "--tcs": c.soft,
    "--tci": c.ink,
    "--tcd": c.deep,
    "--tco": c.on ?? "#FFFFFF",
  } as React.CSSProperties;
  const frame = "relative mx-auto flex h-[188px] w-[104px] flex-col overflow-hidden rounded-[16px] shadow-[0_16px_28px_-14px_rgba(6,33,30,0.4)] ring-[3px] ring-white/80";

  if (kind === "login") {
    return (
      <div className={frame} style={{ ...tintVars, background: "linear-gradient(160deg, var(--tcd) 0%, #05070E 100%)" }}>
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="h-1 w-1 rounded-full bg-white/30" />
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <span className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-br from-[#14b3a4] to-[var(--tcd)] text-[8px] text-lime">◆</span>
          <Line w="34px" h={3} c="rgba(255,255,255,.55)" />
          <Line w="22px" h={2} c="rgba(255,255,255,.2)" />
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="grid size-3.5 place-items-center rounded-[3px] border border-white/20">
                {i < 2 && <span className="size-[3px] rounded-full bg-lime" />}
              </span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-[3px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="size-3.5 rounded-[3px] bg-white/10" />
            ))}
          </div>
        </div>
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1 rounded-[4px] bg-lime/10 p-1">
            <span className="size-1.5 rounded-full bg-lime" />
            <Line w="40px" h={2} c="rgba(200,245,106,.45)" />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "home" || kind === "visits" || kind === "visit-live") {
    const live = kind !== "home";
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <div className="flex items-center gap-1">
            <span className="size-3.5 rounded-full" style={{ background: "linear-gradient(135deg,#12b3a4,var(--tcd))" }} />
            <div className="space-y-[2px]">
              <Line w="22px" h={2.5} c="#C9D8D3" />
              <Line w="16px" h={2} c="#DDE8E4" />
            </div>
          </div>
          <span className="size-3 rounded-[4px] bg-white" />
        </div>
        <div className="px-2">
          <div className="rounded-[7px] p-1.5 text-[color:var(--tco)]" style={{ background: "linear-gradient(140deg,var(--tc),var(--tcd))" }}>
            <div className="flex justify-between">
              <span className="rounded-full bg-white/20 px-1 py-[1px] text-[3.5px] font-bold">● FAOL</span>
              <span className="text-[4px] font-bold">04:57</span>
            </div>
            <Line w="56px" h={2.5} c="rgba(255,255,255,.85)" />
            <Line w="38px" h={2} c="rgba(255,255,255,.4)" />
            <div className="mt-1 flex gap-0.5">
              {[1, 1, 1, 0].map((v, i) => (
                <span key={i} className="h-[1.5px] flex-1 rounded-full" style={{ background: v ? "#fff" : "rgba(255,255,255,.25)" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-[3px] px-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[4px] bg-white p-1">
              <Line w="70%" h={1.5} c="#DDE8E4" />
              <Line w="50%" h={2.5} c="var(--tc)" />
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-4 gap-[3px] px-2">
          {["◆", "＋", "◉", "▤"].map((g, i) => (
            <div key={i} className="grid aspect-square place-items-center rounded-[4px] bg-white text-[4.5px] text-[var(--tci)]">
              {g}
            </div>
          ))}
        </div>
        <div className="no-scrollbar mt-1 flex-1 space-y-[3px] overflow-hidden px-2">
          {[0, 1, 2].map((i) => (
            <Row key={i}>
              <span className="text-[3.5px] font-bold text-[#6C807A]">{["09:40", "11:20", "14:00"][i]}</span>
              <span className="flex-1 space-y-[1.5px]">
                <Line w="85%" h={2} c="#B9CBC5" />
                <Line w="55%" h={1.5} c="#E2ECE8" />
              </span>
              <span className="size-1 rounded-full" style={{ background: i === 0 ? "var(--tc)" : i === 1 ? "#22b573" : "#DDE8E4" }} />
            </Row>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-around border-t border-[#E7EFEC] bg-white py-1">
          {["⌂", "◉", "＋", "☰", "○"].map((n, i) => (
            <span key={i} className={i === (live ? 1 : 0) ? "text-[5px] text-[var(--tc)]" : "text-[5px] text-[#A9BCB6]"}>{n}</span>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "clients" || kind === "client") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1.5 pt-2">
          <Line w="34px" h={4} c="#8FA8A0" />
          <span className="grid size-3 place-items-center rounded-[3px] bg-[var(--tc)] text-[5px] text-[color:var(--tco)]">＋</span>
        </div>
        <div className="px-2">
          <div className="flex items-center gap-1 rounded-[4px] bg-white p-1">
            <span className="text-[4px] text-[#9FB3AD]">⌕</span>
            <Line w="48px" h={2} c="#E2ECE8" />
          </div>
          <div className="mt-1 flex gap-1">
            <span className="rounded-full bg-[var(--tc)] px-1.5 py-[2px] text-[3.5px] text-[color:var(--tco)]">Barchasi</span>
            <span className="rounded-full bg-white px-1.5 py-[2px] text-[3.5px] text-[#6C807A]">Qarzdor</span>
          </div>
        </div>
        <div className="mt-1.5 flex-1 space-y-[3px] px-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Row key={i}>
              <span className="grid size-4 place-items-center rounded-[4px] bg-[var(--tcs)] text-[4px] font-bold text-[var(--tci)]">{["O", "K", "N", "L", "B"][i]}</span>
              <span className="flex-1 space-y-[1.5px]">
                <Line w={`${[82, 62, 74, 58, 68][i]}%`} h={2} c="#AFC2BC" />
                <Line w="52%" h={1.5} c="#E4EDE9" />
              </span>
              <span className="text-[3.5px] font-bold" style={{ color: i === 1 || i === 4 ? "#22a06b" : "#e0574b" }}>{i === 1 || i === 4 ? "0" : "−"}</span>
            </Row>
          ))}
        </div>
        <div className="flex justify-center pb-1.5">
          <span className="h-1 w-9 rounded-full bg-[#CBD9D4]" />
        </div>
      </div>
    );
  }

  if (kind === "order" || kind === "catalog") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <div className="flex items-center gap-1">
            <span className="text-[5px] text-[#0C2320]">←</span>
            <Line w="30px" h={3.5} c="#8FA8A0" />
          </div>
          <span className="grid size-3.5 place-items-center rounded-[3px] bg-[var(--tcs)] text-[4px] font-bold text-[var(--tci)]">3</span>
        </div>
        <div className="px-2">
          <div className="flex items-center gap-1 rounded-[4px] bg-white p-1">
            <span className="grid size-3.5 place-items-center rounded-[3px] bg-[var(--tcs)] text-[3.5px] font-bold text-[var(--tci)]">OG</span>
            <span className="flex-1 space-y-[1.5px]">
              <Line w="52px" h={2} c="#AFC2BC" />
              <Line w="34px" h={1.5} c="#E4EDE9" />
            </span>
            <Line w="16px" h={2} c="var(--tc)" />
          </div>
          <div className="mt-1 flex gap-0.5">
            {[1, 1, 0].map((v, i) => (
              <span key={i} className="h-[2px] flex-1 rounded-full" style={{ background: v ? "var(--tc)" : "#DDE8E4" }} />
            ))}
          </div>
        </div>
        <div className="mt-1.5 grid flex-1 grid-cols-2 gap-[3px] px-2">
          {["🥤", "🍟", "🍫", "☕", "🍊", "🧴"].map((e, i) => (
            <div key={i} className="flex flex-col rounded-[5px] bg-white p-1" style={{ border: i === 0 ? "1px solid var(--tc)" : "1px solid #EDF3F0" }}>
              <div className="flex items-start justify-between">
                <span className="text-[6px]">{e}</span>
                <span className="rounded bg-[#F3F8F6] px-0.5 text-[2.5px] text-[#829891]">+</span>
              </div>
              <Line w="80%" h={1.5} c="#D9E5E1" />
              <div className="mt-0.5 flex items-center justify-between">
                <span className="font-mono text-[3px] font-bold text-[#0C2320]">12 000</span>
                <span className="grid size-2 place-items-center rounded-full bg-[var(--tc)] text-[3px] text-[color:var(--tco)]">＋</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[#E7EFEC] bg-white px-2 py-1.5">
          <span className="font-mono text-[4px] font-bold text-[#0C2320]">36 500 <span className="font-normal text-[#8FA8A0]">so'm</span></span>
          <span className="rounded-[3px] bg-[var(--tc)] px-1.5 py-[2px] text-[3px] font-bold text-[color:var(--tco)]">Buyurtma</span>
        </div>
      </div>
    );
  }

  if (kind === "kpi" || kind === "tabel") {
    const isKpi = kind === "kpi";
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <Line w="30px" h={3.5} c="#8FA8A0" />
          <span className="size-3 rounded-[3px] bg-white" />
        </div>
        <div className="px-2">
          <div className="rounded-[6px] p-1.5" style={{ background: "linear-gradient(145deg,#0B3B37,var(--tcd))" }}>
            <Line w="34px" h={1.5} c="rgba(255,255,255,.35)" />
            <div className="mt-1 flex items-end justify-between">
              <div>
                <span className="text-[9px] font-bold text-white">64%</span>
                <Line w="30px" h={1.5} c="rgba(255,255,255,.25)" />
              </div>
              <span className="grid size-6 place-items-center rounded-full text-[4px] font-bold text-lime" style={{ background: "conic-gradient(#C8F56A 230deg, rgba(255,255,255,.12) 0)", WebkitMask: "radial-gradient(circle, transparent 55%, #000 57%)", mask: "radial-gradient(circle, transparent 55%, #000 57%)" }}>
                <span className="hidden" />
              </span>
            </div>
          </div>
        </div>
        {isKpi ? (
          <>
            <div className="mx-2 mt-1 rounded-[5px] bg-white p-1">
              <Line w="40px" h={2} c="#D9E5E1" />
              <div className="mt-1 flex h-8 items-end gap-1">
                {[40, 62, 48, 78, 60, 92, 66].map((h, i) => (
                  <span key={i} className="flex-1 rounded-t-[1px]" style={{ height: `${h}%`, background: i === 5 ? "#C8F56A" : i === 4 ? "var(--tc)" : "color-mix(in srgb, var(--tc) 38%, white)" }} />
                ))}
              </div>
            </div>
            <div className="mx-2 mt-1 space-y-[3px]">
              {[0, 1].map((i) => (
                <Row key={i}>
                  <span className="grid size-3 place-items-center rounded-full bg-[var(--tcs)] text-[3px] text-[var(--tci)]">✓</span>
                  <Line w="46px" h={2} c="#D9E5E1" />
                  <span className="ml-auto text-[3px] text-[#829891]">5%</span>
                </Row>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mx-2 mt-1 rounded-[5px] bg-white p-1">
              <Line w="34px" h={2} c="#D9E5E1" />
              <div className="mt-1 grid grid-cols-7 gap-[2px]">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className="aspect-square rounded-[1.5px]" style={{ background: [3, 4, 5, 10, 11].includes(i) ? "var(--tc)" : "#EDF3F0" }} />
                ))}
              </div>
            </div>
            <div className="mx-2 mt-1 space-y-[3px]">
              {[0, 1].map((i) => (
                <Row key={i}>
                  <Line w="24px" h={2} c="#D9E5E1" />
                  <span className="ml-auto text-[3px] font-bold text-[#0C2320]">8:30</span>
                </Row>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (kind === "delivery" || kind === "payment") {
    const pay = kind === "payment";
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <Line w="34px" h={3.5} c="#8FA8A0" />
          <span className="size-3 rounded-[3px] bg-white" />
        </div>
        {pay ? (
          <>
            <div className="mx-2 grid grid-cols-3 gap-[2px] rounded-[4px] bg-white p-[2px]">
              {["Naqd", "Karta", "O'tk"].map((l, i) => <span key={l} className="rounded-[3px] py-[2px] text-center text-[3.5px] font-semibold" style={{ background: i === 0 ? "var(--tcs)" : "transparent", color: i === 0 ? "var(--tci)" : "#8FA8A0" }}>{l}</span>)}
            </div>
            <div className="mx-2 mt-1 rounded-[5px] bg-white p-1.5 text-center">
              <Line w="20px" h={1.5} c="#DDE8E4" />
              <p className="mt-1 font-mono text-[8px] font-bold text-[#0C2320]">1 240 000</p>
            </div>
            <div className="mx-2 mt-1 grid flex-1 grid-cols-3 gap-[3px]">
              {["1","2","3","4","5","6","7","8","9","000","0","⌫"].map((d) => <span key={d} className="grid place-items-center rounded-[3px] bg-white text-[5px] font-semibold text-[#0C2320]">{d}</span>)}
            </div>
            <div className="mx-2 my-1.5 rounded-[3px] bg-[var(--tc)] py-[3px] text-center text-[3.5px] font-bold text-[color:var(--tco)]">Qabul qilish</div>
          </>
        ) : (
          <>
            <div className="mx-2 rounded-[7px] p-1.5 text-[color:var(--tco)]" style={{ background: "linear-gradient(140deg,var(--tc),var(--tcd))" }}>
              <Line w="30px" h={1.5} c="rgba(255,255,255,.4)" />
              <p className="mt-0.5 font-mono text-[7px] font-bold">3 870 000</p>
              <div className="mt-1 grid grid-cols-3 gap-[2px]">{[0,1,2].map((i) => <span key={i} className="h-3 rounded-[2px] bg-white/15" />)}</div>
              <div className="mt-1 h-[2px] rounded-full bg-white/20"><span className="block h-full w-[58%] rounded-full bg-lime" /></div>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-[3px] px-2">
              {["🚚", "💵", "↩", "👥"].map((g, i) => <div key={i} className="grid aspect-square place-items-center rounded-[4px] bg-white text-[5px]">{g}</div>)}
            </div>
            <div className="mt-1 flex-1 space-y-[3px] px-2">
              {[0,1,2].map((i) => (
                <Row key={i}>
                  <span className="grid size-3.5 place-items-center rounded-[3px] text-[4px]" style={{ background: i === 1 ? "#22b5731A" : "var(--tcs)", color: i === 1 ? "#22b573" : "var(--tc)" }}>▣</span>
                  <span className="flex-1 space-y-[1.5px]"><Line w="80%" h={2} c="#B9CBC5" /><Line w="50%" h={1.5} c="#E2ECE8" /></span>
                  <span className="rounded-full px-1 text-[3px] font-bold" style={{ background: i === 1 ? "#22b5731A" : "var(--tcs)", color: i === 1 ? "#22b573" : "var(--tc)" }}>{i === 1 ? "OK" : "→"}</span>
                </Row>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (kind === "map") {
    return (
      <div className={frame} style={{ ...tintVars, background: "color-mix(in srgb, var(--tc) 10%, #EEF1F5)" }}>
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 180" preserveAspectRatio="none">
          <g stroke="#fff" strokeWidth="2.5" fill="none"><path d="M0 50 H100" /><path d="M0 120 H100" /><path d="M35 0 V180" /><path d="M70 0 V180" /></g>
          <rect x="72" y="130" width="22" height="26" rx="3" fill="#C9E6F3" />
          <path d="M25 40 L60 35 L68 115 L40 130" fill="none" stroke="var(--tc)" strokeWidth="1" strokeDasharray="2 1.5" />
          <circle cx="68" cy="115" r="14" fill="var(--tc)18" stroke="var(--tc)" strokeWidth=".6" strokeDasharray="1.5 1" />
        </svg>
        {[[25,40],[60,35],[68,115],[40,130]].map(([x,y],i) => (
          <span key={i} className="absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white text-[3.5px] font-bold text-[color:var(--tco)] shadow" style={{ left: `${x}%`, top: `${(y/180)*100}%`, background: i === 2 ? "#e0a023" : "var(--tc)" }}>{["AQ","MK","SN","DR"][i]}</span>
        ))}
        <div className="absolute left-2 right-2 top-2 flex items-center gap-1 rounded-[4px] bg-white p-1"><span className="text-[4px] text-[#9FB3AD]">⌕</span><Line w="40px" h={2} c="#E2ECE8" /></div>
        <div className="absolute bottom-2 left-2 right-2 rounded-[5px] bg-white p-1.5 shadow">
          <div className="flex items-center gap-1"><span className="size-3.5 rounded-full bg-[var(--tc)]" /><span className="flex-1 space-y-[1.5px]"><Line w="60%" h={2} c="#AFC2BC" /><Line w="80%" h={1.5} c="#E4EDE9" /></span></div>
        </div>
      </div>
    );
  }

  if (kind === "team") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="px-2 pb-1 pt-2"><Line w="36px" h={3.5} c="#8FA8A0" /></div>
        <div className="mx-2 rounded-[6px] p-1.5" style={{ background: "linear-gradient(145deg,var(--tcd),var(--tcd))" }}>
          <div className="flex items-end justify-between">
            <div><span className="text-[9px] font-bold text-white">71%</span><Line w="28px" h={1.5} c="rgba(255,255,255,.3)" /></div>
            <div className="flex -space-x-1">{["var(--tc)","#2F7DF6","#7A5CF0","#F0714B"].map((c) => <span key={c} className="size-3 rounded-full border border-[var(--tcd)]" style={{ background: c }} />)}</div>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-[2px]">{[0,1,2].map((i) => <span key={i} className="h-3 rounded-[2px] bg-white/10" />)}</div>
        </div>
        <div className="mx-2 mt-1 flex items-center gap-1 rounded-[4px] bg-[#FEF6E6] p-1"><span className="text-[4px]">⚠</span><Line w="50px" h={1.5} c="#E9C98A" /></div>
        <div className="mt-1 flex-1 space-y-[3px] px-2">
          {[78, 92, 46, 64].map((p, i) => (
            <Row key={i}>
              <span className="size-3.5 rounded-full" style={{ background: ["var(--tc)","#2F7DF6","#7A5CF0","#F0714B"][i] }} />
              <span className="flex-1"><Line w="55%" h={2} c="#AFC2BC" /><span className="mt-[2px] block h-[2px] rounded-full bg-[#EDF3F0]"><span className="block h-full rounded-full" style={{ width: `${p}%`, background: p < 50 ? "#e0a023" : "var(--tc)" }} /></span></span>
              <span className="font-mono text-[3.5px] font-bold text-[#0C2320]">{p}%</span>
            </Row>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "inbox") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="px-2 pb-1 pt-2"><Line w="40px" h={3.5} c="#8FA8A0" /><Line w="26px" h={2} c="#DDE8E4" /></div>
        <div className="mx-2 rounded-[6px] p-1.5 text-[color:var(--tco)]" style={{ background: "linear-gradient(135deg,var(--tc),var(--tcd))" }}>
          <Line w="30px" h={1.5} c="rgba(255,255,255,.4)" /><p className="mt-0.5 font-mono text-[7px] font-bold">14 820 000</p>
          <div className="mt-1 grid grid-cols-3 gap-[2px]">{[0,1,2].map((i) => <span key={i} className="h-3 rounded-[2px] bg-white/15" />)}</div>
        </div>
        <div className="mt-1 flex-1 space-y-[3px] px-2">
          {[0,1,2,3].map((i) => (
            <Row key={i}>
              <span className="grid size-3.5 place-items-center rounded-[3px] bg-[var(--tcs)] text-[4px] text-[var(--tc)]">🏦</span>
              <span className="flex-1 space-y-[1.5px]"><Line w="70%" h={2} c="#AFC2BC" /><Line w="45%" h={1.5} c="#E4EDE9" /></span>
              <span className="text-right"><span className="block font-mono text-[3.5px] font-bold text-[#0C2320]">1 240 000</span><span className="rounded-full px-1 text-[2.5px] font-bold" style={{ background: i > 1 ? "#22b5731A" : "#e0a0231A", color: i > 1 ? "#22b573" : "#e0a023" }}>{i > 1 ? "OK" : "..."}</span></span>
            </Row>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "attendance") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="px-2 pb-1 pt-2"><Line w="30px" h={3.5} c="#8FA8A0" /></div>
        <div className="mx-2 rounded-[6px] bg-white p-2 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-[var(--tcs)]"><span className="grid size-8 place-items-center rounded-full border border-dashed border-[var(--tc)] text-[7px]">📷</span></span>
          <Line w="40px" h={2} c="#AFC2BC" /><div className="mx-auto mt-[2px]"><Line w="30px" h={1.5} c="#E4EDE9" /></div>
          <div className="mt-1.5 rounded-[3px] bg-[var(--tc)] py-[3px] text-[3.5px] font-bold text-[color:var(--tco)]">Kelishni belgilash</div>
        </div>
        <div className="mx-2 mt-1 rounded-[5px] bg-white p-1.5">
          <Line w="20px" h={2} c="#DDE8E4" />
          <div className="mt-1 grid grid-cols-7 gap-[2px]">{[0,1,2,3,4,5,6].map((i) => <span key={i} className="h-4 rounded-[2px]" style={{ background: i < 4 ? "var(--tc)" : i === 4 ? "#e0a023" : "#EDF3F0" }} />)}</div>
        </div>
      </div>
    );
  }

  if (kind === "tasks") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="flex items-center justify-between px-2 pb-1 pt-2"><Line w="30px" h={3.5} c="#8FA8A0" /><span className="grid size-3 place-items-center rounded-[3px] bg-[var(--tc)] text-[5px] text-[color:var(--tco)]">＋</span></div>
        <div className="mt-1 flex-1 space-y-[3px] px-2">
          {[0,1,2,3,4].map((i) => (
            <Row key={i} className="!items-start">
              <span className="mt-[1px] grid size-2.5 place-items-center rounded-full border" style={{ borderColor: i === 1 ? "var(--tc)" : "#DDE8E4", background: i === 1 ? "var(--tc)" : "transparent" }}>{i === 1 && <span className="text-[3px] text-white">✓</span>}</span>
              <span className="flex-1 space-y-[1.5px]"><Line w={`${[90,70,80,60,75][i]}%`} h={2} c={i === 1 ? "#D9E5E1" : "#AFC2BC"} /><span className="flex gap-[2px]"><Line w="14px" h={1.5} c="#E4EDE9" /><span className="rounded px-[2px] text-[2.5px] font-bold" style={{ background: i === 0 ? "#e0574b1A" : "#EDF3F0", color: i === 0 ? "#e0574b" : "#829891" }}>{i === 0 ? "YUQORI" : "O'RTA"}</span></span></span>
            </Row>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "notifications") {
    return (
      <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
        <div className="px-2 pb-1 pt-2">
          <Line w="46px" h={3.5} c="#8FA8A0" />
          <Line w="30px" h={2} c="#DDE8E4" />
        </div>
        <div className="mt-1 flex-1 space-y-[4px] px-2">
          {["var(--tc)", "#22a06b", "#e0a023", "#2f7df6"].map((c, i) => (
            <Row key={i} className={i === 0 ? "!border-[color-mix(in_srgb,var(--tc)_38%,white)]" : ""}>
              <span className="grid size-4 place-items-center rounded-[4px] text-[4px]" style={{ background: `${c}1A`, color: c }}>●</span>
              <span className="flex-1 space-y-[1.5px]">
                <Line w={`${[80, 64, 72, 58][i]}%`} h={2} c="#AFC2BC" />
                <Line w="90%" h={1.5} c="#E4EDE9" />
                <Line w="30%" h={1.5} c="#EDF3F0" />
              </span>
            </Row>
          ))}
        </div>
        <div className="mx-2 mb-2 mt-1 rounded-[4px] bg-white p-1">
          <div className="flex items-center justify-between">
            <Line w="34px" h={2} c="#DDE8E4" />
            <span className="flex h-2 w-3.5 items-center rounded-full bg-[var(--tc)] p-[1px]"><span className="ml-auto size-1.5 rounded-full bg-white" /></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={frame} style={{ ...tintVars, background: "#F1F5F6" }}>
      <div className="px-2 pb-1 pt-2">
        <Line w="30px" h={3.5} c="#8FA8A0" />
      </div>
      <div className="px-2">
        <div className="rounded-[6px] p-1.5" style={{ background: "linear-gradient(140deg,var(--tc),var(--tcd))" }}>
          <div className="flex items-center gap-1">
            <span className="grid size-4 place-items-center rounded-full bg-white/25 text-[4px] font-bold text-white">AQ</span>
            <div className="flex-1 space-y-[1.5px]">
              <Line w="34px" h={2} c="rgba(255,255,255,.8)" />
              <Line w="24px" h={1.5} c="rgba(255,255,255,.4)" />
            </div>
            <span className="text-[5px] text-white/60">›</span>
          </div>
        </div>
        <div className="mt-1.5 space-y-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1 rounded-[4px] bg-white p-1">
              <span className="size-2.5 rounded-[3px] bg-[var(--tcs)]" />
              <Line w="40%" h={2} c="#C9D8D3" />
              {i < 2 ? (
                <span className="ml-auto flex h-2 w-3.5 items-center rounded-full bg-[var(--tc)] p-[1px]"><span className="ml-auto size-1.5 rounded-full bg-white" /></span>
              ) : (
                <span className="ml-auto text-[3px] text-[#8FA8A0]">›</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

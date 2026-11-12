import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Delete, Eye, EyeOff, Fingerprint, Grid3X3, Loader2, Lock, MessageSquare, User, X } from "lucide-react";
import { roles, type RoleKey } from "../../data/design";
import { cn } from "../../utils/cn";
import type { Props } from "./PhoneScreens";
import { BRAND, BrandMark, BrandWave, BrandWordmark } from "./Brand";

type Stage = "launch" | "form" | "pin" | "cover";

export const AUTH_ACCOUNTS: Record<RoleKey, { login: string; name: string; initials: string }> = {
  agent: { login: "aziz.qodirov", name: "Aziz Qodirov", initials: "AQ" },
  expeditor: { login: "bobur.rahimov", name: "Bobur Rahimov", initials: "BR" },
  supervisor: { login: "kamol.aliyev", name: "Kamol Aliyev", initials: "KA" },
  cashier: { login: "dilnoza.karimova", name: "Dilnoza Karimova", initials: "DK" },
};

/** When a demo account is switched the frame remounts — don't replay the launch. */
let skipLaunch = false;
const d = (ms: number) => ({ "--d": `${ms}ms` } as React.CSSProperties);

/**
 * Restored brand entry (as on the deployed build):
 * launch zoom → the mark draws → wordmark → the logo settles at the top →
 * the form staggers in while the brand wave rises → PIN → the wave floods
 * the screen and hands over to the role welcome.
 */
export function AuthScreen({ t, ctx }: Props) {
  const fast = ctx.motion === "off";
  const [role, setRoleLocal] = useState<RoleKey>(ctx.role);
  const roleDef = roles.find((r) => r.key === role) ?? roles[0];
  const acct = AUTH_ACCOUNTS[role];

  const [stage, setStage] = useState<Stage>(skipLaunch ? "form" : "launch");
  const [login, setLogin] = useState(acct.login);
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [tries, setTries] = useState(3);
  const [scan, setScan] = useState(false);
  const [forgot, setForgot] = useState<null | "ask" | "code">(null);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => { skipLaunch = false; }, []);

  useEffect(() => {
    setRoleLocal(ctx.role);
    setLogin(AUTH_ACCOUNTS[ctx.role].login);
  }, [ctx.role]);

  useEffect(() => {
    if (stage !== "launch") return;
    const id = setTimeout(() => setStage("form"), fast ? 150 : 1600);
    return () => clearTimeout(id);
  }, [stage, fast]);

  useEffect(() => {
    if (stage !== "cover") return;
    const id = setTimeout(() => ctxRef.current.go("bootstrap"), fast ? 150 : 900);
    return () => clearTimeout(id);
  }, [stage, fast]);

  useEffect(() => {
    if (tries > 0) return;
    const id = setTimeout(() => { setTries(3); setPinErr(""); }, 15000);
    return () => clearTimeout(id);
  }, [tries]);

  const bump = () => { setShake(true); setTimeout(() => setShake(false), 440); };
  const loginErr = login.trim().length < 3 ? "Login kamida 3 belgidan iborat" : null;
  const passErr = pass.length < 6 ? "Parol kamida 6 belgidan iborat" : null;

  const pickRole = (r: RoleKey) => {
    if (r === role) return;
    setTouched(false);
    setPass("");
    if (ctx.setRole) { skipLaunch = true; ctx.setRole(r); }
    else { setRoleLocal(r); setLogin(AUTH_ACCOUNTS[r].login); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (loginErr || passErr) { bump(); return; }
    setBusy(true);
    setTimeout(() => { setBusy(false); setStage("pin"); ctx.toast("Hisob tasdiqlandi · PIN kiriting"); }, fast ? 20 : 750);
  };
  const demo = () => {
    setPass("Arena#2026");
    setTouched(false);
    setStage("pin");
    ctx.toast(`Demo hisob: ${acct.name}`);
  };
  const bio = () => {
    if (scan) return;
    setScan(true);
    setTimeout(() => { setScan(false); ctx.toast("Biometrika tasdiqlandi"); setStage("cover"); }, fast ? 20 : 1350);
  };
  const press = (digit: string) => {
    if (tries <= 0 || busy || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setPinErr("");
    if (next.length < 4) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (next === "1234") { setStage("cover"); return; }
      const left = tries - 1;
      setTries(left);
      setPin("");
      setPinErr(left > 0 ? `Noto'g'ri PIN · ${left} urinish qoldi` : "Bloklandi · 15 soniyadan keyin urinib ko'ring");
      bump();
    }, fast ? 20 : 420);
  };
  const verifyCode = () => {
    if (code === "4821") {
      setForgot(null); setCode(""); setCodeErr("");
      ctx.toast("Parol tiklandi · PIN bilan kiring");
      setStage("pin");
    } else setCodeErr("Kod noto'g'ri · demo: 4821");
  };

  const paper = t.isDark ? t.bg : "#FFFFFF";
  const fieldBg = t.isDark ? t.card2 : "#EEF1F5";
  const link = t.isDark ? BRAND.bright : BRAND.blue;
  const tone = t.isDark ? "dark" : "light";
  const launch = stage === "launch";
  const cover = stage === "cover";
  const waveTop = launch ? "100%" : cover ? "-160px" : stage === "pin" ? "86%" : "71%";
  const fieldStyle = (err: boolean) => ({ background: fieldBg, ["--bc" as string]: err ? "#E0574B" : link, ...(err ? { borderColor: "#E0574B" } : {}) });
  const btn2 = "flex items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-[9.5px] font-semibold transition active:scale-[0.97]";

  return (
    <div className={cn("relative h-full overflow-hidden", !fast && "launch-zoom")} style={{ background: paper }} data-auth-stage={stage} data-auth-role={role}>
      {!t.isDark && <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.18]" />}

      {/* brand lockup */}
      <div className="sa-logo absolute left-1/2 z-20 flex w-max origin-top flex-col items-center"
        style={{ top: launch ? "36%" : "6%", transform: `translateX(-50%) scale(${launch ? 1 : 0.66})`, opacity: cover ? 0 : 1 }}>
        <BrandMark size={64} draw={!fast} />
        <span className={cn("mt-2.5 block", !fast && "au-in")} style={d(650)}><BrandWordmark size={26} tone={tone} /></span>
        <span className="au-fade mt-2 block text-[11px]" style={{ color: t.sub, opacity: launch ? 1 : 0 }}>
          <span className={cn("block", !fast && "au-in")} style={d(900)}>Savdo jamoasi uchun mobil ilova</span>
        </span>
      </div>

      {stage === "form" && (
        <form key="form" onSubmit={submit} noValidate className={cn("absolute inset-x-0 top-[19.5%] z-20 px-6", shake && "auth-shake")}>
          <label className="sa-field au-in flex items-center gap-2 rounded-[9px] px-3 py-[9px]" style={{ ...fieldStyle(touched && !!loginErr), ...d(80) }}>
            <User size={13} style={{ color: t.sub }} />
            <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Login yoki telefon" aria-label="Login" autoComplete="username" className="w-full bg-transparent text-[11px] font-medium outline-none" style={{ color: t.ink }} />
            {!loginErr && <Check size={12} style={{ color: link }} />}
          </label>
          {touched && loginErr && <p className="mt-1 px-1 text-[8px] font-medium text-[#E0574B]">{loginErr}</p>}

          <label className="sa-field au-in mt-2 flex items-center gap-2 rounded-[9px] px-3 py-[9px]" style={{ ...fieldStyle(touched && !!passErr), ...d(140) }}>
            <Lock size={13} style={{ color: t.sub }} />
            <input type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Parol" aria-label="Parol" autoComplete="current-password" className="w-full bg-transparent text-[11px] font-medium outline-none" style={{ color: t.ink }} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} style={{ color: t.sub }}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          </label>
          {touched && passErr && <p className="mt-1 px-1 text-[8px] font-medium text-[#E0574B]">{passErr}</p>}

          <div className="au-in mt-2.5 flex items-center justify-between" style={d(200)}>
            <button type="button" role="checkbox" aria-checked={remember} onClick={() => setRemember((v) => !v)} className="flex items-center gap-1.5 text-[8.5px]" style={{ color: t.sub }}>
              <span className="grid size-[15px] place-items-center rounded-[4px] border transition" style={{ background: remember ? BRAND.blue : "transparent", borderColor: remember ? BRAND.blue : t.line, color: "#fff" }}>{remember && <Check size={9} strokeWidth={4} />}</span>
              Meni eslab qol
            </button>
            <button type="button" onClick={() => setForgot("ask")} className="text-[8.5px] font-semibold" style={{ color: t.ink }}>Parolni unutdingizmi?</button>
          </div>

          <p className="au-in mt-3 px-3 text-center text-[8px] leading-relaxed" style={{ color: t.sub, ...d(250) }}>
            Davom etish orqali <b style={{ color: t.ink }}>Foydalanish shartlari</b> va <b style={{ color: t.ink }}>Maxfiylik siyosati</b>ga rozilik bildirasiz.
          </p>

          <button type="submit" disabled={busy} className="au-in mx-auto mt-3 flex w-[84%] items-center justify-center gap-1.5 rounded-[9px] py-[11px] text-[11px] font-bold text-white transition active:scale-[0.985]" style={{ background: BRAND.blue, boxShadow: `0 12px 22px -14px ${BRAND.blue}`, ...d(300) }}>
            {busy ? (<><Loader2 size={13} className="animate-spin" /> Tekshirilmoqda…</>) : "Kirish"}
          </button>

          <div className="au-in mx-auto my-2.5 flex w-[84%] items-center gap-2" style={d(350)}>
            <span className="h-px flex-1" style={{ background: t.line }} /><span className="text-[8px]" style={{ color: t.sub }}>yoki</span><span className="h-px flex-1" style={{ background: t.line }} />
          </div>

          <div className="au-in grid grid-cols-2 gap-2" style={d(400)}>
            <button type="button" onClick={bio} className={btn2} style={{ background: fieldBg, color: t.ink }}><Fingerprint size={13} style={{ color: link }} /> Face ID</button>
            <button type="button" onClick={() => setStage("pin")} className={btn2} style={{ background: fieldBg, color: t.ink }}><Grid3X3 size={12} style={{ color: link }} /> PIN-kod</button>
          </div>
        </form>
      )}

      {stage === "pin" && (
        <div key="pin" className={cn("sa-page absolute inset-x-0 top-[19%] z-20 px-6", shake && "auth-shake")}>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setStage("form")} aria-label="Orqaga" className="grid size-7 place-items-center rounded-full" style={{ background: fieldBg, color: t.ink }}><ArrowLeft size={13} /></button>
            <span className="grid size-8 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: BRAND.navy }}>{acct.initials}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[10.5px] font-bold" style={{ color: t.ink }}>{acct.name}</span>
              <span className="block truncate text-[8px]" style={{ color: t.sub }}>{login}</span>
            </span>
          </div>
          <h2 className="mt-3.5 text-center font-display text-[15px] font-bold" style={{ color: t.ink }}>PIN kodni kiriting</h2>
          <div className="mt-3 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => {
              const on = pin.length > i;
              return (
                <span key={i} className="grid size-9 place-items-center rounded-[10px] transition-all duration-200" style={{ background: fieldBg, boxShadow: pinErr ? "inset 0 0 0 1.5px #E0574B" : on ? `inset 0 0 0 1.5px ${link}` : "none" }}>
                  {on && <span className={cn("size-2.5 rounded-full", !fast && "pop-in")} style={{ background: pinErr ? "#E0574B" : link }} />}
                </span>
              );
            })}
          </div>
          <p className="mt-2 h-4 text-center text-[8.5px] font-semibold" style={{ color: pinErr ? "#E0574B" : t.sub }}>{pinErr || (busy ? "Tekshirilmoqda…" : "Demo PIN: 1234")}</p>
          <div className="mx-auto mt-1 grid w-full max-w-[214px] grid-cols-3 gap-x-3 gap-y-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
              <button key={n} type="button" disabled={tries <= 0} onClick={() => press(n)} aria-label={`Raqam ${n}`} className="h-10 rounded-[11px] font-display text-[16px] font-semibold transition active:scale-90 disabled:opacity-30" style={{ background: fieldBg, color: t.ink }}>{n}</button>
            ))}
            <button type="button" onClick={bio} aria-label="Biometrika" className="grid h-10 place-items-center rounded-[11px] transition active:scale-90" style={{ background: `${BRAND.blue}22`, color: link }}><Fingerprint size={17} /></button>
            <button type="button" disabled={tries <= 0} onClick={() => press("0")} aria-label="Raqam 0" className="h-10 rounded-[11px] font-display text-[16px] font-semibold transition active:scale-90 disabled:opacity-30" style={{ background: fieldBg, color: t.ink }}>0</button>
            <button type="button" onClick={() => { setPin((p) => p.slice(0, -1)); setPinErr(""); }} aria-label="O'chirish" className="grid h-10 place-items-center rounded-[11px] transition active:scale-90" style={{ color: t.sub }}><Delete size={17} /></button>
          </div>
          <button type="button" onClick={() => setForgot("ask")} className="mx-auto mt-2.5 block text-[8.5px] font-semibold" style={{ color: link }}>PINni unutdingizmi?</button>
        </div>
      )}

      <BrandWave top={waveTop} />

      {/* demo accounts on the wave */}
      <div className="au-fade absolute inset-x-0 bottom-2.5 z-20 px-5 text-center" style={{ opacity: stage === "form" ? 1 : 0, pointerEvents: stage === "form" ? "auto" : "none" }}>
        <div className="mx-auto grid w-[86%] grid-cols-4 gap-1 rounded-full bg-white/15 p-[3px]" role="tablist" aria-label="Demo hisob roli">
          {roles.map((r) => {
            const on = r.key === role;
            return (
              <button key={r.key} type="button" role="tab" aria-selected={on} onClick={() => pickRole(r.key)} className="rounded-full py-[5px] text-[7px] font-bold transition" style={{ background: on ? "#FFFFFF" : "transparent", color: on ? BRAND.navy : "rgba(255,255,255,.85)" }}>{r.short}</button>
            );
          })}
        </div>
        <p className="mt-2 text-[8.5px] text-white/85">Hisobingiz yo'qmi? <b className="text-white">Administratorga murojaat qiling.</b></p>
        <button type="button" onClick={demo} className="mt-1 text-[8.5px] font-semibold text-white underline underline-offset-2">Demo hisob bilan kirish</button>
      </div>

      {cover && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className={cn("flex flex-col items-center", !fast && "au-in")} style={d(380)}>
            <BrandMark size={72} bare />
            <span className="mt-1 block"><BrandWordmark size={22} tone="onBrand" /></span>
            <span className="mt-2 flex items-center gap-1.5 text-[9px] text-white/80"><Check size={11} strokeWidth={3} /> Kirish tasdiqlandi · {roleDef.name}</span>
          </div>
        </div>
      )}

      {scan && (
        <div className="absolute inset-0 z-40 grid place-items-center backdrop-blur-sm" style={{ background: t.isDark ? "rgba(10,13,20,.88)" : "rgba(255,255,255,.9)" }}>
          <div className="text-center">
            <div className="relative mx-auto grid size-20 place-items-center overflow-hidden rounded-[22px]" style={{ background: `${BRAND.blue}1A`, color: link, boxShadow: `inset 0 0 0 1.5px ${BRAND.blue}` }}>
              <Fingerprint size={36} />
              <span className="au-scan absolute inset-x-3 top-1/2 h-[2px] rounded-full" style={{ background: BRAND.blue }} />
            </div>
            <p className="mt-3 text-[11px] font-bold" style={{ color: t.ink }}>Biometrika tekshirilmoqda…</p>
            <p className="text-[8.5px]" style={{ color: t.sub }}>Qurilmaga qarang yoki barmoq qo'ying</p>
          </div>
        </div>
      )}

      {forgot && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/40" onClick={() => setForgot(null)}>
          <div className="auth-slide-up w-full rounded-t-[22px] px-5 pb-5 pt-4" style={{ background: paper }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-[15px] font-bold" style={{ color: t.ink }}>Parolni tiklash</h3>
                <p className="text-[9px]" style={{ color: t.sub }}>{forgot === "ask" ? "Tasdiqlash kodi telefoningizga yuboriladi" : "SMS dagi 4 xonali kodni kiriting"}</p>
              </div>
              <button type="button" onClick={() => { setForgot(null); setCode(""); setCodeErr(""); }} aria-label="Yopish" className="grid size-7 place-items-center rounded-full" style={{ background: fieldBg, color: t.sub }}><X size={13} /></button>
            </div>
            {forgot === "ask" ? (
              <>
                <div className="mt-4 flex items-center gap-2 rounded-[9px] px-3 py-2.5" style={{ background: fieldBg }}><MessageSquare size={13} style={{ color: link }} /><span className="font-mono text-[10.5px] font-medium" style={{ color: t.ink }}>+998 90 ••• •• 67</span></div>
                <button type="button" onClick={() => { setForgot("code"); ctx.toast("SMS kod yuborildi"); }} className="mt-3 w-full rounded-[9px] py-[11px] text-[11px] font-bold text-white" style={{ background: BRAND.blue }}>SMS kod yuborish</button>
              </>
            ) : (
              <>
                <label className="sa-field mt-4 flex items-center gap-2 rounded-[9px] px-3 py-2.5" style={fieldStyle(!!codeErr)}>
                  <Lock size={13} style={{ color: t.sub }} />
                  <input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setCodeErr(""); }} inputMode="numeric" placeholder="• • • •" aria-label="SMS kod" className="w-full bg-transparent font-mono text-[13px] font-bold tracking-[0.4em] outline-none" style={{ color: t.ink }} />
                </label>
                <p className="mt-1.5 px-1 text-[8px] font-medium" style={{ color: codeErr ? "#E0574B" : t.sub }}>{codeErr || "Demo kod: 4821"}</p>
                <button type="button" onClick={verifyCode} className="mt-2.5 w-full rounded-[9px] py-[11px] text-[11px] font-bold text-white" style={{ background: BRAND.blue }}>Tasdiqlash</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

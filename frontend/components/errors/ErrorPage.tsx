"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, House, Info, KeyRound, LoaderCircle, LogIn, MousePointer2, RefreshCw, Timer } from "lucide-react";
import { ERRORS, UI, retryDelay, type ErrorCode, type ErrorLanguage } from "./error-data";
import { StatusArt } from "./StatusArt";
import "./errors.css";

export type RetryResult = { message?: string; retryAfter?: string | number };
export type ErrorPageProps = {
  code: ErrorCode;
  lang?: ErrorLanguage;
  title?: string;
  message?: string;
  resource?: string;
  referenceId?: string;
  retryAfter?: string | number;
  onRetry?: () => void | RetryResult | Promise<void | RetryResult>;
  onLogin?: () => void;
  onHome?: () => void;
  onBack?: () => void;
  onRequestAccess?: () => void;
  onSupport?: () => void;
  loginHref?: string;
  homeHref?: string;
  paused?: boolean;
  autoplay?: boolean;
  interactive?: boolean;
  animationKey?: number;
  className?: string;
};

function useMotionAllowed() {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowed(!media.matches && !document.hidden);
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return allowed;
}

function timeLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ErrorPage({
  code, lang = "ru", title, message, resource, referenceId, retryAfter,
  onRetry, onLogin, onHome, onBack, onRequestAccess, onSupport,
  loginHref = "/login", homeHref = "/", paused = false, autoplay = true,
  interactive = true, animationKey = 0, className = "",
}: ErrorPageProps) {
  const definition = ERRORS[code];
  const text = definition[lang];
  const ui = UI[lang];
  const headingId = useId();
  const motionAllowed = useMotionAllowed();
  const animated = motionAllowed && !paused && autoplay;
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [gesture, setGesture] = useState<"deny" | "key" | "tug">("deny");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(() => code === 429 ? retryDelay(retryAfter ?? 30) : code === 503 ? retryDelay(retryAfter) : 0);
  const artRef = useRef<HTMLDivElement>(null);
  const lastInteraction = useRef(0);
  const interactions = useRef(0);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(hintTimer.current);
    };
  }, []);

  useEffect(() => {
    const seconds = code === 429 ? retryDelay(retryAfter ?? 30) : code === 503 ? retryDelay(retryAfter) : 0;
    setDeadline(seconds ? Date.now() + seconds * 1000 : 0);
    setRemaining(seconds);
  }, [code, retryAfter]);

  useEffect(() => {
    if (!deadline) return;
    // Wall-clock time keeps Retry-After accurate after backgrounding the tab.
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (code !== 403 || !animated) return;
    let endScan = 0;
    let scene = 0;
    const loop = window.setInterval(() => {
      if (busyRef.current || Date.now() - lastInteraction.current < 5000) return;
      const next = scene++ % 3;
      setChecking(next === 0);
      setGesture(next === 1 ? "tug" : next === 2 ? "key" : "deny");
      setAttempt((value) => value + 1);
      if (next === 0) {
        endScan = window.setTimeout(() => {
          setChecking(false);
          setAttempt((value) => value + 1);
        }, 1350);
      }
    }, 8500);
    return () => {
      window.clearInterval(loop);
      window.clearTimeout(endScan);
    };
  }, [code, animated]);

  function moveScene(event: PointerEvent<HTMLDivElement>) {
    if (!animated || !interactive || event.pointerType !== "mouse") return;
    const el = artRef.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    el.style.setProperty("--px", String(clamp((event.clientX - bounds.left) / bounds.width * 2 - 1)));
    el.style.setProperty("--py", String(clamp((event.clientY - bounds.top) / bounds.height * 2 - 1)));
  }

  function resetScene() {
    artRef.current?.style.setProperty("--px", "0");
    artRef.current?.style.setProperty("--py", "0");
  }

  function interact() {
    if (!interactive || busy) return;
    lastInteraction.current = Date.now();
    interactions.current += 1;
    setChecking(false);
    setGesture(code === 403 && interactions.current % 5 === 0 ? "key" : "deny");
    setAttempt((value) => value + 1);
    setHint(text.interaction);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(""), 3500);
  }

  function home() {
    if (onHome) onHome();
    else window.location.assign(homeHref);
  }

  function back() {
    if (onBack) onBack();
    else if (window.history.length > 1) window.history.back();
    else home();
  }

  async function primary() {
    if (busyRef.current || remaining > 0) return;
    if (definition.action === "login") {
      if (onLogin) onLogin();
      else window.location.assign(loginHref);
      return;
    }
    if (definition.action === "home") return home();
    if (!onRetry) return window.location.reload();

    busyRef.current = true;
    lastInteraction.current = Date.now();
    setBusy(true);
    setGesture("deny");
    setChecking(true);
    setAttempt((value) => value + 1);
    setFeedback("");
    try {
      const result = await onRetry();
      if (!alive.current) return;
      setFeedback(result?.message ?? ui.retryComplete);
      if (result?.retryAfter !== undefined && (code === 429 || code === 503)) {
        const seconds = retryDelay(result.retryAfter);
        setRemaining(seconds);
        setDeadline(seconds ? Date.now() + seconds * 1000 : 0);
      }
    } catch {
      if (alive.current) setFeedback(ui.retryFail);
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setBusy(false);
        setChecking(false);
        setAttempt((value) => value + 1);
      }
    }
  }

  const PrimaryIcon = busy ? LoaderCircle : remaining > 0 ? Timer : definition.action === "login" ? LogIn : definition.action === "home" ? House : RefreshCw;
  const primaryText = busy ? ui.checking : remaining > 0 ? `${ui.countdown} ${timeLabel(remaining)}` : code === 403 ? ui.checkAccess : ui.primary[definition.action];
  const backAction = code < 500;
  const help = code === 403 ? onRequestAccess : code >= 500 ? onSupport : undefined;

  return (
    <section className={`error-page ${className}`} data-code={code} data-motion={animated ? "on" : "off"} aria-labelledby={headingId}>
      <div className="error-composition">
        <div className="error-kicker"><span>HTTP {code}</span><span className="kicker-divider" />{definition.name}</div>
        <div className="error-art" ref={artRef} onPointerMove={moveScene} onPointerLeave={resetScene}>
          <button type="button" className="error-art-trigger" onClick={interact} disabled={!interactive} aria-label={`${ui.interact}: ${code}`}>
            <StatusArt key={animationKey} code={code} animated={animated} attempt={attempt} checking={checking} gesture={gesture} />
          </button>
        </div>
        <div className={`error-art-hint ${hint ? "has-hint" : ""}`} aria-live="polite">
          {interactive && <><MousePointer2 size={12} />{hint || (paused ? ui.paused : ui.interact)}</>}
        </div>
        <h1 id={headingId}>{title ?? text.title}</h1>
        <p className="error-description">{message ?? text.description}</p>

        <div className="error-reasons">
          <div className="error-reasons-title"><Info size={13} /><span>{ui.causes}</span></div>
          <ul>{text.causes.map((cause) => <li key={cause}>{cause}</li>)}</ul>
          <details className="error-details">
            <summary>{ui.details}<ChevronDown size={13} /></summary>
            <div>
              <p>{text.guidance}</p>
              {resource && <p className="error-resource">{resource}</p>}
              {referenceId && <p>{ui.reference}: <code>{referenceId}</code></p>}
            </div>
          </details>
        </div>

        <div className="error-actions">
          <button type="button" className="error-button error-button-primary" onClick={primary} disabled={busy || remaining > 0} aria-busy={busy}>
            <PrimaryIcon size={15} className={busy ? "error-spinner" : ""} /><span>{primaryText}</span>
          </button>
          <button type="button" className="error-button error-button-secondary" onClick={backAction ? back : home}>
            {backAction ? <ArrowLeft size={15} /> : <House size={15} />}{backAction ? ui.back : ui.home}
          </button>
        </div>
        {help && <button className="error-help" type="button" onClick={help}>{code === 403 ? <KeyRound size={13} /> : null}{code === 403 ? ui.request : ui.support}<ArrowUpRight size={13} /></button>}
        <div className="error-feedback" role="status">{feedback || (code === 429 && remaining === 0 ? ui.ready : "")}</div>
      </div>
    </section>
  );
}
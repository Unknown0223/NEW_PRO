"use client";

import "./login.css";

import { SalesArenaLogo } from "@/components/brand/sales-arena-logo";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { describeDevice, getOrCreateDeviceId } from "@/lib/device-id";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function FloatingProducts() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg width="0" height="0">
        <defs>
          <linearGradient id="login-boxTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="login-boxLeft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="login-boxRight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea9a2e" />
            <stop offset="100%" stopColor="#c77816" />
          </linearGradient>
          <linearGradient id="login-blueTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="login-blueLeft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="login-blueRight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>

      <div className="login-float-product-1 absolute left-[7%] top-[12%] opacity-30 drop-shadow-2xl">
        <svg width="72" height="80" viewBox="0 0 72 80" fill="none">
          <path d="M36 4 L68 20 L36 36 L4 20 Z" fill="url(#login-boxTop)" />
          <path d="M4 20 L36 36 L36 76 L4 60 Z" fill="url(#login-boxLeft)" />
          <path d="M68 20 L36 36 L36 76 L68 60 Z" fill="url(#login-boxRight)" />
          <path d="M36 4 L36 36 M20 12 L52 28" stroke="#92400e" strokeWidth="1" opacity="0.4" />
        </svg>
      </div>

      <div className="login-float-product-3 absolute right-[10%] top-[28%] opacity-30 drop-shadow-2xl">
        <svg width="60" height="66" viewBox="0 0 60 66" fill="none">
          <path d="M30 3 L57 16 L30 29 L3 16 Z" fill="url(#login-blueTop)" />
          <path d="M3 16 L30 29 L30 63 L3 50 Z" fill="url(#login-blueLeft)" />
          <path d="M57 16 L30 29 L30 63 L57 50 Z" fill="url(#login-blueRight)" />
          <rect x="14" y="36" width="16" height="10" fill="white" opacity="0.25" transform="skewY(20)" />
        </svg>
      </div>

      <div className="login-float-product-2 absolute left-[5%] top-[58%] opacity-25 drop-shadow-2xl">
        <svg width="92" height="64" viewBox="0 0 92 64" fill="none">
          <path d="M20 8 L46 0 L72 8 L46 16 Z" fill="#a16207" />
          <path d="M20 8 L46 16 L46 30 L20 22 Z" fill="#854d0e" />
          <path d="M72 8 L46 16 L46 30 L72 22 Z" fill="#92600e" />
          <rect x="8" y="40" width="76" height="7" rx="1" fill="#78350f" />
          <rect x="10" y="47" width="9" height="11" fill="#5c2d0c" />
          <rect x="34" y="47" width="9" height="11" fill="#5c2d0c" />
          <rect x="58" y="47" width="9" height="11" fill="#5c2d0c" />
          <rect x="76" y="47" width="6" height="11" fill="#5c2d0c" />
        </svg>
      </div>

      <div className="login-float-product-4 absolute bottom-[16%] right-[7%] opacity-25 drop-shadow-2xl">
        <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
          <ellipse cx="24" cy="10" rx="18" ry="7" fill="#94a3b8" />
          <path d="M6 10 L6 54 A18 7 0 0 0 42 54 L42 10" fill="#64748b" />
          <ellipse cx="24" cy="10" rx="18" ry="7" fill="#cbd5e1" opacity="0.6" />
          <rect x="6" y="24" width="36" height="3" fill="#475569" opacity="0.6" />
          <rect x="6" y="40" width="36" height="3" fill="#475569" opacity="0.6" />
          <ellipse cx="18" cy="10" rx="4" ry="2" fill="white" opacity="0.4" />
        </svg>
      </div>

      <div className="login-float-product-5 absolute left-[26%] top-[72%] opacity-25 drop-shadow-2xl">
        <svg width="54" height="62" viewBox="0 0 54 62" fill="none">
          <path d="M10 22 L10 54 Q10 60 16 60 L38 60 Q44 60 44 54 L44 22 Z" fill="#10b981" />
          <path d="M10 22 L44 22 L42 16 L12 16 Z" fill="#059669" />
          <path d="M16 16 Q16 6 27 6 Q38 6 38 16" stroke="#047857" strokeWidth="3.5" fill="none" />
          <rect x="20" y="34" width="14" height="10" rx="2" fill="white" opacity="0.3" />
        </svg>
      </div>

      <div className="login-float-product-7 absolute bottom-[40%] left-[42%] opacity-30 drop-shadow-2xl">
        <svg width="74" height="46" viewBox="0 0 74 46" fill="none">
          <rect x="4" y="10" width="44" height="24" rx="3" fill="#06b6d4" />
          <rect x="4" y="10" width="44" height="8" rx="3" fill="#0891b2" />
          <path d="M48 16 L60 16 L68 28 L68 34 L48 34 Z" fill="#0e7490" />
          <rect x="50" y="19" width="9" height="7" rx="1" fill="#a5f3fc" opacity="0.7" />
          <circle cx="18" cy="36" r="6" fill="#1e293b" />
          <circle cx="56" cy="36" r="6" fill="#1e293b" />
          <circle cx="18" cy="36" r="2.5" fill="#94a3b8" />
          <circle cx="56" cy="36" r="2.5" fill="#94a3b8" />
        </svg>
      </div>

      <div className="login-float-product-6 absolute right-[30%] top-[6%] opacity-20 drop-shadow-2xl">
        <svg width="78" height="78" viewBox="0 0 78 78" fill="none">
          <path d="M39 5 L72 22 L39 39 L6 22 Z" fill="#a78bfa" />
          <path d="M6 22 L39 39 L39 73 L6 56 Z" fill="#7c3aed" />
          <path d="M72 22 L39 39 L39 73 L72 56 Z" fill="#8b5cf6" />
          <path d="M39 5 L39 39" stroke="#6d28d9" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

type LoginInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  icon: ReactNode;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  rightElement?: ReactNode;
};

function LoginInput({
  id,
  label,
  value,
  onChange,
  icon,
  type = "text",
  placeholder,
  autoComplete,
  required,
  rightElement
}: LoginInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700" htmlFor={id}>
        {label}
      </label>
      <div className={`group relative transition-all duration-300 ${focused ? "scale-[1.01]" : ""}`}>
        <div
          className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition-opacity duration-500 ${focused ? "opacity-25" : ""}`}
        />
        <div className="relative">
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-300 ${focused ? "text-blue-600" : "text-slate-400"}`}
          >
            {icon}
          </div>
          <input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            required={required}
            className="block w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
          />
          {rightElement ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const FEATURE_PILLS = ["Консигнация", "Бонусы", "Скидки", "Реальное время", "Складской учёт"];

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [slug, setSlug] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const sessionEnded = searchParams.get("reason") === "session_ended";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        slug,
        login,
        password,
        device_id: getOrCreateDeviceId(),
        device_name: describeDevice(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : undefined
      });
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantSlug: slug,
        role: data.user?.role as string | undefined
      });
      const from = searchParams.get("from") ?? "/dashboard";
      router.replace(from);
      router.refresh();
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const st = err.response?.status;
        const body = err.response?.data as { error?: string; message?: string } | undefined;
        if (st === 401 || body?.error === "INVALID_CREDENTIALS") {
          setError("Неверный логин или пароль. Проверьте данные и попробуйте снова.");
          return;
        }
        if (st === 404 || body?.error === "TENANT_NOT_FOUND") {
          setError("Дилер (slug) не найден или отключён. Проверьте код дилера.");
          return;
        }
        if (body?.error === "SESSION_LIMIT") {
          setError(
            "Достигнут лимит активных сессий. Завершите вход на другом устройстве (выйдите из системы) и попробуйте снова."
          );
          return;
        }
        if (st === 403 && body?.error === "APP_ACCESS_DENIED") {
          setError("Доступ к приложению отключён. Обратитесь к администратору.");
          return;
        }
        if (body?.message && typeof body.message === "string") {
          setError(getUserFacingError(err, body.message));
          return;
        }
        if (st === 503) {
          setError(
            withApiSupportLine(
              "Сервер не готов (часто БД или миграции). В каталоге backend: npm run db:deploy и проверьте, что PostgreSQL запущен.",
              err
            )
          );
          return;
        }
        setError(getUserFacingError(err));
        return;
      }
      setError(
        getUserFacingError(
          err,
          "Не удалось подключиться к серверу или непредвиденная ошибка. Проверьте, что backend запущен (локально обычно порт 18080, см. PORT в backend)."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 lg:flex-row">
      <div className="relative flex min-h-[55vh] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d1d35] to-[#0a1628] p-8 text-white lg:min-h-dvh lg:w-[56%] lg:p-14">
        <div className="absolute inset-0 overflow-hidden">
          <div className="login-float-orb-1 absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-blue-600/30 blur-3xl" />
          <div className="login-float-orb-2 absolute bottom-0 left-0 h-[450px] w-[450px] rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="login-float-orb-3 absolute left-1/2 top-1/2 h-[350px] w-[350px] rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="login-bg-grid absolute inset-0 opacity-20" />
          <div className="login-scan-horizontal absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        </div>

        <FloatingProducts />

        <div className="relative z-10">
          <div className="mb-16 flex items-center justify-between">
            <div className="group flex items-center gap-3">
              <SalesArenaLogo variant="dark" height={56} className="drop-shadow-lg transition-transform duration-300 group-hover:scale-[1.02]" />
            </div>

            <div className="hidden text-right sm:block">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Время сервера</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-cyan-400">
                {time.toLocaleTimeString("ru-RU", { hour12: false })}
              </div>
            </div>
          </div>

          <div className="max-w-xl space-y-6">
            <div
              className="login-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-cyan-300 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Платформа торговли и дистрибуции
            </div>
            <h1
              className="login-fade-in-up text-4xl font-bold leading-[1.08] tracking-tight lg:text-[3.4rem]"
              style={{ animationDelay: "0.1s", animationFillMode: "both" }}
            >
              Управляйте всеми товарами{" "}
              <span className="login-gradient-shift bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-[length:200%_auto] bg-clip-text text-transparent">
                в одной системе
              </span>
            </h1>
            <p
              className="login-fade-in-up max-w-lg text-base leading-relaxed text-slate-400 lg:text-lg"
              style={{ animationDelay: "0.2s", animationFillMode: "both" }}
            >
              Коробки, паллеты, жидкости и штучный товар — от заказа до доставки в автоматизированной системе.
            </p>
          </div>

          <div
            className="login-fade-in-up mt-10 flex flex-wrap gap-2.5"
            style={{ animationDelay: "0.3s", animationFillMode: "both" }}
          >
            {FEATURE_PILLS.map((item) => (
              <span
                key={item}
                className="cursor-default rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/10 hover:text-white"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 flex items-center justify-between border-t border-white/5 pt-5 text-xs text-slate-500">
          <span>© 2026 Sales Arena</span>
          <div className="flex items-center gap-5">
            <span className="transition-colors hover:text-slate-300">Помощь</span>
            <span className="transition-colors hover:text-slate-300">Конфиденциальность</span>
            <span className="transition-colors hover:text-slate-300">Условия</span>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center bg-gradient-to-br from-white via-slate-50 to-blue-50/40 p-8 lg:w-[44%] lg:p-12">
        <div className="login-bg-dots absolute inset-0 opacity-40" />

        <div className="login-fade-in-up relative z-10 w-full max-w-md">
          <div className="space-y-7 rounded-3xl border border-white/80 bg-white/70 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl lg:p-10">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Вход в систему</h2>
              <p className="mt-2 text-slate-500">Введите данные для входа в учётную запись.</p>
            </div>

            {sessionEnded ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                <span>Ваша сессия была завершена (администратором или повторным входом). Войдите снова.</span>
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={onSubmit}>
              <LoginInput
                id="slug"
                label="Дилер (slug)"
                value={slug}
                onChange={setSlug}
                icon={<IconBox />}
                placeholder="Код дилера"
                autoComplete="organization"
                required
              />
              <LoginInput
                id="login"
                label="Логин"
                value={login}
                onChange={setLogin}
                icon={<IconUser />}
                placeholder="Логин"
                autoComplete="username"
                required
              />
              <LoginInput
                id="password"
                label="Пароль"
                value={password}
                onChange={setPassword}
                icon={<IconLock />}
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="p-1 text-slate-400 transition-colors hover:text-blue-600 focus:outline-none"
                    aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                }
              />

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between">
                <label className="group flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    defaultChecked
                  />
                  <span className="ml-2 select-none text-sm text-slate-600 transition-colors group-hover:text-slate-900">
                    Запомнить
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:shadow-blue-600/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 h-full w-full -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                {loading ? (
                  <span className="relative flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Подождите…
                  </span>
                ) : (
                  <span className="relative flex items-center gap-2">
                    Войти
                    <span className="transition-transform group-hover:translate-x-1">
                      <IconArrowRight />
                    </span>
                  </span>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-4 border-t border-slate-200/70 pt-5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                SSL защита
              </div>
              <div className="h-1 w-1 rounded-full bg-slate-300" />
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Поддержка 2FA
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            <Link href="/" className="font-medium text-blue-600 hover:underline">
              Главная
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

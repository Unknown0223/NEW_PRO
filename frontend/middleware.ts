import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "sd_auth";

/**
 * Sessiya flag cookie (`sd_auth=1`) — faqat middleware yo'naltirish uchun.
 * JWT `localStorage` da (`auth-sync.ts`). HttpOnly emas (by design).
 * Client-side: `auth-sync.ts` SameSite=Strict + Secure (HTTPS).
 * Server-side cookie o'rnatilmaydi; middleware faqat mavjud cookie'ni o'qiydi.
 */

/** Ochiq (autentifikatsiyasiz kiriladigan) sahifalar — faqat login. */
function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

/** Olib tashlangan eski sahifalar — saqlangan havolalar yangi joyga tushsin. */
const LEGACY_EXACT_REDIRECTS: Record<string, string> = {
  "/reports/builder/legacy": "/reports/builder/pivot",
  "/reports/builder/wdr": "/reports/builder/pivot",
  "/reports/builder/dev": "/reports/builder/pivot",
  "/settings/bonus-rules/strategy": "/settings/bonus-strategies",
  "/settings/discount-rules/strategy": "/settings/bonus-strategies",
  "/settings/suppliers": "/suppliers",
  "/settings/inventory/van-selling": "/settings",
  "/settings/spravochnik/collectors/new": "/settings/spravochnik/collectors",
  "/settings/spravochnik/operators/new": "/settings/spravochnik/operators",
  "/settings/spravochnik/skladchik/new": "/settings/spravochnik/skladchik",
  "/stock/adjustment": "/stock/correction",
  "/stock/transfers/new": "/stock/transfers/amaliyot",
  "/territories": "/settings/territories",
  "/routes": "/clients/visit-planner",
  "/routes/track": "/reports/gps/map",
  "/products/new": "/settings/products/add"
};

function resolveLegacyPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const exact = LEGACY_EXACT_REDIRECTS[path];
  if (exact) return exact;
  /** Mahsulotlar katalogi — «Настройки → Продукт» (референс UI) */
  if (path === "/products") return "/settings/products";
  if (/^\/products\/(bulk|excel|add)(\/|$)/.test(path)) return path.replace(/^\/products/, "/settings/products");
  if (path.startsWith("/products/")) return "/settings/products";
  return null;
}

export function middleware(request: NextRequest) {
  const hasFlag = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  const { pathname } = request.nextUrl;

  /** Eski qulaylik yo'nalishlari — yo'lni qayta yozish (referens UI). */
  if (pathname === "/bonus-rules" || pathname.startsWith("/bonus-rules/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/bonus-rules"
        ? "/settings/bonus-rules"
        : `/settings/bonus-rules${pathname.slice("/bonus-rules".length)}`;
    return NextResponse.redirect(url);
  }

  const legacyTarget = resolveLegacyPath(pathname);
  if (legacyTarget) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    return NextResponse.redirect(url);
  }

  /** Login sahifasi ochiq; allaqachon kirgan bo'lsa — dashboardga. */
  if (isPublicPath(pathname)) {
    if (hasFlag) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  /** Ildiz `/` — landing yo'q. Auth holatiga qarab yo'naltiramiz. */
  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasFlag ? "/dashboard" : "/login", request.url));
  }

  /**
   * Qolgan barcha sahifalar himoyalangan: login bo'lmasa hech qanday sahifa
   * (hatto bo'sh yoki ma'lumotli bo'lsa ham) ko'rsatilmaydi — login sahifasiga
   * yo'naltiramiz.
   */
  if (!hasFlag) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Barcha yo'llarni qamrab olamiz; faqat backend proksilari (`/api`, `/auth`),
   * Next ichki yo'llari va statik fayllar chetda qoladi. Shu tariqa har qanday
   * (dashboard) sahifasi avtomatik himoyalanadi.
   */
  matcher: [
    /*
     * Icon metadata routes (`/icon`, `/apple-icon`) kengaytmasiz — auth matcher’dan
     * chiqarilmasa login HTML “favicon” bo‘lib qoladi (Chrome eski Vercel/blank tab).
     */
    "/((?!api|auth|_next/static|_next/image|favicon\\.ico|favicon-sa\\.ico|favicon\\.svg|icon|apple-icon|apple-touch-icon|sa-favicon|sa-brand-v3|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|ico|map|geojson|webmanifest)$).*)"
  ]
};

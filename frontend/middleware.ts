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

  /** Mahsulotlar katalogi — «Настройки → Продукт» (референс UI) */
  if (pathname === "/products" || pathname === "/products/") {
    const url = request.nextUrl.clone();
    url.pathname = "/settings/products";
    return NextResponse.redirect(url);
  }
  if (pathname === "/products/bulk" || pathname.startsWith("/products/bulk/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/products/, "/settings/products");
    return NextResponse.redirect(url);
  }
  if (pathname === "/products/excel" || pathname.startsWith("/products/excel/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/products/, "/settings/products");
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
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|ico|map|geojson)$).*)"
  ]
};

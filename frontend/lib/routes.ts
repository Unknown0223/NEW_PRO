/** Himoyalangan marshrutlar — middleware va testlar uchun yagona ro‘yxat. */

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/products",
  "/clients",
  "/orders",
  "/payments",
  "/expeditor-payment-requests",
  "/client-expenses",
  "/initial-client-balances",
  "/client-balances",
  "/returns",
  "/orders/automation",
  "/reports",
  "/stock",
  "/suppliers",
  "/expenses",
  "/currency-rates",
  "/settings",
  "/access"
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

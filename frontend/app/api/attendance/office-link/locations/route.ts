import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("tenantCode")?.trim().toLowerCase() || "";
  const slug = !asked || asked === "demo" ? "aksit" : asked;
  const upstream = await fetch(
    `https://api.salesarena.sale/api/attendance/office-link/locations?tenantCode=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  const data = await upstream.json().catch(() => ({ locations: [] }));
  return NextResponse.json(data);
}

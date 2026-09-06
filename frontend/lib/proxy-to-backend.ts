import { NextRequest, NextResponse } from "next/server";

/** Server-only: brauzer bundle ga kirmaydi — Railway da runtime da qo‘yish mumkin. */
export function backendOriginForProxy(): string | null {
  const u =
    process.env.API_INTERNAL_ORIGIN?.trim() ||
    process.env.BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  /**
   * `app/api/[[...path]]` Route Handler `next.config` rewrites dan oldin ishlaydi.
   * Devda `.env` da origin bo‘lmasa — `next.config.mjs` dagi standart maqsad (18080).
   */
  if (process.env.NODE_ENV === "development") {
    return (process.env.API_INTERNAL_ORIGIN_DEV_FALLBACK?.trim() || "http://127.0.0.1:18080").replace(/\/$/, "");
  }
  return null;
}

/**
 * Next.js dan kelgan so‘rovni Fastify backend ga uzatadi (`/auth/*`, `/api/*`).
 * Prod: задайте `API_INTERNAL_ORIGIN` или `NEXT_PUBLIC_API_URL`.
 * Dev: при отсутствии env используется `http://127.0.0.1:18080` (как в `next.config.mjs` rewrites).
 */
export async function proxyToBackend(
  req: NextRequest,
  backendPrefix: "/auth" | "/api",
  pathSegments: string[]
): Promise<NextResponse> {
  const base = backendOriginForProxy();
  if (!base) {
    return NextResponse.json(
      { error: "SERVICE_MISCONFIGURED", message: "Set API_INTERNAL_ORIGIN or NEXT_PUBLIC_API_URL on the frontend service." },
      { status: 503 }
    );
  }

  const rest = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  const targetUrl = `${base}${backendPrefix}${rest}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  // content-length ni o‘chirib, stream body bilan fetch o‘zi hisoblaydi
  headers.delete("content-length");

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    // Katta eksport/import — default fetch timeout yetmasligi mumkin
    signal: AbortSignal.timeout(10 * 60 * 1000)
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // arrayBuffer() 1–2 GB ZIP ni butunlay RAM ga oladi va import buziladi —
    // multipart ni stream qilib uzatamiz.
    if (req.body) {
      init.body = req.body;
      init.duplex = "half";
    }
  }

  const res = await fetch(targetUrl, init);
  const out = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText
  });

  res.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "connection" || k === "transfer-encoding") return;
    out.headers.set(key, value);
  });

  return out;
}

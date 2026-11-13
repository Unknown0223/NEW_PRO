import { networkInterfaces } from "node:os";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Docker / Hyper-V / WSL ko‘priklari — telefon LAN uchun odatda yaroqsiz. */
const SKIP_IFACE = /^(docker|br-|veth|lo|Loopback|WSL|vEthernet|Hyper-V|virbr)/i;

function isPrivateLanIpv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  if (ip.startsWith("127.")) return false;
  if (ip.startsWith("169.254.")) return false;
  const parts = ip.split(".").map((p) => Number(p));
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function pickLanIpv4(): string | null {
  const nets = networkInterfaces();
  const scored: { ip: string; score: number }[] = [];
  for (const [name, list] of Object.entries(nets)) {
    if (!list || SKIP_IFACE.test(name)) continue;
    for (const entry of list) {
      if (entry.family !== "IPv4") continue;
      if (entry.internal) continue;
      if (!isPrivateLanIpv4(entry.address)) continue;
      let score = 10;
      if (entry.address.startsWith("192.168.")) score += 30;
      else if (entry.address.startsWith("10.")) score += 20;
      if (/wi-?fi|wlan|wireless|ethernet|eth|lan/i.test(name)) score += 15;
      scored.push({ ip: entry.address, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.ip ?? null;
}

/**
 * Dev: telefon QR uchun PC LAN origin (masalan http://192.168.x.x:3000).
 * Prod’da brauzer hosti qaytariladi — QR uchun asosiy manba hali client env/window.
 */
export async function GET(req: Request) {
  const configured =
    process.env.NEXT_PUBLIC_FACE_BRIDGE_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (configured) {
    return NextResponse.json({
      origin: configured.replace(/\/$/, ""),
      source: "env" as const
    });
  }

  const url = new URL(req.url);
  const port = url.port || (url.protocol === "https:" ? "443" : "3000");
  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const hostname = hostHeader.split(":")[0]?.trim() || "127.0.0.1";
  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";

  if (!isLoopback && process.env.NODE_ENV === "production") {
    const proto =
      (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0]?.trim() ||
      "https";
    return NextResponse.json({
      origin: `${proto}://${hostHeader}`.replace(/\/$/, ""),
      source: "request" as const
    });
  }

  const lan = pickLanIpv4();
  if (!lan) {
    return NextResponse.json({
      origin: null,
      source: "none" as const,
      hint: "LAN IPv4 topilmadi. NEXT_PUBLIC_FACE_BRIDGE_ORIGIN=http://<PC-IP>:3000 qo‘ying."
    });
  }

  const proto = url.protocol === "https:" ? "https" : "http";
  const origin =
    port === "80" && proto === "http"
      ? `${proto}://${lan}`
      : port === "443" && proto === "https"
        ? `${proto}://${lan}`
        : `${proto}://${lan}:${port}`;

  return NextResponse.json({
    origin,
    lan_ip: lan,
    port,
    source: "lan" as const
  });
}

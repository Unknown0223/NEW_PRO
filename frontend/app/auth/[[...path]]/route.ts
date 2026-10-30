import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/proxy-to-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };

async function segments(ctx: Ctx): Promise<string[]> {
  const { path } = await ctx.params;
  return path ?? [];
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxyToBackend(req, "/auth", await segments(ctx));
}

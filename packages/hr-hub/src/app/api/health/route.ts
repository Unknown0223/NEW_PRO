import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "@salec/hr-hub",
    time: new Date().toISOString(),
  });
}

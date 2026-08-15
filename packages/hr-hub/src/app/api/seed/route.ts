import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { requireApiSession } from "@/lib/api";

/** Dev helper: runs `npm run db:seed` in package root. Prefer CLI in production. */
export async function POST() {
  const auth = await requireApiSession(["org_admin"]);
  if (auth instanceof NextResponse) return auth;

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed API disabled in production" }, { status: 403 });
  }

  const cwd = path.resolve(process.cwd());
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/db/seed.ts"], {
      cwd,
      shell: true,
      env: process.env,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed exit ${code}`))));
    child.on("error", reject);
  });

  return NextResponse.json({ ok: true });
}

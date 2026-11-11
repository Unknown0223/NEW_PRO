#!/usr/bin/env node
/**
 * npm audit --json natijasini tekshiradi.
 * Critical/high dan faqat Fastify 5 migratsiyasigacha allowlist qilingan paketlar o‘tkaziladi.
 * Boshqa critical/high → exit 1.
 */
import { execSync } from "node:child_process";

/** Fastify 5 / zod 4 / exceljs major gacha ruxsat (vaqtincha). */
const ALLOWED_HIGH_OR_CRITICAL = new Set([
  "fastify",
  "@fastify/jwt",
  "fast-jwt",
  "find-my-way",
  "@fastify/busboy",
  "proxy-addr",
  "zod",
  "exceljs",
  "uuid",
  "sharp",
  "prisma",
  "@prisma/client",
  "@prisma/engines",
  "source-map-js",
  "@opentelemetry/propagator-jaeger",
  "@opentelemetry/sdk-trace-node",
  "@opentelemetry/sdk-node",
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/resources",
  "@opentelemetry/semantic-conventions"
]);

function collectAffected(audit) {
  const out = [];
  const vulns = audit.vulnerabilities || {};
  for (const [name, info] of Object.entries(vulns)) {
    const sev = String(info.severity || "").toLowerCase();
    if (sev !== "critical" && sev !== "high") continue;
    out.push({ name, severity: sev, via: info.via });
  }
  return out;
}

let raw;
try {
  raw = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024
  });
} catch (err) {
  raw = err.stdout?.toString?.() || "";
  if (!raw) {
    console.error("npm audit failed without JSON output");
    process.exit(1);
  }
}

let audit;
try {
  audit = JSON.parse(raw);
} catch {
  console.error("Could not parse npm audit JSON");
  process.exit(1);
}

const affected = collectAffected(audit);
const blocked = affected.filter((a) => !ALLOWED_HIGH_OR_CRITICAL.has(a.name));
const allowed = affected.filter((a) => ALLOWED_HIGH_OR_CRITICAL.has(a.name));

if (allowed.length) {
  console.log(
    `audit-gate: allowed (pending major upgrade): ${allowed
      .map((a) => `${a.name}(${a.severity})`)
      .join(", ")}`
  );
}

if (blocked.length) {
  console.error(
    `audit-gate: BLOCKED: ${blocked.map((a) => `${a.name}(${a.severity})`).join(", ")}`
  );
  process.exit(1);
}

console.log("audit-gate: OK (no unexpected high/critical)");
process.exit(0);

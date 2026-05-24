#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const seedPath = path.join(prismaDir, "seed.ts");
const lines = fs.readFileSync(seedPath, "utf8").split(/\r?\n/);

const helpersEnd = 171; // before async function main
const mainStart = 172;
const demoStart = 556; // line before demoWh (0-indexed 556)

const helpers = lines.slice(0, helpersEnd).join("\n").replace(/^async function /gm, "export async function ").replace(/^function /gm, "export function ");

const test1Body = lines.slice(mainStart + 1, demoStart).join("\n");
const demoBody = lines.slice(demoStart, lines.findIndex((l) => l.trim() === "}") + 1 || demoStart + 60).join("\n");

const seedDir = path.join(prismaDir, "seed");
fs.mkdirSync(seedDir, { recursive: true });

fs.writeFileSync(
  path.join(seedDir, "helpers.ts"),
  `import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const prisma = new PrismaClient();

${helpers}
`
);

fs.writeFileSync(
  path.join(seedDir, "seed-test1.ts"),
  `import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ensureCategory,
  ensureClient,
  ensureWarehouse,
  mergeDefaultReasonReferences,
  prisma,
  refE
} from "./helpers";

export async function seedTest1Tenant() {
  const password_hash = await bcrypt.hash("secret123", 10);
${test1Body}
}
`
);

fs.writeFileSync(
  path.join(seedDir, "seed-demo.ts"),
  `import { Prisma } from "@prisma/client";
import { ensureWarehouse, mergeDefaultReasonReferences, prisma } from "./helpers";

export async function seedDemoTenant() {
  const demo = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
  const test1 = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });
${demoBody}
}
`
);

fs.writeFileSync(
  seedPath,
  `import "dotenv/config";
import { prisma } from "./seed/helpers";
import { seedDemoTenant } from "./seed/seed-demo";
import { seedTest1Tenant } from "./seed/seed-test1";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("SeedBlockedInProduction");
  }
  await seedTest1Tenant();
  await seedDemoTenant();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
`
);

console.log("seed split OK");

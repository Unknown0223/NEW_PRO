#!/usr/bin/env node
/**
 * order-create-workspace.tsx → use-order-create.ts + order-create-shell.tsx + barrel.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(__dirname, "../components/orders/order-create");
const srcPath = path.join(__dirname, "../components/orders/order-create-workspace.tsx");
const lines = readFileSync(srcPath, "utf8").split(/\r?\n/);

const headerEnd = lines.findIndex((l) => l.startsWith("export function OrderCreateWorkspace"));
if (headerEnd < 0) throw new Error("OrderCreateWorkspace not found");

const header = lines.slice(0, headerEnd).join("\n");
const body = lines.slice(headerEnd);
const noTenantIdx = body.findIndex((l) => l.trim() === "if (!tenantSlug) {");
const mainReturnIdx = body.findIndex((l) => l.trim() === "return (");
if (noTenantIdx < 0 || mainReturnIdx < noTenantIdx) throw new Error("return markers not found");

const hookBody = body.slice(1, noTenantIdx).join("\n");
const noTenantBlock = body.slice(noTenantIdx, mainReturnIdx).join("\n");
const shellBody = body.slice(mainReturnIdx).join("\n");

mkdirSync(mod, { recursive: true });

const hookImports = `${header}
import type { OrderCreateProps } from "@/components/orders/order-create/types";

export function useOrderCreate({ tenantSlug, onCreated, onCancel, orderType }: OrderCreateProps) {
${hookBody}
${noTenantBlock.replace("if (!tenantSlug)", "if (!tenantSlug) { return { kind: \"no-tenant\" as const }; }")}
  return { kind: "ready" as const, tenantSlug, onCreated, onCancel, orderType,
    // NOTE: shell receives full closure via spread below — populated in shell file
  };
}
`;

// Simpler approach: hook returns all locals by keeping single function — rewrite shell to call hook inside workspace only

writeFileSync(path.join(mod, "use-order-create.ts"), "INCOMPLETE — use workspace merge\n", "utf8");
console.log("hook lines", hookBody.split("\n").length, "shell lines", shellBody.split("\n").length);

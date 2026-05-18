/**
 * Zod kontraktlardan OpenAPI 3 `components.schemas` fragmentini generatsiya qiladi.
 * Chiqish: `openapi/generated/components.json`, `openapi/openapi.bundle.yaml`
 *
 * Ishlatish: npm run openapi:generate && npm run openapi:lint
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import YAML from "yaml";
import { readFileSync } from "node:fs";

import { authLoginBodySchema } from "../../src/contracts/auth.schemas";
import {
  mobileEnqueueBodySchema,
  mobileSyncDeltaBodySchema,
  mobileSyncFullBodySchema
} from "../../src/contracts/mobile.schemas";
import { patchClientBodySchema } from "../../src/contracts/clients.schemas";
import {
  bulkOrderStatusBodySchema,
  createOrderBodySchema,
  patchOrderStatusBodySchema
} from "../../src/contracts/orders.schemas";
import { createPaymentBodySchema, patchPaymentBodySchema } from "../../src/contracts/payments.schemas";
import { createProductBodySchema } from "../../src/contracts/products.schemas";
import {
  reportBuilderConfigDocSchema,
  reportBuilderDatasetRequestDocSchema
} from "../../src/contracts/report-builder.schemas";
import { reportsDateRangeQuerySchema } from "../../src/contracts/reports.schemas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiDir = join(__dirname, "../../openapi");
const generatedDir = join(openapiDir, "generated");

/** Bundle da Zod schema $ref — skeleton da generic object qoladi (lint alohida). */
const REQUEST_BODY_REFS: Array<{ pathKey: string; method: string; schemaName: string }> = [
  { pathKey: "/api/auth/login", method: "post", schemaName: "AuthLoginBody" },
  { pathKey: "/api/{slug}/orders", method: "post", schemaName: "CreateOrderBody" },
  { pathKey: "/api/{slug}/orders/{id}/status", method: "patch", schemaName: "PatchOrderStatusBody" },
  { pathKey: "/api/{slug}/payments", method: "post", schemaName: "CreatePaymentBody" },
  { pathKey: "/api/{slug}/products", method: "post", schemaName: "CreateProductBody" },
  { pathKey: "/api/{slug}/clients/{id}", method: "patch", schemaName: "PatchClientBody" },
  {
    pathKey: "/api/{slug}/reports/report-builder/dataset",
    method: "post",
    schemaName: "ReportBuilderDatasetRequest"
  },
  {
    pathKey: "/api/{slug}/mobile/orders/enqueue",
    method: "post",
    schemaName: "MobileEnqueueBody"
  },
  { pathKey: "/api/{slug}/mobile/sync/full", method: "post", schemaName: "MobileSyncFullBody" },
  { pathKey: "/api/{slug}/mobile/sync/delta", method: "post", schemaName: "MobileSyncDeltaBody" }
];

function applyRequestBodyRefs(doc: Record<string, unknown>): void {
  const paths = doc.paths as Record<string, Record<string, Record<string, unknown>>> | undefined;
  if (!paths) return;
  for (const { pathKey, method, schemaName } of REQUEST_BODY_REFS) {
    const op = paths[pathKey]?.[method];
    if (!op?.requestBody) continue;
    const rb = op.requestBody as { content?: { "application/json"?: { schema?: unknown } } };
    if (rb.content?.["application/json"]) {
      rb.content["application/json"].schema = { $ref: `#/components/schemas/${schemaName}` };
    }
  }
}

function zodToOpenApiComponent(schema: ZodTypeAny, name: string): Record<string, unknown> {
  const json = zodToJsonSchema(schema, {
    name,
    target: "openApi3",
    $refStrategy: "none"
  }) as Record<string, unknown>;
  const defs = json.definitions as Record<string, unknown> | undefined;
  if (defs?.[name] && typeof defs[name] === "object") {
    return defs[name] as Record<string, unknown>;
  }
  const { $schema: _s, definitions: _d, $ref: _r, ...rest } = json;
  return rest;
}

const SCHEMA_ENTRIES: Array<{ name: string; schema: ZodTypeAny }> = [
  { name: "AuthLoginBody", schema: authLoginBodySchema },
  { name: "CreateOrderBody", schema: createOrderBodySchema },
  { name: "PatchOrderStatusBody", schema: patchOrderStatusBodySchema },
  { name: "BulkOrderStatusBody", schema: bulkOrderStatusBodySchema },
  { name: "PatchClientBody", schema: patchClientBodySchema },
  { name: "CreatePaymentBody", schema: createPaymentBodySchema },
  { name: "PatchPaymentBody", schema: patchPaymentBodySchema },
  { name: "CreateProductBody", schema: createProductBodySchema },
  { name: "ReportsDateRangeQuery", schema: reportsDateRangeQuerySchema },
  { name: "ReportBuilderDatasetRequest", schema: reportBuilderDatasetRequestDocSchema },
  { name: "ReportBuilderConfig", schema: reportBuilderConfigDocSchema },
  { name: "MobileEnqueueBody", schema: mobileEnqueueBodySchema },
  { name: "MobileSyncFullBody", schema: mobileSyncFullBodySchema },
  { name: "MobileSyncDeltaBody", schema: mobileSyncDeltaBodySchema }
];

function main() {
  const components: Record<string, unknown> = {};
  for (const { name, schema } of SCHEMA_ENTRIES) {
    components[name] = zodToOpenApiComponent(schema, name);
  }

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "components.json"), `${JSON.stringify(components, null, 2)}\n`, "utf8");

  const skeletonPath = join(openapiDir, "skeleton.yaml");
  const skeleton = YAML.parse(readFileSync(skeletonPath, "utf8")) as Record<string, unknown>;
  const skComponents = (skeleton.components ?? {}) as Record<string, unknown>;
  const skSchemas = (skComponents.schemas ?? {}) as Record<string, unknown>;

  skeleton.components = {
    ...skComponents,
    schemas: {
      ...skSchemas,
      ...components
    }
  };

  applyRequestBodyRefs(skeleton);

  writeFileSync(join(openapiDir, "openapi.bundle.yaml"), YAML.stringify(skeleton), "utf8");

  console.log(`Wrote ${SCHEMA_ENTRIES.length} schemas to openapi/generated/components.json`);
  console.log("Wrote openapi/openapi.bundle.yaml (skeleton + Zod schemas)");
}

main();

import { randomUUID } from "node:crypto";

/** Har bir test run uchun noyob prefiks — parallel CI izolyatsiyasi. */
let testRunId: string | null = null;

export function getTestRunId(): string {
  if (!testRunId) {
    testRunId = process.env.VITEST_TEST_RUN_ID ?? randomUUID().slice(0, 8);
    process.env.VITEST_TEST_RUN_ID = testRunId;
  }
  return testRunId;
}

/** Integratsiya testlari uchun nom prefiksi (masalan qoidalar, izohlar). */
export function testDataPrefix(label: string): string {
  return `[vitest-${getTestRunId()}] ${label}`;
}

/** Seed tenant slug — global setup marker bilan mos. */
export const INTEGRATION_TENANT_SLUG = "test1";

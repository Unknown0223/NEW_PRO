import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/db-global-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      include: ["src/modules/orders/domain/**/*.ts"],
      /** Bosqich 1: domain uchun alohida integration testlar qo‘shilganda 60%+ ga ko‘tariladi. */
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      }
    }
  }
});

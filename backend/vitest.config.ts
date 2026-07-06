import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/db-global-setup.ts"],
    /** Integratsiya testlari bitta DB ni bo‘lishadi — parallel fayllar holatni buzadi. */
    fileParallelism: false,
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      include: [
        "src/modules/orders/order-bonus-apply.ts",
        "src/modules/orders/order-bonus-qty.ts",
        "src/modules/orders/order-bonus-context.match-scope.ts",
        "src/modules/orders/order-bonus-context.fetch.ts",
        "src/domain/phone-number.ts",
        "src/domain/tenant-id.ts"
      ],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30
      }
    }
  }
});

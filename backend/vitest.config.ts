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
        "src/modules/orders/bonus-stack-policy.ts",
        "src/modules/orders/order-status.ts",
        "src/modules/access/legacy-key-map.ts",
        "src/modules/access/permission-model.ts",
        "src/domain/phone-number.ts",
        "src/domain/tenant-id.ts",
        "src/domain/events/**/*.ts",
        "src/lib/constants.ts",
        "src/lib/cors-options.ts",
        "src/modules/plans/**/*.ts",
        "src/modules/clients/**/*.ts",
        "src/modules/auth/auth.service.ts",
        "src/modules/auth/auth-cookies.ts",
        "src/modules/payments/payment.query.ts"
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75
      }
    }
  }
});

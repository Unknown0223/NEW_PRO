import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Backend (Fastify + Prisma) ESLint flat config.
 *
 * Maqsad: TypeScript kompilyatori ko'rmaydigan, lekin runtime'da muammo bo'ladigan
 * patternlarni ushlash (`prefer-const`, foydasiz escape, bo'sh catch, `no-useless-catch`).
 * Tiplarga bog'liq og'ir qoidalar ataylab o'chirilgan — ular `tsc --noEmit` da tekshiriladi.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "prisma/migrations/**",
      "openapi/generated/**",
      "**/*.d.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      // --- Error: haqiqiy xato ---
      // `no-undef` o'chirilgan: TypeScript o'zi hal qiladi (typescript-eslint tavsiyasi),
      // `globals` paketiga bog'liqlik qolmaydi.
      "no-undef": "off",
      "prefer-const": "error",
      "no-useless-escape": "error",
      "no-useless-catch": "error",
      "no-var": "error",
      "no-unreachable": "error",
      "no-dupe-else-if": "error",
      "no-constant-binary-expression": "error",
      "no-self-assign": "error",
      "no-unused-private-class-members": "error",
      // Legacy kodda ~2000 ta mavjud (import'da qolib ketgan tiplar, ishlatilmagan
      // yordamchi funksiyalar). Yangi kod uchun error, mavjudlari bosqichma-bosqich:
      // `npm run lint:fix` + `npx eslint src --quiet` bilan kamaytirib boriladi.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true
        }
      ],

      // --- Warn: legacy uslub, bosqichma-bosqich ---
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-empty": ["warn", { allowEmptyCatch: false }],
      "no-console": "warn"
    }
  },
  {
    // Skriptlar va seed fayllar: `console` normal, `any` ko'p ishlatiladi.
    files: ["scripts/**/*.ts", "prisma/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  }
);

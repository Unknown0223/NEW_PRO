import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint (flat config).
 *
 * Qoida: `error` — CI'ni to'xtatadigan haqiqiy xato; `warn` — refaktoring navbati.
 * Yangi kod yozganda warning'larni ham kamaytirishga harakat qilamiz, lekin
 * legacy fayllar (vendor, .cjs skriptlar) lint qilinmaydi.
 */
export default [
  // Build artefaktlari, vendor bundle va CJS skriptlar lint qilinmaydi.
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "public/**",
      "vendor/**",
      "**/*.cjs",
      "**/*.min.js"
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // --- Error: haqiqiy xato manbalari ---
      "react-hooks/rules-of-hooks": "error",
      // Legacy fayllarda ko'p uchraydi — `npm run lint:errors` faqat error'larni tekshiradi.
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
      "prefer-const": "error",
      "react/no-unescaped-entities": "error",
      "@next/next/no-html-link-for-pages": "error",
      // Ataylab to'liq reload (token muddati tugaganda holatni tozalash uchun).
      "@next/next/no-location-assign-relative-destination": "warn",

      // --- Warn: refaktoring navbatidagi legacy patternlar ---
      // React Compiler (eslint-plugin-react-hooks v7) qoidalari: yangi kodda
      // bajarilishi kerak, legacy ekranlar bosqichma-bosqich tuzatiladi.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-img-element": "warn",
      "import/no-anonymous-default-export": "warn"
    }
  },
  // Test fayllarda `any` va bo'sh funksiyalar normal holat.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "e2e/**", "tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  }
];

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "src/.next/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dev-only Playwright screenshot script (CommonJS).
    "screenshot.cjs",
    // Dev-only one-off i18n/data migration scripts (CommonJS, root level).
    "add-all-keys.js",
    "add-keys-asian.js",
    "add-keys.js",
    "fix-dates.js",
    "fix-locale-sub.js",
    "replace-currency.js",
    "update-dicts.js",
  ]),
  {
    // React Compiler (eslint-plugin-react-hooks v6) strict rules. They fire on
    // intentional, working patterns in this codebase — SSR locale init, data-fetch
    // effects, reset-on-filter state, elapsed-time display, and stateful nested
    // components. Kept as warnings so they surface without blocking the CI gate.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;

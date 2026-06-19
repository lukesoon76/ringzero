// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Hard constraint (CLAUDE.md): DETERMINISM ON THE BINDING PATH.
 * The kernel, policy compiler, and mediation gateway make binding governance
 * decisions. Wall-clock time and unseeded randomness make those decisions
 * non-reproducible and break replay (acceptance criterion #3). They are banned
 * structurally here — inject a clock / seeded RNG instead.
 */
const bindingPathDeterminism = {
  "no-restricted-properties": [
    "error",
    {
      object: "Date",
      property: "now",
      message:
        "Determinism (binding path): no Date.now() — inject a Clock. See CLAUDE.md hard constraints.",
    },
    {
      object: "Math",
      property: "random",
      message:
        "Determinism (binding path): no Math.random() — inject a seeded RNG. See CLAUDE.md hard constraints.",
    },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message:
        "Determinism (binding path): no `new Date()` — inject a Clock. See CLAUDE.md hard constraints.",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.config.*",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Binding-path packages only. Test files are exempt (they may simulate time).
    files: [
      "packages/kernel/src/**/*.ts",
      "packages/policy/src/**/*.ts",
      "packages/mediation/src/**/*.ts",
    ],
    ignores: ["**/*.test.ts"],
    rules: bindingPathDeterminism,
  },
);

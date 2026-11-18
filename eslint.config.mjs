import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import security from "eslint-plugin-security";
import importPlugin from "eslint-plugin-import";

export default [
  // Carpetas generadas o de reportes: no se analizan
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".vite/**", "reports/**"],
  },
  // Base recommended rules
  js.configs.recommended,
  // Import plugin recommended rules (flat config)
  importPlugin.flatConfigs.recommended,
  // SonarJS rules for code smells/bugs
  sonarjs.configs.recommended,
  // Security plugin recommended rules
  security.configs.recommended,
  // Project-specific settings and tweaks
  {
    files: ["**/*.js", "**/*.cjs"],
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".vite/**",
      "reports/**",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Keep console allowed but visible
      "no-console": "warn",
      // A few useful SonarJS tweaks
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/cognitive-complexity": ["warn", 20],
    },
  },
  // Node CommonJS scripts
  {
    files: [
      "scripts/**/*.cjs",
      "*.cjs",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  // Node ESM config and server files
  {
    files: [
      "api/**/*.js",
      "vite.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
];

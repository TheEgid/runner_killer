import js from "@eslint/js";
import typescriptParser from "@typescript-eslint/parser";
import stylistic from "@stylistic/eslint-plugin";
import effector from "eslint-plugin-effector";
import reactPlugin from "eslint-plugin-react";
import reactJsx from "eslint-plugin-react/configs/jsx-runtime.js";
import importX from "eslint-plugin-import-x";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import hooksPlugin from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";
import ts from "typescript-eslint";

/** @type {import("eslint").Linter["getConfigForFile"]} */
const config = [
  { ignores: [".next/**/*", "prisma/**/*", "python-applic/**/*"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.tsx", "**/*.jsx"],
    ...reactJsx,
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      import: importX,
      react: reactPlugin,
      "@stylistic": stylistic,
      ...reactRecommended.plugins,
      "react-hooks": fixupPluginRules(hooksPlugin),
      "effector": fixupPluginRules(effector),
    },
    rules: {
      ...effector.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...stylistic.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      "@stylistic/no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 0, maxBOF: 1 }],
      "@stylistic/lines-between-class-members": ["error", "always"],
      "@stylistic/max-statements-per-line": ["warn", { max: 2 }],
      "@stylistic/padding-line-between-statements": [
          "error",
          { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
          { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
      ],
      "@stylistic/member-delimiter-style": [
          "error",
          { multiline: { delimiter: "comma", requireLast: false }, singleline: { delimiter: "comma", requireLast: false } },
      ],
      "@stylistic/no-trailing-spaces": "warn",
      "@stylistic/semi": "warn",
      "@stylistic/indent-binary-ops": ["error", 4],
      "@stylistic/indent": ["error", 4, {
        "ignoredNodes": [
          "JSXElement",
          "JSXFragment",
          "TemplateLiteral"
        ]
      }],
      "@stylistic/no-multi-spaces": "warn",
      "@stylistic/no-tabs": ["error", { allowIndentationTabs: true }],
      "@stylistic/jsx-quotes": ["warn", "prefer-double"],
      "@stylistic/quotes": ["warn", "double"],
      "@stylistic/comma-spacing": ["warn", { before: false, after: true }],
      "@stylistic/jsx-indent-props": "off",
      "@stylistic/arrow-parens": "off",
      "@stylistic/padded-blocks": "off",
      "react-hooks/exhaustive-deps": "off",
      "react/jsx-curly-spacing": "warn",
      "react/jsx-equals-spacing": "warn",
      "react/jsx-wrap-multilines": "warn",
      "import/no-duplicates": "error",
      "import/no-unresolved": "off",
      "import/first": "error",
      "import/named": "off",
      "import/newline-after-import": "error",
      "import/order": [
          "error",
          {
              groups: [["builtin", "external"], "internal", "parent", ["sibling", "index"], "object", "type"],
              pathGroups: [{ pattern: "react", group: "external", position: "before" }],
              pathGroupsExcludedImportTypes: ["react"],
              "newlines-between": "never",
              alphabetize: { order: "asc", caseInsensitive: true },
          },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-assertions": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/naming-convention": [
          "error",
          {
              selector: "variable",
              format: ["camelCase", "UPPER_CASE", "PascalCase"],
              leadingUnderscore: "allow",
          },
      ],
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/no-unnecessary-qualifier": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-use-before-define": "error",
      "@typescript-eslint/prefer-for-of": "error",
      "@typescript-eslint/prefer-function-type": "error",
      "@typescript-eslint/prefer-namespace-keyword": "error",
      "@typescript-eslint/triple-slash-reference": ["error", { path: "always", types: "prefer-import", lib: "always" }],
      "@typescript-eslint/unified-signatures": "error",
      "@typescript-eslint/no-unused-vars": [
          "warn",
          {
              argsIgnorePattern: "^_",
              varsIgnorePattern: "^_",
              caughtErrorsIgnorePattern: "^_",
          },
      ],
      "constructor-super": "error",
      "no-bitwise": "error",
      "no-caller": "error",
      "no-cond-assign": "error",
      "no-control-regex": "error",
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-duplicate-imports": "error",
      "no-eval": "error",
      "no-extra-bind": "error",
      "no-fallthrough": "error",
      "no-invalid-regexp": "error",
      "no-regex-spaces": "error",
      "no-return-await": "error",
      "no-sequences": "error",
      "no-sparse-arrays": "error",
      "no-template-curly-in-string": "error",
      "no-throw-literal": "error",
      "no-unsafe-finally": "error",
      "no-unused-labels": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "one-var": ["error", "never"],
      "prefer-const": "error",
      "prefer-object-spread": "warn",
      "spaced-comment": ["warn", "always", { markers: ["/"] }],
      "curly": "error",
      "default-case": "error",
      "prefer-arrow-callback": "error",
      "arrow-parens": ["warn", "always"],
      "eqeqeq": ["error", "smart"],
  },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
          project: ["./tsconfig.json"],
          sourceType: "module",
          tsconfigRootDir: import.meta.dirname,
      },
  },
  settings: { react: { version: "detect" } },
  }
];

export default config;

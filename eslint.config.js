const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const jsdocPlugin = require("eslint-plugin-jsdoc");

module.exports = [
  {
    ignores: ["out/**", "src/ui/webview/dist/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      "react-hooks": reactHooksPlugin,
      jsdoc: jsdocPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx"],
        },
      },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "variable", format: ["camelCase", "UPPER_CASE", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "property", format: null, filter: { regex: "^__", match: true } },
        { selector: "objectLiteralProperty", format: null, modifiers: ["requiresQuotes"] },
        { selector: "import", format: ["camelCase", "PascalCase"] },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "import/no-restricted-paths": [
        "warn",
        {
          zones: [
            {
              target: "./src/core/memory/**/*",
              from: ["./src/ui/provider/**/*", "./src/ui/notifications/**/*", "./src/api/**/*"],
              message: "core/memory no debe importar desde ui/provider, ui/notifications ni api. Ver Docs/Owners.md.",
            },
            {
              target: "./src/system/debug/**/*",
              from: ["./src/ui/provider/**/*", "./src/ui/notifications/**/*", "./src/api/**/*"],
              message: "debug no debe importar desde ui/provider, ui/notifications ni api. Ver Docs/Owners.md fase D.",
            },
          ],
        },
      ],
      "jsdoc/require-jsdoc": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-type": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-type": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/require-description": "warn",
      "jsdoc/require-description-complete-sentence": "warn",
      "jsdoc/require-property": "warn",
      "jsdoc/require-property-type": "warn",
      "jsdoc/require-property-description": "warn",
      "jsdoc/require-throws-description": "warn",
      "jsdoc/check-syntax": "warn",
      "jsdoc/check-types": "warn",
      "jsdoc/no-blank-blocks": "warn",
      "jsdoc/no-blank-block-descriptions": "warn",
      "jsdoc/check-alignment": "warn",
      "jsdoc/check-param-names": "warn",
      "jsdoc/check-tag-names": "warn",
      "jsdoc/no-undefined-types": "warn",
    },
  },
];

const path = require('path');

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsdocPlugin = require('eslint-plugin-jsdoc');

const tsconfigRootDir = __dirname;

const plugins = {
  '@typescript-eslint': tsPlugin,
  import: importPlugin,
  'react-hooks': reactHooksPlugin,
  jsdoc: jsdocPlugin,
};

const nodeImportResolver = {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
};

/** Resolver TS por subproyecto (evita "Multiple projects found" del import resolver). */
const extensionImportResolver = {
  typescript: {
    alwaysTryTypes: true,
    project: path.join(tsconfigRootDir, 'tsconfig.eslint.json'),
  },
  node: nodeImportResolver,
};

const webviewImportResolver = {
  typescript: {
    alwaysTryTypes: true,
    project: path.join(tsconfigRootDir, 'src/ui/webview/tsconfig.eslint.json'),
  },
  node: nodeImportResolver,
};

const baseSettings = {
  react: {
    version: 'detect',
  },
};

/** @type {import('eslint').Linter.RulesRecord} */
const coreRules = {
  curly: 'error',
  eqeqeq: 'error',
  'no-throw-literal': 'error',
  semi: 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const typescriptRules = {
  '@typescript-eslint/naming-convention': [
    'error',
    { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
    {
      selector: 'variable',
      format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    { selector: 'function', format: ['camelCase', 'PascalCase'] },
    { selector: 'typeLike', format: ['PascalCase'] },
    { selector: 'property', format: null, filter: { regex: '^__', match: true } },
    { selector: 'objectLiteralProperty', format: null, modifiers: ['requiresQuotes'] },
    { selector: 'import', format: ['camelCase', 'PascalCase'] },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'error',
};

/**
 * Segunda tanda TypeScript: preset recommended (sin type-aware).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptRecommendedRules = {
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
      'ts-nocheck': true,
      minimumDescriptionLength: 10,
    },
  ],
  '@typescript-eslint/no-empty-object-type': 'error',
  '@typescript-eslint/no-require-imports': 'error',
  '@typescript-eslint/no-unused-expressions': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/prefer-as-const': 'error',
  'no-array-constructor': 'off',
  '@typescript-eslint/no-array-constructor': 'error',
};

/**
 * Reglas type-aware (requieren parserOptions.project).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptTypeAwareRules = {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-misused-promises': [
    'error',
    { checksVoidReturn: { attributes: false } },
  ],
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/return-await': ['error', 'in-try-catch'],
};

/**
 * Tercera tanda: strict-type-checked (reglas type-aware de alto valor).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptStrictTypeAwareRules = {
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/require-await': 'error',
  '@typescript-eslint/only-throw-error': 'error',
  '@typescript-eslint/prefer-promise-reject-errors': 'error',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/no-deprecated': 'error',
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  '@typescript-eslint/unbound-method': 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const reactRules = {
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const importRules = {
  'import/no-duplicates': 'error',
  'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
  'import/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
      distinctGroup: false,
    },
  ],
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: './src/sugcore/**/*',
          from: ['./src/ui/provider/**/*', './src/ui/notifications/**/*', './src/api/**/*'],
          message:
            'sugcore no debe importar desde ui/provider, ui/notifications ni api. Ver Docs/Owners.md.',
        },
        {
          target: './src/system/log/**/*',
          from: ['./src/ui/provider/**/*', './src/ui/notifications/**/*', './src/api/**/*'],
          message:
            'system/log no debe importar desde ui/provider, ui/notifications ni api. Ver Docs/Owners.md.',
        },
        {
          target: './src/engines/**/*',
          from: ['./src/api/**/*'],
          message:
            'engines no debe importar desde api (evitar ciclos). Ver Docs/Owners.md.',
        },
      ],
    },
  ],
};

/** Reglas JSDoc ya activas: requisitos de documentación y checks básicos. */
/** @type {import('eslint').Linter.RulesRecord} */
const jsdocRequirementRules = {
  'jsdoc/require-jsdoc': 'error',
  'jsdoc/require-param': 'error',
  'jsdoc/require-param-type': 'error',
  'jsdoc/require-param-description': 'error',
  'jsdoc/require-returns': 'error',
  'jsdoc/require-returns-type': 'error',
  'jsdoc/require-returns-description': 'error',
  'jsdoc/require-description': 'error',
  'jsdoc/require-description-complete-sentence': 'error',
  'jsdoc/require-property': 'error',
  'jsdoc/require-property-type': 'error',
  'jsdoc/require-property-description': 'error',
  'jsdoc/require-throws-description': 'error',
};

/**
 * Primera tanda: coherencia código↔JSDoc y validación (preset jsdoc/recommended, fase 1).
 * @type {import('eslint').Linter.RulesRecord}
 */
const jsdocCoherenceRules = {
  'jsdoc/require-returns-check': 'error',
  'jsdoc/valid-types': 'error',
  'jsdoc/require-param-name': 'error',
  'jsdoc/empty-tags': 'error',
  'jsdoc/check-property-names': 'error',
  'jsdoc/require-property-name': 'error',
  'jsdoc/require-throws-type': 'error',
  'jsdoc/check-access': 'error',
  'jsdoc/check-values': 'error',
  'jsdoc/escape-inline-tags': 'error',
  'jsdoc/multiline-blocks': 'error',
  'jsdoc/no-defaults': 'error',
  'jsdoc/no-multi-asterisks': 'error',
  'jsdoc/tag-lines': 'error',
  'jsdoc/ts-no-empty-object-type': 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const jsdocQualityRules = {
  'jsdoc/check-syntax': 'error',
  'jsdoc/check-types': 'error',
  'jsdoc/no-blank-blocks': 'error',
  'jsdoc/no-blank-block-descriptions': 'error',
  'jsdoc/check-alignment': 'error',
  'jsdoc/check-param-names': 'error',
  'jsdoc/check-tag-names': 'error',
  'jsdoc/no-undefined-types': 'error',
};

/**
 * Segunda tanda JSDoc: preset recommended restante (fase 2).
 * @type {import('eslint').Linter.RulesRecord}
 */
const jsdocPhase2Rules = {
  'jsdoc/require-throws': 'error',
  'jsdoc/reject-any-type': 'error',
  'jsdoc/reject-function-type': 'error',
  'jsdoc/implements-on-classes': 'error',
  'jsdoc/require-yields': 'error',
  'jsdoc/require-yields-check': 'error',
  'jsdoc/require-yields-type': 'error',
};

/**
 * Tercera tanda JSDoc: documentación de archivo y calidad narrativa.
 * @type {import('eslint').Linter.RulesRecord}
 */
const jsdocPhase3Rules = {
  'jsdoc/require-file-overview': 'error',
  'jsdoc/informative-docs': 'error',
};

const sharedRules = {
  ...coreRules,
  ...typescriptRules,
  ...typescriptRecommendedRules,
  ...reactRules,
  ...importRules,
  ...jsdocRequirementRules,
  ...jsdocCoherenceRules,
  ...jsdocQualityRules,
  ...jsdocPhase2Rules,
  ...jsdocPhase3Rules,
};

const typeAwareRules = {
  ...sharedRules,
  ...typescriptTypeAwareRules,
  ...typescriptStrictTypeAwareRules,
};

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      'out/**',
      '.vscode-test/**',
      '.vscode-test-profile/**',
      'src/ui/webview/dist/**',
      '**/*.vsix',
    ],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ignores: ['src/ui/webview/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.eslint.json',
        tsconfigRootDir,
      },
    },
    plugins,
    settings: {
      ...baseSettings,
      'import/resolver': extensionImportResolver,
    },
    rules: typeAwareRules,
  },
  {
    files: ['src/ui/webview/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './src/ui/webview/tsconfig.eslint.json',
        tsconfigRootDir,
      },
    },
    plugins,
    settings: {
      ...baseSettings,
      'import/resolver': webviewImportResolver,
    },
    rules: typeAwareRules,
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
      },
    },
    plugins,
    settings: {
      ...baseSettings,
      'import/resolver': { node: nodeImportResolver },
    },
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

const path = require('path');

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const unicornPlugin = require('eslint-plugin-unicorn').default;

const { buildAllRulesOffInventory } = require('./eslint/rule-inventory');
const { sharedActiveRules, typeAwareActiveRules } = require('./eslint/active-rules');

const tsconfigRootDir = __dirname;

const pluginBundle = {
  typescriptEslint: tsPlugin,
  import: importPlugin,
  jsdoc: jsdocPlugin,
  reactHooks: reactHooksPlugin,
  unicorn: unicornPlugin,
};

const allRulesOff = buildAllRulesOffInventory(pluginBundle);

const plugins = {
  '@typescript-eslint': tsPlugin,
  import: importPlugin,
  'react-hooks': reactHooksPlugin,
  jsdoc: jsdocPlugin,
  unicorn: unicornPlugin,
};

const nodeImportResolver = {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
};

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

/**
 * Inventario completo en `off` + reglas activas del proyecto (mismo merge en CLI y VS Code).
 * @param {import('eslint').Linter.RulesRecord} active
 * @returns {import('eslint').Linter.RulesRecord}
 */
function mergeLintRules(active) {
  return {
    ...allRulesOff,
    ...active,
  };
}

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      'out/**',
      '.eslintcache',
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
    rules: mergeLintRules(typeAwareActiveRules),
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
    rules: mergeLintRules(typeAwareActiveRules),
  },
  {
    files: ['src/ui/webview/react/types.ts'],
    rules: {
      'vars-on-top': 'off',
    },
  },
  {
    files: ['src/ui/webview/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vscode',
              message: 'El sandbox webview no importa la API de VS Code.',
            },
          ],
          patterns: [
            {
              group: ['**/out/**'],
              message: 'Importar desde src/; out/ es artefacto compilado.',
            },
            {
              group: ['**/src/ui/webview/dist/**'],
              message: 'No importar el bundle del webview como módulo.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/webview/react/components/GhostToolbarPanels.tsx'],
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.vscode.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'init-declarations': 'off',
      'no-useless-return': 'off',
      'no-promise-executor-return': 'off',
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
    rules: mergeLintRules({
      ...sharedActiveRules,
      '@typescript-eslint/no-require-imports': 'off',
      'no-implicit-globals': 'off',
      'no-promise-executor-return': 'off',
    }),
  },
];

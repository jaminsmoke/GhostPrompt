/**
 * @file Reglas ESLint activas del proyecto (sobre el inventario `off` de `rule-inventory.js`).
 *
 * Activación incremental sugerida:
 * 1. Subir un grupo a `warn` → corregir → `error`.
 * 2. Grupos: `coreExtendedRules` → … → `coreRemainingRules` → `unicornRules` → …
 */
const js = require('@eslint/js');
const { builtinRules } = require('eslint/use-at-your-own-risk');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const unicornPlugin = require('eslint-plugin-unicorn').default;

/** Reglas que TypeScript o @typescript-eslint ya cubren (no duplicar). */
const CORE_EXTENDED_SKIP = new Set(['no-unused-vars', 'no-undef', 'no-redeclare']);

/** Core duplicado por presets TS o unicorn ya activos. */
const CORE_PERMANENT_SKIP = new Set([
  ...CORE_EXTENDED_SKIP,
  'no-array-constructor',
  'no-unused-expressions',
  'no-nested-ternary',
  'dot-notation',
  'require-await',
  'no-return-await',
  'prefer-promise-reject-errors',
  'newline-after-var',
  'newline-before-return',
  'indent-legacy',
  'no-buffer-constructor',
  'no-catch-shadow',
  'no-native-reassign',
  'no-negated-in-lhs',
]);

/** Límites, estilo opinado o migración masiva — tranche core 11+. */
const CORE_DEFERRED_SKIP = new Set([
  'no-restricted-imports',
  'no-restricted-globals',
  'no-restricted-properties',
  'no-restricted-syntax',
  'no-restricted-modules',
  'no-restricted-exports',
  'id-match',
  'id-blacklist',
  'id-denylist',
  'camelcase',
  'one-var',
  'no-shadow',
  'no-use-before-define',
  'no-ternary',
]);

/** Formato/espaciado (Prettier/convención del repo no las fija aún). */
const CORE_STYLE_RULE =
  /^(accessor-pairs|array-bracket|array-element|arrow-|block-spacing|brace-style|comma-|computed-property|dot-location|eol-last|func-call-spacing|func-style|function-call|function-paren|generator-star|implicit-arrow|indent|jsx-quotes|key-spacing|keyword-spacing|line-comment|linebreak|lines-around|lines-between|multiline-|new-parens|newline-|no-mixed-spaces|no-multi-spaces|no-multiple-empty|no-spaced-func|no-tabs|no-trailing|no-whitespace-before-property|nonblock-statement|object-curly|object-property-newline|operator-linebreak|padded-blocks|padding-line|quote-props|quotes|rest-spread|semi-spacing|semi-style|sort-imports|sort-keys|sort-vars|space-|spaced-comment|switch-colon|template-curly|template-tag|unicode-bom|wrap-|yield-star)/;

/**
 * @returns {Set<string>}
 */
function collectActiveCoreRuleNames() {
  const active = new Set();
  for (const ruleName of Object.keys(coreExtendedRules)) {
    active.add(ruleName);
  }
  for (const ruleName of Object.keys(coreRules)) {
    active.add(ruleName);
  }
  return active;
}

/**
 * Grupo 10 — resto de reglas core ESLint (sin formato, duplicados TS ni diferidas).
 * @returns {import('eslint').Linter.RulesRecord}
 */
function mergeRemainingCoreRules() {
  const active = collectActiveCoreRuleNames();
  const skip = new Set([...CORE_PERMANENT_SKIP, ...CORE_DEFERRED_SKIP]);
  /** @type {import('eslint').Linter.RulesRecord} */
  const picked = {};
  for (const ruleName of builtinRules.keys()) {
    if (
      active.has(ruleName) ||
      skip.has(ruleName) ||
      CORE_STYLE_RULE.test(ruleName)
    ) {
      continue;
    }
    active.add(ruleName);
    picked[ruleName] = 'error';
  }
  return picked;
}

/**
 * Grupo 1 — ESLint `recommended` (solo core), sin duplicar TS.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreExtendedRules = Object.fromEntries(
  Object.keys(js.configs.recommended.rules)
    .filter((name) => !CORE_EXTENDED_SKIP.has(name))
    .map((name) => [name, 'error']),
);

/** @type {import('eslint').Linter.RulesRecord} */
const coreRules = {
  curly: 'error',
  eqeqeq: 'error',
  'new-cap': ['error', { capIsNew: false }],
  'no-throw-literal': 'error',
  'require-unicode-regexp': 'error',
  'no-void': 'error',
  semi: 'error',
};

/**
 * Grupo 10 — reglas builtin restantes (ver `mergeRemainingCoreRules`).
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreRemainingRules = mergeRemainingCoreRules();

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
    { selector: 'variable', format: null, filter: { regex: '^__', match: true } },
    {
      selector: 'objectLiteralProperty',
      format: ['camelCase', 'PascalCase', 'snake_case'],
    },
    { selector: 'objectLiteralProperty', format: null, modifiers: ['requiresQuotes'] },
    { selector: 'import', format: ['camelCase', 'PascalCase'] },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'error',
};

/** Preset recommended (sin type-aware). */
/** @type {import('eslint').Linter.RulesRecord} */
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

/** Requieren `parserOptions.project`. */
/** @type {import('eslint').Linter.RulesRecord} */
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

/** strict-type-checked (type-aware). */
/** @type {import('eslint').Linter.RulesRecord} */
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

/**
 * Reglas @typescript-eslint que no activaremos (tipos explícitos opcionales, migraciones masivas).
 * El resto del plugin se irá subiendo por tranches hasta cubrir el inventario.
 */
const TYPESCRIPT_PERMANENT_SKIP = new Set([
  'consistent-type-definitions',
  'explicit-function-return-type',
  'explicit-module-boundary-types',
  'typedef',
]);

/** Ruido alto o requiere configuración de proyecto — tranche 8+. */
const TYPESCRIPT_DEFERRED_SKIP = new Set([
  'class-methods-use-this',
  'consistent-return',
  'default-param-last',
  'explicit-member-accessibility',
  'init-declarations',
  'max-params',
  'member-ordering',
  'no-dupe-class-members',
  'no-invalid-this',
  'no-loop-func',
  'no-magic-numbers',
  'no-redeclare',
  'no-restricted-imports',
  'no-restricted-types',
  'no-type-alias',
  'no-unnecessary-parameter-property-assignment',
  'parameter-properties',
  'prefer-destructuring',
  'prefer-readonly',
  'prefer-readonly-parameter-types',
  'prefer-ts-expect-error',
  'promise-function-async',
  'strict-boolean-expressions',
  'strict-void-return',
  // Tranche dedicada: muchos casts en tests y límites con `unknown`.
  'no-unsafe-type-assertion',
  'sort-type-constituents',
  'method-signature-style',
  // No cuenta usos `instance._private` desde métodos estáticos.
  'no-unused-private-class-members',
]);

/**
 * Reglas @typescript-eslint ya activas (nombre sin prefijo).
 * @param {readonly import('eslint').Linter.RulesRecord[]} [extraRecords]
 * @returns {Set<string>}
 */
function collectActiveTypescriptRuleNames(...extraRecords) {
  const bare = new Set();
  const records = [
    typescriptRules,
    typescriptRecommendedRules,
    typescriptTypeAwareRules,
    typescriptStrictTypeAwareRules,
    ...extraRecords,
  ];
  for (const record of records) {
    for (const ruleName of Object.keys(record)) {
      if (ruleName.startsWith('@typescript-eslint/')) {
        bare.add(ruleName.replace('@typescript-eslint/', ''));
      }
    }
  }
  return bare;
}

/**
 * @param {string} presetName
 * @returns {import('eslint').Linter.RulesRecord}
 */
function collectPresetRules(presetName) {
  /** @type {import('eslint').Linter.RulesRecord} */
  const merged = {};
  const walk = (config) => {
    if (Array.isArray(config)) {
      config.forEach(walk);
    } else if (config?.rules) {
      Object.assign(merged, config.rules);
    }
  };
  walk(tsPlugin.configs[presetName]);
  return merged;
}

/**
 * @param {readonly string[]} presetNames
 * @param {Set<string>} activeBare
 * @param {ReadonlySet<string>} skip
 * @returns {import('eslint').Linter.RulesRecord}
 */
function mergeNewTypescriptPresetRules(presetNames, activeBare, skip) {
  /** @type {import('eslint').Linter.RulesRecord} */
  const picked = {};
  for (const presetName of presetNames) {
    const presetRules = collectPresetRules(presetName);
    for (const [ruleName, ruleConfig] of Object.entries(presetRules)) {
      if (!ruleName.startsWith('@typescript-eslint/')) {
        continue;
      }
      const bare = ruleName.replace('@typescript-eslint/', '');
      if (activeBare.has(bare) || skip.has(bare)) {
        continue;
      }
      activeBare.add(bare);
      picked[ruleName] = ruleConfig;
    }
  }
  return picked;
}

const activeTypescriptForGroup3 = collectActiveTypescriptRuleNames();

/**
 * Grupo 3 — `@typescript-eslint` stylistic + recommended (sin type-aware extra).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptStylisticRules = mergeNewTypescriptPresetRules(
  ['flat/stylistic', 'flat/recommended'],
  activeTypescriptForGroup3,
  TYPESCRIPT_PERMANENT_SKIP,
);

/**
 * Grupo 3 — reglas stylistic que requieren type-checking.
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptStylisticTypeAwareRules = mergeNewTypescriptPresetRules(
  ['flat/stylistic-type-checked'],
  activeTypescriptForGroup3,
  TYPESCRIPT_PERMANENT_SKIP,
);

/**
 * Reglas core en `off` del preset cuando la variante `@typescript-eslint/*` está activa.
 * @param {string} presetName
 * @param {import('eslint').Linter.RulesRecord} activatedTsRules
 * @returns {import('eslint').Linter.RulesRecord}
 */
function collectTypescriptPresetCompanionRules(presetName, activatedTsRules) {
  /** @type {import('eslint').Linter.RulesRecord} */
  const companions = {};
  const presetRules = collectPresetRules(presetName);
  for (const [ruleName, severity] of Object.entries(presetRules)) {
    if (ruleName.startsWith('@typescript-eslint/') || severity !== 'off') {
      continue;
    }
    const tsRuleName = `@typescript-eslint/${ruleName}`;
    if (activatedTsRules[tsRuleName] || activatedTsRules[ruleName]) {
      companions[ruleName] = 'off';
    }
  }
  return companions;
}

/** Desactiva reglas core duplicadas por presets TS (p. ej. `dot-notation`). */
/** @type {import('eslint').Linter.RulesRecord} */
const typescriptStylisticCompanionRules = {
  ...collectTypescriptPresetCompanionRules('flat/stylistic', typescriptStylisticRules),
  ...collectTypescriptPresetCompanionRules('flat/stylistic-type-checked', {
    ...typescriptStylisticRules,
    ...typescriptStylisticTypeAwareRules,
  }),
};

const activeTypescriptForGroup4 = collectActiveTypescriptRuleNames(
  typescriptStylisticRules,
  typescriptStylisticTypeAwareRules,
);

/**
 * Grupo 4 — `@typescript-eslint` `recommended-type-checked`.
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptRecommendedTypeCheckedRules = mergeNewTypescriptPresetRules(
  ['flat/recommended-type-checked'],
  activeTypescriptForGroup4,
  TYPESCRIPT_PERMANENT_SKIP,
);

/** @type {import('eslint').Linter.RulesRecord} */
const typescriptRecommendedTypeCheckedCompanionRules = collectTypescriptPresetCompanionRules(
  'flat/recommended-type-checked',
  typescriptRecommendedTypeCheckedRules,
);

const activeTypescriptForGroup5 = collectActiveTypescriptRuleNames(
  typescriptStylisticRules,
  typescriptStylisticTypeAwareRules,
  typescriptRecommendedTypeCheckedRules,
);

/**
 * Grupo 5 — resto de `@typescript-eslint` `strict-type-checked` (tranche extendida).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptStrictTypeCheckedExtendedRules = mergeNewTypescriptPresetRules(
  ['flat/strict-type-checked'],
  activeTypescriptForGroup5,
  TYPESCRIPT_PERMANENT_SKIP,
);

/** @type {import('eslint').Linter.RulesRecord} */
const typescriptStrictTypeCheckedCompanionRules = collectTypescriptPresetCompanionRules(
  'flat/strict-type-checked',
  typescriptStrictTypeCheckedExtendedRules,
);

/**
 * @param {string} bareRuleName
 * @returns {import('eslint').Linter.RulesRecord[string]}
 */
function typescriptRuleSeverity(bareRuleName) {
  const fromAll = collectPresetRules('flat/all')[`@typescript-eslint/${bareRuleName}`];
  return fromAll ?? 'error';
}

/**
 * @param {Set<string>} activeBare
 * @param {ReadonlySet<string>} skip
 * @returns {import('eslint').Linter.RulesRecord}
 */
function mergeRemainingTypescriptPluginRules(activeBare, skip) {
  /** @type {import('eslint').Linter.RulesRecord} */
  const picked = {};
  for (const bareRuleName of Object.keys(tsPlugin.rules)) {
    if (activeBare.has(bareRuleName) || skip.has(bareRuleName)) {
      continue;
    }
    activeBare.add(bareRuleName);
    picked[`@typescript-eslint/${bareRuleName}`] = typescriptRuleSeverity(bareRuleName);
  }
  return picked;
}

const activeTypescriptForGroup7 = collectActiveTypescriptRuleNames(
  typescriptStylisticRules,
  typescriptStylisticTypeAwareRules,
  typescriptRecommendedTypeCheckedRules,
  typescriptStrictTypeCheckedExtendedRules,
);

/**
 * Grupo 7 — resto del plugin `@typescript-eslint` (sin reglas permanentes ni diferidas).
 * @type {import('eslint').Linter.RulesRecord}
 */
const typescriptRemainingRules = mergeRemainingTypescriptPluginRules(
  activeTypescriptForGroup7,
  new Set([...TYPESCRIPT_PERMANENT_SKIP, ...TYPESCRIPT_DEFERRED_SKIP]),
);

/** @type {import('eslint').Linter.RulesRecord} */
const reactRules = {
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
};

/** Reglas `import/*` que no encajan con extensión VS Code, tests o convenciones del repo. */
const IMPORT_PERMANENT_SKIP = new Set([
  'no-commonjs',
  'no-amd',
  'no-dynamic-require',
  'prefer-default-export',
  'no-default-export',
  'no-named-export',
  'no-unused-modules',
  'no-nodejs-modules',
  'no-webpack-loader-syntax',
  'dynamic-import-chunkname',
  'no-import-module-exports',
  'imports-first',
  'no-relative-parent-imports',
  'group-exports',
  'exports-last',
  'first',
  'max-dependencies',
  'unambiguous',
  'no-internal-modules',
  'no-relative-packages',
  'extensions',
  'enforce-node-protocol-usage',
  'consistent-type-specifier-style',
  // Patrón estándar VS Code: `import * as vscode from 'vscode'`.
  'no-namespace',
]);

/**
 * @returns {import('eslint').Linter.RulesRecord}
 */
function mergeRemainingImportPluginRules() {
  const activeBare = new Set(['no-duplicates', 'no-cycle', 'order', 'no-restricted-paths']);
  /** @type {import('eslint').Linter.RulesRecord} */
  const picked = {};
  for (const bareRuleName of Object.keys(importPlugin.rules)) {
    if (activeBare.has(bareRuleName) || IMPORT_PERMANENT_SKIP.has(bareRuleName)) {
      continue;
    }
    picked[`import/${bareRuleName}`] = 'error';
  }
  return picked;
}

/** Configuración explícita del proyecto (sobre el merge genérico). */
/** @type {import('eslint').Linter.RulesRecord} */
const importRulesCore = {
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
          message: 'engines no debe importar desde api (evitar ciclos). Ver Docs/Owners.md.',
        },
      ],
    },
  ],
  'import/no-unresolved': ['error', { ignore: ['^vscode$'] }],
  'import/no-extraneous-dependencies': [
    'error',
    {
      devDependencies: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.vscode.test.ts',
        'eslint.config.js',
        'vite.config.ts',
        'eslint/**',
        'tests/**',
        'src/ui/webview/**',
      ],
      optionalDependencies: false,
      peerDependencies: true,
      includeTypes: false,
    },
  ],
  'import/no-unassigned-import': [
    'error',
    {
      allow: ['**/*.css', '**/destinations/**'],
    },
  ],
};

/**
 * Grupo 8 — resto de `eslint-plugin-import` (sin reglas en `IMPORT_PERMANENT_SKIP`).
 * @type {import('eslint').Linter.RulesRecord}
 */
const importExtendedRules = mergeRemainingImportPluginRules();

/** @type {import('eslint').Linter.RulesRecord} */
const importRules = {
  ...importExtendedRules,
  ...importRulesCore,
};

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

/** @type {import('eslint').Linter.RulesRecord} */
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

/** @type {import('eslint').Linter.RulesRecord} */
const jsdocPhase2Rules = {
  'jsdoc/require-throws': 'error',
  'jsdoc/reject-any-type': 'error',
  'jsdoc/reject-function-type': 'error',
  'jsdoc/implements-on-classes': 'error',
  'jsdoc/require-yields': 'error',
  'jsdoc/require-yields-check': 'error',
  'jsdoc/require-yields-type': 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const jsdocPhase3Rules = {
  'jsdoc/require-file-overview': 'error',
  'jsdoc/informative-docs': 'error',
};

/** Ejemplos/plantillas opcionales, reglas con opciones obligatorias o choque con `require-*-type`. */
const JSDOC_PERMANENT_SKIP = new Set([
  'require-example',
  'check-examples',
  'require-template',
  'require-template-description',
  'check-template-names',
  'convert-to-jsdoc-comments',
  'no-types',
  'match-name',
  'no-restricted-syntax',
  'require-tags',
  'no-missing-syntax',
  'require-rejects',
  'sort-tags',
  'imports-as-dependencies',
  'ts-method-signature-style',
  'ts-prefer-function-type',
  'ts-no-unnecessary-template-expression',
  'type-formatting',
  'prefer-import-tag',
  'require-next-description',
  'require-next-type',
  'match-description',
]);

/**
 * Grupo 9 — `eslint-plugin-jsdoc` (tranche sin opciones obligatorias ni conflicto con tipos).
 * @type {import('eslint').Linter.RulesRecord}
 */
const jsdocExtendedRules = {
  'jsdoc/no-bad-blocks': 'error',
  'jsdoc/require-asterisk-prefix': 'error',
  'jsdoc/require-hyphen-before-param-description': 'error',
  'jsdoc/require-yields-description': 'error',
  'jsdoc/lines-before-block': 'error',
  'jsdoc/check-indentation': 'error',
  'jsdoc/check-line-alignment': 'error',
  'jsdoc/text-escaping': ['error', { escapeHTML: true }],
};

/** No activar: API VS Code, CJS de extensión/e2e, o migración masiva pendiente. */
const UNICORN_PERMANENT_SKIP = new Set([
  // VS Code webview API no usa targetOrigin en postMessage.
  'require-post-message-target-origin',
  // Scripts CLI / e2e (process.exit y CJS main son válidos aquí).
  'no-process-exit',
  'prefer-top-level-await',
  // Salida compilada de la extensión es CommonJS (`out/extension/extension.js`).
  'prefer-module',
]);

const UNICORN_ALL_SKIP = UNICORN_PERMANENT_SKIP;

/**
 * Normaliza el nombre de regla unicorn para flat config.
 * @param {string} ruleName
 * @returns {string}
 */
function normalizeUnicornRuleName(ruleName) {
  return ruleName.startsWith('unicorn/') ? ruleName : `unicorn/${ruleName}`;
}

/**
 * Grupo 2–6 — unicorn `flat/recommended` + reglas extra no incluidas en el preset.
 * @type {import('eslint').Linter.RulesRecord}
 */
const unicornRules = {
  ...Object.fromEntries(
    Object.entries(unicornPlugin.configs['flat/recommended'].rules)
      .filter(([name]) => {
        const bare = name.replace(/^unicorn\//, '');
        return !UNICORN_ALL_SKIP.has(bare);
      })
      .map(([name]) => [normalizeUnicornRuleName(name), 'error']),
  ),
  'unicorn/no-instanceof-array': 'error',
  'unicorn/no-length-as-slice-end': 'error',
  'unicorn/no-array-push-push': 'error',
};

/**
 * Grupo 14 — core diferidas (tranche 1): calidad de flujo y salida a consola.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche1Rules = {
  'no-console': 'error',
  'no-warning-comments': 'error',
  'no-else-return': 'error',
  'require-atomic-updates': 'error',
};

/**
 * Grupo 15 — core diferidas (tranche 2): flujo de retorno y mutación de parámetros.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche2Rules = {
  'consistent-return': 'error',
  'no-negated-condition': 'error',
  'no-param-reassign': [
    'error',
    {
      props: true,
      ignorePropertyModificationsFor: ['ref', 'refs', 'webview', 'webviewView'],
    },
  ],
};

/**
 * Grupo 16 — core diferidas (tranche 3): const, parámetros por defecto y bucles.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche3Rules = {
  'prefer-const': 'error',
  'no-var': 'error',
  'default-param-last': 'error',
  'no-continue': 'error',
  'no-await-in-loop': 'error',
};

/**
 * Grupo 17 — core diferidas (tranche 4): complejidad, profundidad y números mágicos.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche4Rules = {
  complexity: ['error', { max: 20 }],
  'max-depth': ['error', 4],
  'max-params': ['error', 6],
  'max-nested-callbacks': ['error', 4],
  'max-statements': ['error', 35],
  'no-magic-numbers': [
    'error',
    {
      ignore: [-1, 0, 1, 2, 10, 100, 1000],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true,
      detectObjects: false,
    },
  ],
};

/**
 * Grupo 18 — core diferidas (tranche 5): longitud de línea y tamaño de fichero/función.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche5Rules = {
  'max-len': [
    'error',
    {
      code: 120,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    },
  ],
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': [
    'error',
    { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  'max-statements-per-line': ['error', { max: 1 }],
  'max-classes-per-file': ['error', 1],
};

/**
 * Grupo 19 — core diferidas (tranche 6): funciones vacías, undefined, yoda, destructuring.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche6Rules = {
  'no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
  'no-undefined': 'error',
  yoda: 'error',
  'prefer-destructuring': ['error', { object: true, array: false }],
  'one-var-declaration-per-line': 'error',
  'no-plusplus': 'error',
};

/**
 * Grupo 20 — core diferidas (tranche 7): nombres de funciones, capturas regex y constructores.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche7Rules = {
  'func-names': ['error', 'as-needed', { generators: 'as-needed' }],
  'prefer-named-capture-group': 'error',
  'new-cap': [
    'error',
    {
      newIsCap: true,
      capIsNewExceptions: [
        'Error',
        'Promise',
        'Array',
        'Map',
        'Set',
        'WeakMap',
        'WeakSet',
        'User',
      ],
    },
  ],
  'one-var': ['error', 'never'],
  'no-underscore-dangle': [
    'error',
    {
      allow: ['__ghostPromptViewId', '__ghostPromptCapabilities'],
      allowAfterThis: true,
      allowAfterSuper: true,
      allowFunctionParams: true,
      enforceInMethodNames: true,
    },
  ],
};

/**
 * Grupo 21 — core diferidas (tranche 8): hoisting de `var`, callbacks Node y sombras TS.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche8Rules = {
  'vars-on-top': 'error',
  'handle-callback-err': 'error',
  '@typescript-eslint/no-shadow': [
    'error',
    {
      ignoreFunctionTypeParameterNameValueShadow: true,
      ignoreTypeValueShadow: true,
    },
  ],
  '@typescript-eslint/no-use-before-define': [
    'error',
    {
      allowNamedExports: false,
      classes: false,
      enums: true,
      functions: false,
      typedefs: true,
      variables: true,
    },
  ],
};

/**
 * Grupo 22 — core diferidas (tranche 9): CommonJS, `strict` y callbacks Node.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche9Rules = {
  'callback-return': 'error',
  'prefer-reflect': 'error',
  'global-require': 'error',
  'no-new-require': 'error',
  'no-mixed-requires': 'error',
  strict: ['error', 'never'],
  'no-process-exit': 'error',
};

/**
 * Grupo 23 — core diferidas (tranche 10): inicialización, métodos de clase y callbacks Node.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche10Rules = {
  'handle-callback-err': 'error',
  'init-declarations': ['error', 'always'],
  'class-methods-use-this': [
    'error',
    {
      exceptMethods: [
        'cancel',
        'componentDidCatch',
        'dispose',
        'formatLine',
        'touchConfig',
        'webviewCapabilitiesPayload',
        'ps',
      ],
    },
  ],
};

/**
 * Grupo 24 — core diferidas (tranche 11): `process.env`, longitud de identificadores y I/O síncrono.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche11Rules = {
  'no-process-env': 'error',
  'id-length': [
    'error',
    {
      min: 2,
      exceptions: ['_', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
      properties: 'never',
    },
  ],
  'no-sync': 'error',
};

/**
 * Grupo 25 — core diferidas (tranche 12): comentarios en línea y mayúscula inicial.
 * @type {import('eslint').Linter.RulesRecord}
 */
const coreDeferredTranche12Rules = {
  'no-inline-comments': 'error',
  'capitalized-comments': ['error', 'always'],
};

/**
 * Grupo 13 — unicorn tranche 3 (antes en `UNICORN_PERMANENT_SKIP`).
 * @type {import('eslint').Linter.RulesRecord}
 */
const unicornTranche3Rules = {
  'unicorn/no-null': 'error',
  'unicorn/filename-case': [
    'error',
    {
      cases: {
        camelCase: true,
        pascalCase: true,
      },
      ignore: [/\.test\.[jt]sx?$/u, /\.vscode\.test\.[jt]s$/u],
    },
  ],
  'unicorn/prevent-abbreviations': [
    'error',
    {
      allowList: {
        acc: true,
        args: true,
        arr: true,
        attr: true,
        attrs: true,
        btn: true,
        cfg: true,
        ctx: true,
        dest: true,
        dir: true,
        e: true,
        el: true,
        elem: true,
        env: true,
        err: true,
        fn: true,
        idx: true,
        len: true,
        msg: true,
        num: true,
        obj: true,
        param: true,
        params: true,
        prev: true,
        prop: true,
        props: true,
        ref: true,
        refs: true,
        req: true,
        res: true,
        src: true,
        str: true,
        temp: true,
        tmp: true,
        val: true,
        vars: true,
      },
      checkDefaultAndNamespaceImports: false,
      checkShorthandImports: false,
    },
  ],
  'unicorn/import-style': [
    'error',
    {
      extendDefaultStyles: true,
      styles: {
        vscode: {
          namespace: true,
        },
        vitest: {
          namespace: true,
          named: true,
        },
        '@testing-library/react': {
          namespace: true,
        },
        'node:path': {
          named: true,
        },
      },
    },
  ],
};

const sharedActiveRules = {
  ...coreExtendedRules,
  ...coreRules,
  ...coreRemainingRules,
  ...coreDeferredTranche1Rules,
  ...coreDeferredTranche2Rules,
  ...coreDeferredTranche3Rules,
  ...coreDeferredTranche4Rules,
  ...coreDeferredTranche5Rules,
  ...coreDeferredTranche6Rules,
  ...coreDeferredTranche7Rules,
  ...coreDeferredTranche8Rules,
  ...coreDeferredTranche9Rules,
  ...coreDeferredTranche10Rules,
  ...coreDeferredTranche11Rules,
  ...coreDeferredTranche12Rules,
  ...typescriptStylisticCompanionRules,
  ...typescriptRecommendedTypeCheckedCompanionRules,
  ...typescriptStrictTypeCheckedCompanionRules,
  ...typescriptStylisticRules,
  ...typescriptRules,
  ...typescriptRecommendedRules,
  ...reactRules,
  ...importRules,
  ...jsdocExtendedRules,
  ...jsdocRequirementRules,
  ...jsdocCoherenceRules,
  ...jsdocQualityRules,
  ...jsdocPhase2Rules,
  ...jsdocPhase3Rules,
  ...unicornRules,
  ...unicornTranche3Rules,
};

const typeAwareActiveRules = {
  ...sharedActiveRules,
  ...typescriptStylisticTypeAwareRules,
  ...typescriptRecommendedTypeCheckedRules,
  ...typescriptStrictTypeCheckedExtendedRules,
  ...typescriptRemainingRules,
  ...typescriptTypeAwareRules,
  ...typescriptStrictTypeAwareRules,
};

module.exports = {
  coreExtendedRules,
  coreRules,
  coreRemainingRules,
  coreDeferredTranche1Rules,
  coreDeferredTranche2Rules,
  coreDeferredTranche3Rules,
  coreDeferredTranche4Rules,
  coreDeferredTranche5Rules,
  coreDeferredTranche6Rules,
  coreDeferredTranche7Rules,
  coreDeferredTranche8Rules,
  coreDeferredTranche9Rules,
  coreDeferredTranche10Rules,
  coreDeferredTranche11Rules,
  coreDeferredTranche12Rules,
  typescriptRules,
  typescriptRecommendedRules,
  typescriptStylisticRules,
  typescriptStylisticTypeAwareRules,
  typescriptStylisticCompanionRules,
  typescriptRecommendedTypeCheckedRules,
  typescriptRecommendedTypeCheckedCompanionRules,
  typescriptStrictTypeCheckedExtendedRules,
  typescriptStrictTypeCheckedCompanionRules,
  typescriptRemainingRules,
  typescriptTypeAwareRules,
  typescriptStrictTypeAwareRules,
  reactRules,
  importRulesCore,
  importExtendedRules,
  importRules,
  jsdocExtendedRules,
  jsdocRequirementRules,
  jsdocCoherenceRules,
  jsdocQualityRules,
  jsdocPhase2Rules,
  jsdocPhase3Rules,
  unicornRules,
  unicornTranche3Rules,
  sharedActiveRules,
  typeAwareActiveRules,
};

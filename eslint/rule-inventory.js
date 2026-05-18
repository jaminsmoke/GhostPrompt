/**
 * @file Inventario de reglas ESLint: todas las reglas de cada plugin en `off`.
 * Las reglas activas del proyecto viven en `active-rules.js` y las sobreescriben al mergear.
 */
const { builtinRules } = require('eslint/use-at-your-own-risk');

/**
 * Construye un record con todas las claves en `off`.
 * @param {readonly string[]} ruleKeys Nombres de regla (sin prefijo de plugin).
 * @param {string} [prefix] Prefijo `plugin/` (p. ej. `@typescript-eslint`).
 * @returns {import('eslint').Linter.RulesRecord}
 */
function rulesRecordAllOff(ruleKeys, prefix = '') {
  /** @type {import('eslint').Linter.RulesRecord} */
  const record = {};
  for (const key of ruleKeys) {
    const ruleName = prefix ? `${prefix}/${key}` : key;
    record[ruleName] = 'off';
  }
  return record;
}

/**
 * Reglas core de ESLint (builtin) — todas `off`.
 * @returns {import('eslint').Linter.RulesRecord}
 */
function eslintCoreRulesAllOff() {
  return rulesRecordAllOff([...builtinRules.keys()]);
}

/**
 * Inventario completo: core + plugins instalados, todo en `off`.
 * @param {object} plugins Plugins registrados en flat config.
 * @param {import('@typescript-eslint/eslint-plugin').default} plugins.typescriptEslint
 * @param {import('eslint-plugin-import').default} plugins.import
 * @param {import('eslint-plugin-jsdoc').default} plugins.jsdoc
 * @param {import('eslint-plugin-react-hooks').default} plugins.reactHooks
 * @param {import('eslint-plugin-unicorn').default} plugins.unicorn
 * @returns {import('eslint').Linter.RulesRecord}
 */
function buildAllRulesOffInventory(plugins) {
  return {
    ...eslintCoreRulesAllOff(),
    ...rulesRecordAllOff(Object.keys(plugins.typescriptEslint.rules), '@typescript-eslint'),
    ...rulesRecordAllOff(Object.keys(plugins.import.rules), 'import'),
    ...rulesRecordAllOff(Object.keys(plugins.jsdoc.rules), 'jsdoc'),
    ...rulesRecordAllOff(Object.keys(plugins.reactHooks.rules), 'react-hooks'),
    ...(plugins.unicorn?.rules
      ? rulesRecordAllOff(Object.keys(plugins.unicorn.rules), 'unicorn')
      : {}),
  };
}

module.exports = {
  rulesRecordAllOff,
  eslintCoreRulesAllOff,
  buildAllRulesOffInventory,
};

/**
 * @file Imprime conteos del inventario ESLint (off) vs reglas activas.
 */
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const unicornPlugin = require('eslint-plugin-unicorn').default;

const { buildAllRulesOffInventory, eslintCoreRulesAllOff } = require('./rule-inventory');
const active = require('./active-rules');

const bundle = {
  typescriptEslint: tsPlugin,
  import: importPlugin,
  jsdoc: jsdocPlugin,
  reactHooks: reactHooksPlugin,
  unicorn: unicornPlugin,
};

const inventory = buildAllRulesOffInventory(bundle);
const coreCount = Object.keys(eslintCoreRulesAllOff()).length;

console.log('ESLint rule inventory (all off by default)');
console.log('  eslint core:', coreCount);
console.log('  @typescript-eslint:', Object.keys(tsPlugin.rules).length);
console.log('  import:', Object.keys(importPlugin.rules).length);
console.log('  jsdoc:', Object.keys(jsdocPlugin.rules).length);
console.log('  react-hooks:', Object.keys(reactHooksPlugin.rules).length);
console.log('  unicorn:', Object.keys(unicornPlugin.rules).length);
console.log('  total in merge:', Object.keys(inventory).length);
console.log('Active override keys:', Object.keys(active.typeAwareActiveRules).length);
console.log('  (shared / e2e uses', Object.keys(active.sharedActiveRules).length, 'without type-aware strict)');

/**
 * Migración mecánica para `no-undefined`: sustituye patrones seguros en .ts/.tsx/.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'dist') {
        continue;
      }
      files.push(...walk(full));
      continue;
    }
    if (/\.(?:[cm]?[jt]s|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} source
 * @returns {string}
 */
function transform(source) {
  let next = source;

  next = next.replaceAll(/useRef<([^>]+)>\(\s*undefined\s*\)/gu, 'useRef<$1>()');
  next = next.replaceAll(/useState<([^>]+)>\(\s*undefined\s*\)/gu, 'useState<$1>()');
  next = next.replaceAll(/useState\(\s*undefined\s*\)/gu, 'useState()');

  next = next.replaceAll(
    /(\b(?:private|public|protected)\s+[^=;\n]+)\|\s*undefined\s*=\s*undefined\s*;/gu,
    '$1| undefined;',
  );
  next = next.replaceAll(
    /(\b(?:let|var)\s+[^=;\n]+)\|\s*undefined\s*=\s*undefined\s*;/gu,
    '$1| undefined;',
  );

  next = next.replaceAll(/:\s*undefined\s*=\s*undefined\b/gu, ': undefined');

  next = next.replaceAll(/return\s+undefined\s*;/gu, 'return;');

  // Do not strip `undefined` from call sites — breaks Node callbacks and `new Response(undefined, init)`.

  next = next.replaceAll(/globalValue:\s*undefined/gu, 'globalValue: null');
  next = next.replaceAll(/workspaceValue:\s*undefined/gu, 'workspaceValue: null');
  next = next.replaceAll(/workspaceFolderValue:\s*undefined/gu, 'workspaceFolderValue: null');

  next = next.replaceAll(/getExtension:\s*vi\.fn\(\(\)\s*=>\s*\{\s*return;\s*\}\)/gu, 'getExtension: vi.fn()');

  return next;
}

let changed = 0;
for (const file of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tests'))]) {
  if (file.includes(`${path.sep}ui${path.sep}webview${path.sep}dist${path.sep}`)) {
    continue;
  }
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`Updated ${changed} files`);

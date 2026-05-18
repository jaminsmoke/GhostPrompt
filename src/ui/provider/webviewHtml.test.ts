/**
 * @file Tests de transformación HTML del webview GhostPrompt.
 */
import * as vitest from 'vitest';

import {
  ensureScriptNonces,
  inlineWebviewStylesheets,
  moveExternalScriptsToBodyEnd,
  rewriteGhostPromptWebviewAssetUrls,
  stripWebviewIncompatibleAttributes,
} from './webviewHtmlTransforms';

vitest.describe('webviewHtml transforms', () => {
  vitest.it('elimina crossorigin y type=module', () => {
    const input =
      '<script type="module" crossorigin src="./assets/app.js"></script>' +
      '<link rel="stylesheet" crossorigin href="./assets/app.css">';
    const output = stripWebviewIncompatibleAttributes(input);
    vitest.expect(output).not.toMatch(/\bcrossorigin\b/iu);
    vitest.expect(output).not.toContain('type="module"');
    vitest.expect(output).toContain('src="./assets/app.js"');
  });

  vitest.it('reescribe rutas relativas de assets', () => {
    const html = '<script src="./assets/index.js"></script><link href="./assets/index.css" rel="stylesheet">';
    const out = rewriteGhostPromptWebviewAssetUrls(html, (path) => `https://webview/${path}`);
    vitest.expect(out).toContain('src="https://webview/assets/index.js"');
    vitest.expect(out).toContain('href="https://webview/assets/index.css"');
  });

  vitest.it('mueve scripts con src al final del body', () => {
    const html = `<!doctype html><html><head>
<script src="./assets/index.js"></script>
<link href="./assets/index.css" rel="stylesheet">
</head><body><motion.div id="root"></div></body></html>`;
    const out = moveExternalScriptsToBodyEnd(html);
    const headEnd = out.indexOf('</head>');
    const head = headEnd === -1 ? out : out.slice(0, headEnd);
    vitest.expect(head).not.toMatch(/<script\b[^>]*\bsrc=/iu);
    vitest.expect(out).toMatch(/<body>[\s\S]*id="root"[\s\S]*<script\b[^>]*\bsrc=/iu);
  });

  vitest.it('inline CSS y elimina link stylesheet externo', () => {
    const html = `<!doctype html><html><head>
<link rel="stylesheet" href="./assets/app.css">
</head><body><div id="root"></div></body></html>`;
    const out = inlineWebviewStylesheets(html, ['body{color:red}'], 'nonce1');
    vitest.expect(out).not.toMatch(/<link\b[^>]*stylesheet/iu);
    vitest.expect(out).toContain('<style nonce="nonce1">');
    vitest.expect(out).toContain('body{color:red}');
  });

  vitest.it('mueve script sin type=module (output Vite limpio por stripModuleAttributesPlugin)', () => {
    const viteHtml = `<!doctype html><html><head>
<script src="./assets/index.js"></script>
<link rel="stylesheet" href="./assets/style.css">
</head><body><div id="root"><p id="gp-boot">Cargando</p></div></body></html>`;
    const out = moveExternalScriptsToBodyEnd(viteHtml);
    const headEnd = out.indexOf('</head>');
    const head = out.slice(0, headEnd);
    const body = out.slice(out.indexOf('<body'));
    vitest.expect(head).not.toMatch(/<script\b[^>]*\bsrc=/iu);
    vitest.expect(body).toMatch(/id="root"/u);
    vitest.expect(body).toMatch(/<script\b[^>]*\bsrc=.*index\.js/iu);
  });

  vitest.it('deja script y #root en body como exige el bundle Vite', () => {
    const viteHtml = `<!doctype html><html><head>
<script type="module" crossorigin src="./assets/index.js"></script>
<link rel="stylesheet" crossorigin href="./assets/style.css">
</head><body><div id="root"><p id="gp-boot">Cargando</p></div></body></html>`;
    const out = moveExternalScriptsToBodyEnd(stripWebviewIncompatibleAttributes(viteHtml));
    const headEnd = out.indexOf('</head>');
    const head = out.slice(0, headEnd);
    const body = out.slice(out.indexOf('<body'));
    vitest.expect(head).not.toMatch(/<script\b[^>]*\bsrc=/iu);
    vitest.expect(body).toMatch(/id="root"/u);
    vitest.expect(body).toMatch(/<script\b[^>]*\bsrc=.*index\.js/iu);
  });

  vitest.it('añade nonce a scripts sin nonce', () => {
    const html = '<script src="x"></script><script nonce="keep" src="y"></script>';
    const out = ensureScriptNonces(html, 'abc123');
    vitest.expect(out).toContain('<script nonce="abc123" src="x">');
    vitest.expect(out).toContain('<script nonce="keep" src="y">');
  });
});

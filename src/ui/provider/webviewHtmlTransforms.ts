/**
 * @file Transformaciones puras del HTML del webview (sin dependencia de VS Code).
 */

/**
 * Quita atributos que impiden cargar assets en webviews VS Code/Cursor.
 * @param {string} html - HTML del bundle Vite.
 * @returns {string} HTML compatible con webview.
 */
export function stripWebviewIncompatibleAttributes(html: string): string {
  return html
    .replaceAll(/\s+crossorigin(?:=(?:anonymous|use-credentials|"[^"]*"))?/giu, '')
    .replaceAll(/\stype="module"/giu, '');
}

/**
 * Añade `nonce` a etiquetas &lt;script&gt; que aún no lo tengan.
 * @param {string} html - HTML del webview.
 * @param {string} nonce - Nonce CSP.
 * @returns {string} HTML con nonces en scripts.
 */
export function ensureScriptNonces(html: string, nonce: string): string {
  return html.replaceAll(/<script\b(?![^>]*\bnonce=)/giu, `<script nonce="${nonce}"`);
}

/**
 * Sustituye rutas relativas `./assets/...` por URIs del webview.
 * @param {string} html - HTML con rutas relativas.
 * @param {(relativePath: string) => string} resolveUri - Resolver de URI.
 * @returns {string} HTML con URIs absolutas del webview.
 */
export function rewriteGhostPromptWebviewAssetUrls(
  html: string,
  resolveUri: (relativePath: string) => string,
): string {
  return html.replaceAll(
    /(?<attr>src|href)="(?:\.\/)?(?<relativePath>[^"]+)"/gu,
    (_match: string, attr: string, relativePath: string) => `${attr}="${resolveUri(relativePath)}"`,
  );
}

const EXTERNAL_SCRIPT_TAG_PATTERN = /<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/giu;

/**
 * Mueve scripts con `src` del &lt;head&gt; al final del &lt;body&gt; para que `#root` exista al ejecutarse.
 * @param {string} html - HTML del webview.
 * @returns {string} HTML con bundles al pie del body.
 */
export function moveExternalScriptsToBodyEnd(html: string): string {
  const externalScripts: string[] = [];
  const withoutHeadScripts = html.replaceAll(EXTERNAL_SCRIPT_TAG_PATTERN, (tag) => {
    externalScripts.push(tag);
    return '';
  });
  if (externalScripts.length === 0) {
    return html;
  }
  return withoutHeadScripts.replace('</body>', `  ${externalScripts.join('\n  ')}\n</body>`);
}

const STYLESHEET_LINK_PATTERN =
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']\.\/(?<relativePath>[^"']+)["'][^>]*>/giu;

/**
 * Extrae la ruta relativa del CSS emitido por Vite (`./assets/*.css`).
 * @param {string} html - HTML del bundle.
 * @returns {string | undefined} Ruta relativa o ausente.
 */
export function extractWebviewStylesheetRelativePath(html: string): string | undefined {
  const match = STYLESHEET_LINK_PATTERN.exec(html);
  STYLESHEET_LINK_PATTERN.lastIndex = 0;
  return match?.groups?.relativePath;
}

/**
 * Inline el CSS del webview y elimina &lt;link rel="stylesheet"&gt; externos (fallan a menudo en VSIX).
 * @param {string} html - HTML del webview.
 * @param {readonly string[]} cssContents - Hojas de estilo a inyectar.
 * @param {string} nonce - Nonce CSP.
 * @returns {string} HTML con &lt;style&gt; inline.
 */
export function inlineWebviewStylesheets(
  html: string,
  cssContents: readonly string[],
  nonce: string,
): string {
  const withoutLinks = html.replace(STYLESHEET_LINK_PATTERN, '');
  if (cssContents.length === 0) {
    return withoutLinks;
  }
  const styleTags = cssContents
    .map((css) => `  <style nonce="${nonce}">\n${css}\n  </style>`)
    .join('\n');
  return withoutLinks.replace('</head>', `${styleTags}\n</head>`);
}

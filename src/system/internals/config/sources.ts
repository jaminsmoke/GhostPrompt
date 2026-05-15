import * as vscode from 'vscode';
import type { CompletionSourceId } from '../protocols/routing';

/**
 * Devuelve las fuentes de sugerencia activas según configuración o el modo legacy.
 * @returns {CompletionSourceId[]} Lista de IDs de fuentes habilitadas para completado.
 */
export function getEnabledCompletionSources(): CompletionSourceId[] {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const inspected = cfg.inspect<CompletionSourceId[]>('enabledCompletionSources');

  const explicit =
    inspected?.globalValue !== undefined ||
    inspected?.workspaceValue !== undefined ||
    inspected?.workspaceFolderValue !== undefined;

  if (!explicit) {
    return legacySourcesFromCompletionProvider();
  }

  const normalized = normalizeCompletionSources(cfg.get('enabledCompletionSources'));
  if (normalized.length === 0) {
    return legacySourcesFromCompletionProvider();
  }
  return normalized;
}

/**
 * Mapea la configuración legacy `completionProvider` a las fuentes actuales.
 * @returns {CompletionSourceId[]} Lista de fuentes derivadas de la configuración legacy.
 */
function legacySourcesFromCompletionProvider(): CompletionSourceId[] {
  const v = vscode.workspace
    .getConfiguration('ghostPrompt')
    .get<string>('completionProvider', 'copilot');
  if (v === 'opencode') {
    return ['opencode'];
  }
  if (v === 'ollama') {
    return ['ollama'];
  }
  return ['copilot'];
}

/**
 * Normaliza el valor bruto de `enabledCompletionSources`.
 * @param {unknown} raw Valor sin validar obtenido desde la configuración.
 * @returns {CompletionSourceId[]} Arreglo limpio de IDs de fuentes válidas.
 */
function normalizeCompletionSources(raw: unknown): CompletionSourceId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CompletionSourceId[] = [];
  const seen = new Set<CompletionSourceId>();
  for (const item of raw) {
    if (item === 'copilot' || item === 'opencode' || item === 'ollama') {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}

/**
 * Determina el tipo de UI de completado que debe usar la webview.
 * @returns {'copilot'|'opencode'|'ollama'|'multi'} `multi` si hay varias fuentes habilitadas, de lo contrario la única fuente disponible.
 */
export function getCompletionUiKind(): 'copilot' | 'opencode' | 'ollama' | 'multi' {
  const s = getEnabledCompletionSources();
  if (s.length > 1) {
    return 'multi';
  }
  return s[0];
}

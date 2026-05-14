/**
 * Fuentes de completion habilitadas (`copilot` LM vs OpenCode).
 * Si `enabledCompletionSources` no está definido en ningún scope, se usa el legacy `completionProvider`.
 */
import * as vscode from 'vscode';

export type CompletionSourceId = 'copilot' | 'opencode' | 'ollama';

/**
 * Devuelve las fuentes de sugerencia activas según configuración o el modo legacy.
 * @returns Lista de IDs de fuentes habilitadas para completado.
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
 * @returns Lista de fuentes derivadas de la configuración legacy.
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
 * @param raw Valor sin validar obtenido desde la configuración.
 * @returns Arreglo limpio de IDs de fuentes válidas.
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
 * Elige motor para esta petición según modelo seleccionado y fuentes habilitadas.
 * Con `auto` y varias fuentes, se prefiere Copilot si está habilitado (orden estable).
 * @param id Identificador de modelo seleccionado.
 * @returns True si el ID corresponde a un modelo Ollama.
 */
export function looksLikeOllamaModelId(id: string): boolean {
  return id.includes(':') && !id.includes('/');
}

/**
 * Decide qué fuente de completado usar para una petición dada.
 * @param selectedModelId Modelo seleccionado o `auto`.
 * @param enabledSources Fuentes disponibles en la configuración activa.
 * @returns Fuente de completado que debe atender la petición.
 */
export function resolveCompletionSourceForRequest(
  selectedModelId: string,
  enabledSources: readonly CompletionSourceId[],
): CompletionSourceId {
  if (enabledSources.length === 1) {
    return enabledSources[0];
  }
  if (selectedModelId === 'auto') {
    if (enabledSources.includes('copilot')) {
      return 'copilot';
    }
    if (enabledSources.includes('opencode')) {
      return 'opencode';
    }
    return 'ollama';
  }
  if (enabledSources.includes('ollama') && looksLikeOllamaModelId(selectedModelId)) {
    return 'ollama';
  }
  if (enabledSources.includes('opencode') && looksLikeOpencodeModelId(selectedModelId)) {
    return 'opencode';
  }
  if (enabledSources.includes('copilot')) {
    return 'copilot';
  }
  if (enabledSources.includes('opencode')) {
    return 'opencode';
  }
  return 'ollama';
}

/**
 * Id OpenCode típico: `providerID/modelID` (una barra).
 * @param id Identificador de modelo candidato.
 * @returns True si el ID contiene exactamente una barra y no es un URL con doble slash.
 */
export function looksLikeOpencodeModelId(id: string): boolean {
  const t = id.trim();
  const slash = t.indexOf('/');
  if (slash <= 0 || slash === t.length - 1) {
    return false;
  }
  return !t.includes('//') && t.split('/').length === 2;
}

/**
 * Determina el tipo de UI de completado que debe usar la webview.
 * @returns `multi` si hay varias fuentes habilitadas, de lo contrario la única fuente disponible.
 */
export function getCompletionUiKind(): 'copilot' | 'opencode' | 'ollama' | 'multi' {
  const s = getEnabledCompletionSources();
  if (s.length > 1) {
    return 'multi';
  }
  return s[0];
}

/**
 * @file Lectura de configuración VS Code: fuentes de completado habilitadas.
 */
import * as vscode from 'vscode';

import type { ProviderId } from '../../system/internals/protocols/state/provider';

/**
 * Devuelve las fuentes de sugerencia activas según configuración o el modo legacy.
 * @returns {ProviderId[]} Lista de proveedores LM habilitados.
 */
export function getEnabledCompletionSources(): ProviderId[] {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const inspected = cfg.inspect<ProviderId[]>('enabledCompletionSources');

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
 * @returns {ProviderId[]} Lista de proveedores derivados de la configuración legacy.
 */
function legacySourcesFromCompletionProvider(): ProviderId[] {
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
 * @returns {ProviderId[]} Arreglo limpio de IDs de proveedores válidos.
 */
function normalizeCompletionSources(raw: unknown): ProviderId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ProviderId[] = [];
  const seen = new Set<ProviderId>();
  for (const item of raw) {
    if (!isProviderId(item)) {
      continue;
    }

    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Comprueba si un valor coincide con un ID de fuente de completado válido.
 * @param {unknown} value Valor a validar.
 * @returns {value is ProviderId} True si el valor es un proveedor válido.
 */
function isProviderId(value: unknown): value is ProviderId {
  return value === 'copilot' || value === 'opencode' || value === 'ollama';
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

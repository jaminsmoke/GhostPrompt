/**
 * @file Lectura de configuración VS Code: fuentes de completado habilitadas.
 */

import * as vscode from 'vscode';

import { isProviderId } from '../../system/internals/protocols/guards/guardProviderId';

import type { ProviderId } from '../../system/internals/protocols/state/provider';
import type { CompletionUiKind } from '../../system/internals/protocols/types/typeCompletionUi';

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
 * @param {unknown} raw - Valor sin validar obtenido desde la configuración.
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
 * Determina el tipo de UI de completado que debe usar la webview.
 * @returns {CompletionUiKind} `multi` si hay varias fuentes habilitadas, de lo contrario la única fuente disponible.
 */
export function getCompletionUiKind(): CompletionUiKind {
  const s = getEnabledCompletionSources();
  if (s.length > 1) {
    return 'multi';
  }
  return s[0];
}

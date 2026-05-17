/**
 * @file Catálogo de modelos Ollama para el selector de UI.
 */

import * as vscode from 'vscode';

import { listModels } from '../http/ollamaApiClient';

import { normalizeOllamaModels, ollamaModelToDescriptor } from './normalizeOllamaModels';

import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../../../system/internals/protocols/types';

/**
 * Lista los modelos de Ollama disponibles y los convierte en descriptores.
 * @param {SuggestionModelPolicy} _policy - Política de modelo solicitada (actualmente no usada para Ollama).
 * @returns {Promise<SuggestionModelDescriptor[]>} Lista de descriptores de modelos Ollama.
 */
export async function listOllamaSuggestionModels(
  _policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const cfg = vscode.workspace.getConfiguration('ghostPrompt');
  const excluded = new Set(
    cfg
      .get<string[]>('ollamaExcludedModelIds', [])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  );

  const baseUrl = cfg.get<string>('ollamaBaseUrl', 'http://localhost:11434');
  try {
    const models = await listModels({ baseUrl });
    const normalized = normalizeOllamaModels(models);
    const descriptors = normalized
      .filter((m) => !excluded.has(m.name))
      .map((model) => ollamaModelToDescriptor(model));

    return descriptors.toSorted((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
  } catch {
    return [
      {
        id: 'ollama/unavailable',
        label: 'Ollama (no disponible)',
        tier: 'unknown' as const,
        completionSource: 'ollama' as const,
        provider: 'ollama',
      },
    ];
  }
}

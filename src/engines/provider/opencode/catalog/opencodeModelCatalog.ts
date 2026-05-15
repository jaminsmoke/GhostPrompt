/**
 * @file Catálogo de modelos OpenCode para el selector webview.
 *
 * `config.providers()` se normaliza y se convierte en descriptores que muestra la UI.
 */
import * as vscode from 'vscode';

import { createOpenCodeClient } from '../client';
import { getOpenCodeClientOptions } from '../server/opencodeServerManager';

import { normalizeOpencodeProviderModels } from './normalizeOpencodeProviderModels';
import { classifyOpencodeModelTier } from './opencodeModelTier';

import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../../../system/internals/protocols/types';

type OpencodeProvidersBundle = {
  providers?: Array<{
    id: string;
    name?: string;
    models?: unknown;
  }>;
};

/**
 * Lista modelos instalados/configurados en OpenCode para el dropdown.
 * Vacío si no hay conexión o no hay CLI.
 * Con **`nonPremiumOnly`** se ocultan modelos clasificados como **premium** según metadatos del catálogo.
 * @param {SuggestionModelPolicy} policy Política de modelo usada para filtrar modelos premium.
 * @returns {Promise<SuggestionModelDescriptor[]>} Lista de descriptores de modelo OpenCode.
 */
export async function listOpencodeSuggestionModels(
  policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const excluded = new Set(
    vscode.workspace
      .getConfiguration('ghostPrompt')
      .get<string[]>('opencodeExcludedModelIds', [])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  );

  let client: unknown;
  try {
    client = await createOpenCodeClient(getOpenCodeClientOptions());
  } catch {
    return [];
  }

  const sdkClient = client as {
    config: { providers(): Promise<unknown> };
  };

  try {
    const raw = await sdkClient.config.providers();
    const data =
      raw && typeof raw === 'object' && 'data' in raw
        ? (raw as { data?: OpencodeProvidersBundle }).data
        : undefined;
    const providers = data?.providers ?? [];
    const descriptors: SuggestionModelDescriptor[] = [];

    for (const p of providers) {
      const seenComposite = new Set<string>();

      for (const model of normalizeOpencodeProviderModels(p.models)) {
        const id = `${p.id}/${model.id}`;
        if (seenComposite.has(id)) {
          continue;
        }
        seenComposite.add(id);

        if (excluded.has(id)) {
          continue;
        }

        const labelSource = typeof model.name === 'string' ? model.name.trim() : model.id;
        const rawRecord = model as Record<string, unknown>;
        const { tier, pricing } = classifyOpencodeModelTier(p.id, model.id, labelSource, rawRecord);

        if (policy === 'nonPremiumOnly' && tier === 'premium') {
          continue;
        }

        descriptors.push({
          id,
          label: labelSource || model.id,
          tier,
          ...(pricing ? { pricing } : {}),
          provider: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : p.id,
          completionSource: 'opencode',
        });
      }
    }

    descriptors.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

    return descriptors;
  } catch {
    return [];
  }
}

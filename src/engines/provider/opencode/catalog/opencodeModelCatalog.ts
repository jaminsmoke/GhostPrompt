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
  providers?: {
    id: string;
    name?: string;
    models?: unknown;
  }[];
};

type OpencodeProviderRow = NonNullable<OpencodeProvidersBundle['providers']>[number];

/**
 * Construye un descriptor de modelo OpenCode si pasa filtros de duplicado, exclusión y política.
 * @param {OpencodeProviderRow} provider - Proveedor del catálogo OpenCode.
 * @param {ReturnType<typeof normalizeOpencodeProviderModels>[number]} model - Modelo normalizado.
 * @param {ReadonlySet<string>} seenComposite - IDs compuestos ya emitidos en el proveedor.
 * @param {ReadonlySet<string>} excluded - IDs excluidos por configuración.
 * @param {SuggestionModelPolicy} policy - Política de filtrado premium.
 * @returns {SuggestionModelDescriptor | undefined} Descriptor o `undefined` si se omite.
 */
function buildOpencodeModelDescriptor(
  provider: OpencodeProviderRow,
  model: ReturnType<typeof normalizeOpencodeProviderModels>[number],
  seenComposite: Set<string>,
  excluded: ReadonlySet<string>,
  policy: SuggestionModelPolicy,
): SuggestionModelDescriptor | false {
  const id = `${provider.id}/${model.id}`;
  if (seenComposite.has(id) || excluded.has(id)) {
    return false;
  }
  seenComposite.add(id);

  const labelSource = typeof model.name === 'string' ? model.name.trim() : model.id;
  const rawRecord = model as Record<string, unknown>;
  const { tier, pricing } = classifyOpencodeModelTier(provider.id, model.id, labelSource, rawRecord);

  if (policy === 'nonPremiumOnly' && tier === 'premium') {
    return false;
  }

  return {
    id,
    label: labelSource || model.id,
    tier,
    ...pricing ? { pricing } : {},
    provider: typeof provider.name === 'string' && provider.name.trim() ? provider.name.trim() : provider.id,
    completionSource: 'opencode',
  };
}

/**
 * Lista modelos instalados/configurados en OpenCode para el dropdown.
 * Vacío si no hay conexión o no hay CLI.
 * Con **`nonPremiumOnly`** se ocultan modelos clasificados como **premium** según metadatos del catálogo.
 * @param {SuggestionModelPolicy} policy - Política de modelo usada para filtrar modelos premium.
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

  const clientResult = await createOpenCodeClient(getOpenCodeClientOptions()).catch(
    (): false => false,
  );
  if (clientResult === false) {
    return [];
  }

  const sdkClient = clientResult as unknown as {
    config: { providers: () => Promise<unknown> };
  };

  try {
    const raw = await sdkClient.config.providers();
    const providers =
      raw && typeof raw === 'object' && 'data' in raw
        ? (raw as { data?: OpencodeProvidersBundle }).data?.providers ?? []
        : [];
    const descriptors: SuggestionModelDescriptor[] = [];

    for (const p of providers) {
      const seenComposite = new Set<string>();

      for (const model of normalizeOpencodeProviderModels(p.models)) {
        const descriptor = buildOpencodeModelDescriptor(p, model, seenComposite, excluded, policy);
        if (descriptor) {
          descriptors.push(descriptor);
        }
      }
    }

    return descriptors.toSorted((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
    );
  } catch {
    return [];
  }
}

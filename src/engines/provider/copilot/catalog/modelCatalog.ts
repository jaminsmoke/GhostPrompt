/**
 * @file Catálogo de modelos de sugerencia Copilot para GhostPrompt.
 */
import * as vscode from 'vscode';

import type {
  SuggestionModelDescriptor,
  SuggestionModelPolicy,
  SuggestionModelTier,
} from '../../../../system/internals/protocols/types';

/**
 * Selecciona el modelo Copilot adecuado según la política y preferencia.
 * @param {readonly vscode.LanguageModelChat[]} models Lista de modelos disponibles.
 * @param {SuggestionModelPolicy} policy Política de selección de modelo.
 * @param {string | undefined} [preferredModelId] Identificador de modelo preferido opcional.
 * @returns {vscode.LanguageModelChat | undefined} Modelo elegido o undefined si no hay coincidencias.
 */
export function selectModelByPolicy(
  models: readonly vscode.LanguageModelChat[],
  policy: SuggestionModelPolicy,
  preferredModelId?: string,
): vscode.LanguageModelChat | undefined {
  if (preferredModelId) {
    const preferred = models.find((candidate) => getModelId(candidate) === preferredModelId);
    if (preferred) {
      if (policy === 'anyModel' || isIncludedModel(preferred)) {
        return preferred;
      }
    }
  }

  if (policy === 'anyModel') {
    return models[0];
  }
  return models.find((candidate) => isIncludedModel(candidate));
}

/**
 * Enumera los modelos Copilot que cumplen la política indicada.
 * @param {SuggestionModelPolicy} policy Política para filtrar los modelos devueltos.
 * @returns {Promise<SuggestionModelDescriptor[]>} Lista de descriptores de modelo Copilot.
 */
export async function listSuggestionModels(
  policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  const filtered =
    policy === 'anyModel' ? models : models.filter((candidate) => isIncludedModel(candidate));
  const seen = new Set<string>();
  const descriptors: SuggestionModelDescriptor[] = [];
  for (const candidate of filtered) {
    const descriptor = describeModel(candidate);
    const dedupeKey = buildModelDedupeKey(descriptor);
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    descriptors.push({
      ...descriptor,
      completionSource: 'copilot',
    });
  }
  return descriptors;
}

/**
 * Expuesto para el proveedor LM al armar el resultado de suggestion.
 * @param {unknown} model Objeto de modelo Copilot a describir.
 * @returns {SuggestionModelDescriptor} Descriptor del modelo.
 */
export function describeModel(model: unknown): SuggestionModelDescriptor {
  const data = model as {
    id?: string;
    family?: string;
    name?: string;
    pricing?: string;
  };
  const id = getModelId(model);
  const label = [data.name?.trim(), data.family?.trim(), id].find(Boolean) ?? id;
  const pricing = normalizePricing(data.pricing);
  const tier = classifyModelTier(model);
  const provider = inferModelProvider(model);
  return {
    id,
    label,
    tier,
    ...(pricing ? { pricing } : {}),
    ...(provider ? { provider } : {}),
  };
}

/**
 * Resuelve el identificador de un modelo a partir de sus campos disponibles.
 * @param {unknown} model Objeto de modelo posible.
 * @returns {string} Id del modelo o "unknown" si no se encuentra ninguno.
 */
function getModelId(model: unknown): string {
  const data = model as { id?: string; family?: string; name?: string };
  return (
    [data.id?.trim(), data.family?.trim(), data.name?.trim()].find(Boolean) ?? 'unknown'
  );
}

/**
 * Determina si un modelo debe incluirse según sus marcas y precio.
 * @param {unknown} model Objeto de modelo a evaluar.
 * @returns {boolean} True si el modelo es elegible para uso incluido.
 */
function isIncludedModel(model: unknown): boolean {
  const tierByPricing = classifyTierFromPricing(model);
  if (tierByPricing === 'included') {
    return true;
  }
  if (tierByPricing === 'premium') {
    return false;
  }

  const data = model as { id?: string; family?: string; name?: string };
  const fingerprint = `${data.id ?? ''} ${data.family ?? ''} ${data.name ?? ''}`
    .toLowerCase()
    .trim();

  if (!fingerprint) {
    return false;
  }

  const allowMarkers = ['mini', 'nano', 'haiku', 'flash'];
  const hasAllowMarker = allowMarkers.some((marker) => fingerprint.includes(marker));
  if (!hasAllowMarker) {
    return false;
  }

  const denyMarkers = ['premium', 'pro', 'opus', 'sonnet', 'gpt-5', 'gpt-4.1', 'o1', 'o3', 'o4'];
  return !denyMarkers.some((marker) => fingerprint.includes(marker));
}

/**
 * Clasifica el nivel de un modelo en función de su precio y compatibilidad.
 * @param {unknown} model Objeto de modelo a clasificar.
 * @returns {SuggestionModelTier} Nivel de sugerencia deducido.
 */
function classifyModelTier(model: unknown): SuggestionModelTier {
  const tierByPricing = classifyTierFromPricing(model);
  if (tierByPricing !== 'unknown') {
    return tierByPricing;
  }
  return isIncludedModel(model) ? 'included' : 'unknown';
}

/**
 * Clasifica el tier de un modelo en función de la cadena pricing.
 * @param {unknown} model Objeto de modelo con posible campo pricing.
 * @returns {SuggestionModelTier} Tier inferido a partir del precio.
 */
function classifyTierFromPricing(model: unknown): SuggestionModelTier {
  const data = model as { pricing?: string };
  const normalized = normalizePricing(data.pricing);
  if (!normalized) {
    return 'unknown';
  }
  const multiplier = parsePricingMultiplier(normalized);
  if (multiplier === undefined) {
    return 'unknown';
  }
  return multiplier === 0 ? 'included' : 'premium';
}

/**
 * Normaliza la cadena de pricing de un modelo si es válida.
 * @param {unknown} pricing Valor bruto de pricing.
 * @returns {string | undefined} Pricing limpio o undefined si no es válido.
 */
function normalizePricing(pricing: unknown): string | undefined {
  if (typeof pricing !== 'string') {
    return undefined;
  }
  const value = pricing.trim();
  return value.length ? value : undefined;
}

/**
 * Extrae el multiplicador numérico de una cadena de pricing tipo `2x`.
 * @param {string} pricing Cadena de pricing a parsear.
 * @returns {number | undefined} Multiplicador numérico o undefined si no coincide.
 */
function parsePricingMultiplier(pricing: string): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)x$/i.exec(pricing.trim());
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Construye una clave de deduplicado para un descriptor de modelo.
 * @param {SuggestionModelDescriptor} model Descriptor de modelo que se normaliza.
 * @returns {string} Clave única usada para evitar duplicados.
 */
function buildModelDedupeKey(model: SuggestionModelDescriptor): string {
  const normalize = (value: string | undefined): string => (value ?? '').trim().toLowerCase();
  return [
    normalize(model.provider),
    normalize(model.label),
    model.tier,
    normalize(model.pricing),
  ].join('|');
}

/**
 * Infiera el proveedor original de un modelo a partir de su nombre/fingerprint.
 * @param {unknown} model Objeto de modelo con campos id, family o name.
 * @returns {string | undefined} Nombre del proveedor o undefined si no se puede inferir.
 */
function inferModelProvider(model: unknown): string | undefined {
  const data = model as { id?: string; family?: string; name?: string };
  const fingerprint = `${data.id ?? ''} ${data.family ?? ''} ${data.name ?? ''}`
    .toLowerCase()
    .trim();
  if (!fingerprint) {
    return undefined;
  }
  if (
    fingerprint.includes('gpt') ||
    fingerprint.includes('o1') ||
    fingerprint.includes('o3') ||
    fingerprint.includes('o4')
  ) {
    return 'OpenAI';
  }
  if (fingerprint.includes('claude')) {
    return 'Anthropic';
  }
  if (fingerprint.includes('gemini')) {
    return 'Google';
  }
  if (fingerprint.includes('grok')) {
    return 'xAI';
  }
  if (fingerprint.includes('raptor') || fingerprint.includes('oswe')) {
    return 'GitHub';
  }
  return 'Other';
}

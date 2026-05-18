/**
 * @file Clasificador de tiers de modelo OpenCode.
 * Tier / pricing solo desde metadatos del catálogo OpenCode (`config.providers`).
 * Sin adivinar por nombre de modelo (phi, GPT-*, etc.): si la API no dice precio/free → **unknown**.
 *
 * Política de producto / routing (`nonPremiumOnly`), no "prompt" al LM. Ver `Docs/ARCHITECTURE.md` §3.
 */
import type { SuggestionModelTier } from '../../../../system/internals/protocols/types';

/**
 * Extrae el multiplicador numérico de pricing del catálogo OpenCode.
 * @param {string} pricing - Cadena de pricing como '0x' o '1x'.
 * @returns {number | undefined} Multiplicador si el formato es válido.
 */
function parsePricingMultiplier(pricing: string): number | false {
  const match = /^(?<multiplier>\d+(?:\.\d+)?)x$/iu.exec(pricing.trim());
  if (!match?.groups?.multiplier) {
    return false;
  }
  const parsed = Number(match.groups.multiplier);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return parsed;
}

export type OpencodeTierResult = {
  tier: SuggestionModelTier;
  pricing?: string;
};

/**
 * Orden: pricing → flag free → proveedor opencode → backends locales por id.
 * @param {string} providerID - Identificador del proveedor OpenCode.
 * @param {string} _modelID - ID del modelo OpenCode.
 * @param {string} _modelDisplayName - Nombre visible del modelo.
 * @param {Record<string, unknown>} raw - Registro completo de metadatos del modelo.
 * @returns {OpencodeTierResult} Clasificación del modelo: included, premium o unknown.
 */
export function classifyOpencodeModelTier(
  providerID: string,
  _modelID: string,
  _modelDisplayName: string,
  raw: Record<string, unknown>,
): OpencodeTierResult {
  const pricingRaw = typeof raw.pricing === 'string' ? raw.pricing.trim() : '';
  if (pricingRaw) {
    const mult = parsePricingMultiplier(pricingRaw);
    if (mult !== false) {
      return {
        tier: mult === 0 ? 'included' : 'premium',
        pricing: pricingRaw,
      };
    }
  }

  if (raw.free === true) {
    return { tier: 'included', ...pricingRaw ? { pricing: pricingRaw } : {} };
  }

  if (providerID === 'opencode') {
    return { tier: 'included', ...pricingRaw ? { pricing: pricingRaw } : {} };
  }

  const localish = ['ollama', 'lmstudio', 'jan', 'local', 'llamacpp'];
  if (localish.some((k) => providerID.toLowerCase().includes(k))) {
    return { tier: 'included' };
  }

  return { tier: 'unknown', ...pricingRaw ? { pricing: pricingRaw } : {} };
}

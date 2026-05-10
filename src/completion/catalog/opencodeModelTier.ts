/**
 * Tier / pricing solo desde metadatos del catálogo OpenCode (`config.providers`).
 * Sin adivinar por nombre de modelo (phi, GPT-*, etc.): si la API no dice precio/free → **unknown**.
 *
 * Política de producto / routing (`nonPremiumOnly`), no “prompt” al LM. Ver `Docs/ARCHITECTURE.md` §3.
 */
import type { SuggestionModelTier } from "../types";

function parsePricingMultiplier(pricing: string): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)x$/i.exec(pricing.trim());
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type OpencodeTierResult = {
  tier: SuggestionModelTier;
  pricing?: string;
};

/**
 * Orden: `pricing` multiplicador (`0x` / `1x`) → flag `free` → proveedor **opencode** → backends locales por **id de proveedor**.
 */
export function classifyOpencodeModelTier(
  providerID: string,
  _modelID: string,
  _modelDisplayName: string,
  raw: Record<string, unknown>,
): OpencodeTierResult {
  const pricingRaw =
    typeof raw.pricing === "string" ? raw.pricing.trim() : "";
  if (pricingRaw) {
    const mult = parsePricingMultiplier(pricingRaw);
    if (mult !== undefined) {
      return {
        tier: mult === 0 ? "included" : "premium",
        pricing: pricingRaw,
      };
    }
  }

  if (raw.free === true) {
    return { tier: "included", pricing: pricingRaw || undefined };
  }

  // Proveedor embebido del runtime OpenCode (catálogo, no nombre de modelo).
  if (providerID === "opencode") {
    return { tier: "included", pricing: pricingRaw || undefined };
  }

  const localish = ["ollama", "lmstudio", "jan", "local", "llamacpp"];
  if (localish.some((k) => providerID.toLowerCase().includes(k))) {
    return { tier: "included" };
  }

  return { tier: "unknown", pricing: pricingRaw || undefined };
}

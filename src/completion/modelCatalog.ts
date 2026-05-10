import * as vscode from "vscode";

import type {
  SuggestionModelDescriptor,
  SuggestionModelPolicy,
  SuggestionModelTier,
} from "./types";

export function selectModelByPolicy(
  models: readonly vscode.LanguageModelChat[],
  policy: SuggestionModelPolicy,
  preferredModelId?: string,
): vscode.LanguageModelChat | undefined {
  if (preferredModelId) {
    const preferred = models.find(
      (candidate) => getModelId(candidate) === preferredModelId,
    );
    if (preferred) {
      if (policy === "anyModel" || isIncludedModel(preferred)) {
        return preferred;
      }
    }
  }

  if (policy === "anyModel") {
    return models[0];
  }
  return models.find((candidate) => isIncludedModel(candidate));
}

export async function listSuggestionModels(
  policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
  const filtered =
    policy === "anyModel"
      ? models
      : models.filter((candidate) => isIncludedModel(candidate));
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
      completionSource: "copilot",
    });
  }
  return descriptors;
}

/** Expuesto para el proveedor LM al armar el resultado de suggestion. */
export function describeModel(model: unknown): SuggestionModelDescriptor {
  const data = model as {
    id?: string;
    family?: string;
    name?: string;
    pricing?: string;
  };
  const id = getModelId(model);
  const label = data.name?.trim() || data.family?.trim() || id;
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

function getModelId(model: unknown): string {
  const data = model as { id?: string; family?: string; name?: string };
  return data.id?.trim() || data.family?.trim() || data.name?.trim() || "unknown";
}

function isIncludedModel(model: unknown): boolean {
  const tierByPricing = classifyTierFromPricing(model);
  if (tierByPricing === "included") {
    return true;
  }
  if (tierByPricing === "premium") {
    return false;
  }

  const data = model as { id?: string; family?: string; name?: string };
  const fingerprint = `${data.id ?? ""} ${data.family ?? ""} ${data.name ?? ""}`
    .toLowerCase()
    .trim();

  if (!fingerprint) {
    return false;
  }

  const allowMarkers = ["mini", "nano", "haiku", "flash"];
  const hasAllowMarker = allowMarkers.some((marker) =>
    fingerprint.includes(marker),
  );
  if (!hasAllowMarker) {
    return false;
  }

  const denyMarkers = [
    "premium",
    "pro",
    "opus",
    "sonnet",
    "gpt-5",
    "gpt-4.1",
    "o1",
    "o3",
    "o4",
  ];
  return !denyMarkers.some((marker) => fingerprint.includes(marker));
}

function classifyModelTier(model: unknown): SuggestionModelTier {
  const tierByPricing = classifyTierFromPricing(model);
  if (tierByPricing !== "unknown") {
    return tierByPricing;
  }
  return isIncludedModel(model) ? "included" : "unknown";
}

function classifyTierFromPricing(model: unknown): SuggestionModelTier {
  const data = model as { pricing?: string };
  const normalized = normalizePricing(data.pricing);
  if (!normalized) {
    return "unknown";
  }
  const multiplier = parsePricingMultiplier(normalized);
  if (multiplier === undefined) {
    return "unknown";
  }
  return multiplier === 0 ? "included" : "premium";
}

function normalizePricing(pricing: unknown): string | undefined {
  if (typeof pricing !== "string") {
    return undefined;
  }
  const value = pricing.trim();
  return value.length ? value : undefined;
}

function parsePricingMultiplier(pricing: string): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)x$/i.exec(pricing.trim());
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildModelDedupeKey(model: SuggestionModelDescriptor): string {
  const normalize = (value: string | undefined): string =>
    (value ?? "").trim().toLowerCase();
  return [normalize(model.provider), normalize(model.label), model.tier, normalize(model.pricing)].join(
    "|",
  );
}

function inferModelProvider(model: unknown): string | undefined {
  const data = model as { id?: string; family?: string; name?: string };
  const fingerprint = `${data.id ?? ""} ${data.family ?? ""} ${data.name ?? ""}`
    .toLowerCase()
    .trim();
  if (!fingerprint) {
    return undefined;
  }
  if (
    fingerprint.includes("gpt") ||
    fingerprint.includes("o1") ||
    fingerprint.includes("o3") ||
    fingerprint.includes("o4")
  ) {
    return "OpenAI";
  }
  if (fingerprint.includes("claude")) {
    return "Anthropic";
  }
  if (fingerprint.includes("gemini")) {
    return "Google";
  }
  if (fingerprint.includes("grok")) {
    return "xAI";
  }
  if (fingerprint.includes("raptor") || fingerprint.includes("oswe")) {
    return "GitHub";
  }
  return "Other";
}

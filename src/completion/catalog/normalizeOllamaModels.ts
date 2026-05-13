import type { SuggestionModelDescriptor } from "../types";

export type OllamaApiModelRecord = {
  name: string;
  size?: number;
};

function isValidOllamaModel(v: unknown): v is OllamaApiModelRecord {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as { name?: unknown }).name === "string" &&
    (v as { name: string }).name.trim().length > 0
  );
}

export function normalizeOllamaModels(models: unknown): OllamaApiModelRecord[] {
  if (models === null || models === undefined) {
    return [];
  }
  if (!Array.isArray(models)) {
    return [];
  }
  return models.filter(isValidOllamaModel);
}

export function ollamaModelToDescriptor(
  model: OllamaApiModelRecord,
): SuggestionModelDescriptor {
  return {
    id: model.name,
    label: model.name,
    tier: "included",
    provider: "ollama",
    completionSource: "ollama",
  };
}

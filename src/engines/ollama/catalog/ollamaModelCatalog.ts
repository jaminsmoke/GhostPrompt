import * as vscode from "vscode";

import type { SuggestionModelDescriptor, SuggestionModelPolicy } from '../../../core/types';
import { listModels } from "../ollamaApiClient";
import { normalizeOllamaModels, ollamaModelToDescriptor } from "./normalizeOllamaModels";

export async function listOllamaSuggestionModels(
  _policy: SuggestionModelPolicy,
): Promise<SuggestionModelDescriptor[]> {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const excluded = new Set(
    cfg
      .get<string[]>("ollamaExcludedModelIds", [])
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );

  const baseUrl = cfg.get<string>("ollamaBaseUrl", "http://localhost:11434");
  try {
    const models = await listModels({ baseUrl });
    const normalized = normalizeOllamaModels(models);
    const descriptors = normalized
      .filter((m) => !excluded.has(m.name))
      .map(ollamaModelToDescriptor);

    descriptors.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );

    return descriptors;
  } catch {
    return [{
      id: "ollama/unavailable",
      label: "Ollama (no disponible)",
      tier: "unknown" as const,
      completionSource: "ollama" as const,
      provider: "ollama",
    }];
  }
}
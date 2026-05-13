import { describe, it, expect } from "vitest";
import {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from "../src/core/loading";

describe("suggestionLoadingStatusText", () => {
  const cases: Array<[SuggestionLoadingPhase, string]> = [
    ["copilot", "Buscando sugerencia…"],
    ["opencode-start", "Iniciando OpenCode…"],
    ["opencode-connecting", "Conectando con el servidor…"],
    ["opencode-generating", "Generando sugerencia…"],
  ];

  it.each(cases)("maps %s", (phase, expected) => {
    expect(suggestionLoadingStatusText(phase)).toBe(expected);
  });
});

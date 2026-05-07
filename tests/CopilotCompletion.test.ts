import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectChatModelsMock, userMessageMock } = vi.hoisted(() => ({
  selectChatModelsMock: vi.fn(),
  userMessageMock: vi.fn((instruction: string) => ({ instruction })),
}));

vi.mock("vscode", () => ({
  lm: {
    selectChatModels: selectChatModelsMock,
  },
  LanguageModelChatMessage: {
    User: userMessageMock,
  },
}));

import {
  normalizeSuggestion,
  requestCompletion,
  buildCompletionInstruction,
  selectModelByPolicy,
} from "../src/CopilotCompletion";

function createTextStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function createToken() {
  return { isCancellationRequested: false };
}

describe("CopilotCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve empty no-model cuando no hay modelos", async () => {
    selectChatModelsMock.mockResolvedValueOnce([]);

    const result = await requestCompletion("hola", {
      token: createToken() as never,
      policy: "anyModel",
    });

    expect(result).toEqual({ kind: "empty", reason: "no-model" });
  });

  it("normaliza suggestion quitando prefijo repetido y truncando", () => {
    const normalized = normalizeSuggestion(
      "Hola mundo, ahora seguimos con mas contexto de prueba",
      "Hola mundo,",
      12,
    );
    expect(normalized).toBe("ahora seguim");
  });

  it("devuelve suggestion cuando el modelo responde texto", async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createTextStream([" continuacion ", "util"]),
    });
    selectChatModelsMock.mockResolvedValueOnce([{ sendRequest }]);

    const result = await requestCompletion("Escribe", {
      token: createToken() as never,
      policy: "anyModel",
      maxSuggestionChars: 50,
    });

    expect(result).toEqual({ kind: "suggestion", suggestion: "continuacion util" });
    expect(sendRequest).toHaveBeenCalledOnce();
    expect(userMessageMock).toHaveBeenCalledOnce();
  });

  it("selectModelByPolicy prioriza modelo no premium en modo seguro", () => {
    const models = [
      { id: "gpt-5-pro" },
      { id: "gpt-4o-mini" },
    ] as never[];

    const selected = selectModelByPolicy(models, "nonPremiumOnly");
    expect(selected).toEqual(models[1]);
  });

  it("buildCompletionInstruction incluye directiva de estilo y contexto reciente", () => {
    const instruction = buildCompletionInstruction("Escribe una propuesta", "detailed", {
      lastSentPrompt: "Quiero una arquitectura en capas",
      lastAcceptedSuggestion: "Incluye riesgos y mitigaciones",
    });

    expect(instruction).toContain("richer continuation");
    expect(instruction).toContain("Recent prompt sent by user");
    expect(instruction).toContain("Recent accepted suggestion style");
  });
});

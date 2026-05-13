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
  CancellationTokenSource: class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose: () => {} }),
    };
    cancel() {
      this.token.isCancellationRequested = true;
    }
    dispose() {}
  },
}));

import {
  listSuggestionModels,
  normalizeSuggestion,
  requestCompletion,
  buildCompletionInstruction,
  detectSuggestionLanguageFromInput,
  resolveSuggestionLanguage,
  selectModelByPolicy,
  suggestionStyleDirective,
} from "../src/core";

function createTextStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function createHangingTextStream(): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise<IteratorResult<string>>(() => {}),
      };
    },
  };
}

function createToken() {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  };
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
    expect(normalized).toBe(" ahora segui");
  });

  it("preserva espacio o salto inicial tras quitar prefijo duplicado", () => {
    expect(normalizeSuggestion("para la siguiente iteración", "para", 100)).toBe(
      " la siguiente iteración",
    );
    expect(normalizeSuggestion("línea\nnueva", "línea", 100)).toBe("\nnueva");
  });

  it("quita solape parcial entre sufijo del usuario y prefijo de suggestion", () => {
    const normalized = normalizeSuggestion(
      "de autenticación con refresh token y rotación",
      "Diseña un flujo de autenticación ",
      200,
    );
    expect(normalized).toBe(" con refresh token y rotación");
  });

  it("quita palabra final incompleta duplicada al inicio de suggestion", () => {
    const normalized = normalizeSuggestion(
      "autenticación robusta para API",
      "Necesito una autenti",
      200,
    );
    expect(normalized).toBe("cación robusta para API");
  });

  it("no introduce espacios artificiales en palabra partida", () => {
    const normalized = normalizeSuggestion(
      "cacion robusta para API",
      "Necesito una apli",
      200,
    );
    expect(normalized).toBe("cacion robusta para API");
  });

  it("inserta espacio tras puntuacion cuando suggestion empieza en palabra", () => {
    expect(normalizeSuggestion("continuacion", "Ejemplo:", 100)).toBe(" continuacion");
    expect(normalizeSuggestion("item", "Lista,", 100)).toBe(" item");
    expect(normalizeSuggestion("valor", "Clave;", 100)).toBe(" valor");
  });

  it("no inserta espacio extra si ya existe separacion", () => {
    expect(normalizeSuggestion(" continuacion", "Ejemplo:", 100)).toBe(
      " continuacion",
    );
    expect(normalizeSuggestion("continuacion", "Ejemplo: ", 100)).toBe(
      "continuacion",
    );
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

    expect(result).toEqual(
      expect.objectContaining({
        kind: "suggestion",
        suggestion: " continuacion util",
      }),
    );
    expect(sendRequest).toHaveBeenCalledOnce();
    expect(userMessageMock).toHaveBeenCalledTimes(2);
  });

  it("requestCompletion inyecta la directiva STYLE_* segun suggestionStyle", async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createTextStream([" ok"]),
    });
    selectChatModelsMock.mockResolvedValue([{ sendRequest }]);

    await requestCompletion("Hola", {
      token: createToken() as never,
      policy: "anyModel",
      maxSuggestionChars: 20,
      style: "concise",
    });
    expect(userMessageMock.mock.calls[0][0]).toContain("STYLE_CONCISE");

    userMessageMock.mockClear();
    await requestCompletion("Hola", {
      token: createToken() as never,
      policy: "anyModel",
      maxSuggestionChars: 20,
      style: "balanced",
    });
    expect(userMessageMock.mock.calls[0][0]).toContain("STYLE_BALANCED");

    userMessageMock.mockClear();
    await requestCompletion("Hola", {
      token: createToken() as never,
      policy: "anyModel",
      maxSuggestionChars: 20,
      style: "detailed",
    });
    expect(userMessageMock.mock.calls[0][0]).toContain("STYLE_DETAILED");

    expect(sendRequest).toHaveBeenCalledTimes(3);
  });

  it("devuelve request-timeout si el modelo no responde en el tiempo limite", async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createHangingTextStream(),
    });
    selectChatModelsMock.mockResolvedValueOnce([{ sendRequest }]);

    const result = await requestCompletion("Escribe", {
      token: createToken() as never,
      policy: "anyModel",
      requestTimeoutMs: 20,
    });

    expect(result).toEqual({ kind: "empty", reason: "request-timeout" });
  });

  it("selectModelByPolicy prioriza modelo no premium en modo seguro", () => {
    const models = [
      { id: "gpt-5-pro" },
      { id: "gpt-4o-mini" },
    ] as never[];

    const selected = selectModelByPolicy(models, "nonPremiumOnly");
    expect(selected).toEqual(models[1]);
  });

  it("selectModelByPolicy respeta preferredModelId cuando es compatible", () => {
    const models = [
      { id: "gpt-4o-mini" },
      { id: "claude-3.5-haiku" },
    ] as never[];
    const selected = selectModelByPolicy(models, "nonPremiumOnly", "claude-3.5-haiku");
    expect(selected).toEqual(models[1]);
  });

  it("selectModelByPolicy ignora preferred premium en modo seguro", () => {
    const models = [
      { id: "gpt-5-pro" },
      { id: "gpt-4o-mini" },
    ] as never[];
    const selected = selectModelByPolicy(models, "nonPremiumOnly", "gpt-5-pro");
    expect(selected).toEqual(models[1]);
  });

  it("listSuggestionModels devuelve label con tier", async () => {
    selectChatModelsMock.mockResolvedValueOnce([{ id: "gpt-4o-mini", name: "GPT-4o mini" }]);
    const models = await listSuggestionModels("anyModel");
    expect(models).toEqual([
      {
        id: "gpt-4o-mini",
        label: "GPT-4o mini",
        tier: "included",
        provider: "OpenAI",
        completionSource: "copilot",
      },
    ]);
  });

  it("listSuggestionModels elimina modelos duplicados por etiqueta visible", async () => {
    selectChatModelsMock.mockResolvedValueOnce([
      { id: "gpt-4o", name: "GPT-4o", pricing: "0x" },
      { id: "copilot-fast-gpt4o", name: "GPT-4o", pricing: "0x" },
      { id: "gpt-4o-alt", name: "GPT-4o", pricing: "0x" },
    ]);
    const models = await listSuggestionModels("anyModel");
    expect(models).toEqual([
      {
        id: "gpt-4o",
        label: "GPT-4o",
        tier: "included",
        pricing: "0x",
        provider: "OpenAI",
        completionSource: "copilot",
      },
    ]);
  });

  it("listSuggestionModels deduplica ids versionados del mismo modelo visible", async () => {
    selectChatModelsMock.mockResolvedValueOnce([
      { id: "gpt-4o", name: "GPT-4o", pricing: "0x" },
      { id: "gpt-4o-2024-11-20", name: "GPT-4o", pricing: "0x" },
    ]);
    const models = await listSuggestionModels("anyModel");
    expect(models).toEqual([
      {
        id: "gpt-4o",
        label: "GPT-4o",
        tier: "included",
        pricing: "0x",
        provider: "OpenAI",
        completionSource: "copilot",
      },
    ]);
  });

  it("buildCompletionInstruction incluye directiva de estilo y contexto reciente", () => {
    const instruction = buildCompletionInstruction("Escribe una propuesta", "detailed", {
      lastSentPrompt: "Quiero una arquitectura en capas",
      lastAcceptedSuggestion: "Incluye riesgos y mitigaciones",
      recentSentPrompts: [
        "Diseña un backend con Node y PostgreSQL",
        "Quiero tests para API REST",
      ],
      workspaceName: "VsCodeExtension-InlineChatSuggestions",
      activeFilePath: "src/host/MiniInputViewProvider.ts",
      activeLanguageId: "typescript",
      activeSelection: "const value = message.value === 'off' ? 'off' : 'basic';",
      outputLanguage: "es",
    });

    expect(instruction).toContain("STYLE_DETAILED:");
    expect(instruction).toContain("2-3 fluent sentences");
    expect(instruction).toContain("Recent prompt sent by user");
    expect(instruction).toContain("Recent accepted suggestion style");
    expect(instruction).toContain("Relevant project context");
    expect(instruction).toContain("Active file: src/host/MiniInputViewProvider.ts");
    expect(instruction).toContain("Recent prompts (latest first)");
    expect(instruction).toContain("Write the continuation in Spanish.");
    expect(instruction).toContain(
      "If your continuation starts a new word and the partial text does not end with whitespace, include exactly one leading space.",
    );
    expect(instruction).toContain(
      "If you are completing the current unfinished word, do not add a leading space.",
    );
    expect(instruction).toContain("Do not translate code identifiers");
  });

  it("buildCompletionInstruction diferencia claramente concise/balanced/detailed", () => {
    const concise = buildCompletionInstruction("Texto", "concise");
    const balanced = buildCompletionInstruction("Texto", "balanced");
    const detailed = buildCompletionInstruction("Texto", "detailed");

    expect(concise).toContain("STYLE_CONCISE:");
    expect(concise).not.toContain("STYLE_BALANCED:");
    expect(concise).not.toContain("STYLE_DETAILED:");

    expect(balanced).toContain("STYLE_BALANCED:");
    expect(balanced).not.toContain("STYLE_CONCISE:");
    expect(balanced).not.toContain("STYLE_DETAILED:");

    expect(detailed).toContain("STYLE_DETAILED:");
    expect(detailed).not.toContain("STYLE_CONCISE:");
    expect(detailed).not.toContain("STYLE_BALANCED:");
  });

  it("suggestionStyleDirective expone reglas de longitud disjuntas entre estilos", () => {
    const c = suggestionStyleDirective("concise");
    const b = suggestionStyleDirective("balanced");
    const d = suggestionStyleDirective("detailed");

    expect(c).toMatch(/4 words/i);
    expect(b).toMatch(/one practical sentence|8-18 words/i);
    expect(d).toMatch(/2-3/i);
    expect(d).toMatch(/25-60 words/i);
  });

  it("detecta idioma espanol e ingles de forma basica", () => {
    expect(detectSuggestionLanguageFromInput("Quiero una funcion para validar email")).toBe(
      "es",
    );
    expect(detectSuggestionLanguageFromInput("I need a function to validate email")).toBe(
      "en",
    );
  });

  it("usa ingles por defecto cuando no recibe contexto de idioma", () => {
    const instruction = buildCompletionInstruction("Create a test plan");
    expect(instruction).toContain("Write the continuation in English.");
  });

  it("manual tiene precedencia sobre auto en resolucion de idioma", () => {
    expect(resolveSuggestionLanguage("manual", "en", "Quiero una propuesta")).toBe(
      "en",
    );
    expect(resolveSuggestionLanguage("auto", "en", "Quiero una propuesta")).toBe(
      "es",
    );
  });

  it("en auto mantiene idioma previo con input corto de baja confianza", () => {
    expect(resolveSuggestionLanguage("auto", "en", "ok", "es")).toBe("es");
  });

  it("en auto usa fallback manual si no hay idioma previo", () => {
    expect(resolveSuggestionLanguage("auto", "en", "ok")).toBe("en");
  });

  it("en auto resuelve ingles para prompt tecnico claro", () => {
    expect(
      resolveSuggestionLanguage(
        "auto",
        "es",
        "Please create a REST endpoint with authentication and validation",
        "es",
      ),
    ).toBe("en");
  });
});

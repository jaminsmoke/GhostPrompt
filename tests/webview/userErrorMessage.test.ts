import { describe, expect, it } from "vitest";
import {
  messageForEmptySuggestion,
  toUserErrorMessage,
} from "../../src/ui/webview/lib/userErrorMessage";

const ctxCopilot = {
  completionUiKind: "copilot",
  completionProvider: "copilot",
};
const ctxOpencode = {
  completionUiKind: "opencode",
  completionProvider: "opencode",
};
const ctxMulti = {
  completionUiKind: "multi",
  completionProvider: "copilot",
};

describe("messageForEmptySuggestion", () => {
  it("no-model según motor y modo UI", () => {
    expect(messageForEmptySuggestion("no-model", ctxMulti)).toContain(
      "Copilot u OpenCode",
    );
    expect(messageForEmptySuggestion("no-model", ctxOpencode)).toContain(
      "OpenCode",
    );
    expect(messageForEmptySuggestion("no-model", ctxCopilot)).toContain(
      "Copilot",
    );
  });

  it("empty-response es explícito para el usuario", () => {
    expect(messageForEmptySuggestion("empty-response", ctxCopilot)).toContain(
      "vacío",
    );
  });

  it("unknown reason cae en mensaje genérico", () => {
    expect(messageForEmptySuggestion("unknown-reason", ctxCopilot)).toBe(
      "Sin sugerencia para este texto.",
    );
  });
});

describe("toUserErrorMessage", () => {
  it("vacío → mensaje fijo", () => {
    expect(toUserErrorMessage("")).toBe("Error al generar sugerencia.");
    expect(toUserErrorMessage(undefined)).toBe("Error al generar sugerencia.");
  });

  it("mapea cuota premium Copilot", () => {
    expect(
      toUserErrorMessage(
        "Premium model quota exceeded; allowance to renew next month.",
      ),
    ).toContain("Cuota de modelo premium");
  });

  it("mapea fallo de arranque OpenCode", () => {
    expect(
      toUserErrorMessage("Failed to start OpenCode server: boom"),
    ).toContain("No se pudo iniciar OpenCode");
  });

  it("mapea errores de red genéricos", () => {
    expect(toUserErrorMessage("fetch failed")).toContain("No se pudo conectar");
    expect(toUserErrorMessage("ECONNREFUSED localhost:3939")).toContain(
      "No se pudo conectar",
    );
  });

  it("sin patrón conocido conserva el texto compactado", () => {
    expect(toUserErrorMessage("Algo raro pasó")).toBe("Error: Algo raro pasó");
  });

  it("trunca mensajes largos sin patrón", () => {
    const long = "x".repeat(200);
    const out = toUserErrorMessage(long);
    expect(out.startsWith("Error: ")).toBe(true);
    expect(out.length).toBeLessThanOrEqual("Error: ".length + 140);
  });
});

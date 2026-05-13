import { describe, expect, it } from "vitest";

import { buildCompletionInstruction } from "../src/core/instruction";
import { normalizeSuggestion } from "../src/core/normalize";

/**
 * Contrato Fase 1 v0.4.2: la instrucción pide comportamiento; normalize corrige
 * desviaciones típicas del LM (no repetir prefijo, espaciado tras puntuación).
 */
describe("instruction ↔ normalize contract", () => {
  it("la instrucción incluye anti-duplicación y guía de espacio inicial", () => {
    const instruction = buildCompletionInstruction("hello ", "balanced");
    expect(instruction).toContain("Never repeat");
    expect(instruction).toContain("leading space");
    expect(instruction).toContain("Partial text to continue:");
  });

  it("normalize elimina eco del prefijo cuando el LM ignora Never repeat", () => {
    expect(
      normalizeSuggestion("hello world next bit", "hello world ", 100),
    ).toBe(" next bit");
  });

  it("maxChars solo aplica en normalize (tope duro frente a STYLE_* por palabras)", () => {
    expect(normalizeSuggestion("abcdefgh", "", 4)).toBe("abcd");
  });
});

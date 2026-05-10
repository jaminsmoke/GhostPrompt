import { describe, expect, it } from "vitest";

import { buildCompletionInstruction } from "../src/completion/instruction";

describe("buildCompletionInstruction", () => {
  it("incluye projectBootstrapLines en Relevant project context", () => {
    const text = buildCompletionInstruction("hola", "balanced", {
      outputLanguage: "en",
      workspaceName: "demo",
      projectBootstrapLines: [
        "README excerpt (README.md): resumen corto",
        "package.json: name=demo",
      ],
    });
    expect(text).toContain("Relevant project context:");
    expect(text).toContain("Workspace: demo");
    expect(text).toContain("README excerpt (README.md): resumen corto");
    expect(text).toContain("package.json: name=demo");
    expect(text).toContain("Partial text to continue: hola");
  });
});

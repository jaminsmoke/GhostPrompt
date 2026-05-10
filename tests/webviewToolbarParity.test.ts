/**
 * Regresión: paridad funcional del toolbar entre sidebar y panel (mismo bundle webview).
 * @see Docs/Plans/Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md Fase A
 * @see Docs/Plans/Roadmaps/Roadmap-v0.4.3-quality-resilience.md Fase 5 (gobernanza dual webview)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("webview toolbar parity (v0.3.1 Fase A)", () => {
  it("index.html defines exactly five setting groups with stable data-keys", () => {
    const html = read("webview/index.html");
    expect(html.match(/class="setting-group"/g)?.length).toBe(5);
    for (const key of [
      "completionProvider",
      "suggestionModelPolicy",
      "suggestionStyle",
      "contextMode",
      "suggestionLanguageChoice",
    ]) {
      expect(html).toContain(`data-key="${key}"`);
    }
  });

  it("index.html exposes stable toolbar control ids shared by both webviews", () => {
    const html = read("webview/index.html");
    for (const id of [
      "completion-backend-select",
      "compose-options-details",
      "compose-options-summary",
      "model-select",
      "model-runtime-label",
      "debug-btn",
      "prompt-input",
      "send-btn",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("webview entry documents VIEW_ID / VIEW_CAPS parity rules (sidebar vs panel)", () => {
    const js = read("webview/src/main.ts");
    expect(js).toContain("Paridad sidebar vs panel");
    expect(js).toContain("draftChanged");
    expect(js).toContain("draftSync");
  });

  it("compact-toolbar CSS does not hide setting groups", () => {
    const css = read("webview/style.css");
    const blockStart = css.indexOf("body.gp-cap-compact-toolbar");
    expect(blockStart).toBeGreaterThan(-1);
    const blockEnd = css.indexOf("#send-btn", blockStart);
    const block = css.slice(blockStart, blockEnd > blockStart ? blockEnd : undefined);
    expect(block.toLowerCase()).not.toMatch(/\.setting-group[\s\S]*display\s*:\s*none/);
  });
});

describe("webview dual-view governance (v0.4.3 Fase 5)", () => {
  it("ghostPromptWebviewHtml carga un único index + bundle + CSS", () => {
    const src = read("src/host/ghostPromptWebviewHtml.ts");
    expect(src).toContain('"webview"');
    expect(src).toContain('"index.html"');
    expect(src).toContain('"dist"');
    expect(src).toContain('"main.js"');
    expect(src).toContain('"style.css"');
  });

  it("MiniInputViewProvider usa ambas contribuciones y el HTML compartido", () => {
    const src = read("src/host/MiniInputViewProvider.ts");
    expect(src).toContain("ghostPrompt.input");
    expect(src).toContain("ghostPrompt.inputPanel");
    expect(src).toContain("buildGhostPromptWebviewHtml");
    expect(src).toContain("_broadcastUi");
  });

  it("el cliente webview centraliza mensajes de estado en userErrorMessage.ts", () => {
    const main = read("webview/src/main.ts");
    expect(main).toContain("./lib/userErrorMessage");
    expect(main).toContain("messageForEmptySuggestion");
    expect(main).toContain("toUserErrorMessage");
  });
});

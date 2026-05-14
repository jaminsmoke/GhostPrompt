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

describe("React webview toolbar parity", () => {
  it("GhostToolbar defines exactly six setting groups with stable data-keys", () => {
    const source = read("src/ui/webview/react/components/GhostToolbar.tsx");
    expect(source.match(/data-key="/g)?.length).toBe(6);
    for (const key of [
      "completionProvider",
      "agentDestination",
      "suggestionModelPolicy",
      "suggestionStyle",
      "contextMode",
      "suggestionLanguageChoice",
    ]) {
      expect(source).toContain(`data-key="${key}"`);
    }
  });

  it("component files expose stable toolbar control ids shared by both webviews", () => {
    const toolbar = read("src/ui/webview/react/components/GhostToolbar.tsx");
    const input = read("src/ui/webview/react/components/PromptInput.tsx");
    const footer = read("src/ui/webview/react/components/ActionBar.tsx");
    const app = read("src/ui/webview/react/App.tsx");

    expect(toolbar).toContain('id="completion-backend-select"');
    expect(toolbar).toContain('id="agent-destination-select"');
    expect(toolbar).toContain('id="compose-options-details"');
    expect(toolbar).toContain('id="model-select"');
    expect(toolbar).toContain('id="model-runtime-label"');
    expect(toolbar).toContain('id="debug-btn"');
    expect(input).toContain('id="prompt-input"');
    expect(app).toContain('id="gp-vsx-surface-note"');
    expect(footer).toContain('id="send-btn"');
  });

  it("webviewHtml loads the React built index document", () => {
    const src = read("src/ui/provider/webviewHtml.ts");
    expect(src).toContain("\"dist\",");
    expect(src).toContain("\"react\",");
    expect(src).toContain("\"index.html\"");
  });

  it("MiniInputViewProvider usa el builder de HTML compartido", () => {
    const src = read("src/ui/provider/MiniInputViewProvider.ts");
    expect(src).toContain("buildGhostPromptWebviewHtml");
    expect(src).toContain("ghostPrompt.input");
    expect(src).toContain("ghostPrompt.inputPanel");
  });
});

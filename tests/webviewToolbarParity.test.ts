/**
 * Regresión: paridad funcional del toolbar entre sidebar y panel (mismo bundle webview).
 * @see Docs/Plans/Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md Fase A
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

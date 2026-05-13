/**
 * Regresión Fase D: colores del webview deben depender de tokens VS Code (sin hex sueltos).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("webview theme tokens (v0.3.1 Fase D)", () => {
  it(".status-text.error usa solo --vscode-errorForeground", () => {
    const css = readFileSync(join(repoRoot, "src/ui/webview/style.css"), "utf8");
    expect(css).toMatch(
      /\.status-text\.error\s*\{[^}]*color:\s*var\(--vscode-errorForeground\)\s*;/,
    );
    expect(css).not.toMatch(/#f48771/);
  });
});

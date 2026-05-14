(globalThis as any).window = globalThis as any;

const { postMessageMock } = vi.hoisted(() => {
  const pm = vi.fn();
  (globalThis as any).acquireVsCodeApi = () => ({ postMessage: pm });
  return { postMessageMock: pm };
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App, postToHost } from "../../src/ui/webview/react/App";

describe("GhostPrompt React webview App", () => {
  it("renders the chip bar with current values and initial status line", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Copilot LM");
    expect(html).toContain("Auto");
    expect(html).toContain("Normal · Básico · Auto");
    expect(html).toContain("Empieza a escribir para obtener sugerencias...");
  });

  it("posts outbound messages using the VS Code API when available", () => {
    postToHost({ type: "init" });

    expect(postMessageMock).toHaveBeenCalledWith({ type: "init" });
  });
});

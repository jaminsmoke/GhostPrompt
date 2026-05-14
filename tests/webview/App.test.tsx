(globalThis as any).window = globalThis as any;
(globalThis as any).acquireVsCodeApi = undefined;

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App, postToHost } from "../../src/ui/webview/react/App";

describe("GhostPrompt React webview App", () => {
  it("renders the main toolbar and initial status line", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('data-key="completionProvider"');
    expect(html).toContain("Motor");
    expect(html).toContain("Empieza a escribir para obtener sugerencias...");
  });

  it("posts outbound messages using the VS Code API when available", () => {
    const postMessage = vi.fn();
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage });

    postToHost({ type: "init" });

    expect(postMessage).toHaveBeenCalledWith({ type: "init" });
  });
});

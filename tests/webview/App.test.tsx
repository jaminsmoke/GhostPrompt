const { postMessageMock } = vi.hoisted(() => {
  (globalThis as any).window = globalThis as any;
  const pm = vi.fn();
  (globalThis as any).acquireVsCodeApi = () => ({ postMessage: pm });
  return { postMessageMock: pm };
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, postToHost } from "../../src/ui/webview/react/App";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderApp() {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("GhostPrompt React webview App", () => {
  it("renders the bottom bar with initial status line", () => {
    const html = renderApp();

    expect(html).toContain("Copilot LM");
    expect(html).toContain("Auto");
    expect(html).toContain("Empieza a escribir para obtener sugerencias...");
  });

  it("posts outbound messages using the VS Code API when available", () => {
    postToHost({ type: "init" });

    expect(postMessageMock).toHaveBeenCalledWith({ type: "init" });
  });
});

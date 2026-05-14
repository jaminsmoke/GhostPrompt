(globalThis as any).window = globalThis as any;

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PromptInput } from "../../src/ui/webview/react/components/PromptInput";

function createMockProps(overrides: Record<string, unknown> = {}) {
  return {
    text: "",
    suggestion: "",
    vsxActive: false,
    compact: false,
    textareaRef: { current: null },
    isGhostUiAllowed: () => false,
    onTextChange: vi.fn(),
    onSend: vi.fn(),
    onAccept: vi.fn(),
    onCursorCheck: vi.fn(),
    ...overrides,
  };
}

function extractPre(html: string): string | null {
  const match = /<pre[\s\S]*?<\/pre>/.exec(html);
  return match ? match[0] : null;
}

describe("PromptInput ghost overlay", () => {
  it("renders invisible user text before visible suggestion in pre", () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: "hello", suggestion: " world" })} />,
    );
    const pre = extractPre(html);

    expect(pre).not.toBeNull();
    expect(pre).toContain('class="opacity-0"');
    expect(pre).toContain("hello");
    expect(pre).toContain(" world");
  });

  it("hides overlay when suggestion is empty", () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: "hello", suggestion: "" })} />,
    );

    expect(extractPre(html)).toBeNull();
  });

  it("hides overlay when text is empty", () => {
    const html = renderToStaticMarkup(
      <PromptInput {...createMockProps({ text: "", suggestion: "world" })} />,
    );

    expect(extractPre(html)).toBeNull();
  });

  it("ghost pre has alignment classes matching textarea", () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProps({ text: "foo", suggestion: "bar" })} />,
      ),
    );

    expect(pre).toContain("inset-[1px]");
    expect(pre).toContain("px-3");
    expect(pre).toContain("py-2");
    expect(pre).toContain("overflow-auto");
  });

  it("ghost suggestion uses 70% opacity token", () => {
    const pre = extractPre(
      renderToStaticMarkup(
        <PromptInput {...createMockProps({ text: "foo", suggestion: "bar" })} />,
      ),
    );

    expect(pre).toContain("text-[var(--vscode-input-foreground)]/70");
  });

  it("renders textarea with prompt-input id", () => {
    const html = renderToStaticMarkup(<PromptInput {...createMockProps()} />);

    expect(html).toContain('id="prompt-input"');
  });
});

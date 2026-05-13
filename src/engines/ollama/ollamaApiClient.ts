import {
  type OllamaClientOptions,
  type OllamaGenerateResponse,
  type OllamaModel,
  type OllamaTagsResponse,
} from "./ollamaTypes";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function resolveUrl(
  path: string,
  baseUrl?: string,
): string {
  const base = (baseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "");
  return `${base}${path}`;
}

function buildOptions(
  opts: OllamaClientOptions,
): { headers: Record<string, string>; signal?: AbortSignal } {
  return {
    headers: { "Content-Type": "application/json" },
    ...(opts.signal ? { signal: opts.signal } : {}),
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const signal = (init.signal as AbortSignal | undefined) ?? controller.signal;
  const mergedSignal = init.signal
    ? anySignal([init.signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(url, { ...init, signal: mergedSignal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama request timed out or was cancelled");
    }
    throw err;
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

export async function listModels(
  opts: OllamaClientOptions = {},
): Promise<OllamaModel[]> {
  const url = resolveUrl("/api/tags", opts.baseUrl);
  const { headers, signal } = buildOptions(opts);
  const data = await fetchJson<OllamaTagsResponse>(
    url,
    { method: "GET", headers, signal },
    opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );
  return data.models ?? [];
}

export async function generate(
  prompt: string,
  model: string,
  opts: OllamaClientOptions & {
    onStreamPreview?: (text: string) => void;
    system?: string;
    options?: Record<string, unknown>;
  } = {},
): Promise<string> {
  const url = resolveUrl("/api/generate", opts.baseUrl);
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (opts.onStreamPreview) {
    return streamGenerate(prompt, model, url, opts, timeoutMs);
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
  };
  if (opts.system) body.system = opts.system;
  if (opts.options) body.options = opts.options;

  const { headers, signal } = buildOptions(opts);
  const res = await fetchJson<OllamaGenerateResponse>(
    url,
    {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  return res.response ?? "";
}

async function streamGenerate(
  prompt: string,
  model: string,
  url: string,
  opts: OllamaClientOptions & {
    onStreamPreview?: (text: string) => void;
    system?: string;
    options?: Record<string, unknown>;
  },
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = opts.signal
    ? anySignal([opts.signal, controller.signal])
    : controller.signal;

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: true,
  };
  if (opts.system) body.system = opts.system;
  if (opts.options) body.options = opts.options;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Ollama stream response body is null");
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaGenerateResponse;
          if (chunk.response) {
            fullText += chunk.response;
            opts.onStreamPreview?.(fullText);
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    return fullText;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama request timed out or was cancelled");
    }
    throw err;
  }
}

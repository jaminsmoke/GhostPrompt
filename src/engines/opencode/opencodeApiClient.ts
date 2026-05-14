export const OPENCODE_DEFAULT_PORT = 4096;

export interface OpenCodeClientOptions {
  port?: number;
  hostname?: string;
  authToken?: string;
}

interface PoolEntry {
  sessionId: string;
  lastUsed: number;
}

const POOL_TTL_MS = 5 * 60 * 1000;
const POOL_MAX_SIZE = 4;

let globalClient: unknown | undefined;
let globalOptions: OpenCodeClientOptions = {};
let sessionPool: PoolEntry[] = [];

function buildBaseUrl(options: OpenCodeClientOptions): string {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? OPENCODE_DEFAULT_PORT;
  return `http://${hostname}:${port}`;
}

function buildHeaders(options: OpenCodeClientOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }
  return headers;
}

export async function createOpenCodeClient(
  options: OpenCodeClientOptions,
): Promise<unknown> {
  const baseUrl = buildBaseUrl(options);
  const headers = buildHeaders(options);
  const { createOpencodeClient: factory } = await import("@opencode-ai/sdk");
  globalClient = factory({ baseUrl, headers });
  globalOptions = options;
  return globalClient;
}

export function getGlobalClient(): unknown {
  if (!globalClient) {
    throw new Error(
      "OpenCode client no inicializado. Llama a createOpenCodeClient primero.",
    );
  }
  return globalClient;
}

export async function healthCheck(client?: unknown): Promise<boolean> {
  const c = client ?? getGlobalClient();
  try {
    await (c as { config: { get: () => Promise<unknown> } }).config.get();
    return true;
  } catch {
    return false;
  }
}

async function createSessionInternal(client: unknown): Promise<string> {
  const result = await (client as { session: { create: (opts?: unknown) => Promise<unknown> } }).session.create();
  return extractSessionId(result);
}

async function deleteSessionInternal(sessionId: string, client: unknown): Promise<void> {
  await (client as { session: { delete: (opts: unknown) => Promise<unknown> } }).session.delete({ path: { id: sessionId } });
}

export async function promptOpenCode(
  sessionId: string,
  model: { providerID: string; modelID: string },
  parts: Array<{ type: string; text: string }>,
  client?: unknown,
): Promise<string> {
  const c = client ?? getGlobalClient();
  const result = await (c as { session: { prompt: (opts: unknown) => Promise<unknown> } }).session.prompt({
    path: { id: sessionId },
    body: { model, parts },
  });
  return extractPromptText(result);
}

export async function* promptStreamOpenCode(
  sessionId: string,
  signal: AbortSignal,
  client?: unknown,
): AsyncGenerator<string> {
  const c = client ?? getGlobalClient();
  const { stream } = await (c as {
    event: {
      subscribe: (opts: { signal: AbortSignal }) => Promise<{ stream: AsyncIterable<unknown> }>;
    };
  }).event.subscribe({ signal });
  for await (const data of stream) {
    const text = extractDeltaText(data);
    if (text) {
      yield text;
    }
  }
}

export async function getSession(client?: unknown): Promise<string> {
  evictStaleSessions();
  const c = client ?? getGlobalClient();
  const pooled = sessionPool.find((e) => !isSessionStale(e));
  if (pooled) {
    pooled.lastUsed = Date.now();
    return pooled.sessionId;
  }
  if (sessionPool.length >= POOL_MAX_SIZE) {
    const oldest = sessionPool.reduce((a, b) =>
      a.lastUsed < b.lastUsed ? a : b,
    );
    await deleteSessionInternal(oldest.sessionId, c);
    sessionPool = sessionPool.filter((e) => e !== oldest);
  }
  const sessionId = await createSessionInternal(c);
  sessionPool.push({ sessionId, lastUsed: Date.now() });
  return sessionId;
}

export async function closeAllSessions(client?: unknown): Promise<void> {
  const c = client ?? getGlobalClient();
  await Promise.all(
    sessionPool.map((e) => deleteSessionInternal(e.sessionId, c)),
  );
  sessionPool = [];
}

export function resetClient(): void {
  globalClient = undefined;
  globalOptions = {};
  sessionPool = [];
}

function isSessionStale(entry: PoolEntry): boolean {
  return Date.now() - entry.lastUsed > POOL_TTL_MS;
}

function evictStaleSessions(): void {
  sessionPool = sessionPool.filter((e) => {
    if (isSessionStale(e)) {
      deleteSessionInternal(e.sessionId, getGlobalClient()).catch(() => {});
      return false;
    }
    return true;
  });
}

function extractSessionId(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "";
  }
  const r = result as { data?: { id?: string } };
  return r.data?.id ?? "";
}

function extractPromptText(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "";
  }
  const r = result as { data?: { parts?: Array<{ type?: string; text?: string }> } };
  const parts = r.data?.parts ?? [];
  let text = "";
  for (const p of parts) {
    if (p.type === "text" && typeof p.text === "string") {
      text += p.text;
    }
  }
  return text;
}

function extractDeltaText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const d = data as Record<string, unknown>;
  if (d.type !== "message") {
    return undefined;
  }
  const part = d.part as Record<string, unknown> | undefined;
  if (!part) {
    return undefined;
  }
  if (part.field !== "text" || typeof part.delta !== "string") {
    return undefined;
  }
  return part.delta;
}
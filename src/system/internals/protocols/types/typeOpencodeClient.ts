/**
 * @file Contratos del cliente SDK OpenCode (@opencode-ai/sdk).
 */

export interface OpenCodeClientOptions {
  port?: number;
  hostname?: string;
  authToken?: string;
}

/** Subconjunto tipado del cliente `@opencode-ai/sdk` usado por GhostPrompt. */
export interface OpenCodeSdkClient {
  config: {
    get: () => Promise<unknown>;
  };
  session: {
    create: (options?: unknown) => Promise<unknown>;
    prompt: (options: unknown) => Promise<unknown>;
    delete: (options: unknown) => Promise<unknown>;
  };
  event: {
    subscribe: (options: {
      signal: AbortSignal;
    }) => Promise<{ stream: AsyncIterable<unknown> }>;
  };
}

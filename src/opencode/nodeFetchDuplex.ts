/**
 * Node's fetch (undici) exige `duplex: "half"` cuando el body es un ReadableStream.
 * El cliente HTTP generado de `@opencode-ai/sdk` no lo incluye; sin este envoltorio
 * aparece: "RequestInit: duplex option is required when sending a body."
 */

/**
 * Instalación única (fetch + Request): evita apilar envoltorios y reemplazar `Request` varias veces.
 */
let duplexCompatInstalled = false;

function patchGlobalRequestForStreamBody(): void {
  const originalRequest = globalThis.Request;
  if (!originalRequest) {
    return;
  }
  function requestConstructorWithDuplex(
    input: unknown,
    init?: RequestInit,
  ): InstanceType<typeof originalRequest> {
    const body = init?.body;
    if (
      init !== undefined &&
      body !== undefined &&
      body !== null &&
      isReadableStreamBody(body) &&
      init.duplex === undefined
    ) {
      return new originalRequest(input as never, { ...init, duplex: "half" });
    }
    return new originalRequest(input as never, init);
  }
  requestConstructorWithDuplex.prototype = originalRequest.prototype;
  Object.defineProperty(requestConstructorWithDuplex, "name", { value: "Request" });
  globalThis.Request = requestConstructorWithDuplex as unknown as typeof originalRequest;
}

function isReadableStreamBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as ReadableStream<Uint8Array>).getReader === "function"
  );
}

/** Duck-typing: mismo shape que `Request` del fetch global sin depender de lib DOM. */
function requestLikeWithStreamBody(input: unknown): input is { body: unknown } {
  return (
    typeof input === "object" &&
    input !== null &&
    "body" in input &&
    (input as { body: unknown }).body !== null
  );
}

export function wrapFetchWithNodeDuplex(base: typeof fetch): typeof fetch {
  const bound = base.bind(globalThis);
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    const initBody = init?.body;
    if (
      init !== undefined &&
      initBody !== undefined &&
      initBody !== null &&
      isReadableStreamBody(initBody)
    ) {
      if (init.duplex === undefined) {
        return bound(input, { ...init, duplex: "half" });
      }
    }
    if (
      init === undefined &&
      requestLikeWithStreamBody(input) &&
      isReadableStreamBody(input.body)
    ) {
      return bound(input, { duplex: "half" });
    }
    return bound(input, init);
  }) as typeof fetch;
}

export function ensureNodeFetchDuplex(): void {
  if (duplexCompatInstalled) {
    return;
  }
  duplexCompatInstalled = true;
  patchGlobalRequestForStreamBody();
  const g = globalThis as typeof globalThis & { fetch: typeof fetch };
  g.fetch = wrapFetchWithNodeDuplex(g.fetch);
}

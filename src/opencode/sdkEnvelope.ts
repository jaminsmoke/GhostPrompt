/**
 * Contratos locales para envelopes HTTP del cliente `@opencode-ai/sdk`.
 * Solo incluye campos que GhostPrompt interpreta; si el SDK cambia, los errores de compilación
 * acotan el alcance del ajuste (Roadmap v0.4.3 Fase 4).
 */

/** Envelope genérico `{ data?, error? }` devuelto por varias rutas del SDK. */
export type OpencodeApiEnvelope<TData = unknown> = {
  data?: TData;
  error?: string | null | { message?: unknown };
};

export type OpencodeSessionCreateData = {
  id?: string;
};

export type OpencodePromptInfoError = {
  name?: string;
  data?: { message?: string };
};

/** Payload `data` de `session.prompt` tras desenvolver el envelope. */
export type OpencodePromptResultData = {
  info?: {
    error?: OpencodePromptInfoError;
    modelID?: string;
    providerID?: string;
  };
  parts?: readonly OpencodeMessagePart[];
};

export type OpencodeMessagePart = {
  type?: string;
  text?: string;
};

export function unwrapOpencodeEnvelopeData<T>(
  result: unknown,
): T | undefined {
  if (result && typeof result === "object" && "data" in result) {
    return (result as OpencodeApiEnvelope<T>).data;
  }
  return undefined;
}

/**
 * Error de protocolo en la envoltura (p. ej. fallo de transporte antes de `data`).
 */
export function readOpencodeEnvelopeFailure(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const err = (result as OpencodeApiEnvelope).error;
  if (err === undefined || err === null) {
    return undefined;
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") {
      return m;
    }
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** `data` del envelope de `session.prompt`. */
export function parseOpencodePromptResultPayload(
  promptResult: unknown,
): OpencodePromptResultData | undefined {
  return unwrapOpencodeEnvelopeData<OpencodePromptResultData>(promptResult);
}

export function concatOpencodeAssistantTextParts(
  parts: readonly OpencodeMessagePart[] | undefined,
): string {
  if (!parts?.length) {
    return "";
  }
  let out = "";
  for (const p of parts) {
    if (p?.type === "text" && typeof p.text === "string") {
      out += p.text;
    }
  }
  return out;
}

/** `data.id` tras `session.create`. */
export function unpackOpencodeSessionCreateId(envelope: unknown): string | undefined {
  const data = unwrapOpencodeEnvelopeData<OpencodeSessionCreateData>(envelope);
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const id = data.id;
  return typeof id === "string" && id.trim().length > 0 ? id : undefined;
}

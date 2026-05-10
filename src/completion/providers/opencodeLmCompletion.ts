/**
 * Completions vía OpenCode (servidor embebido GhostPrompt + `@opencode-ai/sdk`).
 */
import { buildCompletionInstruction } from "../instruction";
import { normalizeSuggestion } from "../normalize";
import {
  DEFAULT_MAX_SUGGESTION_CHARS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  type CompletionRequestOptions,
  type CompletionResult,
  type SuggestionModelDescriptor,
  type SuggestionModelPolicy,
} from "../types";
import { normalizeOpencodeProviderModels } from "../normalizeOpencodeProviderModels";
import { classifyOpencodeModelTier } from "../opencodeModelTier";
import { getOpenCodeRuntime } from "../../opencode/OpenCodeRuntime";
import { consumeOpencodeSuggestionTextStream } from "../../opencode/opencodeSuggestionStream";

type SdkClient = {
  config: {
    providers(): Promise<unknown>;
  };
  session: {
    create(options?: unknown): Promise<unknown>;
    prompt(options?: unknown): Promise<unknown>;
    abort(options?: unknown): Promise<unknown>;
    delete(options?: unknown): Promise<unknown>;
  };
};

type ProvidersPayload = {
  providers?: Array<{
    id: string;
    models?: unknown;
  }>;
  default?: Record<string, string>;
};

type SessionPayload = { id: string };

type PromptPayload = {
  info?: {
    error?: { name?: string; data?: { message?: string } };
    modelID?: string;
    providerID?: string;
  };
};

type TextPart = { type?: string; text?: string };

function getResultData(result: unknown): unknown {
  if (result && typeof result === "object" && "data" in result) {
    return (result as { data: unknown }).data;
  }
  return undefined;
}

function readEnvelopeError(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const err = (result as { error?: unknown }).error;
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

function parsePreferredOpencodeModel(
  preferredModelId?: string,
): { providerID: string; modelID: string } | undefined {
  if (!preferredModelId || preferredModelId === "auto") {
    return undefined;
  }
  const idx = preferredModelId.indexOf("/");
  if (idx <= 0 || idx === preferredModelId.length - 1) {
    return undefined;
  }
  const providerID = preferredModelId.slice(0, idx).trim();
  const modelID = preferredModelId.slice(idx + 1).trim();
  if (!providerID || !modelID) {
    return undefined;
  }
  return { providerID, modelID };
}

function findModelRecord(
  provider: { models?: unknown } | undefined,
  modelID: string,
): Record<string, unknown> | undefined {
  for (const m of normalizeOpencodeProviderModels(provider?.models)) {
    if (m.id === modelID) {
      return m as Record<string, unknown>;
    }
  }
  return undefined;
}

async function resolveOpencodeModelIds(
  client: SdkClient,
  preferredModelId: string | undefined,
  policy: SuggestionModelPolicy,
): Promise<{ providerID: string; modelID: string } | undefined> {
  const raw = await client.config.providers();
  const bundle = getResultData(raw) as ProvidersPayload | undefined;
  const providers = bundle?.providers ?? [];
  const defaults = bundle?.default ?? {};

  const tierFor = (
    providerID: string,
    modelID: string,
  ): ReturnType<typeof classifyOpencodeModelTier> => {
    const p = providers.find((x) => x.id === providerID);
    const record = p ? findModelRecord(p, modelID) : undefined;
    const nameHint =
      typeof record?.name === "string" ? (record.name as string) : modelID;
    return classifyOpencodeModelTier(
      providerID,
      modelID,
      nameHint,
      record ?? {},
    );
  };

  const parsed = parsePreferredOpencodeModel(preferredModelId);
  if (parsed) {
    const { tier } = tierFor(parsed.providerID, parsed.modelID);
    if (policy === "nonPremiumOnly" && tier === "premium") {
      return undefined;
    }
    return parsed;
  }

  for (const p of providers) {
    const entries = normalizeOpencodeProviderModels(p.models);
    if (entries.length === 0) {
      continue;
    }

    const preferredDefault = defaults[p.id];
    const tryModel = (modelID: string): { providerID: string; modelID: string } | undefined => {
      if (!entries.some((m) => m.id === modelID)) {
        return undefined;
      }
      const { tier } = tierFor(p.id, modelID);
      if (policy === "nonPremiumOnly" && tier === "premium") {
        return undefined;
      }
      return { providerID: p.id, modelID };
    };

    if (preferredDefault) {
      const picked = tryModel(preferredDefault);
      if (picked) {
        return picked;
      }
    }

    if (policy === "anyModel") {
      const first = entries[0]!;
      return { providerID: p.id, modelID: first.id };
    }

    for (const m of entries) {
      const picked = tryModel(m.id);
      if (picked) {
        return picked;
      }
    }
  }
  return undefined;
}

function concatAssistantParts(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  let out = "";
  for (const p of parts) {
    const part = p as TextPart;
    if (part?.type === "text" && typeof part.text === "string") {
      out += part.text;
    }
  }
  return out;
}

function describeOpencodeModel(
  providerID: string,
  modelID: string,
): SuggestionModelDescriptor {
  const { tier, pricing } = classifyOpencodeModelTier(
    providerID,
    modelID,
    modelID,
    {},
  );
  return {
    id: `${providerID}/${modelID}`,
    label: `${providerID} / ${modelID}`,
    tier,
    ...(pricing ? { pricing } : {}),
    provider: "opencode",
  };
}

export async function requestOpencodeCompletion(
  userText: string,
  options: CompletionRequestOptions,
): Promise<CompletionResult> {
  const {
    token,
    policy,
    preferredModelId,
    maxSuggestionChars = DEFAULT_MAX_SUGGESTION_CHARS,
    style = "balanced",
    context,
    requestTimeoutMs = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    onLoadingPhase,
    onStreamPreview,
  } = options;

  const runtime = getOpenCodeRuntime();
  if (runtime.isRunning) {
    onLoadingPhase?.("opencode-connecting");
  } else {
    onLoadingPhase?.("opencode-start");
  }

  const started = await runtime.start();
  if (!started.ok) {
    return {
      kind: "error",
      message: started.error,
    };
  }

  const rawClient = runtime.getClient();
  if (!rawClient) {
    return { kind: "empty", reason: "no-model" };
  }
  const client = rawClient as SdkClient;

  onLoadingPhase?.("opencode-connecting");

  const sseAbort = new AbortController();
  let sessionId: string | undefined;
  const disposeCancel = token.onCancellationRequested(() => {
    sseAbort.abort();
    if (!sessionId) {
      return;
    }
    void client.session.abort({ path: { id: sessionId } });
  });

  const timeoutHandle = setTimeout(() => {
    if (!sessionId) {
      return;
    }
    void client.session.abort({ path: { id: sessionId } });
  }, requestTimeoutMs);

  let streamPromise: Promise<void> = Promise.resolve();

  try {
    const modelIds = await resolveOpencodeModelIds(
      client,
      preferredModelId,
      policy,
    );
    if (!modelIds) {
      return {
        kind: "empty",
        reason:
          policy === "nonPremiumOnly"
            ? "no-included-model"
            : "no-model",
      };
    }

    const created = await client.session.create({
      body: { title: "GhostPrompt inline suggestion" },
    });
    const envErr = readEnvelopeError(created);
    if (envErr) {
      return { kind: "error", message: envErr };
    }
    const session = getResultData(created) as SessionPayload | undefined;
    sessionId = session?.id;
    if (!sessionId) {
      return { kind: "empty", reason: "empty-response" };
    }

    const instruction = buildCompletionInstruction(userText, style, context);

    onLoadingPhase?.("opencode-generating");

    runtime.logDebugFirstPrompt();

    if (onStreamPreview) {
      streamPromise = consumeOpencodeSuggestionTextStream(
        rawClient,
        sseAbort.signal,
        onStreamPreview,
        {
          maxPreviewChars: maxSuggestionChars,
          sessionId,
        },
      );
    }

    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: {
          providerID: modelIds.providerID,
          modelID: modelIds.modelID,
        },
        parts: [{ type: "text", text: instruction }],
      },
    });

    const promptEnvErr = readEnvelopeError(promptResult);
    if (promptEnvErr) {
      return { kind: "error", message: promptEnvErr };
    }

    const payload = getResultData(promptResult) as
      | { info?: PromptPayload["info"]; parts?: unknown }
      | undefined;

    const err = payload?.info?.error;
    if (err) {
      const name = err.name ?? "";
      const msg = err.data?.message ?? name;
      if (token.isCancellationRequested || /abort/i.test(name)) {
        return { kind: "empty", reason: "request-timeout" };
      }
      return { kind: "error", message: msg };
    }

    const completionText = concatAssistantParts(payload?.parts);
    const suggestion = normalizeSuggestion(
      completionText,
      userText,
      maxSuggestionChars,
    );
    if (!suggestion) {
      return { kind: "empty", reason: "empty-response" };
    }

    return {
      kind: "suggestion",
      suggestion,
      model: describeOpencodeModel(modelIds.providerID, modelIds.modelID),
    };
  } catch (e) {
    if (token.isCancellationRequested) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    if (/abort|cancel/i.test(message)) {
      return { kind: "empty", reason: "request-timeout" };
    }
    return { kind: "error", message };
  } finally {
    sseAbort.abort();
    await streamPromise.catch(() => {
      /* cierre SSE ante abort */
    });
    clearTimeout(timeoutHandle);
    disposeCancel.dispose();
    if (sessionId) {
      try {
        await client.session.delete({ path: { id: sessionId } });
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}

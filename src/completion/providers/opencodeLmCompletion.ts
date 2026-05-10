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
import { normalizeOpencodeProviderModels } from "../catalog/normalizeOpencodeProviderModels";
import { classifyOpencodeModelTier } from "../catalog/opencodeModelTier";
import { getOpenCodeRuntime } from "../../opencode/OpenCodeRuntime";
import {
  getOpenCodeProvidersSnapshot,
  type OpenCodeProvidersSnapshot,
} from "../../opencode/opencodeProvidersSnapshot";
import { logOpenCodePerfCapture } from "../../debug/SuggestionDebug";
import {
  getOrCreateOpencodeInlineSession,
  invalidateOpencodeInlineSuggestionSessionPool,
} from "../../opencode/opencodeInlineSuggestionSession";
import { enqueueOpencodeInlineLm } from "../../opencode/opencodeInlineCompletionQueue";
import { consumeOpencodeSuggestionTextStream } from "../../opencode/opencodeSuggestionStream";

function perfMsNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function lmPerf(
  perfCaptureId: number | undefined,
  phase: string,
  details?: string,
): void {
  if (perfCaptureId === undefined) {
    return;
  }
  logOpenCodePerfCapture(perfCaptureId, phase, details);
}

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

function resolveOpencodeModelIdsFromSnapshot(
  bundle: OpenCodeProvidersSnapshot | undefined,
  preferredModelId: string | undefined,
  policy: SuggestionModelPolicy,
): { providerID: string; modelID: string } | undefined {
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
  return enqueueOpencodeInlineLm(() =>
    executeOpencodeInlineLmCompletion(userText, options),
  );
}

async function executeOpencodeInlineLmCompletion(
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
    perfCaptureId,
  } = options;

  const tRequest0 = perfMsNow();

  const runtime = getOpenCodeRuntime();
  if (runtime.isRunning) {
    onLoadingPhase?.("opencode-connecting");
  } else {
    onLoadingPhase?.("opencode-start");
  }

  const tBeforeStart = perfMsNow();
  const started = await runtime.start();
  if (!started.ok) {
    return {
      kind: "error",
      message: started.error,
    };
  }
  lmPerf(
    perfCaptureId,
    "runtime-ready",
    `elapsedMs=${Math.round(perfMsNow() - tBeforeStart)}`,
  );

  const rawClient = runtime.getClient();
  if (!rawClient) {
    return { kind: "empty", reason: "no-model" };
  }
  const client = rawClient as SdkClient;

  onLoadingPhase?.("opencode-connecting");

  const sseAbort = new AbortController();
  let sessionId: string | undefined;
  let sessionLifecycleAborted = false;
  let abortedByDeadline = false;

  const disposeCancel = token.onCancellationRequested(() => {
    sessionLifecycleAborted = true;
    sseAbort.abort();
    if (!sessionId) {
      return;
    }
    void client.session.abort({ path: { id: sessionId } });
  });

  const timeoutHandle = setTimeout(() => {
    abortedByDeadline = true;
    sessionLifecycleAborted = true;
    if (!sessionId) {
      return;
    }
    void client.session.abort({ path: { id: sessionId } });
  }, requestTimeoutMs);

  let streamPromise: Promise<void> = Promise.resolve();
  const hadStreamingPreview = typeof onStreamPreview === "function";

  try {
    const providersSnapshot = await getOpenCodeProvidersSnapshot(client, {
      perfCaptureId,
    });
    const modelIds = resolveOpencodeModelIdsFromSnapshot(
      providersSnapshot,
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

    try {
      sessionId = await getOrCreateOpencodeInlineSession(
        client,
        readEnvelopeError,
        perfCaptureId,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      invalidateOpencodeInlineSuggestionSessionPool();
      return { kind: "error", message };
    }

    const instruction = buildCompletionInstruction(userText, style, context);

    onLoadingPhase?.("opencode-generating");

    runtime.logDebugFirstPrompt();

    let tPromptSend = 0;
    let loggedFirstPreview = false;
    const streamPreviewWrapped = onStreamPreview
      ? (accumulatedText: string) => {
          if (
            !loggedFirstPreview &&
            accumulatedText.length > 0 &&
            perfCaptureId !== undefined
          ) {
            loggedFirstPreview = true;
            const sinceSend =
              tPromptSend > 0 ? Math.round(perfMsNow() - tPromptSend) : 0;
            lmPerf(
              perfCaptureId,
              "stream-first-delta",
              `msSincePromptSend=${sinceSend} accumulatedChars=${accumulatedText.length}`,
            );
          }
          onStreamPreview(accumulatedText);
        }
      : undefined;

    if (streamPreviewWrapped) {
      streamPromise = consumeOpencodeSuggestionTextStream(
        rawClient,
        sseAbort.signal,
        streamPreviewWrapped,
        {
          maxPreviewChars: maxSuggestionChars,
          sessionId,
        },
      );
    }

    tPromptSend = perfMsNow();
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
    lmPerf(
      perfCaptureId,
      "prompt",
      `roundTripMs=${Math.round(perfMsNow() - tPromptSend)}`,
    );

    const promptEnvErr = readEnvelopeError(promptResult);
    if (promptEnvErr) {
      invalidateOpencodeInlineSuggestionSessionPool();
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
      invalidateOpencodeInlineSuggestionSessionPool();
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
    if (!token.isCancellationRequested) {
      invalidateOpencodeInlineSuggestionSessionPool();
    }
    if (token.isCancellationRequested) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    if (/abort|cancel/i.test(message)) {
      return { kind: "empty", reason: "request-timeout" };
    }
    return { kind: "error", message };
  } finally {
    if (abortedByDeadline) {
      invalidateOpencodeInlineSuggestionSessionPool();
    }
    sseAbort.abort();
    const tDrain0 =
      perfCaptureId !== undefined && hadStreamingPreview
        ? perfMsNow()
        : 0;
    await streamPromise.catch(() => {
      /* cierre SSE ante abort */
    });
    if (tDrain0 > 0) {
      lmPerf(
        perfCaptureId,
        "sse-consumer-settled",
        `elapsedMs=${Math.round(perfMsNow() - tDrain0)}`,
      );
    }
    lmPerf(
      perfCaptureId,
      "opencode-lm-total",
      `elapsedMs=${Math.round(perfMsNow() - tRequest0)}`,
    );
    clearTimeout(timeoutHandle);
    disposeCancel.dispose();
    /* Fase H: no `session.delete` en critical path ni por request feliz — pool reused; reset en servidor/abort/errores. */
  }
}

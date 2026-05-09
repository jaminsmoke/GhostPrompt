import * as vscode from "vscode";

import { DEFAULT_MODEL_REQUEST_TIMEOUT_MS } from "./types";

export async function collectResponseText(
  response: vscode.LanguageModelChatResponse,
  timeoutMs: number = DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
): Promise<string> {
  let completion = "";
  const iterator = response.text[Symbol.asyncIterator]();
  while (true) {
    const nextChunk = await awaitNextChunkWithTimeout(iterator, timeoutMs);
    if (nextChunk.done) {
      break;
    }
    completion += nextChunk.value;
  }
  return completion;
}

async function awaitNextChunkWithTimeout(
  iterator: AsyncIterator<string>,
  timeoutMs: number,
): Promise<IteratorResult<string>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<string>>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("request-timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

import { execFile } from "node:child_process";

import {
  OPENCODE_CLI_CACHE_TTL_MS,
  OPENCODE_CLI_PROBE_TIMEOUT_MS,
} from "./constants";

export type OpenCodeCliDeps = {
  /** Override for tests; defaults to `child_process.execFile`. */
  execFileImpl?: typeof execFile;
};

export type OpenCodeCliOk = { ok: true; version: string };
export type OpenCodeCliUnavailable = {
  ok: false;
  /** End-user oriented reason (English for logs; UI may localize later). */
  reason: string;
};
export type OpenCodeCliResult = OpenCodeCliOk | OpenCodeCliUnavailable;

let cache: { result: OpenCodeCliResult; atMs: number } | undefined;

export function invalidateOpenCodeCliCache(): void {
  cache = undefined;
}

/**
 * Best-effort detection: `opencode --version` with PATH resolution for `opencode` / `opencode.cmd` on Windows.
 */
export async function checkOpenCodeCli(
  forceRefresh = false,
  deps?: OpenCodeCliDeps,
): Promise<OpenCodeCliResult> {
  if (
    !forceRefresh &&
    cache &&
    Date.now() - cache.atMs < OPENCODE_CLI_CACHE_TTL_MS
  ) {
    return cache.result;
  }
  const execImpl = deps?.execFileImpl ?? execFile;
  const result = await probeOpencodeVersion(execImpl);
  cache = { result, atMs: Date.now() };
  return result;
}

async function probeOpencodeVersion(
  execImpl: typeof execFile,
): Promise<OpenCodeCliResult> {
  const commands: string[][] = [["opencode", "--version"]];
  if (process.platform === "win32") {
    commands.push(["opencode.cmd", "--version"]);
  }

  let lastError: unknown;
  for (const [cmd, ...args] of commands) {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        execImpl(
          cmd,
          args,
          {
            timeout: OPENCODE_CLI_PROBE_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 256 * 1024,
          },
          (err, stdout, stderr) => {
            void stderr;
            if (err) {
              reject(err);
              return;
            }
            const raw = Buffer.isBuffer(stdout)
              ? stdout.toString("utf8")
              : String(stdout ?? "");
            resolve(raw);
          },
        );
      });
      const version =
        text
          .trim()
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .find(Boolean) ?? "";
      if (!version) {
        lastError = new Error("empty output");
        continue;
      }
      return { ok: true, version };
    } catch (e) {
      lastError = e;
    }
  }

  const hint =
    lastError instanceof Error ? lastError.message : String(lastError);
  return {
    ok: false,
    reason: `OpenCode CLI not available (${hint}). Install OpenCode and ensure the CLI is on PATH.`,
  };
}

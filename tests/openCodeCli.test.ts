import type { execFile as ExecFileType } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

import {
  checkOpenCodeCli,
  invalidateOpenCodeCliCache,
} from "../src/opencode/openCodeCli";

function fakeExec(
  stdoutPayload: string,
  error?: Error | null,
): ExecFileType {
  return ((cmd, args, opts, cb) => {
    void cmd;
    void args;
    void opts;
    const callback = cb as (
      err: Error | null,
      stdout: string | Buffer,
      stderr: string | Buffer,
    ) => void;
    callback(error ?? null, stdoutPayload, "");
  }) as ExecFileType;
}

describe("checkOpenCodeCli", () => {
  it("returns ok with first line of stdout when opencode responds", async () => {
    invalidateOpenCodeCliCache();
    const execImpl = fakeExec("1.2.3\nextra line\n");
    const r = await checkOpenCodeCli(true, { execFileImpl: execImpl });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe("1.2.3");
    }
  });

  it("returns unavailable when exec fails", async () => {
    invalidateOpenCodeCliCache();
    const execImpl = fakeExec("", new Error("ENOENT"));
    const r = await checkOpenCodeCli(true, { execFileImpl: execImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("OpenCode CLI not available");
    }
  });

  it("uses cached result within TTL when forceRefresh is false", async () => {
    invalidateOpenCodeCliCache();
    let calls = 0;
    const execImpl = vi.fn(((cmd, args, opts, cb) => {
      void cmd;
      void args;
      void opts;
      calls += 1;
      const callback = cb as (
        err: Error | null,
        stdout: string | Buffer,
        stderr: string | Buffer,
      ) => void;
      callback(null, `v-${calls}\n`, "");
    }) as typeof import("node:child_process").execFile);

    const a = await checkOpenCodeCli(false, { execFileImpl: execImpl });
    const callsAfterFirst = calls;
    const b = await checkOpenCodeCli(false, { execFileImpl: execImpl });
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(callsAfterFirst);
    expect(a).toEqual(b);
  });
});

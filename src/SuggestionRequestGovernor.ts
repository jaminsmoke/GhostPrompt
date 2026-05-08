import * as vscode from "vscode";
import { CompletionResult } from "./CopilotCompletion";

type EmptyReason = Extract<CompletionResult, { kind: "empty" }>["reason"];

export interface GovernorConfig {
  minChars: number;
  cooldownMs: number;
  cacheTtlMs: number;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  sessionBudget: number;
}

export interface GovernorMetrics {
  requested: number;
  servedFromCache: number;
  deduped: number;
  rateLimited: number;
  sessionBlocked: number;
}

export interface GovernorUsageSnapshot {
  requestsInWindow: number;
  remainingInWindow: number;
  sessionUsed: number;
  sessionRemaining: number;
  msUntilWindowReset: number;
}

type GovernorDecision =
  | { kind: "request"; key: string }
  | { kind: "serve-cache"; key: string; result: CompletionResult }
  | { kind: "block"; reason: EmptyReason };

interface CacheEntry {
  result: CompletionResult;
  expiresAt: number;
}

const DEFAULT_CONFIG: GovernorConfig = {
  minChars: 6,
  cooldownMs: 500,
  cacheTtlMs: 45_000,
  rateLimitMaxRequests: 90,
  rateLimitWindowMs: 10 * 60_000,
  sessionBudget: 300,
};

export class SuggestionRequestGovernor {
  private readonly _cache = new Map<string, CacheEntry>();
  private _lastKey = "";
  private _lastAt = 0;
  private _requestTimestamps: number[] = [];
  private _sessionUsed = 0;
  private readonly _metrics: GovernorMetrics = {
    requested: 0,
    servedFromCache: 0,
    deduped: 0,
    rateLimited: 0,
    sessionBlocked: 0,
  };

  public static readonly shared = new SuggestionRequestGovernor();

  public static fromWorkspace(): GovernorConfig {
    const cfg = vscode.workspace.getConfiguration("ghostPrompt");
    return {
      minChars: clampNumber(
        cfg.get<number>("minCharsForSuggestion", DEFAULT_CONFIG.minChars),
        1,
        100,
      ),
      cooldownMs: clampNumber(
        cfg.get<number>("requestCooldownMs", DEFAULT_CONFIG.cooldownMs),
        100,
        5000,
      ),
      cacheTtlMs: clampNumber(
        cfg.get<number>("cacheTtlMs", DEFAULT_CONFIG.cacheTtlMs),
        1000,
        300_000,
      ),
      rateLimitMaxRequests: clampNumber(
        cfg.get<number>(
          "rateLimitMaxRequests",
          DEFAULT_CONFIG.rateLimitMaxRequests,
        ),
        1,
        500,
      ),
      rateLimitWindowMs: clampNumber(
        cfg.get<number>("rateLimitWindowMs", DEFAULT_CONFIG.rateLimitWindowMs),
        10_000,
        60 * 60_000,
      ),
      sessionBudget: clampNumber(
        cfg.get<number>("sessionRequestBudget", DEFAULT_CONFIG.sessionBudget),
        1,
        2000,
      ),
    };
  }

  public decide(text: string, config: GovernorConfig): GovernorDecision {
    const now = Date.now();
    const key = normalizeInput(text);

    if (key.length < config.minChars) {
      return { kind: "block", reason: "too-short" };
    }

    this.cleanupCache(now);
    const cached = this._cache.get(key);
    if (cached) {
      this._metrics.servedFromCache += 1;
      return { kind: "serve-cache", key, result: cached.result };
    }

    if (this._lastKey === key && now - this._lastAt < config.cooldownMs) {
      this._metrics.deduped += 1;
      return { kind: "block", reason: "duplicate-input" };
    }

    if (this._sessionUsed >= config.sessionBudget) {
      this._metrics.sessionBlocked += 1;
      return { kind: "block", reason: "session-budget-exhausted" };
    }

    this.pruneRequestTimestamps(now, config.rateLimitWindowMs);
    if (this._requestTimestamps.length >= config.rateLimitMaxRequests) {
      this._metrics.rateLimited += 1;
      return { kind: "block", reason: "rate-limited" };
    }

    this._lastKey = key;
    this._lastAt = now;
    this._sessionUsed += 1;
    this._requestTimestamps.push(now);
    this._metrics.requested += 1;
    return { kind: "request", key };
  }

  public saveResult(
    key: string,
    result: CompletionResult,
    config: GovernorConfig,
  ): void {
    if (result.kind === "error") {
      return;
    }
    this._cache.set(key, {
      result,
      expiresAt: Date.now() + config.cacheTtlMs,
    });
  }

  public getMetrics(): GovernorMetrics {
    return { ...this._metrics };
  }

  public getUsageSnapshot(config: GovernorConfig): GovernorUsageSnapshot {
    const now = Date.now();
    this.pruneRequestTimestamps(now, config.rateLimitWindowMs);
    const requestsInWindow = this._requestTimestamps.length;
    const remainingInWindow = Math.max(
      0,
      config.rateLimitMaxRequests - requestsInWindow,
    );
    const sessionRemaining = Math.max(0, config.sessionBudget - this._sessionUsed);
    const oldestInWindow = this._requestTimestamps[0];
    const msUntilWindowReset = oldestInWindow
      ? Math.max(0, config.rateLimitWindowMs - (now - oldestInWindow))
      : 0;
    return {
      requestsInWindow,
      remainingInWindow,
      sessionUsed: this._sessionUsed,
      sessionRemaining,
      msUntilWindowReset,
    };
  }

  private cleanupCache(now: number): void {
    for (const [key, entry] of this._cache.entries()) {
      if (entry.expiresAt <= now) {
        this._cache.delete(key);
      }
    }
  }

  private pruneRequestTimestamps(now: number, windowMs: number): void {
    this._requestTimestamps = this._requestTimestamps.filter(
      (t) => now - t <= windowMs,
    );
  }
}

function normalizeInput(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

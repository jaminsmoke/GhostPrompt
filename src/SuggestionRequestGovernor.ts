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
  cooldownMs: 700,
  cacheTtlMs: 45_000,
  rateLimitMaxRequests: 40,
  rateLimitWindowMs: 10 * 60_000,
  sessionBudget: 120,
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
      minChars: clampNumber(cfg.get<number>("minCharsForSuggestion", 6), 1, 100),
      cooldownMs: clampNumber(cfg.get<number>("requestCooldownMs", 700), 100, 5000),
      cacheTtlMs: clampNumber(cfg.get<number>("cacheTtlMs", 45_000), 1000, 300_000),
      rateLimitMaxRequests: clampNumber(
        cfg.get<number>("rateLimitMaxRequests", 40),
        1,
        500,
      ),
      rateLimitWindowMs: clampNumber(
        cfg.get<number>("rateLimitWindowMs", 10 * 60_000),
        10_000,
        60 * 60_000,
      ),
      sessionBudget: clampNumber(
        cfg.get<number>("sessionRequestBudget", 120),
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

    this._requestTimestamps = this._requestTimestamps.filter(
      (t) => now - t <= config.rateLimitWindowMs,
    );
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

  private cleanupCache(now: number): void {
    for (const [key, entry] of this._cache.entries()) {
      if (entry.expiresAt <= now) {
        this._cache.delete(key);
      }
    }
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

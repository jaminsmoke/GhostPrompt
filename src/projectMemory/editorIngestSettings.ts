import * as vscode from "vscode";

import { normalizeWorkspaceRelativePath } from "./workspaceRelativePath";

/** UTF-16 máximas del excerpt de ficheros editor-ingest en el prompt. */
export const PROJECT_EDITOR_CARD_MAX_CHARS = 1200;

export { normalizeWorkspaceRelativePath };

export function readEditorIngestConfig(): {
  /** `projectMemoryEnabled` && `projectMemoryEditorIngestEnabled` */
  includeEditorIngest: boolean;
  maxTotalBytes: number;
  maxEntryBytes: number;
  maxEditorSources: number;
  maxFileBytes: number;
  allowedExtensions: Set<string>;
  excludePathPatterns: readonly string[];
} {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const includeEditorIngest =
    cfg.get<boolean>("projectMemoryEnabled", true) &&
    cfg.get<boolean>("projectMemoryEditorIngestEnabled", true);

  const maxTotalBytes = clampInt(
    cfg.get<number>("projectMemoryMaxTotalBytes", 393_216),
    16_384,
    4_194_304,
  );
  const maxEntryBytes = clampInt(
    cfg.get<number>("projectMemoryMaxEntryBytes", 32_768),
    512,
    512_000,
  );
  const maxEditorSources = clampInt(
    cfg.get<number>("projectMemoryMaxEditorSources", 48),
    1,
    500,
  );
  const maxFileBytes = clampInt(
    cfg.get<number>("projectMemoryEditorMaxFileBytes", 512_000),
    1024,
    10_485_760,
  );

  const extRaw = cfg.get<string>(
    "projectMemoryEditorAllowedExtensions",
    ".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.md,.css,.scss,.html,.vue,.py,.rs,.go,.java,.cs,.cpp,.c,.h,.yaml,.yml,.toml,.xml,.sql,.sh,.ps1,.dockerfile",
  );
  const allowedExtensions = new Set(
    extRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((s) => (s.startsWith(".") ? s : `.${s}`)),
  );

  const excludePathPatterns = (
    cfg.get<string[]>("projectMemoryEditorPathExcludeGlobs", []) ?? []
  ).filter((s) => typeof s === "string" && s.trim());

  return {
    includeEditorIngest,
    maxTotalBytes,
    maxEntryBytes,
    maxEditorSources,
    maxFileBytes,
    allowedExtensions,
    excludePathPatterns,
  };
}

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(v)));
}

/** Best-effort exclusión sin glob pesado (p. ej. segmentos `node_modules`, `.git`, `.env`). */
export function pathLikelyExcludedForEditorIngest(
  normalizedRelativePath: string,
  extraPatterns: readonly string[],
): boolean {
  const p = normalizedRelativePath.replace(/\\/g, "/").toLowerCase();
  const segments = p.split("/");
  if (segments.some((s) => s === "node_modules" || s === ".git")) {
    return true;
  }
  if (
    p.includes("/node_modules/") ||
    p.startsWith("node_modules/") ||
    p.includes("/.git/") ||
    p.includes(".env")
  ) {
    return true;
  }
  for (const raw of extraPatterns) {
    const pat = raw.trim().toLowerCase().replace(/\\/g, "/");
    if (!pat) {
      continue;
    }
    if (pat.includes("*")) {
      const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
      try {
        if (new RegExp(`^${escaped}$`).test(p)) {
          return true;
        }
      } catch {
        //
      }
    } else if (p.includes(pat) || p.startsWith(pat)) {
      return true;
    }
  }
  return false;
}

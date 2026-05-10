/**
 * Card “bootstrap” cuando `contextMode === "project"`:
 * extracto de README y resumen de package.json.
 *
 * Fase A: solo en memoria para el prompt.
 * Fase C: `ProjectBootstrapPiece` incluye mtime/hash para persistencia y validación en disco.
 */
import { createHash } from "node:crypto";

import * as vscode from "vscode";

/** Unidades UTF-16 máximas del excerpt de README tras compactar whitespace. */
export const PROJECT_README_CARD_MAX_CHARS = 1400;

/** Unidades UTF-16 máximas del resumen derivado de package.json. */
export const PROJECT_PACKAGE_JSON_SUMMARY_MAX_CHARS = 560;

/** Nombres de script listados como máximo en el resumen de package.json. */
export const PROJECT_PACKAGE_JSON_MAX_SCRIPT_NAMES = 12;

const README_CANDIDATES = [
  "README.md",
  "readme.md",
  "Readme.md",
  "README.TXT",
] as const;

export function sha256HexBytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function truncateProjectCardText(text: string, maxChars: number): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const slice = trimmed.slice(0, Math.max(0, maxChars - 3));
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxChars * 0.82) ? slice.slice(0, lastSpace) : slice;
  return `${cut}...`;
}

export function summarizePackageJsonForProjectCard(jsonText: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return "";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }
  const o = parsed as Record<string, unknown>;
  const parts: string[] = [];

  const addString = (key: string, maxInner: number) => {
    const v = o[key];
    if (typeof v !== "string" || !v.trim()) {
      return;
    }
    parts.push(`${key}=${truncateProjectCardText(v.trim(), maxInner)}`);
  };

  addString("name", 160);
  addString("version", 40);
  addString("description", 220);
  if (typeof o.private === "boolean") {
    parts.push(`private=${String(o.private)}`);
  }
  if (typeof o.type === "string" && o.type.trim()) {
    parts.push(`type=${o.type.trim()}`);
  }
  if (Array.isArray(o.keywords)) {
    const kw = o.keywords
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 8);
    if (kw.length) {
      parts.push(`keywords=${kw.join(",")}`);
    }
  }
  const scripts = o.scripts;
  if (scripts && typeof scripts === "object" && !Array.isArray(scripts)) {
    const names = Object.keys(scripts as Record<string, unknown>)
      .filter((k) => k.trim())
      .sort()
      .slice(0, PROJECT_PACKAGE_JSON_MAX_SCRIPT_NAMES);
    if (names.length) {
      parts.push(`scripts: ${names.join(",")}`);
    }
  }

  const joined = parts.join("; ");
  return joined ? truncateProjectCardText(joined, PROJECT_PACKAGE_JSON_SUMMARY_MAX_CHARS) : "";
}

export function fingerprintProjectBootstrapLines(lines: readonly string[]): string {
  if (!lines.length) {
    return "";
  }
  return createHash("sha256").update(lines.join("\u0001")).digest("hex").slice(0, 16);
}

export interface ProjectBootstrapPiece {
  /** Ruta relativa al workspace (nombre real del README si difiere en mayúsculas). */
  relativePath: string;
  /** Línea lista para el prompt (misma que fase A). */
  promptLine: string;
  /** `vscode.FileStat.mtime` del fichero al leer (ms). */
  sourceMtimeMs: number;
  /** SHA-256 hex del contenido binario leído del workspace. */
  sourceSha256: string;
}

/** Raíz del workspace para bootstrap (editor activo o primera carpeta). */
export function resolveGhostPromptWorkspaceFolderUri(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  const folder = editor
    ? vscode.workspace.getWorkspaceFolder(editor.document.uri)
    : undefined;
  return folder?.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

/** Orden estable: README* antes que `package.json`; el resto alfabético. */
export function sortProjectBootstrapPieces(
  pieces: readonly ProjectBootstrapPiece[],
): ProjectBootstrapPiece[] {
  return [...pieces].sort((a, b) => {
    const rp = bootstrapRelativePathBucket(a.relativePath) -
      bootstrapRelativePathBucket(b.relativePath);
    if (rp !== 0) {
      return rp;
    }
    return a.relativePath.localeCompare(b.relativePath, "en", { sensitivity: "base" });
  });
}

/** 1 = readme-familia, 2 = package manifest, 0 = otros. */
function bootstrapRelativePathBucket(rel: string): number {
  const lower = rel.toLowerCase();
  if (lower === "package.json") {
    return 2;
  }
  const base = lower.replace(/^.*[/\\]/, "");
  return base.startsWith("readme") ? 1 : 0;
}

/**
 * Lee README y package.json bajo la raíz del workspace (documento activo o primera carpeta).
 * Errores de FS se ignoran; nunca lanza.
 */
export async function collectProjectBootstrapPieces(
  root?: vscode.Uri,
): Promise<ProjectBootstrapPiece[]> {
  const wsRoot = root ?? resolveGhostPromptWorkspaceFolderUri();
  if (!wsRoot) {
    return [];
  }
  const out: ProjectBootstrapPiece[] = [];

  for (const name of README_CANDIDATES) {
    const uri = vscode.Uri.joinPath(wsRoot, name);
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder("utf-8").decode(bytes);
      const compact = text.replace(/\s+/g, " ").trim();
      if (!compact) {
        continue;
      }
      const excerpt = truncateProjectCardText(compact, PROJECT_README_CARD_MAX_CHARS);
      out.push({
        relativePath: name,
        promptLine: `README excerpt (${name}): ${excerpt}`,
        sourceMtimeMs: stat.mtime,
        sourceSha256: sha256HexBytes(bytes),
      });
      break;
    } catch {
      // omitido
    }
  }

  try {
    const pkgUri = vscode.Uri.joinPath(wsRoot, "package.json");
    const stat = await vscode.workspace.fs.stat(pkgUri);
    const bytes = await vscode.workspace.fs.readFile(pkgUri);
    const text = new TextDecoder("utf-8").decode(bytes);
    const summary = summarizePackageJsonForProjectCard(text);
    if (summary.trim()) {
      out.push({
        relativePath: "package.json",
        promptLine: `package.json: ${summary}`,
        sourceMtimeMs: stat.mtime,
        sourceSha256: sha256HexBytes(bytes),
      });
    }
  } catch {
    // omitido
  }

  return sortProjectBootstrapPieces(out);
}

/**
 * Líneas del card en orden estable (mismas heurísticas que {@link collectProjectBootstrapPieces}).
 */
export async function buildProjectBootstrapCardLines(): Promise<readonly string[]> {
  const pieces = await collectProjectBootstrapPieces();
  return pieces.map((p) => p.promptLine);
}

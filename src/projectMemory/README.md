# `projectMemory/` — Memoria del proyecto

> Dominio canónico que gestiona el almacenamiento, reconcile y ingest de contexto del proyecto para suggestions.

---

## Rol

`projectMemory/` implementa un sistema de **memoria persistente por workspace** que indexa archivos bootstrap (README, package.json) y documentos del editor activo, reconciliando cambios y sirviendo excerpts al pipeline de suggestion cuando `contextMode: project`.

**No debe contener:**
- Lógica de suggestion (eso es `core/`)
- Integración con VS Code providers (eso es `vscode/`)

---

## Estructura

```
projectMemory/
├── activateProjectMemory.ts     # Entry point: registra store, watchers, comandos
├── ProjectMemoryStore.ts        # Store principal: reconcile, query, LRU
├── projectMemoryTypes.ts        # Tipos canónicos: entries, snapshots, queries
├── projectMemoryJson.ts         # Lectura/escritura de JSON en globalStorageUri
├── projectMemoryNodeFs.ts       # Adaptador Node FS para el store
├── workspaceFileProbes.ts       # Probing de archivos bootstrap (README*, package.json)
├── workspaceKey.ts              # Generación de clave SHA-256 por workspace
├── workspaceRelativePath.ts     # Paths relativos al workspace
├── entriesMutation.ts           # Mutaciones de entries (add, update, evict, LRU)
├── editorIngestActiveDocument.ts # Ingest del documento activo del editor
├── editorIngestSettings.ts      # Settings de editor ingest (filters, limits)
├── editorIngestLru.ts           # LRU pool de editor sources
├── editorStoredHelpers.ts       # Helpers para almacenar editor sources
├── bootstrapStoredHelpers.ts    # Helpers para almacenar bootstrap sources
├── indexedPathsFileWatcher.ts   # FileSystemWatcher para paths indexados
├── persistProjectBootstrapSnapshot.ts # Persist snapshot reconcile para suggest
└── index.ts                     # Barrel público
```

---

## Almacenamiento en disco

```
ExtensionContext.globalStorageUri/
└── ghostPrompt/projectMemory/v1/
    ├── registry.json                    # Workspace keys, lastSeenAt, GC
    └── stores/
        └── <sha256-workspace-key>/
            ├── manifest.json            # Schema version, metadata
            └── entries.json             # Bootstrap + editor entries, LRU
```

### `registry.json`

```json
{
  "stores": [
    {
      "workspaceKey": "abc123...",
      "storeFolderName": "abc123...",
      "lastSeenAt": 1715630400000
    }
  ]
}
```

### `entries.json`

```json
{
  "entries": [
    {
      "relativePath": "README.md",
      "sourceType": "bootstrap",
      "promptLine": "README excerpt (README.md): hello project",
      "sourceMtimeMs": 1715630400000,
      "sourceSha256": "abc123...",
      "lastAccessedAt": 1715630400000,
      "byteSize": 1234
    }
  ],
  "totalBytes": 1234,
  "lastReconciledAt": 1715630400000
}
```

---

## Flujo de reconcile

```
Suggestion request (contextMode: project)
    │
    ▼
resolveGhostPromptWorkspaceFolderUri()
    │
    ▼
collectProjectBootstrapPieces(folderUri)
    ├── Probe README* files
    ├── Probe package.json
    └── Extract prompt lines (truncated, formatted)
    │
    ▼
reconcileProjectMemoryForSuggest({ workspaceRootUri, livePieces })
    ├── Load existing entries.json
    ├── Merge live pieces (new/updated)
    ├── Evict stale entries (hash/mtime mismatch)
    ├── Apply LRU if over byte cap
    └── Return ProjectMemoryReconcileSnapshot
    │
    ▼
writeReconciledProjectBootstrapSnapshot(snapshot)
    └── Persist entries.json + manifest.json
```

---

## Editor ingest

Cuando `projectMemoryEditorIngestEnabled: true`:

```
Active document change
    │
    ▼
editorIngestActiveDocument()
    ├── Check extension filter (.ts, .js, .py, etc.)
    ├── Check size limit (< max bytes)
    ├── Extract prompt lines from selection/content
    └── Store in entries.json (LRU pool)
```

### Filtros de extensión

Archivos con extensiones de código son priorizados. Archivos binarios, imágenes y archivos > `projectMemoryMaxEditorSourceBytes` son excluidos.

---

## File watchers

Cuando `projectMemoryFileWatcherEnabled: true`:

- Un `FileSystemWatcher` por path indexado en `entries.json`
- Throttle: `projectMemoryFileWatcherThrottleMs` (default 5000ms)
- Eventos: `onDidChange` (invalida hash), `onDidDelete` (evict entry)

---

## Garbage collection

- **Unused stores:** Eliminados tras `projectMemoryUnusedStoreTtlDays` (default 30)
- **LRU:** Entries más antiguas evictadas cuando `totalBytes > projectMemoryMaxTotalBytes`
- **Comando:** `GhostPrompt: Clear Project Memory (This Workspace)` elimina el store del workspace activo

---

## Settings

| Setting | Default | Rol |
|---------|---------|-----|
| `projectMemoryEnabled` | `true` | Master switch |
| `projectMemoryEditorIngestEnabled` | `true` | Ingest de documentos activos |
| `projectMemoryMaxTotalBytes` | `50000` | Cap total de bytes del store |
| `projectMemoryMaxEditorSources` | `10` | Máximo de editor sources en LRU |
| `projectMemoryUnusedStoreTtlDays` | `30` | GC de stores no usados |
| `projectMemoryFileWatcherEnabled` | `true` | Watchers de invalidación |
| `projectMemoryFileWatcherThrottleMs` | `5000` | Throttle de watchers |

---

## Dependencias

| Importa de | Por qué |
|------------|---------|
| `vscode` | Workspace, FileSystemWatcher, commands |
| `system/debug/SuggestionDebug` | Logging de debug |

**No importa de:** `host/`, `api/`, `vscode/` (para evitar cycles conceptuales)

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `projectMemoryStore.test.ts` | Store principal: reconcile, query, LRU |
| `projectBootstrapContext.test.ts` | Bootstrap pieces, fingerprint |
| `bootstrapStoredHelpers.test.ts` | Helpers de almacenamiento bootstrap |
| `entriesMutation.test.ts` | Mutaciones: add, update, evict, LRU |
| `editorIngestLru.test.ts` | LRU pool de editor sources |

# `system/internals/config/` — Lectores de configuración GhostPrompt

> Funciones que leen claves concretas de `vscode.workspace.getConfiguration('ghostPrompt')` y devuelven valores ya tipados o coaccionados para el runtime y la UI.

La configuración de **fuentes de completado** (`enabledCompletionSources`, modo legacy, etc.) sigue en `engines/config/completionSources.ts`.

Aquí van lectores **transversales** o que acoplan el host a contratos de `system/internals/protocols/types/` sin pasar por el barrel `api/getters/`.

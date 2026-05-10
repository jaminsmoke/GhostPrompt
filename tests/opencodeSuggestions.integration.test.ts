/**
 * Integración real: CLI OpenCode + servidor embebido + `requestOpencodeCompletion`.
 *
 * Por defecto esta suite está **omitida** para CI y entornos sin OpenCode.
 * Para ejecutarla (requiere CLI en PATH y proveedores/modelos configurados en OpenCode):
 *
 * PowerShell:
 *   $env:GHOST_PROMPT_OPENCODE_INTEGRATION="1"; npm run test:integration
 *
 * Opcional si "auto" no elige bien el modelo:
 *   $env:GHOST_PROMPT_OPENCODE_MODEL="proveedor/id-modelo"
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: (_section: string) => ({
      get: (_key: string, defaultValue: unknown) => defaultValue,
    }),
  },
}));

import { checkOpenCodeCli } from "../src/opencode/openCodeCli";
import { getOpenCodeRuntime } from "../src/opencode/OpenCodeRuntime";
import { requestOpencodeCompletion } from "../src/completion/providers/opencodeLmCompletion";
import { listOpencodeSuggestionModels } from "../src/completion/opencodeModelCatalog";

const integrationEnabled =
  process.env.GHOST_PROMPT_OPENCODE_INTEGRATION === "1";

function makeCancellationToken(): import("vscode").CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  } as import("vscode").CancellationToken;
}

describe.skipIf(!integrationEnabled)(
  "OpenCode integration (CLI + servidor embebido)",
  () => {
    beforeAll(async () => {
      const cli = await checkOpenCodeCli(true);
      if (!cli.ok) {
        throw new Error(
          `GHOST_PROMPT_OPENCODE_INTEGRATION=1 pero el CLI no está disponible: ${cli.reason}`,
        );
      }
    });

    afterAll(() => {
      getOpenCodeRuntime().stop();
    });

    it(
      "lista modelos y devuelve una suggestion no vacía",
      async () => {
        const models = await listOpencodeSuggestionModels("anyModel");
        expect(
          models.length,
          "OpenCode debe exponer al menos un modelo (revisa `config.providers` y credenciales).",
        ).toBeGreaterThan(0);

        const preferred =
          process.env.GHOST_PROMPT_OPENCODE_MODEL?.trim() || undefined;

        const result = await requestOpencodeCompletion(
          'Reply with only the word pong and nothing else.',
          {
            token: makeCancellationToken(),
            policy: "anyModel",
            preferredModelId: preferred ?? "auto",
            style: "concise",
            maxSuggestionChars: 200,
            requestTimeoutMs: 180_000,
          },
        );

        expect(
          result.kind,
          result.kind === "error"
            ? result.message
            : result.kind === "empty"
              ? `empty: ${result.reason}`
              : "",
        ).toBe("suggestion");

        if (result.kind === "suggestion") {
          expect(result.suggestion.trim().length).toBeGreaterThan(0);
        }
      },
      240_000,
    );
  },
);

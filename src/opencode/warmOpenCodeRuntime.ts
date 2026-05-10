import { getEnabledCompletionSources } from "../completion/completionSources";
import { OPENCODE_WARM_THROTTLE_MS } from "./constants";
import { getOpenCodeRuntime } from "./OpenCodeRuntime";

let lastWarmAtMs = 0;

/**
 * Si OpenCode está entre las fuentes habilitadas, arranca el runtime y un ping `config.get` en segundo plano.
 * Llámalo al abrir una vista GhostPrompt para amortiguar el cold start antes del primer suggest.
 * Limitado por {@link OPENCODE_WARM_THROTTLE_MS} para no spamear si hay Sidebar + Panel.
 */
export function warmOpenCodeRuntimeIfConfigured(): void {
  const sources = getEnabledCompletionSources();
  if (!sources.includes("opencode")) {
    return;
  }

  const now = Date.now();
  if (now - lastWarmAtMs < OPENCODE_WARM_THROTTLE_MS) {
    return;
  }
  lastWarmAtMs = now;

  void (async () => {
    const runtime = getOpenCodeRuntime();
    const started = await runtime.start();
    if (!started.ok) {
      return;
    }
    await runtime.isHealthy();
  })();
}

/**
 * Una sola ejecución de `requestOpencodeCompletion` activa contra el SDK / sesión pooled.
 * Dos prompts concurrentes sobre la misma sesión OpenCode pueden encolar en el servidor,
 * disparar timeouts (~12 s) y retrasos multi‑segundo hasta el primer token SSE — ver spikes.
 */

let lmTail = Promise.resolve();

/** Encadena tareas LM inline (OpenCode path) en serie; conserva rejects. */
export function enqueueOpencodeInlineLm<T>(task: () => Promise<T>): Promise<T> {
  const run = lmTail.then(task);
  lmTail = run.then(() => {}, () => {});
  return run;
}

/** Liberar cola al apagar la extensión o en setup de tests. */
export function resetOpencodeInlineLmQueue(): void {
  lmTail = Promise.resolve();
}

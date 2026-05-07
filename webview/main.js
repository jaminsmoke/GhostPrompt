/**
 * Client-side logic for the GhostPrompt webview.
 * Communicates with the extension host exclusively via VS Code's postMessage API.
 *
 * Inbound  (host → webview):
 *   { type: 'suggestion', suggestion: string, captureId: number }
 *   { type: 'clear' }
 *
 * Outbound (webview → host):
 *   { type: 'suggest',  text: string, captureId: number }
 *   { type: 'accept',   context: string, suggestion: string }
 *   { type: 'send',     text: string }
 */
(function () {
  "use strict";

  const vscode = acquireVsCodeApi();
  const input = /** @type {HTMLTextAreaElement} */ (
    document.getElementById("prompt-input")
  );
  const sendBtn = document.getElementById("send-btn");
  const ghostEl = document.getElementById("ghost-text");

  /** ID de la última solicitud de suggestion enviada al host. */
  let currentCaptureId = 0;
  /** Texto de la suggestion actualmente mostrada (vacío si no hay ninguna). */
  let pendingSuggestion = "";

  /** Temporizador de debounce para las solicitudes de suggestion. */
  let debounceTimer = null;

  // ── Envío de suggestion al host (con debounce) ───────────────────────────

  function requestSuggestion() {
    clearTimeout(debounceTimer);
    clearGhost();
    const text = input.value;
    if (!text.trim()) {
      return;
    }
    debounceTimer = setTimeout(() => {
      currentCaptureId += 1;
      vscode.postMessage({
        type: "suggest",
        text,
        captureId: currentCaptureId,
      });
    }, 300);
  }

  // ── Ghost-text helpers ───────────────────────────────────────────────────

  function showGhost(text) {
    pendingSuggestion = text;
    ghostEl.textContent = text;
    ghostEl.style.display = "block";
  }

  function clearGhost() {
    pendingSuggestion = "";
    ghostEl.textContent = "";
    ghostEl.style.display = "none";
  }

  // ── Aceptar suggestion con Tab ───────────────────────────────────────────

  function acceptSuggestion() {
    if (!pendingSuggestion) {
      return false;
    }
    const context = input.value;
    input.value += pendingSuggestion;
    vscode.postMessage({
      type: "accept",
      context,
      suggestion: pendingSuggestion,
    });
    clearGhost();
    // Mover cursor al final.
    input.selectionStart = input.selectionEnd = input.value.length;
    return true;
  }

  // ── Envío al chat ────────────────────────────────────────────────────────

  function send() {
    const text = input.value.trim();
    if (!text) {
      return;
    }
    clearGhost();
    clearTimeout(debounceTimer);
    vscode.postMessage({ type: "send", text });
  }

  // ── Event listeners ──────────────────────────────────────────────────────

  input.addEventListener("input", requestSuggestion);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      acceptSuggestion();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  sendBtn.addEventListener("click", send);

  // ── Mensajes desde el host ───────────────────────────────────────────────

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "suggestion") {
      // Descartar si llegó fuera de tiempo (usuario ya siguió escribiendo).
      if (message.captureId !== currentCaptureId) {
        return;
      }
      if (message.suggestion) {
        showGhost(message.suggestion);
      }
    } else if (message.type === "clear") {
      input.value = "";
      clearGhost();
      input.focus();
    }
  });
})();

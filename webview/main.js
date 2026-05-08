/**
 * Client-side logic for the GhostPrompt webview.
 * Communicates with the extension host exclusively via VS Code's postMessage API.
 *
 * Inbound  (host → webview):
 *   { type: 'loading', captureId: number }
 *   { type: 'suggestion', suggestion: string, captureId: number, model?: { id: string, label: string, tier: 'free' | 'premium' } }
 *   { type: 'empty', reason: 'no-model' | 'no-non-premium-model' | 'premium-quota-blocked' | 'empty-response' | 'too-short' | 'duplicate-input' | 'rate-limited' | 'session-budget-exhausted', captureId: number }
 *   { type: 'error', message: string, captureId: number }
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
  const inputStack = document.querySelector(".input-stack");
  const ghostInline = document.getElementById("ghost-inline");
  const ghostMeasure = document.getElementById("ghost-measure");
  const sendBtn = document.getElementById("send-btn");
  const statusEl = document.getElementById("status-text");
  const settingGroups = Array.from(document.querySelectorAll(".setting-group"));
  const debugBtn = document.getElementById("debug-btn");
  const modelRuntimeLabel = document.getElementById("model-runtime-label");
  const modelSelect = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("model-select")
  );

  /** ID de la última solicitud de suggestion enviada al host. */
  let currentCaptureId = 0;
  /** Texto de la suggestion actualmente mostrada (vacío si no hay ninguna). */
  let pendingSuggestion = "";
  const MIN_COMPOSER_HEIGHT = 56;

  /** Temporizador de debounce para las solicitudes de suggestion. */
  let debounceTimer = null;

  /** Ghost visible solo con foco en el textarea y cursor al final (sin selección). */
  function isGhostUiAllowed() {
    if (document.activeElement !== input) {
      return false;
    }
    const len = input.value.length;
    return input.selectionStart === len && input.selectionEnd === len;
  }

  /** Si hace falta, inserta un espacio entre el contexto y la sugerencia (evita "parala"). */
  function joinSeparatorBeforeSuggestion(context, suggestion) {
    if (!suggestion) {
      return "";
    }
    if (!context) {
      return "";
    }
    const first = suggestion[0];
    const last = context[context.length - 1];
    if (!last) {
      return "";
    }

    // Evita duplicados tipo "..", ",," o espacios repetidos en la frontera.
    if (last === first && /[\s.,;:!?]/.test(first)) {
      return "";
    }
    if (/\s/.test(first)) {
      return "";
    }
    if (/\s/.test(last)) {
      return "";
    }
    if (isWordChar(last) && isWordChar(first)) {
      return " ";
    }
    return "";
  }

  function isWordChar(char) {
    return /[\p{L}\p{N}_]/u.test(char);
  }

  function refreshGhostPresentation() {
    renderInlineGhost();
    syncComposerHeight();
  }

  function buildInsertedSuggestion(context, suggestion) {
    const gap = joinSeparatorBeforeSuggestion(context, suggestion);
    return normalizeAcceptedSuggestion(context, gap + suggestion);
  }

  // ── Envío de suggestion al host (con debounce) ───────────────────────────

  function requestSuggestion() {
    clearTimeout(debounceTimer);
    clearGhost();
    clearStatus();
    const text = input.value;
    syncComposerHeight();
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
    renderInlineGhost();
    syncComposerHeight();
  }

  function clearGhost() {
    pendingSuggestion = "";
    renderInlineGhost();
    syncComposerHeight();
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderInlineGhost() {
    if (!pendingSuggestion || !isGhostUiAllowed()) {
      ghostInline.innerHTML = "";
      return;
    }
    const typed = escapeHtml(input.value);
    const renderedSuggestion = buildInsertedSuggestion(input.value, pendingSuggestion);
    if (!renderedSuggestion) {
      ghostInline.innerHTML = "";
      return;
    }
    const suggestion = escapeHtml(renderedSuggestion);
    ghostInline.innerHTML =
      `<span class="typed">${typed}</span>` +
      `<span class="suggestion">${suggestion}</span>`;
    ghostInline.scrollTop = inputStack.scrollTop;
    ghostInline.scrollLeft = inputStack.scrollLeft;
  }

  function syncComposerHeight() {
    const ghostVisible = Boolean(pendingSuggestion) && isGhostUiAllowed();
    const renderedSuggestion = ghostVisible
      ? buildInsertedSuggestion(input.value, pendingSuggestion)
      : "";
    const combined = ghostVisible
      ? `${input.value}${renderedSuggestion}`
      : input.value;
    ghostMeasure.textContent = combined || " ";
    const measured = Math.max(MIN_COMPOSER_HEIGHT, ghostMeasure.scrollHeight + 2);
    input.style.height = `${measured}px`;
    ghostInline.style.minHeight = `${measured}px`;
  }

  function showStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
    statusEl.style.display = "block";
  }

  function toUserErrorMessage(rawMessage) {
    if (!rawMessage) {
      return "Error al generar sugerencia.";
    }
    const normalized = String(rawMessage).trim();
    // Evitar mensajes demasiado largos o poco legibles en la UI.
    const compact = normalized.replace(/\s+/g, " ");
    const maxLen = 140;
    if (compact.length <= maxLen) {
      return `Error: ${compact}`;
    }
    return `Error: ${compact.slice(0, maxLen - 3)}...`;
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    statusEl.style.display = "none";
  }

  // ── Aceptar suggestion con Tab ───────────────────────────────────────────

  function acceptSuggestion() {
    if (!pendingSuggestion || !isGhostUiAllowed()) {
      return false;
    }
    const context = input.value;
    const inserted = buildInsertedSuggestion(context, pendingSuggestion);
    input.value += inserted;
    vscode.postMessage({
      type: "accept",
      context,
      suggestion: inserted,
    });
    clearGhost();
    clearStatus();
    // Mover cursor al final.
    input.selectionStart = input.selectionEnd = input.value.length;
    return true;
  }

  function normalizeAcceptedSuggestion(context, inserted) {
    if (!inserted || !context) {
      return inserted;
    }
    const last = context[context.length - 1];
    const first = inserted[0];
    if (!last || !first) {
      return inserted;
    }
    if (last === first && /[\s.,;:!?]/.test(first)) {
      return inserted.slice(1);
    }
    return inserted;
  }

  // ── Envío al chat ────────────────────────────────────────────────────────

  function send() {
    const text = input.value.trim();
    if (!text) {
      return;
    }
    clearGhost();
    clearStatus();
    clearTimeout(debounceTimer);
    vscode.postMessage({ type: "send", text });
  }

  // ── Event listeners ──────────────────────────────────────────────────────

  input.addEventListener("input", requestSuggestion);
  input.addEventListener("keyup", refreshGhostPresentation);
  input.addEventListener("click", refreshGhostPresentation);
  input.addEventListener("focus", refreshGhostPresentation);
  input.addEventListener("blur", refreshGhostPresentation);
  document.addEventListener("selectionchange", () => {
    if (document.activeElement !== input) {
      return;
    }
    refreshGhostPresentation();
  });
  inputStack.addEventListener("scroll", () => {
    ghostInline.scrollTop = inputStack.scrollTop;
    ghostInline.scrollLeft = inputStack.scrollLeft;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      if (pendingSuggestion && isGhostUiAllowed()) {
        e.preventDefault();
        acceptSuggestion();
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  sendBtn.addEventListener("click", send);
  modelSelect?.addEventListener("change", () => {
    vscode.postMessage({
      type: "updateSetting",
      key: "selectedModelId",
      value: modelSelect.value || "auto",
    });
  });
  settingGroups.forEach((group) => {
    group.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest(".chip");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const key = group.getAttribute("data-key");
      const value = button.getAttribute("data-value");
      if (!key || !value) {
        return;
      }
      vscode.postMessage({
        type: "updateSetting",
        key,
        value,
      });
    });
    group.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      event.preventDefault();
      const chips = Array.from(group.querySelectorAll(".chip"));
      const index = chips.indexOf(target);
      if (index < 0) {
        return;
      }
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + chips.length) % chips.length;
      const next = chips[nextIndex];
      if (next instanceof HTMLButtonElement) {
        next.focus();
        next.click();
      }
    });
  });
  debugBtn.addEventListener("click", () => {
    const next = debugBtn.dataset.enabled !== "true";
    vscode.postMessage({
      type: "updateSetting",
      key: "debugSuggestions",
      value: next,
    });
  });
  vscode.postMessage({ type: "init" });
  syncComposerHeight();

  // ── Mensajes desde el host ───────────────────────────────────────────────

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      typeof message.captureId === "number" &&
      message.captureId !== currentCaptureId
    ) {
      return;
    }

    if (message.type === "loading") {
      showStatus("Buscando sugerencia...");
    } else if (message.type === "suggestion") {
      // Descartar si llegó fuera de tiempo (usuario ya siguió escribiendo).
      if (message.suggestion) {
        clearStatus();
        showGhost(message.suggestion);
        setRuntimeModelLabel(message.model);
      }
    } else if (message.type === "empty") {
      clearGhost();
      if (message.reason === "no-model") {
        showStatus("Copilot no disponible en esta sesión.");
      } else if (message.reason === "no-non-premium-model") {
        showStatus("No hay modelo no premium disponible para suggestions.");
      } else if (message.reason === "premium-quota-blocked") {
        showStatus("Suggestions pausadas para evitar consumo de cuota premium.");
      } else if (message.reason === "too-short") {
        showStatus("Escribe un poco más para sugerir mejor.");
      } else if (message.reason === "duplicate-input") {
        showStatus("Esperando cambios en el texto...");
      } else if (message.reason === "rate-limited") {
        showStatus("Pausado temporalmente por limite de llamadas. Puedes ampliar el limite en Settings.");
      } else if (message.reason === "session-budget-exhausted") {
        showStatus("Se alcanzo el limite de suggestions de esta sesion. Ajustalo en Settings si necesitas mas.");
      } else {
        showStatus("Sin sugerencia para este texto.");
      }
    } else if (message.type === "error") {
      clearGhost();
      showStatus(toUserErrorMessage(message.message), true);
    } else if (message.type === "settings") {
      const settings = message.settings ?? {};
      setActiveChip("suggestionModelPolicy", settings.suggestionModelPolicy);
      setModelOptions(settings.availableModels, settings.selectedModelId);
      setActiveChip("suggestionStyle", settings.suggestionStyle);
      setActiveChip("contextMode", settings.contextMode);
      setActiveChip("suggestionLanguageChoice", settings.suggestionLanguageChoice);
      setLanguageAutoLabel(settings.effectiveSuggestionLanguage);
      setRuntimeModelLabel(settings.effectiveModel);
      const isDebug = Boolean(settings.debugSuggestions);
      debugBtn.dataset.enabled = String(isDebug);
      debugBtn.textContent = isDebug ? "Debug: on" : "Debug: off";
    } else if (message.type === "languageEffective") {
      setLanguageAutoLabel(message.language);
    } else if (message.type === "clear") {
      input.value = "";
      clearGhost();
      clearStatus();
      syncComposerHeight();
      inputStack.scrollTop = 0;
      input.focus();
    }
  });

  function setActiveChip(key, value) {
    if (!value) {
      return;
    }
    const group = document.querySelector(`.setting-group[data-key="${key}"]`);
    if (!group) {
      return;
    }
    group.querySelectorAll(".chip").forEach((chip) => {
      const isActive = chip.getAttribute("data-value") === value;
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setLanguageAutoLabel(effectiveLanguage) {
    const group = document.querySelector(
      '.setting-group[data-key="suggestionLanguageChoice"]',
    );
    if (!group) {
      return;
    }
    const autoChip = group.querySelector('.chip[data-value="auto"]');
    if (!(autoChip instanceof HTMLButtonElement)) {
      return;
    }
    const code =
      effectiveLanguage === "es" ? "ES" : effectiveLanguage === "en" ? "EN" : "...";
    autoChip.textContent = `Auto (${code})`;
  }

  function setModelOptions(availableModels, selectedModelId) {
    if (!(modelSelect instanceof HTMLSelectElement)) {
      return;
    }
    const models = Array.isArray(availableModels) ? availableModels : [];
    const selected = typeof selectedModelId === "string" ? selectedModelId : "auto";

    const options = [{ value: "auto", label: "Auto (policy)" }].concat(
      models.map((model) => {
        const tier = model?.tier === "premium" ? "Premium" : "Free";
        const id = typeof model?.id === "string" ? model.id : "";
        const labelRaw = typeof model?.label === "string" ? model.label : id || "unknown";
        return {
          value: id,
          label: `${labelRaw} [${tier}]`,
        };
      }),
    );

    modelSelect.innerHTML = options
      .filter((option) => option.value)
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
      )
      .join("");

    const hasSelected = options.some((option) => option.value === selected);
    modelSelect.value = hasSelected ? selected : "auto";
  }

  function setRuntimeModelLabel(model) {
    if (!(modelRuntimeLabel instanceof HTMLElement)) {
      return;
    }
    if (!model || typeof model !== "object") {
      modelRuntimeLabel.textContent = "Modelo: --";
      return;
    }
    const labelRaw =
      typeof model.label === "string" && model.label.trim()
        ? model.label.trim()
        : typeof model.id === "string"
          ? model.id
          : "unknown";
    const tier = model.tier === "premium" ? "Premium" : "Free";
    modelRuntimeLabel.textContent = `Modelo: ${labelRaw} [${tier}]`;
  }
})();

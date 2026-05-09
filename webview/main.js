/**
 * Client-side logic for the GhostPrompt webview.
 * Communicates with the extension host exclusively via VS Code's postMessage API.
 *
 * Inbound  (host → webview):
 *   { type: 'loading', captureId: number, broadcast?: boolean }
 *   { type: 'suggestion', suggestion: string, captureId: number, model?: { id: string, label: string, tier: 'included' | 'premium' | 'unknown', pricing?: string, provider?: string } }
 *   { type: 'empty', reason: 'no-model' | 'no-included-model' | 'premium-quota-blocked' | 'empty-response' | 'request-timeout' | 'too-short' | 'duplicate-input' | 'rate-limited' | 'session-budget-exhausted', captureId: number }
 *   { type: 'error', message: string, captureId: number }
 *   { type: 'clear' }
 *   { type: 'draftSync', text: string, originViewId: string }
 *   { type: 'draftHydrate', text: string }
 *
 * Outbound (webview → host):
 *   { type: 'suggest',  text: string, captureId: number }
 *   { type: 'draftChanged', text: string, originViewId: string }
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

  /** Evita eco al aplicar borrador remoto (host → webview). */
  let applyingRemoteDraft = false;

  /** Id de vista desde el host (`ghostPrompt.input` | `ghostPrompt.inputPanel`). */
  const VIEW_ID =
    typeof window.__ghostPromptViewId === "string"
      ? window.__ghostPromptViewId
      : "";

  const VIEW_CAPS =
    typeof window.__ghostPromptCapabilities === "object" &&
    window.__ghostPromptCapabilities !== null
      ? window.__ghostPromptCapabilities
      : {};

  if (VIEW_CAPS.compactToolbar === true) {
    document.body.classList.add("gp-cap-compact-toolbar");
  }

  function applyDraftFromHost(text) {
    applyingRemoteDraft = true;
    input.value = typeof text === "string" ? text : "";
    applyingRemoteDraft = false;
    refreshGhostPresentation();
    syncComposerHeight();
  }

  /** Ghost visible solo con foco en el textarea y cursor al final (sin selección). */
  function isGhostUiAllowed() {
    if (document.activeElement !== input) {
      return false;
    }
    const len = input.value.length;
    return input.selectionStart === len && input.selectionEnd === len;
  }

  function refreshGhostPresentation() {
    renderInlineGhost();
    syncComposerHeight();
  }

  function buildInsertedSuggestion(_context, suggestion) {
    // Fuente de verdad: el host ya devuelve la suggestion normalizada.
    // Aquí solo renderizamos/aplicamos literalmente para evitar divergencias
    // entre preview y texto aceptado.
    return suggestion || "";
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

  function showStatus(text, isError = false, isLoading = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
    statusEl.classList.toggle("loading", isLoading && !isError);
    statusEl.style.display = isLoading && !isError ? "flex" : "block";
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
    statusEl.classList.remove("loading");
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

  input.addEventListener("input", () => {
    if (!applyingRemoteDraft && VIEW_ID) {
      vscode.postMessage({
        type: "draftChanged",
        text: input.value,
        originViewId: VIEW_ID,
      });
    }
    if (!applyingRemoteDraft) {
      requestSuggestion();
    }
  });
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
    debugBtn.setAttribute("aria-pressed", String(next));
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

    if (message.type === "draftHydrate") {
      applyDraftFromHost(message.text);
      return;
    }
    if (message.type === "draftSync") {
      if (!VIEW_ID || message.originViewId === VIEW_ID) {
        return;
      }
      applyDraftFromHost(message.text);
      return;
    }

    if (message.broadcast === true && typeof message.captureId === "number") {
      currentCaptureId = message.captureId;
    }

    if (
      typeof message.captureId === "number" &&
      message.captureId !== currentCaptureId &&
      message.broadcast !== true
    ) {
      return;
    }

    if (message.type === "loading") {
      showStatus("Buscando sugerencia...", false, true);
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
      } else if (message.reason === "no-included-model") {
        showStatus("No hay modelo incluido disponible para suggestions.");
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
      } else if (message.reason === "request-timeout") {
        showStatus("El modelo tardo demasiado en responder. Prueba otro modelo o vuelve a intentarlo.");
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
      debugBtn.setAttribute("aria-pressed", String(isDebug));
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

    const byProvider = new Map();
    for (const model of models) {
      const provider =
        typeof model?.provider === "string" && model.provider.trim()
          ? model.provider.trim()
          : "Other";
      const current = byProvider.get(provider) || [];
      current.push(model);
      byProvider.set(provider, current);
    }

    const providerOrder = ["OpenAI", "Anthropic", "Google", "xAI", "GitHub", "Other"];
    const sortedProviders = Array.from(byProvider.keys()).sort((a, b) => {
      const ia = providerOrder.indexOf(a);
      const ib = providerOrder.indexOf(b);
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) {
        return pa - pb;
      }
      return a.localeCompare(b);
    });

    const providerOptions = sortedProviders
      .map((provider) => {
        const rows = (byProvider.get(provider) || [])
          .slice()
          .sort((a, b) => {
            const la =
              typeof a?.label === "string" ? a.label.toLowerCase() : String(a?.id ?? "");
            const lb =
              typeof b?.label === "string" ? b.label.toLowerCase() : String(b?.id ?? "");
            return la.localeCompare(lb);
          })
          .map((model) => {
        const tier = model?.tier;
        const pricing = typeof model?.pricing === "string" ? model.pricing.trim() : "";
        const id = typeof model?.id === "string" ? model.id : "";
        const labelRaw = typeof model?.label === "string" ? model.label : id || "unknown";
        return {
          value: id,
          label: `${labelRaw}  ${formatTierToken(tier, pricing)}`,
        };
          })
          .filter((option) => option.value);
        if (!rows.length) {
          return "";
        }
        const optionsHtml = rows
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
          )
          .join("");
        return `<optgroup label="${escapeHtml(formatProviderTitle(provider))}">${optionsHtml}</optgroup>`;
      })
      .join("");

    modelSelect.innerHTML =
      `<option value="auto">${escapeHtml("Auto (policy)")}</option>` + providerOptions;

    const hasSelected = models.some(
      (option) => typeof option?.id === "string" && option.id === selected,
    );
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
    const tier = model.tier;
    const pricing = typeof model.pricing === "string" ? model.pricing.trim() : "";
    const provider =
      typeof model.provider === "string" && model.provider.trim()
        ? `${model.provider.trim()} · `
        : "";
    modelRuntimeLabel.textContent = `Modelo: ${provider}${labelRaw} · ${formatTierToken(tier, pricing)}`;
  }

  function formatProviderTitle(provider) {
    return `▸ ${provider}`;
  }

  function formatTierToken(tier, pricing) {
    const normalizedPricing = typeof pricing === "string" && pricing ? ` ${pricing}` : "";
    if (tier === "premium") {
      return `[PREMIUM${normalizedPricing}]`;
    }
    if (tier === "included") {
      return `[INCLUDED${normalizedPricing || " 0x"}]`;
    }
    return `[UNKNOWN${normalizedPricing}]`;
  }
})();

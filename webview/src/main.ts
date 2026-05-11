/**
 * Client-side logic for the GhostPrompt webview.
 * Communicates with the extension host exclusively via VS Code's postMessage API.
 *
 * Inbound  (host → webview):
 *   { type: 'loading', captureId: number, broadcast?: boolean, phase?: string, statusText?: string }
 *   { type: 'suggestion-stream', text: string, captureId: number }  // OpenCode: vista previa SSE (solo partes type=text)
 *   { type: 'suggestion', suggestion: string, captureId: number, model?: { id: string, label: string, tier: 'included' | 'premium' | 'unknown', pricing?: string, provider?: string } }
 *   { type: 'empty', reason: 'no-model' | 'no-included-model' | 'premium-quota-blocked' | 'empty-response' | 'request-timeout' | 'too-short' | 'duplicate-input' | 'rate-limited' | 'session-budget-exhausted', captureId: number }
 *   { type: 'error', message: string, captureId: number }
 *   { type: 'clear' }
 *   { type: 'draftSync', text: string, originViewId: string }
 *   { type: 'draftHydrate', text: string }
 *   { type: 'settings', settings: { ..., suggestionDebounceMs: number, agentDestination, vsOpenCodeXExtensionInstalled, ... } }
 *
 * Outbound (webview → host):
 *   { type: 'suggest',  text: string, captureId: number }
 *   { type: 'draftChanged', text: string, originViewId: string }
 *   { type: 'accept',   context: string, suggestion: string }
 *   { type: 'send',     text: string }
 *
 * Contratos Zod compartidos: `src/shared/webviewMessageSchemas.ts` (salida webview validada en `protocol/postToHost.ts`).
 */
import { escapeHtml } from "./lib/htmlEscape";
import {
  composeStyleShort,
  composeContextShort,
  composeLangShort,
} from "./lib/composeLabels";
import {
  messageForEmptySuggestion,
  toUserErrorMessage,
} from "./lib/userErrorMessage";
import { postToHost } from "./protocol/postToHost";

(function (): void {
  "use strict";

  const vscode = acquireVsCodeApi();
  const input = document.getElementById("prompt-input") as HTMLTextAreaElement;
  const inputStack = document.querySelector(".input-stack") as HTMLElement;
  const ghostInline = document.getElementById("ghost-inline") as HTMLElement;
  const ghostMeasure = document.getElementById("ghost-measure") as HTMLElement;
  const sendBtn = document.getElementById("send-btn") as HTMLElement;
  const toolbarEl = document.querySelector(".toolbar") as HTMLElement | null;
  const vsxSurfaceNote = document.getElementById(
    "gp-vsx-surface-note",
  ) as HTMLElement | null;
  const hintEl = document.querySelector(".toolbar .hint") as HTMLElement | null;
  const statusEl = document.getElementById("status-text") as HTMLElement;
  const settingGroups = Array.from(document.querySelectorAll(".setting-group"));
  const debugBtn = document.getElementById("debug-btn") as HTMLElement;
  const modelRuntimeLabel = document.getElementById("model-runtime-label");
  const modelSelect = document.getElementById(
    "model-select",
  ) as HTMLSelectElement | null;
  const completionBackendSelect = document.getElementById(
    "completion-backend-select",
  );
  const agentDestinationRow = document.getElementById(
    "agent-destination-row",
  ) as HTMLElement | null;
  const agentDestinationSelect = document.getElementById(
    "agent-destination-select",
  ) as HTMLSelectElement | null;

  /** Para etiquetas tier en español vs inglés (`Gratis` / `INCLUDED`). */
  let lastSuggestionUiLang = "en";

  /** Último motor activo (para mensajes empty/no-model). */
  let lastCompletionProvider = "copilot";
  /** `copilot` | `opencode` | `multi` — fuentes habilitadas en host. */
  let lastCompletionUiKind = "copilot";

  /** ID de la última solicitud de suggestion enviada al host. */
  let currentCaptureId = 0;
  /** Texto de la suggestion actualmente mostrada (vacío si no hay ninguna). */
  let pendingSuggestion = "";
  const MIN_COMPOSER_HEIGHT = 56;

  /** Temporizador de debounce para las solicitudes de suggestion. */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Ms tras dejar de teclear antes de enviar `suggest` (viene del host / `ghostPrompt.suggestionDebounceMs`). */
  let suggestionDebounceMs = 800;

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

  /**
   * Paridad sidebar vs panel (roadmap v0.3.1 Fase A):
   * - VIEW_ID: solo enrutado de borrador (`draftChanged` / `draftSync`). No usar para
   *   ocultar chips, el `<select>` de modelo ni Debug u otros controles del toolbar.
   * - VIEW_CAPS: solo flags de presentación (p. ej. `compactToolbar` → clase CSS en body).
   *   No eliminar del DOM grupos de opciones según la vista.
   */
  if (VIEW_CAPS.compactToolbar === true) {
    document.body.classList.add("gp-cap-compact-toolbar");
  }

  /** Último bloque `settings` del host — texto del menú composición (Fase C). */
  let lastComposeSettings: Record<string, unknown> | null = null;

  function applyAgentDestinationFromSettings(settings: Record<string, unknown>) {
    const dest =
      settings.agentDestination === "vsOpenCodeX" ? "vsOpenCodeX" : "copilotChat";
    const vsx = dest === "vsOpenCodeX";
    document.body.classList.toggle("gp-dest-vsx", vsx);
    if (vsxSurfaceNote) {
      vsxSurfaceNote.hidden = !vsx;
    }
    input.disabled = vsx;
    sendBtn.toggleAttribute("disabled", vsx);
    if (toolbarEl) {
      toolbarEl.classList.toggle("gp-vsx-toolbar-hidden", vsx);
    }
    if (hintEl) {
      hintEl.textContent = vsx
        ? "Destino VSOpenCodeX: redacta y envía en VSOpenCodeX; los chips de arriba siguen activos."
        : "Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea";
    }
    if (vsx) {
      clearGhost();
      clearStatus();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
  }

  function refreshComposeSummary() {
    const sumEl = document.getElementById("compose-options-summary");
    if (!(sumEl instanceof HTMLElement)) {
      return;
    }
    const s = lastComposeSettings;
    if (!s || typeof s !== "object") {
      sumEl.textContent = "Estilo · Contexto · Idioma";
      return;
    }
    sumEl.textContent = `${composeStyleShort(String(s.suggestionStyle ?? ""))} · ${composeContextShort(String(s.contextMode ?? ""))} · ${composeLangShort(String(s.suggestionLanguageChoice ?? ""), String(s.effectiveSuggestionLanguage ?? ""))}`;
  }

  function applyDraftFromHost(text: unknown) {
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

  function buildInsertedSuggestion(_context: string, suggestion: string) {
    // Fuente de verdad: el host ya devuelve la suggestion normalizada.
    // Aquí solo renderizamos/aplicamos literalmente para evitar divergencias
    // entre preview y texto aceptado.
    return suggestion || "";
  }

  // ── Envío de suggestion al host (con debounce) ───────────────────────────

  function requestSuggestion() {
    if (document.body.classList.contains("gp-dest-vsx")) {
      return;
    }
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    clearGhost();
    clearStatus();
    const text = input.value;
    syncComposerHeight();
    if (!text.trim()) {
      return;
    }
    debounceTimer = setTimeout(() => {
      currentCaptureId += 1;
      postToHost(vscode, {
        type: "suggest",
        text,
        captureId: currentCaptureId,
      });
    }, suggestionDebounceMs);
  }

  // ── Ghost-text helpers ───────────────────────────────────────────────────

  function showGhost(text: string) {
    pendingSuggestion = text;
    renderInlineGhost();
    syncComposerHeight();
  }

  function clearGhost() {
    pendingSuggestion = "";
    renderInlineGhost();
    syncComposerHeight();
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

  function showStatus(
    text: string,
    isError = false,
    isLoading = false,
  ) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
    statusEl.classList.toggle("loading", isLoading && !isError);
    statusEl.style.display = isLoading && !isError ? "flex" : "block";
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
    postToHost(vscode, {
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
    if (document.body.classList.contains("gp-dest-vsx")) {
      return;
    }
    const text = input.value.trim();
    if (!text) {
      return;
    }
    clearGhost();
    clearStatus();
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    postToHost(vscode, { type: "send", text });
  }

  // ── Event listeners ──────────────────────────────────────────────────────

  input.addEventListener("input", () => {
    if (!applyingRemoteDraft && VIEW_ID) {
      postToHost(vscode, {
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
    postToHost(vscode, {
      type: "updateSetting",
      key: "selectedModelId",
      value: modelSelect.value || "auto",
    });
  });
  completionBackendSelect?.addEventListener("change", () => {
    if (!(completionBackendSelect instanceof HTMLSelectElement)) {
      return;
    }
    const v = completionBackendSelect.value;
    if (v !== "copilot" && v !== "opencode") {
      return;
    }
    postToHost(vscode, {
      type: "updateSetting",
      key: "completionProvider",
      value: v,
    });
  });
  agentDestinationSelect?.addEventListener("change", () => {
    if (!(agentDestinationSelect instanceof HTMLSelectElement)) {
      return;
    }
    const v = agentDestinationSelect.value;
    if (v !== "copilotChat" && v !== "vsOpenCodeX") {
      return;
    }
    postToHost(vscode, {
      type: "updateSetting",
      key: "agentDestination",
      value: v,
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
      postToHost(vscode, {
        type: "updateSetting",
        key,
        value,
      });
    });
    group.addEventListener("keydown", (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const ke = event as KeyboardEvent;
      if (ke.key !== "ArrowRight" && ke.key !== "ArrowLeft") {
        return;
      }
      ke.preventDefault();
      const chips = Array.from(group.querySelectorAll(".chip"));
      const index = chips.indexOf(target);
      if (index < 0) {
        return;
      }
      const delta = ke.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + chips.length) % chips.length;
      const next = chips[nextIndex];
      if (next instanceof HTMLButtonElement) {
        next.focus();
        next.click();
      }
    });
  });

  document.querySelector(".gp-compose-panel")?.addEventListener("click", (event) => {
    const t = event.target;
    if (!(t instanceof HTMLElement)) {
      return;
    }
    if (t.closest(".chip")) {
      const d = document.getElementById("compose-options-details");
      if (d instanceof HTMLDetailsElement) {
        d.open = false;
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") {
      return;
    }
    const d = document.getElementById("compose-options-details");
    if (d instanceof HTMLDetailsElement && d.open) {
      d.open = false;
      e.preventDefault();
    }
  });

  debugBtn.addEventListener("click", () => {
    const next = debugBtn.dataset.enabled !== "true";
    debugBtn.setAttribute("aria-pressed", String(next));
    postToHost(vscode, {
      type: "updateSetting",
      key: "debugSuggestions",
      value: next,
    });
  });
  postToHost(vscode, { type: "init" });
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
      const loadingLabel =
        typeof message.statusText === "string" && message.statusText.trim().length > 0
          ? message.statusText
          : "Buscando sugerencia...";
      showStatus(loadingLabel, false, true);
    } else if (message.type === "suggestion-stream") {
      if (typeof message.text === "string" && message.text.length > 0) {
        clearStatus();
        showGhost(message.text);
      }
    } else if (message.type === "suggestion") {
      // Descartar si llegó fuera de tiempo (usuario ya siguió escribiendo).
      if (message.suggestion) {
        clearStatus();
        showGhost(message.suggestion);
        setRuntimeModelLabel(message.model);
      }
    } else if (message.type === "empty") {
      clearGhost();
      showStatus(
        messageForEmptySuggestion(message.reason, {
          completionUiKind: lastCompletionUiKind,
          completionProvider: lastCompletionProvider,
        }),
      );
    } else if (message.type === "error") {
      clearGhost();
      showStatus(toUserErrorMessage(message.message), true);
    } else if (message.type === "settings") {
      const settings = message.settings ?? {};
      const debRaw = settings.suggestionDebounceMs;
      if (typeof debRaw === "number" && Number.isFinite(debRaw)) {
        suggestionDebounceMs = Math.min(2000, Math.max(150, Math.round(debRaw)));
      }
      lastCompletionUiKind =
        typeof settings.completionUiKind === "string"
          ? settings.completionUiKind
          : settings.completionProvider === "opencode"
            ? "opencode"
            : "copilot";
      const sourcesRaw = settings.enabledCompletionSources;
      const sources = Array.isArray(sourcesRaw) ? sourcesRaw : [];
      let motorSelectValue: "copilot" | "opencode" =
        settings.completionProvider === "opencode" ? "opencode" : "copilot";
      if (sources.length === 1 && (sources[0] === "copilot" || sources[0] === "opencode")) {
        motorSelectValue = sources[0];
      } else if (sources.length > 1) {
        motorSelectValue = "copilot";
      }
      lastCompletionProvider = motorSelectValue;
      if (completionBackendSelect instanceof HTMLSelectElement) {
        completionBackendSelect.value = motorSelectValue;
        const ocAccent =
          lastCompletionUiKind === "opencode" || lastCompletionUiKind === "multi";
        completionBackendSelect.classList.toggle("backend-opencode", ocAccent);
      }
      const vsxInstalled = Boolean(settings.vsOpenCodeXExtensionInstalled);
      if (agentDestinationRow) {
        agentDestinationRow.hidden = !vsxInstalled;
      }
      if (agentDestinationSelect instanceof HTMLSelectElement) {
        const dest =
          settings.agentDestination === "vsOpenCodeX" ? "vsOpenCodeX" : "copilotChat";
        agentDestinationSelect.value = dest;
      }
      lastSuggestionUiLang =
        settings.effectiveSuggestionLanguage === "es" ? "es" : "en";
      setActiveChip("suggestionModelPolicy", settings.suggestionModelPolicy);
      setModelOptions(
        settings.availableModels,
        settings.selectedModelId,
        settings.completionProvider,
        lastCompletionUiKind,
      );
      setActiveChip("suggestionStyle", settings.suggestionStyle);
      setActiveChip("contextMode", settings.contextMode);
      setActiveChip("suggestionLanguageChoice", settings.suggestionLanguageChoice);
      setLanguageAutoLabel(settings.effectiveSuggestionLanguage);
      lastComposeSettings = { ...settings };
      refreshComposeSummary();
      setRuntimeModelLabel(settings.effectiveModel);
      const isDebug = Boolean(settings.debugSuggestions);
      debugBtn.dataset.enabled = String(isDebug);
      debugBtn.textContent = isDebug ? "Debug: on" : "Debug: off";
      debugBtn.setAttribute("aria-pressed", String(isDebug));
      applyAgentDestinationFromSettings(settings as Record<string, unknown>);
    } else if (message.type === "languageEffective") {
      lastSuggestionUiLang = message.language === "es" ? "es" : "en";
      setLanguageAutoLabel(message.language);
      if (lastComposeSettings && typeof lastComposeSettings === "object") {
        lastComposeSettings = {
          ...lastComposeSettings,
          effectiveSuggestionLanguage: message.language === "es" ? "es" : "en",
        };
        refreshComposeSummary();
      }
    } else if (message.type === "clear") {
      input.value = "";
      clearGhost();
      clearStatus();
      syncComposerHeight();
      inputStack.scrollTop = 0;
      input.focus();
    }
  });

  type HostModelDescriptor = {
    id?: string;
    label?: string;
    tier?: string;
    pricing?: string;
    provider?: string;
    completionSource?: string;
  };

  function setActiveChip(key: string, value: unknown) {
    if (!value) {
      return;
    }
    const group = document.querySelector(`.setting-group[data-key="${key}"]`);
    if (!group) {
      return;
    }
    group.querySelectorAll(".chip").forEach((chip) => {
      const isActive = chip.getAttribute("data-value") === String(value);
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setLanguageAutoLabel(effectiveLanguage: string) {
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

  function setModelOptions(
    availableModels: unknown,
    selectedModelId: unknown,
    _completionProvider: unknown,
    completionUiKind: unknown,
  ) {
    if (!(modelSelect instanceof HTMLSelectElement)) {
      return;
    }
    const uiKind =
      typeof completionUiKind === "string" ? completionUiKind : "copilot";
    const models: HostModelDescriptor[] = Array.isArray(availableModels)
      ? (availableModels as HostModelDescriptor[])
      : [];
    const selected = typeof selectedModelId === "string" ? selectedModelId : "auto";
    let autoLabel = "Auto (policy)";
    if (uiKind === "opencode") {
      autoLabel = "Auto (OpenCode)";
    } else if (uiKind === "multi") {
      autoLabel = "Auto (Copilot primero)";
    }

    const byProvider = new Map<string, HostModelDescriptor[]>();
    for (const model of models) {
      const raw =
        typeof model?.provider === "string" && model.provider.trim()
          ? model.provider.trim()
          : "Other";
      const cs = model?.completionSource;
      const provider =
        cs === "opencode"
          ? `OpenCode · ${raw}`
          : cs === "copilot"
            ? `Copilot · ${raw}`
            : raw;
      const current = byProvider.get(provider) || [];
      current.push(model);
      byProvider.set(provider, current);
    }

    const providerOrder = ["OpenAI", "Anthropic", "Google", "xAI", "GitHub", "Other"];
    const sortedProviders = Array.from(byProvider.keys()).sort((a, b) => {
      const bucket = (k: string) => {
        if (k.startsWith("Copilot ·")) {
          return 0;
        }
        if (k.startsWith("OpenCode ·")) {
          return 1;
        }
        return 2;
      };
      const ba = bucket(a);
      const bb = bucket(b);
      if (ba !== bb) {
        return ba - bb;
      }
      const stripPrefix = (k: string) => {
        if (k.startsWith("Copilot · ")) {
          return k.slice("Copilot · ".length);
        }
        if (k.startsWith("OpenCode · ")) {
          return k.slice("OpenCode · ".length);
        }
        return k;
      };
      const ia = providerOrder.indexOf(stripPrefix(a));
      const ib = providerOrder.indexOf(stripPrefix(b));
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) {
        return pa - pb;
      }
      return a.localeCompare(b);
    });

    const providerOptions = sortedProviders
      .map((provider: string) => {
        const rows = (byProvider.get(provider) || [])
          .slice()
          .sort((a: HostModelDescriptor, b: HostModelDescriptor) => {
            const la =
              typeof a?.label === "string" ? a.label.toLowerCase() : String(a?.id ?? "");
            const lb =
              typeof b?.label === "string" ? b.label.toLowerCase() : String(b?.id ?? "");
            return la.localeCompare(lb);
          })
          .map((model: HostModelDescriptor) => {
        const tier = model?.tier;
        const pricing = typeof model?.pricing === "string" ? model.pricing.trim() : "";
        const id = typeof model?.id === "string" ? model.id : "";
        const labelRaw = typeof model?.label === "string" ? model.label : id || "unknown";
        return {
          value: id,
          label: `${labelRaw}  ${formatTierToken(tier, pricing, lastSuggestionUiLang)}`,
        };
          })
          .filter((option: { value: string }) => option.value);
        if (!rows.length) {
          return "";
        }
        const optionsHtml = rows
          .map(
            (option: { value: string; label: string }) =>
              `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
          )
          .join("");
        return `<optgroup label="${escapeHtml(formatProviderTitle(provider))}">${optionsHtml}</optgroup>`;
      })
      .join("");

    modelSelect.innerHTML =
      `<option value="auto">${escapeHtml(autoLabel)}</option>` + providerOptions;

    const hasSelected = models.some(
      (option: HostModelDescriptor) =>
        typeof option?.id === "string" && option.id === selected,
    );
    modelSelect.value = hasSelected ? selected : "auto";
  }

  function setRuntimeModelLabel(model: unknown) {
    if (!(modelRuntimeLabel instanceof HTMLElement)) {
      return;
    }
    if (!model || typeof model !== "object") {
      modelRuntimeLabel.textContent = "Modelo: --";
      return;
    }
    const m = model as HostModelDescriptor;
    const labelRaw =
      typeof m.label === "string" && m.label.trim()
        ? m.label.trim()
        : typeof m.id === "string"
          ? m.id
          : "unknown";
    const tier = m.tier;
    const pricing = typeof m.pricing === "string" ? m.pricing.trim() : "";
    const provider =
      typeof m.provider === "string" && m.provider.trim()
        ? `${m.provider.trim()} · `
        : "";
    modelRuntimeLabel.textContent = `Modelo: ${provider}${labelRaw} · ${formatTierToken(tier, pricing, lastSuggestionUiLang)}`;
  }

  function formatProviderTitle(provider: string) {
    return `▸ ${provider}`;
  }

  function formatTierToken(
    tier: unknown,
    pricing: unknown,
    lang: string,
  ) {
    const L = lang === "es" ? "es" : "en";
    const normalizedPricing = typeof pricing === "string" && pricing ? ` ${pricing}` : "";
    if (tier === "premium") {
      return L === "es" ? `[Premium${normalizedPricing}]` : `[PREMIUM${normalizedPricing}]`;
    }
    if (tier === "included") {
      return L === "es"
        ? `[Gratis${normalizedPricing}]`
        : `[INCLUDED${normalizedPricing || " 0x"}]`;
    }
    return L === "es"
      ? `[Sin clasificar${normalizedPricing}]`
      : `[UNKNOWN${normalizedPricing}]`;
  }
})();

/**
 * @file Input principal de prompts en el webview GhostPrompt.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  WEBVIEW_TEXTAREA_COMPACT_MIN_HEIGHT_PX,
  WEBVIEW_TEXTAREA_MIN_HEIGHT_PX,
} from '../webviewProtocolConstants';

/** Contenedor grid: textarea + ghost comparten la misma celda. */
export const GP_PROMPT_FIELD_CLASS = 'gp-prompt-field';

/** Tipografía y padding compartidos (deben coincidir en textarea y capa ghost). */
export const GP_PROMPT_FIELD_EDITOR_CLASS =
  'gp-prompt-field__editor px-3 py-2 text-sm leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-[family-name:inherit] [font-size:inherit] min-w-0 w-full box-border m-0';

/**
 * True when a ref holds a mounted DOM node (not `false` sentinel nor React `null`).
 * @param {HTMLElement | false | null | undefined} value - Ref current value.
 * @returns {value is HTMLElement} Whether the value is a live element.
 */
export function isMountedElement(value: HTMLElement | false | null | undefined): value is HTMLElement {
  return value instanceof HTMLElement;
}

interface PromptInputProperties {
  text: string;
  suggestion: string;
  vsxActive: boolean;
  compact: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | false>;
  isGhostUiAllowed: () => boolean;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAccept: () => void;
  onCursorCheck: () => void;
}

/**
 * Componente de entrada de prompt con sugerencia fantasma y atajos de teclado.
 * @param {PromptInputProperties} props - Propiedades del componente PromptInput.
 * @param {string} props.text - Texto actual del prompt.
 * @param {string} props.suggestion - Sugerencia fantasma a mostrar.
 * @param {boolean} props.vsxActive - Indica si VSOpenCodeX está activo.
 * @param {boolean} props.compact - Usa diseño compacto.
 * @param {import('react').RefObject<HTMLTextAreaElement | undefined>} props.textareaRef - Referencia del textarea.
 * @param {() => boolean} props.isGhostUiAllowed - Si se puede aceptar la sugerencia.
 * @param {(e: import('react').ChangeEvent<HTMLTextAreaElement>) => void} props.onTextChange - Cambio de texto.
 * @param {() => void} props.onSend - Controlador de envío de prompt.
 * @param {() => void} props.onAccept - Controlador de aceptación de la sugerencia.
 * @returns {import('react').JSX.Element} JSX del textarea y la sugerencia.
 */
export function PromptInput(props: PromptInputProperties): React.JSX.Element {
  const {
    text,
    suggestion,
    vsxActive,
    compact,
    textareaRef,
    isGhostUiAllowed,
    onTextChange,
    onSend,
    onAccept,
    onCursorCheck,
  } = props;
  const ghostOverlayReference = useRef<HTMLDivElement | null>(null);
  const fieldShellReference = useRef<HTMLDivElement | null>(null);

  const showGhostOverlay = Boolean(suggestion) && text.length > 0;
  const minHeightPx = compact ? WEBVIEW_TEXTAREA_COMPACT_MIN_HEIGHT_PX : WEBVIEW_TEXTAREA_MIN_HEIGHT_PX;

  const syncTextareaHeight = useCallback(() => {
    const input = textareaRef.current;
    const shell = fieldShellReference.current;
    if (!isMountedElement(input)) {
      return;
    }
    input.style.height = 'auto';
    const nextHeight = Math.max(input.scrollHeight, minHeightPx);
    input.style.height = `${nextHeight}px`;
    if (isMountedElement(shell)) {
      shell.style.minHeight = `${nextHeight}px`;
    }
  }, [textareaRef, minHeightPx]);

  const syncGhostScrollbarGutter = useCallback(() => {
    const input = textareaRef.current;
    const ghost = ghostOverlayReference.current;
    if (!isMountedElement(input) || !isMountedElement(ghost)) {
      return;
    }
    const gutterPx = input.offsetWidth - input.clientWidth;
    const inputStyle = globalThis.getComputedStyle(input);
    const basePaddingRightPx = Number.parseFloat(inputStyle.paddingRight) || 0;
    ghost.style.paddingRight = `${basePaddingRightPx + gutterPx}px`;
  }, [textareaRef]);

  const syncScroll = useCallback(() => {
    const input = textareaRef.current;
    const ghost = ghostOverlayReference.current;
    if (!isMountedElement(input) || !isMountedElement(ghost)) {
      return;
    }
    ghost.scrollTop = input.scrollTop;
    ghost.scrollLeft = input.scrollLeft;
  }, [textareaRef]);

  const handleTextareaScroll = useCallback(() => {
    syncScroll();
    syncGhostScrollbarGutter();
  }, [syncGhostScrollbarGutter, syncScroll]);

  useEffect(() => {
    syncTextareaHeight();
    if (showGhostOverlay) {
      syncGhostScrollbarGutter();
      syncScroll();
    }
  }, [showGhostOverlay, text, suggestion, syncGhostScrollbarGutter, syncScroll, syncTextareaHeight]);

  useEffect(() => {
    const input = textareaRef.current;
    let disconnectObserver: (() => void) | false = false;
    if (isMountedElement(input) && showGhostOverlay) {
      syncGhostScrollbarGutter();
      const observer = new ResizeObserver(() => {
        syncGhostScrollbarGutter();
      });
      observer.observe(input);
      disconnectObserver = () => {
        observer.disconnect();
      };
    }
    return () => {
      if (disconnectObserver) {
        disconnectObserver();
      }
    };
  }, [showGhostOverlay, syncGhostScrollbarGutter, textareaRef]);

  const ghostOverlay = useMemo(() => {
    if (!showGhostOverlay) {
      return false;
    }
    return (
      <div
        ref={ghostOverlayReference}
        className={`gp-prompt-ghost col-start-1 row-start-1 z-10 pointer-events-none overflow-auto ${GP_PROMPT_FIELD_EDITOR_CLASS}`}
        aria-hidden="true"
      >
        <span className="opacity-0 select-none">{text}</span>
        <span className="gp-prompt-ghost__suggestion">{suggestion}</span>
      </div>
    );
  }, [showGhostOverlay, suggestion, text]);

  const minHeightClass = compact ? 'min-h-16' : 'min-h-25';

  return (
    <div
      ref={fieldShellReference}
      className={`${GP_PROMPT_FIELD_CLASS} relative mb-2 grid grid-cols-1 grid-rows-1 rounded-md border border-(--vscode-input-border) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder) focus-within:ring-1 focus-within:ring-(--vscode-focusBorder) ${minHeightClass}`}
    >
      <textarea
        ref={textareaRef as unknown as React.Ref<HTMLTextAreaElement>}
        id="prompt-input"
        className={`gp-prompt-field__textarea col-start-1 row-start-1 z-0 block resize-none border-0 bg-transparent text-(--vscode-input-foreground) outline-none [scrollbar-gutter:stable] ${GP_PROMPT_FIELD_EDITOR_CLASS}`}
        value={text}
        onChange={onTextChange}
        onScroll={handleTextareaScroll}
        onMouseUp={onCursorCheck}
        onKeyUp={onCursorCheck}
        onKeyDown={(event) => {
          if (event.key === 'Tab' && suggestion && isGhostUiAllowed()) {
            event.preventDefault();
            onAccept();
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder={
          vsxActive
            ? 'Destino VSOpenCodeX activo: escribe aquí pero envía desde VSOpenCodeX.'
            : 'Escribe tu prompt…'
        }
        disabled={vsxActive}
        rows={3}
        spellCheck={false}
        autoFocus
      />
      {ghostOverlay}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef } from 'react';

interface PromptInputProps {
  text: string;
  suggestion: string;
  vsxActive: boolean;
  compact: boolean;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  isGhostUiAllowed: () => boolean;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAccept: () => void;
  onCursorCheck: () => void;
}

/**
 * Componente de entrada de prompt con sugerencia fantasma y atajos de teclado.
 * @param {PromptInputProps} props Propiedades del componente PromptInput.
 * @param {string} props.text Texto actual del prompt.
 * @param {string} props.suggestion Sugerencia fantasma a mostrar.
 * @param {boolean} props.vsxActive Indica si VSOpenCodeX está activo.
 * @param {boolean} props.compact Usa diseño compacto.
 * @param {import('react').MutableRefObject<globalThis.HTMLTextAreaElement | null>} props.textareaRef Referencia del textarea.
 * @param {() => boolean} props.isGhostUiAllowed Comprueba si se puede aceptar la sugerencia.
 * @param {(e: import('react').ChangeEvent<globalThis.HTMLTextAreaElement>) => void} props.onTextChange Controlador de cambios de texto.
 * @param {() => void} props.onSend Controlador de envío de prompt.
 * @param {() => void} props.onAccept Controlador de aceptación de la sugerencia.
 * @returns {import('react').JSX.Element} JSX del textarea y la sugerencia.
 */
export function PromptInput(props: PromptInputProps): JSX.Element {
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
  const ghostRef = useRef<HTMLPreElement | null>(null);

  const syncTextareaHeight = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return;
    }
    input.style.height = 'auto';
    input.style.height = `${Math.max(input.scrollHeight, compact ? 80 : 120)}px`;
  }, [textareaRef, compact]);

  useEffect(() => {
    syncTextareaHeight();
  }, [text, syncTextareaHeight]);

  const syncScroll = useCallback(() => {
    const input = textareaRef.current;
    const ghost = ghostRef.current;
    if (input && ghost) {
      ghost.scrollTop = input.scrollTop;
      ghost.scrollLeft = input.scrollLeft;
    }
  }, [textareaRef, ghostRef]);

  const ghostContent = useMemo(() => {
    if (!suggestion || !text.trim()) {
      return null;
    }
    return (
      <pre
        ref={ghostRef}
        className="absolute inset-px pointer-events-none m-0 px-3 py-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 overflow-auto"
        aria-hidden="true"
      >
        <span className="opacity-0">{text}</span>
        <span className="text-(--vscode-input-foreground)/70">{suggestion}</span>
      </pre>
    );
  }, [suggestion, text]);

  return (
    <div className="relative mb-2">
      {ghostContent}
      <textarea
        ref={textareaRef}
        id="prompt-input"
        className={`w-full rounded-md border border-(--vscode-input-border) bg-(--vscode-input-background) px-3 py-2 text-sm leading-6 text-(--vscode-input-foreground) outline-none transition focus:border-(--vscode-focusBorder) focus:ring-1 focus:ring-(--vscode-focusBorder) resize-none ${compact ? 'min-h-16' : 'min-h-25'}`}
        value={text}
        onChange={onTextChange}
        onScroll={syncScroll}
        onMouseUp={onCursorCheck}
        onKeyUp={onCursorCheck}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            if (suggestion && isGhostUiAllowed()) {
              event.preventDefault();
              onAccept();
            }
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
    </div>
  );
}

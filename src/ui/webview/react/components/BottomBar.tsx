interface BottomBarProps {
  status: string;
  isLoading: boolean;
  canSend: boolean;
  onSend: () => void;
}

const errorPatterns = /^Error/i;
const successPatterns = /Modelo listo|Suggestion aceptada|Sugerencia recibida/i;

/**
 * Devuelve el icono de estado para el mensaje de estado.
 * @param status Texto de estado.
 * @param isLoading Indica si el estado es de carga.
 * @returns Icono de estado o `null` si no hay icono.
 */
function statusIcon(status: string, isLoading: boolean): string | null {
  if (isLoading) { return "\u25CB"; }
  if (errorPatterns.test(status)) { return "\u26A0"; }
  if (successPatterns.test(status)) { return "\u2713"; }
  return null;
}

/**
 * Barra inferior de estado y botón de envío para el webview.
 * @param props Propiedades del componente BottomBar.
 * @returns Elemento JSX con estado y botón de envío.
 */
export function BottomBar(props: BottomBarProps) {
  const { status, isLoading, canSend, onSend } = props;
  const icon = statusIcon(status, isLoading);
  const isError = errorPatterns.test(status);
  const isSuccess = successPatterns.test(status);
  const colorClass = isError
    ? "text-[var(--vscode-errorForeground)]"
    : isSuccess
      ? "text-[var(--vscode-testing-iconPassed)]"
      : "text-[var(--vscode-descriptionForeground)]";

  return (
    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-[var(--vscode-widget-border)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-h-[20px]">
          {icon !== null && (
            <span className={`text-xs ${isLoading ? "animate-spin" : ""}`} aria-hidden="true">
              {icon}
            </span>
          )}
          <span
            id="status-text"
            className={`text-xs ${colorClass}`}
            aria-live="polite"
            aria-relevant="text"
          >
            {status}
          </span>
        </div>
        <button
          id="send-btn"
          className="inline-flex items-center justify-center rounded-md bg-[var(--vscode-button-background)] px-4 py-1.5 text-sm font-semibold text-[var(--vscode-button-foreground)] shadow-sm transition hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onSend}
          disabled={!canSend}
        >
          Enviar ↵
        </button>
      </div>
      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
        Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea
      </span>
    </div>
  );
}

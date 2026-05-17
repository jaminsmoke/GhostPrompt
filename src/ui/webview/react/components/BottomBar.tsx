/**
 * @file Barra inferior compartida del webview GhostPrompt.
 */
interface BottomBarProperties {
  status: string;
  isLoading: boolean;
  canSend: boolean;
  onSend: () => void;
}

const errorPatterns = /^error/iu;
const successPatterns = /modelo listo|suggestion aceptada|sugerencia recibida/iu;

/**
 * Devuelve el icono de estado para el mensaje de estado.
 * @param {string} status - Texto de estado.
 * @param {boolean} isLoading - Indica si el estado es de carga.
 * @returns {string | undefined} Icono de estado si aplica.
 */
function statusIcon(status: string, isLoading: boolean): string | undefined {
  if (isLoading) {
    return '\u25CB';
  }
  if (errorPatterns.test(status)) {
    return '\u26A0';
  }
  if (successPatterns.test(status)) {
    return '\u2713';
  }
  return undefined;
}

/**
 * Barra inferior de estado y botón de envío para el webview.
 * @param {BottomBarProperties} props - Propiedades del componente BottomBar.
 * @returns {import('react').JSX.Element} Elemento JSX con estado y botón de envío.
 */
export function BottomBar(props: BottomBarProperties) {
  const { status, isLoading, canSend, onSend } = props;
  const icon = statusIcon(status, isLoading);
  const isError = errorPatterns.test(status);
  const isSuccess = successPatterns.test(status);
  let colorClass = 'text-[var(--vscode-descriptionForeground)]';
  if (isError) {
    colorClass = 'text-[var(--vscode-errorForeground)]';
  } else if (isSuccess) {
    colorClass = 'text-[var(--vscode-testing-iconPassed)]';
  }

  return (
    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-(--vscode-widget-border)">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-h-5">
          {icon !== undefined && 
            <span className={`text-xs ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
              {icon}
            </span>
          }
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
          className="inline-flex items-center justify-center rounded-md bg-(--vscode-button-background) px-4 py-1.5 text-sm font-semibold text-(--vscode-button-foreground) shadow-sm transition hover:bg-(--vscode-button-hoverBackground) disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onSend}
          disabled={!canSend}
        >
          Enviar ↵
        </button>
      </div>
      <span className="text-[10px] text-(--vscode-descriptionForeground)">
        Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea
      </span>
    </div>
  );
}

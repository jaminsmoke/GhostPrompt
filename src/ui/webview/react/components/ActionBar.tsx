interface ActionBarProps {
  canSend: boolean;
  onSend: () => void;
}

export function ActionBar({ canSend, onSend }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-[var(--vscode-descriptionForeground)]">
        Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea
      </span>
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
  );
}

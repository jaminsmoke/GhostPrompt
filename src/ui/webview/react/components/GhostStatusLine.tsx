interface GhostStatusLineProps {
  status: string;
}

export function GhostStatusLine({ status }: GhostStatusLineProps) {
  return (
    <div
      id="status-text"
      className="my-2 min-h-[20px] text-xs text-[var(--vscode-descriptionForeground)]"
      aria-live="polite"
      aria-relevant="text"
    >
      {status}
    </div>
  );
}

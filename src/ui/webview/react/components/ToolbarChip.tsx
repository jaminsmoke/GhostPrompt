import { type ReactNode, useEffect, useRef } from "react";

interface ToolbarChipProps {
  label: string;
  chipLabel?: string;
  tooltip?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
  id?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function ToolbarChip({
  label,
  chipLabel,
  tooltip,
  isOpen,
  onToggle,
  onClose,
  children,
  id,
  compact,
  disabled,
}: ToolbarChipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) { return; }

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); }
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="inline-flex flex-col gap-0">
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.15em] leading-tight mb-0.5 ${
          chipLabel && !compact
            ? "text-[var(--vscode-descriptionForeground)]"
            : "invisible"
        }`}
        aria-hidden={!chipLabel}
      >
        {chipLabel || "Label"}
      </span>
      <div className="relative">
        <button
          id={id}
          title={tooltip}
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition
            ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
            ${
              isOpen
                ? "border-[var(--vscode-badge-background)] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                : "border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
            }
            ${compact ? "text-xs px-1.5 py-0.5" : ""}`}
          onClick={onToggle}
          disabled={disabled}
          aria-expanded={isOpen}
        >
          <span className={`truncate ${compact ? "max-w-[80px]" : "max-w-[140px]"}`}>{label}</span>
          <span className={`transition-transform text-[10px] ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 z-50 mt-0.5 min-w-[180px] rounded-md border shadow-lg"
            style={{
              background: "var(--vscode-dropdown-background, var(--vscode-sideBar-background))",
              borderColor: "var(--vscode-dropdown-border, var(--vscode-widget-border))",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

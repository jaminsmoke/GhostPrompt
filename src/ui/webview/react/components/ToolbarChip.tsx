/**
 * @file Chip reutilizable para toolbar del webview GhostPrompt.
 */
import { type ReactNode, useEffect, useRef } from 'react';

interface ToolbarChipProperties {
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

const getChipLabelClass = (chipLabel: string | undefined, compact?: boolean) =>
  `text-[10px] font-semibold uppercase tracking-[0.15em] leading-tight mb-0.5 ${
    chipLabel && !compact ? 'text-[var(--vscode-descriptionForeground)]' : 'invisible'
  }`;

const renderChipLabel = (chipLabel: string | undefined, compact?: boolean) => {
  const chipLabelClass = getChipLabelClass(chipLabel, compact);
  if (chipLabel) {
    return (
      <span className={chipLabelClass} aria-hidden="false">
        {chipLabel}
      </span>
    );
  }

  return (
    <span className={chipLabelClass} aria-hidden="true">
      Label
    </span>
  );
};

type ToggleButtonRenderOptions = {
  isOpen: boolean;
  id: string | undefined;
  tooltip: string | undefined;
  disabled: boolean | undefined;
  compact: boolean | undefined;
  onToggle: () => void;
  label: string;
};

const renderToggleButton = (options: ToggleButtonRenderOptions) => {
  const { isOpen, id, tooltip, disabled, compact, onToggle, label } = options;
  const buttonClass = `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            ${
              isOpen
                ? 'border-(--vscode-badge-background) bg-(--vscode-badge-background) text-(--vscode-badge-foreground)'
                : 'border-(--vscode-widget-border) bg-(--vscode-sideBar-background) text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground)'
            }
            ${compact ? 'text-xs px-1.5 py-0.5' : ''}`;

  if (isOpen) {
    return (
      <button
        id={id}
        title={tooltip}
        type="button"
        className={buttonClass}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded="true"
      >
        <span className={`truncate ${compact ? 'max-w-20' : 'max-w-35'}`}>{label}</span>
        <span className="transition-transform text-[10px] rotate-180">▾</span>
      </button>
    );
  }

  return (
    <button
      id={id}
      title={tooltip}
      type="button"
      className={buttonClass}
      onClick={onToggle}
      disabled={disabled}
      aria-expanded="false"
    >
      <span className={`truncate ${compact ? 'max-w-20' : 'max-w-35'}`}>{label}</span>
      <span className="transition-transform text-[10px]">▾</span>
    </button>
  );
};

/**
 * Chip de la barra superior que gestiona estados abiertos y eventos de cierre.
 * @param {ToolbarChipProperties} props - Propiedades del componente ToolbarChip.
 * @returns {import('react').JSX.Element} Elemento JSX para el chip de la barra superior.
 */
export function ToolbarChip(props: ToolbarChipProperties) {
  const { label, chipLabel, tooltip, isOpen, onToggle, onClose, children, id, compact, disabled } =
    props;
  const ref = useRef<HTMLDivElement | false>(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current !== false && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    let timer: ReturnType<typeof setTimeout> | false = false;
    if (isOpen) {
      timer = setTimeout(() => {
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKey);
      }, 0);
    }

    return () => {
      if (timer !== false) {
        clearTimeout(timer);
      }
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={ref as unknown as React.Ref<HTMLDivElement>} className="inline-flex flex-col gap-0">
      {renderChipLabel(chipLabel, compact)}
      <div className="relative">
        {renderToggleButton({ isOpen, id, tooltip, disabled, compact, onToggle, label })}

        {isOpen && 
          <div className="absolute top-full left-0 z-50 mt-0.5 min-w-45 rounded-md border border-(--vscode-dropdown-border) bg-(--vscode-dropdown-background) shadow-lg">
            {children}
          </div>
        }
      </div>
    </div>
  );
}

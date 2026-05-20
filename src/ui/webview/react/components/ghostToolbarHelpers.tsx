/**
 * @file Utilidades compartidas del toolbar GhostPrompt.
 */
import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceState,
} from '../types';
import type { ReactNode } from 'react';


export const itemClass =
  'flex w-full items-center justify-between px-3 py-1.5 text-sm text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground) transition';

export const actionButtonClass =
  'rounded px-2 py-0.5 text-xs font-medium transition border ' +
  'border-(--vscode-widget-border) ' +
  'hover:bg-(--vscode-list-hoverBackground)';

export const separatorClass = 'my-1 border-t border-(--vscode-widget-border)';

/**
 * Icono de estado del proveedor en el chip de motor.
 * @param {CompletionSourceState} state - Estado reportado por el host.
 * @returns {string} Carácter/icono mostrado en UI.
 */
export const statusIcon = (state: CompletionSourceState): string => {
  switch (state) {
    case 'running': {
      return '\u25CF';
    }
    case 'stopped': {
      return '\u25CB';
    }
    case 'starting': {
      return '\u25CB';
    }
    case 'unavailable': {
      return '\u2014';
    }
    case 'error': {
      return '\u26A0';
    }
    default: {
      return '\u2014';
    }
  }
};

/**
 * Clase Tailwind del color de estado del proveedor.
 * @param {CompletionSourceState} state - Estado reportado por el host.
 * @returns {string} Clases CSS para el indicador.
 */
export const statusColor = (state: CompletionSourceState): string => {
  switch (state) {
    case 'running': {
      return 'text-green-500';
    }
    case 'stopped': {
      return 'text-gray-400';
    }
    case 'starting': {
      return 'text-yellow-400';
    }
    case 'unavailable': {
      return 'text-gray-500';
    }
    case 'error': {
      return 'text-red-500';
    }
    default: {
      return 'text-gray-500';
    }
  }
};

/**
 * Etiqueta legible del proveedor de completion.
 * @param {CompletionProvider} provider - Identificador del proveedor.
 * @returns {string} Texto mostrado en chips y listas.
 */
export const completionSourceLabel = (provider: CompletionProvider): string => {
  switch (provider) {
    case 'copilot': {
      return 'Copilot LM';
    }
    case 'opencode': {
      return 'OpenCode';
    }
    case 'ollama': {
      return 'Ollama';
    }
    default: {
      return provider;
    }
  }
};

const toggleButton = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs transition ${
    active
      ? 'border-(--vscode-badge-background) bg-(--vscode-badge-background) text-(--vscode-badge-foreground)'
      : 'border-(--vscode-widget-border) text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground)'
  }`;

/**
 * Botón de opción toggle en paneles del toolbar.
 * @param {boolean} active - Si la opción está activa.
 * @param {() => void} onClick - Handler de clic.
 * @param {ReactNode} children - Contenido del botón.
 * @returns {import('react').JSX.Element} Botón con estilo activo/inactivo.
 */
export const renderToggleOption = (
  active: boolean,
  onClick: () => void,
  children: ReactNode,
) => {
  if (active) {
    return (
      <button type="button" className={toggleButton(active)} onClick={onClick} aria-pressed="true">
        {children}
      </button>
    );
  }

  return (
    <button type="button" className={toggleButton(active)} onClick={onClick} aria-pressed="false">
      {children}
    </button>
  );
};

/**
 * Etiqueta legible del destino del agente en el chip de destino.
 * @param {AgentDestination} destination - Destino configurado en el webview.
 * @returns {string} Texto mostrado en el chip.
 */
export function agentDestinationLabel(destination: AgentDestination): string {
  if (destination === 'copilotChat') {
    return 'Copilot Chat';
  }
  if (destination === 'vsOpenCodeX') {
    return 'VSOpenCodeX';
  }
  return 'Cursor Chat';
}

/**
 * Clase de etiqueta de chip según modo compacto.
 * @param {boolean} compact - Si el toolbar está en modo compacto.
 * @returns {string} Clases CSS del label.
 */
export const chipLabelClass = (compact: boolean) => {
  return compact ? 'text-[10px]' : 'text-xs';
};

/**
 * Comprueba si un registro de estado del host corresponde al proveedor UI activo.
 * @param {CompletionProvider} provider - Proveedor de completion en UI.
 * @param {string} statusId - Identificador del estado reportado por el host.
 * @returns {boolean} Si el estado corresponde al proveedor seleccionado.
 */
export function providerStatusMatches(
  provider: CompletionProvider,
  statusId: string,
): boolean {
  if (provider === 'copilot') {
    return statusId === 'copilot';
  }
  if (provider === 'opencode') {
    return statusId === 'opencode';
  }
  return statusId === 'ollama';
}

/**
 * @file Componente de toolbar principal del webview GhostPrompt.
 */
import {
  GhostToolbarComposicionPanel,
  GhostToolbarDestinoPanel,
  GhostToolbarModeloPanel,
  GhostToolbarMotorPanel,
} from './GhostToolbarPanels';
import { ToolbarChip } from './ToolbarChip';
import { useGhostToolbarState } from './useGhostToolbarState';

import type { GhostPromptWebviewSurface } from '../ghostPromptViewIds';
import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceStateRecord,
  SuggestionModel,
} from '../types';

interface GhostToolbarProperties {
  /** `chat`: solo chip Destino. `hub`: Motor, Modelo, Composición y ajustes. */
  surface: GhostPromptWebviewSurface;
  completionProvider: CompletionProvider;
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionModelPolicy: 'anyModel' | 'nonPremiumOnly';
  maxSuggestionChars: number;
  onPreviewMaxSuggestionChars: (value: number) => void;
  onCommitMaxSuggestionChars: (value: number) => void;
  debugSuggestions: boolean;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
  cursorDesktopHost: boolean;
  compact: boolean;
  providerStatuses: CompletionSourceStateRecord[];
  statusLoading: boolean;
  onCompletionProviderChange: (value: CompletionProvider) => void;
  onSelectedModelChange: (value: string) => void;
  onAgentDestinationChange: (value: AgentDestination) => void;
  onToggle: (key: string, value: string) => void;
  onDebugToggle: () => void;
  onStartProvider: (id: string) => void;
  onStopProvider: (id: string) => void;
}

const debugButtonClass =
  'flex w-full items-center justify-between px-3 py-1.5 text-sm ' +
  'text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground) transition';

/**
 * Toolbar de GhostPrompt con controles de modelo, sugerencia y proveedor.
 * @param {GhostToolbarProperties} props - Propiedades del componente GhostToolbar.
 * @returns {import('react').JSX.Element} Elemento JSX del toolbar de GhostPrompt.
 */
export function GhostToolbar(props: GhostToolbarProperties) {
  const {
    surface,
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    maxSuggestionChars,
    onPreviewMaxSuggestionChars,
    onCommitMaxSuggestionChars,
    debugSuggestions,
    agentDestination,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    compact,
    providerStatuses,
    statusLoading,
    onCompletionProviderChange,
    onSelectedModelChange,
    onAgentDestinationChange,
    onToggle,
    onDebugToggle,
    onStartProvider,
    onStopProvider,
  } = props;

  const toolbar = useGhostToolbarState({
    completionProvider,
    selectedModelId,
    availableModels,
    maxSuggestionChars,
    agentDestination,
    providerStatuses,
    onCompletionProviderChange,
    onSelectedModelChange,
    onAgentDestinationChange,
    onToggle,
  });

  return (
    <div className="flex flex-wrap items-start gap-1 mb-2">
      {surface === 'hub' && 
        <ToolbarChip
          id="motor-chip"
          label={toolbar.providerLabelWithStatus}
          chipLabel="Motor"
          tooltip="Motor de sugerencias: Copilot LM, OpenCode u Ollama"
          isOpen={toolbar.openChip === 'motor'}
          onToggle={() => toolbar.toggleChip('motor')}
          onClose={toolbar.closeChips}
          compact={compact}
        >
          <GhostToolbarMotorPanel
            completionProvider={completionProvider}
            providerStatuses={providerStatuses}
            statusLoading={statusLoading}
            onSelectProvider={toolbar.handleProvider}
            onStartProvider={onStartProvider}
            onStopProvider={onStopProvider}
            onClose={toolbar.closeChips}
          />
        </ToolbarChip>
      }

      {surface === 'chat' && 
        <ToolbarChip
          id="destino-chip"
          label={toolbar.destinoLabel}
          chipLabel="Destino"
          tooltip="Destino del prompt: Copilot Chat, VSOpenCodeX o Cursor Chat"
          isOpen={toolbar.openChip === 'destino'}
          onToggle={() => toolbar.toggleChip('destino')}
          onClose={toolbar.closeChips}
          compact={compact}
        >
          <GhostToolbarDestinoPanel
            agentDestination={agentDestination}
            vsOpenCodeXExtensionInstalled={vsOpenCodeXExtensionInstalled}
            cursorDesktopHost={cursorDesktopHost}
            onSelectDestination={toolbar.handleDestino}
          />
        </ToolbarChip>
      }

      {surface === 'hub' && 
        <ToolbarChip
          id="modelo-chip"
          label={toolbar.modeloLabel}
          chipLabel="Modelo"
          tooltip="Modelo de IA y política de suscripción"
          isOpen={toolbar.openChip === 'modelo'}
          onToggle={() => toolbar.toggleChip('modelo')}
          onClose={toolbar.closeChips}
          compact={compact}
        >
          <GhostToolbarModeloPanel
            compact={compact}
            suggestionModelPolicy={suggestionModelPolicy}
            selectedModelId={selectedModelId}
            filteredModels={toolbar.filteredModels}
            currentModelLabel={toolbar.currentModelLabel}
            onTogglePolicy={(value) => toolbar.handleToggle('suggestionModelPolicy', value)}
            onSelectModel={toolbar.handleModel}
          />
        </ToolbarChip>
      }

      {surface === 'hub' && 
        <ToolbarChip
          id="composicion-chip"
          label={toolbar.styleLabel}
          chipLabel="Composición"
          tooltip="Longitud máxima de las pre-sugerencias"
          isOpen={toolbar.openChip === 'composicion'}
          onToggle={() => toolbar.toggleChip('composicion')}
          onClose={toolbar.closeChips}
          compact={compact}
        >
          <GhostToolbarComposicionPanel
            compact={compact}
            maxSuggestionChars={maxSuggestionChars}
            onPreviewMaxSuggestionChars={onPreviewMaxSuggestionChars}
            onCommitMaxSuggestionChars={onCommitMaxSuggestionChars}
          />
        </ToolbarChip>
      }

      {surface === 'hub' && 
        <ToolbarChip
          id="gear-chip"
          label="⚙"
          tooltip="Ajustes adicionales (debug)"
          isOpen={toolbar.openChip === 'gear'}
          onToggle={() => toolbar.toggleChip('gear')}
          onClose={toolbar.closeChips}
          compact={compact}
        >
          <div className="py-1 min-w-40">
            <button
              id="debug-btn"
              type="button"
              className={`${debugButtonClass} ${debugSuggestions ? 'text-(--vscode-badge-foreground)' : ''}`}
              onClick={() => {
                onDebugToggle();
                toolbar.closeChips();
              }}
            >
              <span>Debug</span>
              <span className="text-xs opacity-70">{debugSuggestions ? 'on' : 'off'}</span>
            </button>
          </div>
        </ToolbarChip>
      }
    </div>
  );
}

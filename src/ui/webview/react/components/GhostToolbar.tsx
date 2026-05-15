import { type ReactNode, useMemo, useState } from 'react';
import type {
  AgentDestination,
  CompletionProvider,
  ProviderState,
  ProviderStateRecord,
  SuggestionModel,
} from '../types';
import { ToolbarChip } from './ToolbarChip';

interface GhostToolbarProps {
  completionProvider: CompletionProvider;
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionModelPolicy: 'nonPremiumOnly' | 'anyModel';
  suggestionStyle: 'concise' | 'balanced' | 'detailed';
  debugSuggestions: boolean;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
  cursorDesktopHost: boolean;
  compact: boolean;
  providerStatuses: ProviderStateRecord[];
  statusLoading: boolean;
  onCompletionProviderChange: (value: CompletionProvider) => void;
  onSelectedModelChange: (value: string) => void;
  onAgentDestinationChange: (value: AgentDestination) => void;
  onToggle: (key: string, value: string) => void;
  onDebugToggle: () => void;
  onStartProvider: (id: string) => void;
  onStopProvider: (id: string) => void;
}

const itemClass =
  'flex w-full items-center justify-between px-3 py-1.5 text-sm text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground) transition';

const actionBtnClass =
  'rounded px-2 py-0.5 text-xs font-medium transition border ' +
  'border-(--vscode-widget-border) ' +
  'hover:bg-(--vscode-list-hoverBackground)';

const statusIcon = (s: ProviderState): string => {
  switch (s) {
    case 'running':
      return '\u25CF';
    case 'stopped':
      return '\u25CB';
    case 'starting':
      return '\u25CB';
    case 'unavailable':
      return '\u2014';
    case 'error':
      return '\u26A0';
  }
};

const statusColor = (s: ProviderState): string => {
  switch (s) {
    case 'running':
      return 'text-green-500';
    case 'stopped':
      return 'text-gray-400';
    case 'starting':
      return 'text-yellow-400';
    case 'unavailable':
      return 'text-gray-500';
    case 'error':
      return 'text-red-500';
  }
};

const toggleBtn = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs transition ${
    active
      ? 'border-(--vscode-badge-background) bg-(--vscode-badge-background) text-(--vscode-badge-foreground)'
      : 'border-(--vscode-widget-border) text-(--vscode-sideBar-foreground) hover:bg-(--vscode-list-hoverBackground)'
  }`;

const renderToggleOption = (active: boolean, onClick: () => void, children: ReactNode) => {
  if (active) {
    return (
      <button type="button" className={toggleBtn(active)} onClick={onClick} aria-pressed="true">
        {children}
      </button>
    );
  }

  return (
    <button type="button" className={toggleBtn(active)} onClick={onClick} aria-pressed="false">
      {children}
    </button>
  );
};

const separatorClass = 'my-1 border-t border-(--vscode-widget-border)';

const chipLabelClass = (compact: boolean) => (compact ? 'text-[10px]' : 'text-xs');

/**
 * Toolbar de GhostPrompt con controles de modelo, sugerencia y proveedor.
 * @param {GhostToolbarProps} props Propiedades del componente GhostToolbar.
 * @returns {import('react').JSX.Element} Elemento JSX del toolbar de GhostPrompt.
 */
export function GhostToolbar(props: GhostToolbarProps) {
  const {
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    suggestionStyle,
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
  const [openChip, setOpenChip] = useState<string | null>(null);

  const toggleChip = (id: string) => setOpenChip((p) => (p === id ? null : id));
  const closeChips = () => setOpenChip(null);

  const providerLabel =
    completionProvider === 'copilot'
      ? 'Copilot LM'
      : completionProvider === 'opencode'
        ? 'OpenCode'
        : 'Ollama';

  const currentProviderStatus = providerStatuses.find((s) =>
    completionProvider === 'copilot'
      ? s.id === 'copilot'
      : completionProvider === 'opencode'
        ? s.id === 'opencode'
        : s.id === 'ollama',
  );
  const providerLabelWithStatus = currentProviderStatus
    ? `${statusIcon(currentProviderStatus.status)} ${providerLabel}`
    : providerLabel;

  const filteredModels = useMemo(() => {
    if (completionProvider === 'ollama') {
      return availableModels.filter((m) => m.completionSource === 'ollama');
    }
    if (completionProvider === 'opencode') {
      return availableModels.filter((m) => m.completionSource === 'opencode');
    }
    return availableModels;
  }, [completionProvider, availableModels]);

  const currentModel = filteredModels.find((m) => m.id === selectedModelId);
  const modeloLabel =
    currentModel?.label ?? (selectedModelId === 'auto' ? 'Auto' : selectedModelId);

  const styleLabel =
    suggestionStyle === 'concise' ? 'Breve' : suggestionStyle === 'balanced' ? 'Normal' : 'Extenso';

  const compLabel = styleLabel;

  const handleProvider = (v: CompletionProvider) => {
    onCompletionProviderChange(v);
    closeChips();
  };

  const handleDestino = (v: AgentDestination) => {
    onAgentDestinationChange(v);
    closeChips();
  };

  const handleModel = (v: string) => {
    onSelectedModelChange(v);
    closeChips();
  };

  const handleToggle = (key: string, value: string) => {
    onToggle(key, value);
    closeChips();
  };

  return (
    <div className="flex flex-wrap items-start gap-1 mb-2">
      <ToolbarChip
        id="motor-chip"
        label={providerLabelWithStatus}
        chipLabel="Motor"
        tooltip="Motor de sugerencias: Copilot LM, OpenCode u Ollama"
        isOpen={openChip === 'motor'}
        onToggle={() => toggleChip('motor')}
        onClose={closeChips}
        compact={compact}
      >
        <div className="py-1" data-key="completionProvider">
          {statusLoading ? (
            <div className="px-3 py-2 text-sm text-(--vscode-descriptionForeground)">
              ◌ Comprobando estados...
            </div>
          ) : (
            (['copilot', 'opencode', 'ollama'] as const).map((p) => {
              const pStatus = providerStatuses.find((s) =>
                p === 'copilot'
                  ? s.id === 'copilot'
                  : p === 'opencode'
                    ? s.id === 'opencode'
                    : s.id === 'ollama',
              );
              const isActive = completionProvider === p;
              return (
                <div
                  key={p}
                  className={`${itemClass} flex-col items-stretch gap-1 ${isActive ? 'bg-(--vscode-list-hoverBackground)' : ''}`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() => {
                      handleProvider(p);
                      if (pStatus?.actions?.includes('start')) {
                        onStartProvider(p);
                      }
                      closeChips();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {pStatus && (
                        <span className={`${statusColor(pStatus.status)} text-xs`}>
                          {statusIcon(pStatus.status)}
                        </span>
                      )}
                      <span>
                        {p === 'copilot' ? 'Copilot LM' : p === 'opencode' ? 'OpenCode' : 'Ollama'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {pStatus?.statusText && (
                        <span className="text-[10px] text-(--vscode-descriptionForeground)">
                          {pStatus.statusText}
                        </span>
                      )}
                      {isActive && <span className="text-(--vscode-badge-background)">✓</span>}
                    </span>
                  </button>
                  {pStatus?.actions?.includes('stop') && isActive && p !== 'copilot' && (
                    <button
                      type="button"
                      className={actionBtnClass}
                      onClick={() => {
                        onStopProvider(p);
                        closeChips();
                      }}
                    >
                      ■ Detener
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="destino-chip"
        label={
          agentDestination === 'copilotChat'
            ? 'Copilot Chat'
            : agentDestination === 'vsOpenCodeX'
              ? 'VSOpenCodeX'
              : 'Cursor Chat'
        }
        chipLabel="Destino"
        tooltip="Destino del prompt: Copilot Chat, VSOpenCodeX o Cursor Chat"
        isOpen={openChip === 'destino'}
        onToggle={() => toggleChip('destino')}
        onClose={closeChips}
        compact={compact}
      >
        <div className="py-1" data-key="agentDestination">
          <button type="button" className={itemClass} onClick={() => handleDestino('copilotChat')}>
            <span>Copilot Chat</span>
            {agentDestination === 'copilotChat' && (
              <span className="text-(--vscode-badge-background)">✓</span>
            )}
          </button>
          {vsOpenCodeXExtensionInstalled && (
            <button
              type="button"
              className={itemClass}
              onClick={() => handleDestino('vsOpenCodeX')}
            >
              <span>VSOpenCodeX</span>
              {agentDestination === 'vsOpenCodeX' && (
                <span className="text-(--vscode-badge-background)">✓</span>
              )}
            </button>
          )}
          {cursorDesktopHost && (
            <button type="button" className={itemClass} onClick={() => handleDestino('cursorChat')}>
              <span>Cursor Chat</span>
              {agentDestination === 'cursorChat' && (
                <span className="text-(--vscode-badge-background)">✓</span>
              )}
            </button>
          )}
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="modelo-chip"
        label={modeloLabel}
        chipLabel="Modelo"
        tooltip="Modelo de IA y política de suscripción"
        isOpen={openChip === 'modelo'}
        onToggle={() => toggleChip('modelo')}
        onClose={closeChips}
        compact={compact}
      >
        <div className="p-2 space-y-2 min-w-50">
          <div data-key="suggestionModelPolicy" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Política de modelo</span>
            <div className="flex gap-1">
              {renderToggleOption(
                suggestionModelPolicy === 'nonPremiumOnly',
                () => handleToggle('suggestionModelPolicy', 'nonPremiumOnly'),
                'No premium',
              )}
              {renderToggleOption(
                suggestionModelPolicy === 'anyModel',
                () => handleToggle('suggestionModelPolicy', 'anyModel'),
                'Cualquiera',
              )}
            </div>
          </div>
          <hr className={separatorClass} />
          <div className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Modelo específico</span>
            <select
              id="model-chip-select"
              className="rounded-md border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 py-1 text-sm text-(--vscode-input-foreground) outline-none"
              value={selectedModelId}
              onChange={(e) => handleModel(e.target.value)}
              aria-label="Modelo sugerencias"
            >
              {selectedModelId === '' && (
                <option value="" disabled>
                  Selecciona modelo
                </option>
              )}
              <option value="auto">Auto</option>
              {filteredModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span
              id="model-chip-label"
              className="text-xs text-(--vscode-descriptionForeground)"
              aria-live="polite"
            >
              {currentModel?.label ?? '--'}
            </span>
          </div>
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="composicion-chip"
        label={compLabel}
        chipLabel="Composición"
        tooltip="Estilo de las sugerencias"
        isOpen={openChip === 'composicion'}
        onToggle={() => toggleChip('composicion')}
        onClose={closeChips}
        compact={compact}
      >
        <div className="p-2 space-y-3 min-w-55">
          <div data-key="suggestionStyle" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Estilo</span>
            <div className="flex gap-1">
              {renderToggleOption(
                suggestionStyle === 'concise',
                () => handleToggle('suggestionStyle', 'concise'),
                'Breve',
              )}
              {renderToggleOption(
                suggestionStyle === 'balanced',
                () => handleToggle('suggestionStyle', 'balanced'),
                'Normal',
              )}
              {renderToggleOption(
                suggestionStyle === 'detailed',
                () => handleToggle('suggestionStyle', 'detailed'),
                'Extenso',
              )}
            </div>
          </div>
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="gear-chip"
        label="⚙"
        tooltip="Ajustes adicionales (debug)"
        isOpen={openChip === 'gear'}
        onToggle={() => toggleChip('gear')}
        onClose={closeChips}
        compact={compact}
      >
        <div className="py-1 min-w-40">
          <button
            id="debug-btn"
            type="button"
            className={`${itemClass} ${debugSuggestions ? 'text-(--vscode-badge-foreground)' : ''}`}
            onClick={() => {
              onDebugToggle();
              closeChips();
            }}
          >
            <span>Debug</span>
            <span className="text-xs opacity-70">{debugSuggestions ? 'on' : 'off'}</span>
          </button>
        </div>
      </ToolbarChip>
    </div>
  );
}

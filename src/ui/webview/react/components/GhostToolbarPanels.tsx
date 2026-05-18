/**
 * @file Paneles desplegables de chips del toolbar GhostPrompt.
 */
import { COMPLETION_UI_SOURCE_VALUES } from '../../../../system/internals/protocols/constants/consCompletionUi';

import {
  actionButtonClass,
  chipLabelClass,
  completionSourceLabel,
  itemClass,
  providerStatusMatches,
  renderToggleOption,
  separatorClass,
  statusColor,
  statusIcon,
} from './ghostToolbarHelpers';

import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceStateRecord,
  SuggestionModel,
} from '../types';

interface GhostToolbarMotorPanelProperties {
  completionProvider: CompletionProvider;
  providerStatuses: CompletionSourceStateRecord[];
  statusLoading: boolean;
  onSelectProvider: (provider: CompletionProvider) => void;
  onStartProvider: (id: string) => void;
  onStopProvider: (id: string) => void;
  onClose: () => void;
}

/**
 * Panel del chip Motor (proveedores de completion).
 * @param {GhostToolbarMotorPanelProperties} props - Propiedades del panel.
 * @returns {import('react').JSX.Element} Contenido del chip motor.
 */
export function GhostToolbarMotorPanel(props: GhostToolbarMotorPanelProperties) {
  const {
    completionProvider,
    providerStatuses,
    statusLoading,
    onSelectProvider,
    onStartProvider,
    onStopProvider,
    onClose,
  } = props;

  return (
    <div className="py-1" data-key="completionProvider">
      {statusLoading ? 
        <MotorLoading />
       : 
        COMPLETION_UI_SOURCE_VALUES.map((provider) => 
          <MotorProviderRow
            key={provider}
            provider={provider}
            completionProvider={completionProvider}
            providerStatuses={providerStatuses}
            onSelectProvider={onSelectProvider}
            onStartProvider={onStartProvider}
            onStopProvider={onStopProvider}
            onClose={onClose}
          />
        )
      }
    </div>
  );
}

/**
 * Indicador de carga mientras se consultan estados de proveedores.
 * @returns {import('react').JSX.Element} Fila de loading.
 */
function MotorLoading() {
  return (
    <div className="px-3 py-2 text-sm text-(--vscode-descriptionForeground)">
      ◌ Comprobando estados...
    </div>
  );
}

interface MotorProviderRowProperties {
  provider: CompletionProvider;
  completionProvider: CompletionProvider;
  providerStatuses: CompletionSourceStateRecord[];
  onSelectProvider: (provider: CompletionProvider) => void;
  onStartProvider: (id: string) => void;
  onStopProvider: (id: string) => void;
  onClose: () => void;
}

/**
 * Fila de un proveedor en el panel Motor.
 * @param {MotorProviderRowProperties} props - Estado y callbacks de la fila.
 * @returns {import('react').JSX.Element} Fila del proveedor.
 */
function MotorProviderRow(props: MotorProviderRowProperties) {
  const {
    provider,
    completionProvider,
    providerStatuses,
    onSelectProvider,
    onStartProvider,
    onStopProvider,
    onClose,
  } = props;
  const providerStatus = providerStatuses.find((entry) =>
    providerStatusMatches(provider, entry.id),
  );
  const isActive = completionProvider === provider;

  return (
    <div
      className={`${itemClass} flex-col items-stretch gap-1 ${isActive ? 'bg-(--vscode-list-hoverBackground)' : ''}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => {
          onSelectProvider(provider);
          if (providerStatus?.actions?.includes('start')) {
            onStartProvider(provider);
          }
          onClose();
        }}
      >
        <span className="flex items-center gap-2">
          {providerStatus && 
            <span className={`${statusColor(providerStatus.status)} text-xs`}>
              {statusIcon(providerStatus.status)}
            </span>
          }
          <span>{completionSourceLabel(provider)}</span>
        </span>
        <span className="flex items-center gap-2">
          {providerStatus?.statusText && 
            <span className="text-[10px] text-(--vscode-descriptionForeground)">
              {providerStatus.statusText}
            </span>
          }
          {isActive && <span className="text-(--vscode-badge-background)">✓</span>}
        </span>
      </button>
      {providerStatus?.actions?.includes('stop') && isActive && provider !== 'copilot' && 
        <button
          type="button"
          className={actionButtonClass}
          onClick={() => {
            onStopProvider(provider);
            onClose();
          }}
        >
          ■ Detener
        </button>
      }
    </div>
  );
}

interface GhostToolbarDestinoPanelProperties {
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
  cursorDesktopHost: boolean;
  onSelectDestination: (destination: AgentDestination) => void;
}

/**
 * Panel del chip Destino del agente.
 * @param {GhostToolbarDestinoPanelProperties} props - Propiedades del panel.
 * @returns {import('react').JSX.Element} Contenido del chip destino.
 */
export function GhostToolbarDestinoPanel(props: GhostToolbarDestinoPanelProperties) {
  const {
    agentDestination,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    onSelectDestination,
  } = props;

  return (
    <div className="py-1" data-key="agentDestination">
      <button type="button" className={itemClass} onClick={() => onSelectDestination('copilotChat')}>
        <span>Copilot Chat</span>
        {agentDestination === 'copilotChat' && 
          <span className="text-(--vscode-badge-background)">✓</span>
        }
      </button>
      {vsOpenCodeXExtensionInstalled && 
        <button
          type="button"
          className={itemClass}
          onClick={() => onSelectDestination('vsOpenCodeX')}
        >
          <span>VSOpenCodeX</span>
          {agentDestination === 'vsOpenCodeX' && 
            <span className="text-(--vscode-badge-background)">✓</span>
          }
        </button>
      }
      {cursorDesktopHost && 
        <button type="button" className={itemClass} onClick={() => onSelectDestination('cursorChat')}>
          <span>Cursor Chat</span>
          {agentDestination === 'cursorChat' && 
            <span className="text-(--vscode-badge-background)">✓</span>
          }
        </button>
      }
    </div>
  );
}

interface GhostToolbarModeloPanelProperties {
  compact: boolean;
  suggestionModelPolicy: 'anyModel' | 'nonPremiumOnly';
  selectedModelId: string;
  filteredModels: SuggestionModel[];
  currentModelLabel: string;
  onTogglePolicy: (value: string) => void;
  onSelectModel: (modelId: string) => void;
}

/**
 * Panel del chip Modelo (política y selector).
 * @param {GhostToolbarModeloPanelProperties} props - Propiedades del panel.
 * @returns {import('react').JSX.Element} Contenido del chip modelo.
 */
export function GhostToolbarModeloPanel(props: GhostToolbarModeloPanelProperties) {
  const {
    compact,
    suggestionModelPolicy,
    selectedModelId,
    filteredModels,
    currentModelLabel,
    onTogglePolicy,
    onSelectModel,
  } = props;

  return (
    <ModeloPanelBody
      compact={compact}
      suggestionModelPolicy={suggestionModelPolicy}
      selectedModelId={selectedModelId}
      filteredModels={filteredModels}
      currentModelLabel={currentModelLabel}
      onTogglePolicy={onTogglePolicy}
      onSelectModel={onSelectModel}
    />
  );
}

/**
 * Cuerpo del panel Modelo (política + selector).
 * @param {GhostToolbarModeloPanelProperties} props - Props del panel modelo.
 * @returns {import('react').JSX.Element} Contenido del panel.
 */
function ModeloPanelBody(props: GhostToolbarModeloPanelProperties) {
  const {
    compact,
    suggestionModelPolicy,
    selectedModelId,
    filteredModels,
    currentModelLabel,
    onTogglePolicy,
    onSelectModel,
  } = props;

  return (
    <div className="p-2 space-y-2 min-w-50">
      <div data-key="suggestionModelPolicy" className="flex flex-col gap-1">
        <span className={chipLabelClass(compact)}>Política de modelo</span>
        <PolicyToggles
          suggestionModelPolicy={suggestionModelPolicy}
          onTogglePolicy={onTogglePolicy}
        />
      </div>
      <hr className={separatorClass} />
      <div className="flex flex-col gap-1">
        <span className={chipLabelClass(compact)}>Modelo específico</span>
        <select
          id="model-chip-select"
          className="rounded-md border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 py-1 text-sm text-(--vscode-input-foreground) outline-none"
          value={selectedModelId}
          onChange={(event) => onSelectModel(event.target.value)}
          aria-label="Modelo sugerencias"
        >
          {selectedModelId === '' && 
            <option value="" disabled>
              Selecciona modelo
            </option>
          }
          <option value="auto">Auto</option>
          {filteredModels.map((model) => 
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          )}
        </select>
        <span
          id="model-chip-label"
          className="text-xs text-(--vscode-descriptionForeground)"
          aria-live="polite"
        >
          {currentModelLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Botones de política de modelo en el panel Modelo.
 * @param {object} props - Props del subcomponente.
 * @param {'anyModel' | 'nonPremiumOnly'} props.suggestionModelPolicy - Política activa.
 * @param {(value: string) => void} props.onTogglePolicy - Handler de cambio.
 * @returns {import('react').JSX.Element} Grupo de toggles.
 */
function PolicyToggles(props: {
  suggestionModelPolicy: 'anyModel' | 'nonPremiumOnly';
  onTogglePolicy: (value: string) => void;
}) {
  const { suggestionModelPolicy, onTogglePolicy } = props;
  return (
    <div className="flex gap-1">
      {renderToggleOption(
        suggestionModelPolicy === 'nonPremiumOnly',
        () => onTogglePolicy('nonPremiumOnly'),
        'No premium',
      )}
      {renderToggleOption(
        suggestionModelPolicy === 'anyModel',
        () => onTogglePolicy('anyModel'),
        'Cualquiera',
      )}
    </div>
  );
}

interface GhostToolbarComposicionPanelProperties {
  compact: boolean;
  suggestionStyle: 'balanced' | 'concise' | 'detailed';
  onToggleStyle: (value: string) => void;
}

/**
 * Panel del chip Composición (estilo de sugerencias).
 * @param {GhostToolbarComposicionPanelProperties} props - Propiedades del panel.
 * @returns {import('react').JSX.Element} Contenido del chip composición.
 */
export function GhostToolbarComposicionPanel(props: GhostToolbarComposicionPanelProperties) {
  const { compact, suggestionStyle, onToggleStyle } = props;

  return (
    <div className="p-2 space-y-3 min-w-55">
      <div data-key="suggestionStyle" className="flex flex-col gap-1">
        <span className={chipLabelClass(compact)}>Estilo</span>
        <div className="flex gap-1">
          {renderToggleOption(
            suggestionStyle === 'concise',
            () => onToggleStyle('concise'),
            'Breve',
          )}
          {renderToggleOption(
            suggestionStyle === 'balanced',
            () => onToggleStyle('balanced'),
            'Normal',
          )}
          {renderToggleOption(
            suggestionStyle === 'detailed',
            () => onToggleStyle('detailed'),
            'Extenso',
          )}
        </div>
      </div>
    </div>
  );
}

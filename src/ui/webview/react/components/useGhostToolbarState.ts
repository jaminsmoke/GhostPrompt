/**
 * @file Estado derivado y handlers locales del GhostToolbar.
 */
import { useMemo, useState } from 'react';

import {
  deriveSuggestionLengthLabel,
} from '../webviewProtocolConstants';

import {
  agentDestinationLabel,
  completionSourceLabel,
  providerStatusMatches,
  statusIcon,
} from './ghostToolbarHelpers';

import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceStateRecord,
  SuggestionModel,
} from '../types';

interface GhostToolbarStateInput {
  completionProvider: CompletionProvider;
  selectedModelId: string;
  availableModels: SuggestionModel[];
  maxSuggestionChars: number;
  agentDestination: AgentDestination;
  providerStatuses: CompletionSourceStateRecord[];
  onCompletionProviderChange: (value: CompletionProvider) => void;
  onSelectedModelChange: (value: string) => void;
  onAgentDestinationChange: (value: AgentDestination) => void;
  onToggle: (key: string, value: string) => void;
}

/**
 * Estado de chips abiertos y etiquetas derivadas del toolbar.
 * @param {GhostToolbarStateInput} input - Props del toolbar necesarias para derivar etiquetas.
 * @returns {object} Estado local y handlers con cierre de chips.
 */
export function useGhostToolbarState(input: GhostToolbarStateInput) {
  const {
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
  } = input;

  const [openChip, setOpenChip] = useState('');
  const toggleChip = (id: string) => {
    setOpenChip((previous) => {
      return previous === id ? '' : id;
    });
  };
  const closeChips = () => setOpenChip('');

  const providerLabel = completionSourceLabel(completionProvider);
  const currentProviderStatus = providerStatuses.find((entry) =>
    providerStatusMatches(completionProvider, entry.id),
  );
  const providerLabelWithStatus = currentProviderStatus
    ? `${statusIcon(currentProviderStatus.status)} ${providerLabel}`
    : providerLabel;

  const filteredModels = useMemo(() => {
    if (completionProvider === 'ollama') {
      return availableModels.filter((model) => model.completionSource === 'ollama');
    }
    if (completionProvider === 'opencode') {
      return availableModels.filter((model) => model.completionSource === 'opencode');
    }
    return availableModels;
  }, [completionProvider, availableModels]);

  const currentModel = filteredModels.find((model) => model.id === selectedModelId);
  const modeloLabel =
    currentModel?.label ?? (selectedModelId === 'auto' ? 'Auto' : selectedModelId);
  const currentModelLabel = currentModel?.label ?? '--';

  const lengthLabel = deriveSuggestionLengthLabel(maxSuggestionChars);
  const styleLabel = `${lengthLabel} (${maxSuggestionChars})`;

  const handleProvider = (value: CompletionProvider) => {
    onCompletionProviderChange(value);
    closeChips();
  };

  const handleDestino = (value: AgentDestination) => {
    onAgentDestinationChange(value);
    closeChips();
  };

  const handleModel = (value: string) => {
    onSelectedModelChange(value);
    closeChips();
  };

  const handleToggle = (key: string, value: string) => {
    onToggle(key, value);
    closeChips();
  };

  return {
    openChip,
    toggleChip,
    closeChips,
    providerLabelWithStatus,
    filteredModels,
    modeloLabel,
    currentModelLabel,
    styleLabel,
    lengthLabel,
    destinoLabel: agentDestinationLabel(agentDestination),
    handleProvider,
    handleDestino,
    handleModel,
    handleToggle,
  };
}

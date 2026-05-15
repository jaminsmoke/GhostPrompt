/**
 * @file Reinicio del runtime del host para tests que comparten singletons.
 */
import { resetMultiViewDraftText } from '../../ui/provider/multiViewDraft';

import { resetLastEffectiveSuggestionModel } from './lastEffectiveSuggestionModel';
import { suggestionRequestCoordinator } from './suggestionRequestCoordinator';

/**
 * Reinicia capture, modelo efectivo y borrador compartido.
 */
export function resetGhostPromptHostRuntimeForTests(): void {
  suggestionRequestCoordinator.reset();
  resetLastEffectiveSuggestionModel();
  resetMultiViewDraftText();
}

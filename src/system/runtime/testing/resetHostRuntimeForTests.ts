/**
 * @file Reinicio del runtime del host para tests que comparten singletons.
 */
import { resetMultiViewDraftText } from '../../../ui/provider/multiViewDraft';
import { resetLastEffectiveSuggestionModel } from '../suggest/lastEffectiveSuggestionModel';
import { suggestionRequestCoordinator } from '../suggest/suggestionRequestCoordinator';

/**
 * Reinicia capture, modelo efectivo y borrador compartido.
 */
export function resetGhostPromptHostRuntimeForTests(): void {
  suggestionRequestCoordinator.reset();
  resetLastEffectiveSuggestionModel();
  resetMultiViewDraftText();
}

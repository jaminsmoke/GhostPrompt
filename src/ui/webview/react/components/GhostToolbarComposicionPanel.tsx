/**
 * @file Panel Composición: slider de longitud de pre-suggestion.
 */
import { useEffect, useRef, useState } from 'react';

import {
  deriveSuggestionLengthLabel,
  SUGGESTION_LENGTH_LABELS,
  SUGGESTION_LENGTH_PRESETS,
} from '../webviewProtocolConstants';

import { chipLabelClass, renderToggleOption } from './ghostToolbarHelpers';

const SLIDER_COMMIT_DEBOUNCE_MS = 350;

interface GhostToolbarComposicionPanelProperties {
  compact: boolean;
  maxSuggestionChars: number;
  onPreviewMaxSuggestionChars: (value: number) => void;
  onCommitMaxSuggestionChars: (value: number) => void;
}

/**
 * Panel del chip Composición (longitud de pre-suggestion).
 * @param {GhostToolbarComposicionPanelProperties} props - Propiedades del panel.
 * @returns {import('react').JSX.Element} Contenido del chip composición.
 */
export function GhostToolbarComposicionPanel(props: GhostToolbarComposicionPanelProperties) {
  const { compact, maxSuggestionChars, onPreviewMaxSuggestionChars, onCommitMaxSuggestionChars } =
    props;

  const [draftValue, setDraftValue] = useState(maxSuggestionChars);
  const isPointerDragging = useRef(false);
  const commitTimer = useRef<number | false>(false);
  const lastCommitted = useRef(maxSuggestionChars);

  useEffect(() => {
    setDraftValue(maxSuggestionChars);
    lastCommitted.current = maxSuggestionChars;
  }, [maxSuggestionChars]);

  const clearCommitTimer = () => {
    if (commitTimer.current !== false) {
      globalThis.clearTimeout(commitTimer.current);
      commitTimer.current = false;
    }
  };

  const commitNow = (value: number) => {
    clearCommitTimer();
    if (value === lastCommitted.current) {
      return;
    }
    lastCommitted.current = value;
    onCommitMaxSuggestionChars(value);
  };

  const scheduleCommit = (value: number) => {
    clearCommitTimer();
    commitTimer.current = globalThis.setTimeout(() => {
      commitNow(value);
    }, SLIDER_COMMIT_DEBOUNCE_MS);
  };

  const handleSliderInput = (value: number) => {
    setDraftValue(value);
    onPreviewMaxSuggestionChars(value);
    if (isPointerDragging.current) {
      return;
    }
    scheduleCommit(value);
  };

  useEffect(() => () => clearCommitTimer(), []);

  const lengthLabel = deriveSuggestionLengthLabel(draftValue);

  return (
    <div className="p-2 space-y-3 min-w-55">
      <div data-key="maxSuggestionChars" className="flex flex-col gap-2">
        <span className={chipLabelClass(compact)}>Longitud</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={40}
            max={500}
            step={1}
            value={draftValue}
            className="flex-1 accent-(--vscode-focusBorder)"
            aria-label="Longitud máxima de la sugerencia"
            onPointerDown={() => {
              isPointerDragging.current = true;
            }}
            onPointerUp={() => {
              isPointerDragging.current = false;
              commitNow(draftValue);
            }}
            onPointerCancel={() => {
              isPointerDragging.current = false;
              commitNow(draftValue);
            }}
            onInput={(event) => handleSliderInput(Number(event.currentTarget.value))}
            onBlur={() => commitNow(draftValue)}
          />
          <span className="text-xs tabular-nums min-w-8 text-right">{draftValue}</span>
        </div>
        <span className="text-xs text-(--vscode-descriptionForeground)">{lengthLabel}</span>
        <div className="flex flex-wrap gap-1">
          {SUGGESTION_LENGTH_PRESETS.map((preset, index) =>
            renderToggleOption(
              draftValue === preset,
              () => {
                setDraftValue(preset);
                onPreviewMaxSuggestionChars(preset);
                commitNow(preset);
              },
              SUGGESTION_LENGTH_LABELS[index],
            ),
          )}
        </div>
      </div>
    </div>
  );
}
import type {
  SuggestionLanguageMode,
  SupportedSuggestionLanguage,
} from "./types";

type LanguageConfidence = "low" | "medium" | "high";
const LANGUAGE_DETECTION_MIN_CHARS = 12;

export function detectSuggestionLanguageFromInput(
  input: string,
): SupportedSuggestionLanguage {
  return detectLanguageSignal(input).language;
}

function detectLanguageSignal(input: string): {
  language: SupportedSuggestionLanguage;
  confidence: LanguageConfidence;
} {
  const normalized = input
    .toLowerCase()
    .replace(/[`*_~>#()[\]{}\\/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return { language: "en", confidence: "low" };
  }

  if (/[ñáéíóúü¿¡]/u.test(normalized)) {
    return { language: "es", confidence: "high" };
  }

  const spanishHits = countWordHits(normalized, [
    " de ",
    " la ",
    " el ",
    " en ",
    " que ",
    " para ",
    " con ",
    " una ",
    " un ",
    " por ",
    " como ",
    " quiero ",
    " necesito ",
    " y ",
  ]);
  const englishHits = countWordHits(normalized, [
    " the ",
    " and ",
    " with ",
    " for ",
    " in ",
    " to ",
    " of ",
    " i ",
    " want ",
    " need ",
    " create ",
    " build ",
  ]);

  const language: SupportedSuggestionLanguage =
    spanishHits >= englishHits ? "es" : "en";
  const bestHits = Math.max(spanishHits, englishHits);
  const diff = Math.abs(spanishHits - englishHits);
  const confidence: LanguageConfidence =
    normalized.length < LANGUAGE_DETECTION_MIN_CHARS || bestHits === 0
      ? "low"
      : diff >= 2 && bestHits >= 2
        ? "high"
        : diff >= 1
          ? "medium"
          : "low";
  return { language, confidence };
}

export function resolveSuggestionLanguage(
  mode: SuggestionLanguageMode,
  manualLanguage: SupportedSuggestionLanguage,
  input: string,
  previousEffectiveLanguage?: SupportedSuggestionLanguage,
): SupportedSuggestionLanguage {
  if (mode === "manual") {
    return manualLanguage;
  }
  const signal = detectLanguageSignal(input);
  if (signal.confidence === "high") {
    return signal.language;
  }
  if (signal.confidence === "medium") {
    return signal.language;
  }
  return previousEffectiveLanguage ?? manualLanguage;
}

function countWordHits(text: string, needles: string[]): number {
  const padded = ` ${text} `;
  return needles.reduce((hits, needle) => hits + (padded.includes(needle) ? 1 : 0), 0);
}

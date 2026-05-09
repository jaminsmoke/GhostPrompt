export function normalizeSuggestion(
  rawSuggestion: string,
  userText: string,
  maxChars: number,
): string {
  let normalized = rawSuggestion.replace(/\r\n/g, "\n").trimEnd();
  const prefix = userText.trim();

  if (!normalized) {
    return "";
  }

  if (prefix && normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
    normalized = normalized.slice(prefix.length);
    /* No trimStart: la continuación suele empezar con espacio o \n respecto a la última palabra. */
  } else if (prefix) {
    const overlap = findSuffixPrefixOverlap(prefix, normalized);
    if (overlap > 0) {
      normalized = normalized.slice(overlap);
    } else {
      const trailingWord = getTrailingWord(prefix);
      if (
        trailingWord.length >= 3 &&
        normalized.toLowerCase().startsWith(trailingWord.toLowerCase())
      ) {
        normalized = normalized.slice(trailingWord.length);
      }
    }
  }

  if (!normalized.trim()) {
    return "";
  }

  if (shouldInsertSpaceAfterPunctuation(userText, normalized)) {
    normalized = ` ${normalized}`;
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}

function shouldInsertSpaceAfterPunctuation(userText: string, suggestion: string): boolean {
  if (!suggestion) {
    return false;
  }
  const first = suggestion[0];
  if (/\s/.test(first)) {
    return false;
  }
  if (!/[\p{L}\p{N}_]/u.test(first)) {
    return false;
  }
  if (/\s$/.test(userText)) {
    return false;
  }
  const last = getLastNonWhitespaceChar(userText);
  if (!last) {
    return false;
  }
  return /[:;,.!?]/.test(last);
}

function getLastNonWhitespaceChar(text: string): string {
  const trimmed = text.replace(/\s+$/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed[trimmed.length - 1];
}

function findSuffixPrefixOverlap(left: string, right: string): number {
  const leftLower = left.toLowerCase();
  const rightLower = right.toLowerCase();
  const max = Math.min(leftLower.length, rightLower.length, 80);
  for (let len = max; len >= 3; len -= 1) {
    if (leftLower.slice(-len) === rightLower.slice(0, len)) {
      return len;
    }
  }
  return 0;
}

function getTrailingWord(text: string): string {
  const match = text.match(/[\p{L}\p{N}_]+$/u);
  return match?.[0] ?? "";
}

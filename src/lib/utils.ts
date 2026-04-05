export function compactText(input: string, max = 1200) {
  return input.replace(/\s+/g, " ").trim().slice(0, max);
}

export function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function overlapScore(source: string, target: string) {
  const a = new Set(tokenize(source));
  const b = tokenize(target);

  if (!a.size || !b.length) {
    return 0;
  }

  let hits = 0;
  for (const token of b) {
    if (a.has(token)) {
      hits += 1;
    }
  }

  return hits / b.length;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatModeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

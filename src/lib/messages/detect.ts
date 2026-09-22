/**
 * Basic regex-based contact-info detection — SPEC.md Section 11. Explicitly NOT in scope for
 * P0: OCR, obfuscation detection (spaced-out digits, homoglyphs), or any ML-based approach —
 * see Section 20.
 */
export type DetectedPatternType = 'phone' | 'email' | 'url';

export interface DetectionMatch {
  type: DetectedPatternType;
  text: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s]+)/gi;
const PHONE_REGEX = /(\+?\d[\d\-\s().]{6,}\d)/g;

export function detectContactInfo(content: string): DetectionMatch[] {
  const matches: DetectionMatch[] = [];
  const claimed: Array<[number, number]> = [];

  const record = (regex: RegExp, type: DetectedPatternType) => {
    for (const m of content.matchAll(regex)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = claimed.some(([s, e]) => start < e && end > s);
      if (overlaps) continue;
      claimed.push([start, end]);
      matches.push({ type, text: m[0] });
    }
  };

  record(EMAIL_REGEX, 'email');
  record(URL_REGEX, 'url');
  record(PHONE_REGEX, 'phone');

  return matches;
}

/** Longest matches replaced first so overlapping shorter substrings can't leave remnants. */
export function maskContactInfo(content: string, matches: DetectionMatch[]): string {
  let masked = content;
  const sorted = [...matches].sort((a, b) => b.text.length - a.text.length);
  for (const match of sorted) {
    masked = masked.split(match.text).join('[redacted]');
  }
  return masked;
}

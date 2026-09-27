/** Port of src/lib/messages/detect.ts — SPEC.md Section 11/13: basic regex only, no OCR, no
 * obfuscation detection, no ML. Explicit P0 scope limit, not an oversight. */

const PATTERNS = [
  { type: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'url', regex: /(https?:\/\/[^\s]+)|(\bwww\.[^\s]+)/gi },
  { type: 'phone', regex: /(\+?\d[\d\-\s()]{7,}\d)/g },
];

/** Returns { flagged, maskedContent, matches: [{type, text}] }. content is always delivered
 * (never blocked) — only the counterpart-facing copy gets redacted. */
function scanMessage(content) {
  let maskedContent = content;
  const matches = [];

  for (const { type, regex } of PATTERNS) {
    maskedContent = maskedContent.replace(regex, (match) => {
      matches.push({ type, text: match });
      return '[redacted]';
    });
  }

  return { flagged: matches.length > 0, maskedContent, matches };
}

module.exports = { scanMessage };

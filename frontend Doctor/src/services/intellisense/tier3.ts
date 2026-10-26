// Tier 3 (language-model) helpers: when to ask the model, and how to keep a suggestion alive
// while the doctor types along with it. Pure functions so they're easy to test.

export interface AiSuggestion {
  /** Note text and cursor at the moment the model was asked. */
  text: string;
  cursor: number;
  completion: string;
  provider?: string;
}

/**
 * The part of an AI suggestion still left to accept, or null if it no longer applies.
 * The suggestion survives as long as everything typed since it arrived matches its start
 * (case-insensitive), like editor ghost text. So a reply the doctor "types through" is used, not wasted.
 */
export function aiRemaining(ai: AiSuggestion | null, text: string, cursor: number): string | null {
  if (!ai) return null;
  const typedCount = cursor - ai.cursor;
  if (typedCount < 0 || typedCount >= ai.completion.length) return null;
  if (text.length !== ai.text.length + typedCount) return null;
  if (text.slice(0, ai.cursor) !== ai.text.slice(0, ai.cursor)) return null;
  if (text.slice(cursor) !== ai.text.slice(ai.cursor)) return null;
  if (text.slice(ai.cursor, cursor).toLowerCase() !== ai.completion.slice(0, typedCount).toLowerCase()) return null;
  return ai.completion.slice(typedCount);
}

const MIN_NEW_CHARS = 3;

/**
 * Should we ask the model at this cursor position? Only at the end of a line, at a word or
 * clause boundary, and not again right after the model had nothing to say for nearly the same text.
 */
export function shouldRequest(
  text: string,
  cursor: number,
  lastEmpty: { text: string; cursor: number } | null,
  force: boolean,
): boolean {
  if (text[cursor] !== undefined && text[cursor] !== '\n') return false;
  const line = text.slice(text.lastIndexOf('\n', cursor - 1) + 1, cursor);
  if (line.trim().split(/\s+/).filter(Boolean).length < 2 || line.trimEnd().endsWith(':')) return false;
  if (force) return true;

  // Boundary: just typed a space or clause punctuation. Mid-word pauses are usually the doctor thinking
  // about spelling, and Tier 1 handles word completion much faster.
  if (!/[\s,;]$/.test(line)) return false;

  if (lastEmpty && text.startsWith(lastEmpty.text.slice(0, lastEmpty.cursor)) &&
      cursor - lastEmpty.cursor < MIN_NEW_CHARS && cursor >= lastEmpty.cursor) {
    return false;
  }
  return true;
}

/** Learns the doctor's typing rhythm so we wait "a pause" for this doctor, not a fixed time. */
export class TypingRhythm {
  private gaps: number[] = [];
  private last = 0;
  private static readonly MAX_SAMPLES = 40;
  private static readonly MIN_DELAY_MS = 450;
  private static readonly MAX_DELAY_MS = 1200;
  private static readonly DEFAULT_DELAY_MS = 650;

  keystroke(now: number = performance.now()): void {
    const gap = now - this.last;
    this.last = now;
    if (gap > 0 && gap < 1500) {  // longer gaps are pauses, not rhythm
      this.gaps.push(gap);
      if (this.gaps.length > TypingRhythm.MAX_SAMPLES) this.gaps.shift();
    }
  }

  /** About 3x the doctor's median gap between keys, clamped to a sensible range. */
  delayMs(): number {
    if (this.gaps.length < 8) return TypingRhythm.DEFAULT_DELAY_MS;
    const sorted = [...this.gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Math.round(Math.min(TypingRhythm.MAX_DELAY_MS, Math.max(TypingRhythm.MIN_DELAY_MS, median * 3)));
  }
}

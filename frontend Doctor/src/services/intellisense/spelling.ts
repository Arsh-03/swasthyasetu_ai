// Medical spelling help for the notepad: sound-alike matching so "numonia", "pnuemonia" and
// "diarhea" find Pneumonia / Diarrhoea. Mirrors backend/app/services/intellisense_engine.py.

const SOUND_RULES: [RegExp, string][] = [
  [/^p(?=[nst])/, ''], [/^kn/, 'n'], [/^gn/, 'n'], [/^wr/, 'r'], [/ph/g, 'f'], [/rrh/g, 'r'], [/rh/g, 'r'],
  [/ae/g, 'e'], [/oe/g, 'e'], [/ck/g, 'k'], [/qu/g, 'kw'], [/x/g, 'ks'], [/th/g, 't'], [/y/g, 'i'],
  [/c(?=[ei])/g, 's'], [/c/g, 'k'], [/(.)\1+/g, '$1'],
];

/** Spellings that sound alike get the same key. */
export function soundKey(word: string): string {
  let key = word.toLowerCase();
  for (const [re, repl] of SOUND_RULES) key = key.replace(re, repl);
  return key;
}

/** Edit distance where swapping two adjacent letters counts as one edit. Stops early past `limit`. */
export function boundedOsa(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let val = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) val = Math.min(val, prev2[j - 2] + 1);
      cur.push(val);
      rowMin = Math.min(rowMin, val);
    }
    if (rowMin > limit) return limit + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const SUFFIXES = ['s', 'es', 'ed', 'ing', 'ly', 'al'];
const WORD_RE = /[A-Za-z][A-Za-z'-]+/g;
const MIN_SPELL_LEN = 5;

interface VocabWord { lower: string; display: string; key: string }

export class SpellIndex {
  private words: VocabWord[] = [];
  private byLower = new Map<string, VocabWord>();
  private sortedLower: string[] = [];
  private common: Set<string>;
  private sortedCommon: string[];

  constructor(sources: string[], commonWords: string[]) {
    for (const src of sources) {
      for (const w of src.match(WORD_RE) ?? []) {
        const lower = w.toLowerCase();
        if (lower.length < 4 || this.byLower.has(lower)) continue;
        const entry = { lower, display: w, key: soundKey(lower) };
        this.byLower.set(lower, entry);
        this.words.push(entry);
      }
    }
    this.sortedLower = [...this.byLower.keys()].sort();
    this.common = new Set(commonWords.map(w => w.toLowerCase()));
    this.sortedCommon = [...this.common].sort();
  }

  isKnown(lower: string): boolean {
    if (this.byLower.has(lower) || this.common.has(lower)) return true;
    return SUFFIXES.some(s => lower.endsWith(s) && (this.byLower.has(lower.slice(0, -s.length)) || this.common.has(lower.slice(0, -s.length))));
  }

  /** Vocabulary words that start with `prefix` (exact, case-insensitive), shortest first. */
  wordsStartingWith(prefix: string, limit = 3): string[] {
    const lower = prefix.toLowerCase();
    const out: string[] = [];
    for (let i = lowerBound(this.sortedLower, lower); i < this.sortedLower.length; i++) {
      const w = this.sortedLower[i];
      if (!w.startsWith(lower)) break;
      if (w !== lower) out.push(w);
    }
    return out.sort((a, b) => a.length - b.length).slice(0, limit).map(w => this.byLower.get(w)!.display);
  }

  private isPrefixOfKnown(lower: string): boolean {
    const hit = (list: string[]) => {
      const i = lowerBound(list, lower);
      return i < list.length && list[i].startsWith(lower);
    };
    return hit(this.sortedLower) || hit(this.sortedCommon);
  }

  /** Likely intended word for a finished, misspelled word; null if it looks fine. */
  closestWord(word: string): string | null {
    const lower = word.toLowerCase();
    if (lower.length < MIN_SPELL_LEN || this.isKnown(lower)) return null;
    const key = soundKey(lower);
    const rawLimit = lower.length < 8 ? 1 : 2;
    let best: { score: number; w: VocabWord } | null = null;
    for (const w of this.words) {
      if (w.lower.length < MIN_SPELL_LEN || Math.abs(w.key.length - key.length) > 2) continue;
      const dKey = boundedOsa(key, w.key, 1);
      const dRaw = boundedOsa(lower, w.lower, rawLimit);
      if (dKey <= 1 || dRaw <= rawLimit) {
        const score = Math.min(dKey, dRaw);
        if (!best || score < best.score) best = { score, w };
      }
    }
    return best ? best.w.display : null;
  }

  /** Words the doctor may be trying to type, for a misspelled partial word ("pnuemo" -> Pneumonia). */
  fuzzyPrefix(typed: string, limit = 3): string[] {
    const lower = typed.toLowerCase();
    if (lower.length < 4 || this.isPrefixOfKnown(lower)) return [];
    const key = soundKey(lower);
    const maxD = lower.length <= 5 ? 1 : 2;
    const hits: { d: number; w: VocabWord }[] = [];
    for (const w of this.words) {
      let d = maxD + 1;
      for (let len = key.length - 1; len <= key.length + 1; len++) {
        if (len < 3 || len > w.key.length) continue;
        d = Math.min(d, boundedOsa(key, w.key.slice(0, len), maxD));
      }
      for (let len = lower.length - 1; len <= lower.length + 1; len++) {
        if (len < 3 || len > w.lower.length) continue;
        d = Math.min(d, boundedOsa(lower, w.lower.slice(0, len), maxD));
      }
      if (d <= maxD) hits.push({ d, w });
    }
    return hits
      .sort((a, b) => a.d - b.d || a.w.lower.length - b.w.lower.length)
      .slice(0, limit)
      .map(h => h.w.display);
  }
}

function lowerBound(list: string[], target: string): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

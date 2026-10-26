// Browser-side IntelliSense engine (Tier 1 prefix completion, Tier 2 shorthand, auto-punctuation).
// Runs synchronously from the cached lexicon, so it keeps working when the server is unreachable.
// Context-aware nomenclature scoring runs on the server; `localNomenclature` is the offline fallback.

import type {
  Annotation, Lexicon, LexiconTerm, NomenclatureMatch, NoteSection, RegexRule, ShorthandEntry, Suggestion,
} from './types';
import { SpellIndex } from './spelling';

export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
  /** Present when the edit inserts a coded term (e.g. "dm2" -> Type 2 Diabetes Mellitus). */
  coded?: Omit<Annotation, 'id' | 'start' | 'end'>;
}

const MAX_SUGGESTIONS = 5;
const MAX_TIDY_LINE = 600;
const VITALS_JOIN_RE = /(mmHg|bpm|%|\u00b0[CF]|\/min)(?= +(?:BP|Pulse|SpO2|Temp|RR|HR|Weight|Height|GRBS|RBS)\b)/g;
const RX_LINE_RE = /^(?:tab|tabs|cap|caps|syp|syr|inj|oint|drops?|neb|susp)\.?\s/i;

/** Minimal edits that turn `a` into `b` (character LCS), so unchanged parts of a line stay untouched. */
function lineDiff(a: string, b: string): TextEdit[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const edits: TextEdit[] = [];
  let i = 0;
  let j = 0;
  let open: TextEdit | null = null;
  const flush = () => { if (open) { edits.push(open); open = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
    if (!open) open = { start: i, end: i, replacement: '' };
    if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { open.replacement += b[j]; j++; }
    else { open.end = ++i; }
  }
  flush();
  return edits;
}
const MAX_PHRASE_WORDS = 5;
const OFFLINE_CONFIDENCE_CAP = 0.85; // offline matches are never auto-converted

const SECTION_CATEGORY_BOOST: Record<NoteSection, string> = {
  plan: 'drug',
  labs: 'investigation',
  history: 'diagnosis',
  assessment: 'diagnosis',
  exam: 'finding',
  complaints: 'symptom',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (phrase: string) => `(?<![\\w/-])${escapeRe(phrase).replace(/ /g, '\\s+')}(?![\\w-])`;

function matchCase(insert: string, typed: string): string {
  if (typed && /^[A-Z]/.test(typed) && /^[a-z]/.test(insert)) {
    return insert[0].toUpperCase() + insert.slice(1);
  }
  return insert;
}

/** Phrases: earlier in the lexicon = more common. Other terms: shorter first. */
function tieBreak(term: LexiconTerm, order: number): number {
  return term.category === 'phrase' ? -order * 0.01 : -term.text.length * 0.1;
}

function rangesOverlap(a: number, b: number, ranges: [number, number][]): boolean {
  return ranges.some(([s, e]) => a < e && s < b);
}

export class LocalEngine {
  readonly lexicon: Lexicon;
  private sortedTerms: { key: string; term: LexiconTerm; order: number }[];
  readonly spelling: SpellIndex;
  private shorthand = new Map<string, ShorthandEntry>();
  private shorthandPatterns: { endRe: RegExp; globalRe: RegExp; rule: RegexRule }[];
  private punctuation: { endRe: RegExp; globalRe: RegExp; rule: RegexRule }[];
  private headings: { re: RegExp; section: NoteSection }[];
  private nomenclature: { re: RegExp; entry: Lexicon['nomenclature'][number] }[];

  constructor(lexicon: Lexicon) {
    this.lexicon = lexicon;
    this.sortedTerms = lexicon.terms
      .map((term, order) => ({ key: term.text.toLowerCase(), term, order }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    this.spelling = new SpellIndex(
      [
        ...lexicon.terms.map(t => t.text),
        ...lexicon.shorthand.map(s => s.expansion),
        ...lexicon.nomenclature.flatMap(e => e.candidates.map(c => c.name)),
      ],
      lexicon.common_words ?? [],
    );
    for (const s of lexicon.shorthand) this.shorthand.set(s.abbr.toLowerCase(), s);

    const compile = (rule: RegexRule) => ({
      endRe: new RegExp(`(?:${rule.pattern})$`, rule.flags),
      globalRe: new RegExp(rule.pattern, `${rule.flags}g`),
      rule,
    });
    this.shorthandPatterns = lexicon.shorthand_patterns.map(compile);
    this.punctuation = lexicon.punctuation_rules.map(compile);
    this.headings = lexicon.section_headings.map(h => ({ re: new RegExp(h.pattern, 'i'), section: h.section }));
    this.nomenclature = lexicon.nomenclature.map(entry => {
      const phrases = [...entry.phrases].sort((a, b) => b.length - a.length);
      let guard = '(?!\\s*[:=]?\\s*\\d)';
      if (entry.not_followed_by?.length) {
        guard += `(?!\\s+(?:${entry.not_followed_by.map(escapeRe).join('|')})\\b)`;
      }
      return { re: new RegExp(`(?:${phrases.map(wordRe).join('|')})${guard}`, 'gi'), entry };
    });
  }

  /** Where to add a new line to a section: the end of its last non-empty line (null if no such heading). */
  sectionInsertionPoint(text: string, section: NoteSection): number | null {
    let pos = 0;
    let inSection = false;
    let lastEnd = -1;
    for (const line of text.split('\n')) {
      const lineEnd = pos + line.length;
      const heading = this.headings.find(h => h.re.test(line));
      if (heading) {
        if (inSection) break;
        if (heading.section === section) { inSection = true; lastEnd = lineEnd; }
      } else if (inSection && line.trim()) {
        lastEnd = lineEnd;
      }
      pos = lineEnd + 1;
    }
    return inSection ? lastEnd : null;
  }

  detectSection(text: string, pos: number): NoteSection | null {
    const lines = text.slice(0, pos).split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      for (const h of this.headings) if (h.re.test(lines[i])) return h.section;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Tier 1 + Tier 2 suggestions at the cursor
  // -------------------------------------------------------------------------
  suggest(text: string, cursor: number, force = false): Suggestion[] {
    // Only complete at the end of a word, not in the middle of one.
    if (/[\w/]/.test(text[cursor] ?? '')) return [];
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
    const before = text.slice(lineStart, cursor);
    const out: Suggestion[] = [];

    if (/[\s,;:.]$/.test(before)) {
      // Just finished a word: offer a spelling fix for it, and continue common phrases.
      out.push(...this.correctionAt(before, lineStart));
      if (/\s$/.test(before)) out.push(...this.phraseContinuations(text, before, lineStart, cursor));
    } else {
      const lastWord = before.match(/[A-Za-z0-9/.-]+$/)?.[0] ?? '';
      if (!lastWord) return [];
      out.push(...this.shorthandAt(before, lineStart, cursor));
      if (/[A-Za-z]/.test(lastWord)) {
        out.push(...this.completionsAt(text, before, lineStart, cursor, force ? 1 : 2));
        const alpha = lastWord.match(/[A-Za-z][A-Za-z'-]*$/)?.[0] ?? '';
        if (alpha.length >= 3) out.push(...this.wordCompletions(alpha, cursor));
        // Nothing matches exactly: maybe it's misspelled ("pnuemo" -> Pneumonia).
        if (!out.length && alpha.length >= 4) out.push(...this.fuzzyCompletions(alpha, cursor));
      }
    }
    const seen = new Set<string>();
    return out.filter(s => {
      const k = s.insert.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, MAX_SUGGESTIONS);
  }

  private shorthandAt(before: string, lineStart: number, cursor: number): Suggestion[] {
    const out: Suggestion[] = [];
    // Two-word abbreviations first ("per abd"), then single tokens ("c/o").
    for (const n of [2, 1]) {
      const m = before.match(new RegExp(`(?:^|\\s)((?:\\S+\\s+){${n - 1}}\\S+)$`));
      if (!m) continue;
      const token = m[1];
      const entry = this.shorthand.get(token.toLowerCase().replace(/\s+/g, ' '));
      if (entry) {
        out.push({
          kind: 'shorthand',
          replaceStart: cursor - token.length,
          replaceEnd: cursor,
          insert: entry.expansion,
          label: entry.expansion,
          detail: `Shorthand · ${token}`,
          codes: entry.codes,
          original: token,
        });
      }
    }
    for (const { endRe, rule } of this.shorthandPatterns) {
      const tail = before.slice(-20);
      const m = tail.match(endRe);
      if (m && m.index !== undefined) {
        const start = lineStart + before.length - tail.length + m.index;
        const insert = m[0].replace(new RegExp(rule.pattern, rule.flags), rule.replacement);
        out.push({
          kind: 'shorthand', replaceStart: start, replaceEnd: cursor, insert, label: insert,
          detail: `Shorthand · ${m[0]}`, original: m[0],
        });
      }
    }
    return out;
  }

  private completionsAt(text: string, before: string, lineStart: number, cursor: number, minLen: number): Suggestion[] {
    const section = this.detectSection(text, cursor);
    const boostCategory = section ? SECTION_CATEGORY_BOOST[section] : null;
    const words = [...before.matchAll(/\S+/g)];
    const ranked: { s: Suggestion; score: number }[] = [];

    // Try multi-word prefixes first so "severe head" can match "severe headache"
    // and "patient is suf" can match "patient is suffering from".
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length); n >= 1; n--) {
      const typedStart = lineStart + (words[words.length - n].index ?? 0);
      const typed = text.slice(typedStart, cursor).replace(/\s+/g, ' ');
      // A single word needs a couple of letters; in a phrase ("chest p") one letter is enough.
      if (n === 1 && typed.length < minLen) continue;
      for (const { term, order } of this.prefixLookup(typed.toLowerCase())) {
        const typedRaw = text.slice(typedStart, cursor);
        // Multi-word matches and phrases keep exactly what the doctor typed and only add the rest;
        // single drug/diagnosis words take the vocabulary's spelling and capitalisation.
        const keepTyped = n > 1 || term.category === 'phrase';
        const insert = keepTyped ? typedRaw + term.text.slice(typed.length) : matchCase(term.text, typed);
        ranked.push({
          score: n * 1000 + term.weight + (term.category === boostCategory ? 15 : 0) + tieBreak(term, order),
          s: {
            kind: term.category === 'phrase' ? 'phrase' : 'complete',
            replaceStart: typedStart,
            replaceEnd: cursor,
            insert,
            label: term.text,
            detail: term.codes[0] ? `${term.category} · ${formatCode(term.codes[0])}` : term.category,
            codes: term.codes,
          },
        });
      }
    }
    return ranked.sort((a, b) => b.score - a.score).map(r => r.s);
  }

  /** After a space: continue a common phrase ("patient is " -> "suffering from"). */
  private phraseContinuations(text: string, before: string, lineStart: number, cursor: number): Suggestion[] {
    const words = [...before.matchAll(/\S+/g)];
    const ranked: { s: Suggestion; score: number }[] = [];
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length); n >= 1; n--) {
      const typedStart = lineStart + (words[words.length - n].index ?? 0);
      const typed = text.slice(typedStart, cursor).replace(/\s+/g, ' ');
      if (n === 1 && typed.trim().length < 4) continue;
      for (const { term, order } of this.prefixLookup(typed.toLowerCase())) {
        const rest = term.text.slice(typed.length);
        if (!rest.trim()) continue;
        ranked.push({
          score: n * 1000 + term.weight + tieBreak(term, order),
          s: {
            kind: term.category === 'phrase' ? 'phrase' : 'complete',
            replaceStart: cursor, replaceEnd: cursor, insert: rest,
            // No codes here: the insert is only the tail of the term, not the whole coded span.
            label: term.text, detail: term.category,
          },
        });
      }
    }
    return ranked.sort((a, b) => b.score - a.score).map(r => r.s);
  }

  /** Complete the current word from single vocabulary words ("pneu" -> Pneumonia). */
  private wordCompletions(typed: string, cursor: number): Suggestion[] {
    return this.spelling.wordsStartingWith(typed).map(word => ({
      kind: 'complete' as const,
      replaceStart: cursor - typed.length, replaceEnd: cursor,
      insert: matchCase(word, typed), label: word, detail: 'word',
    }));
  }

  /** The current partial word matches nothing: suggest what the doctor probably means. */
  private fuzzyCompletions(typed: string, cursor: number): Suggestion[] {
    return this.spelling.fuzzyPrefix(typed).map(word => ({
      kind: 'spelling' as const,
      replaceStart: cursor - typed.length, replaceEnd: cursor,
      insert: matchCase(word, typed), label: word, detail: `Did you mean · “${typed}”`, original: typed,
    }));
  }

  /** Spelling fix for the word just finished ("numonia " -> Pneumonia). The trailing space stays. */
  private correctionAt(before: string, lineStart: number): Suggestion[] {
    const m = before.match(/([A-Za-z][A-Za-z'-]*)[\s,;:.]{1,2}$/);
    if (!m || m.index === undefined) return [];
    const fix = this.spelling.closestWord(m[1]);
    if (!fix) return [];
    const start = lineStart + m.index;
    return [{
      kind: 'spelling', replaceStart: start, replaceEnd: start + m[1].length,
      insert: matchCase(fix, m[1]), label: fix, detail: `Fix spelling · “${m[1]}”`, original: m[1],
    }];
  }

  private prefixLookup(prefix: string, limit = 20): { term: LexiconTerm; order: number }[] {
    let lo = 0;
    let hi = this.sortedTerms.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sortedTerms[mid].key < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: { term: LexiconTerm; order: number }[] = [];
    for (let i = lo; i < this.sortedTerms.length && out.length < limit; i++) {
      const { key, term, order } = this.sortedTerms[i];
      if (!key.startsWith(prefix)) break;
      if (key !== prefix) out.push({ term, order });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Auto-punctuation
  // -------------------------------------------------------------------------
  /** Format the text just before the cursor (called after the doctor types space/Enter). */
  formatAt(text: string, cursor: number): TextEdit | null {
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
    const before = text.slice(lineStart, cursor);
    for (const { endRe, rule } of this.punctuation) {
      const m = before.match(endRe);
      if (m && m.index !== undefined) {
        const replacement = m[0].replace(new RegExp(rule.pattern, rule.flags), rule.replacement);
        if (replacement !== m[0]) {
          return { start: lineStart + m.index, end: cursor, replacement };
        }
      }
    }
    return null;
  }

  /** Whole-note formatting pass: vitals/demographics + sentence-start capitalisation. */
  formatAll(text: string, protectedRanges: [number, number][]): TextEdit[] {
    const edits: TextEdit[] = [];
    let lineStart = 0;
    for (const line of text.split('\n')) {
      edits.push(...this.tidyLine(text, lineStart, lineStart + line.length, protectedRanges));
      lineStart += line.length + 1;
    }
    return edits.sort((a, b) => a.start - b.start);
  }

  /**
   * Punctuation and spacing for one finished line, as minimal edits (so coded terms keep their codes):
   * vitals formatting, single spaces, a space after commas and before "(", "mmHg, Pulse" separators,
   * a capital at the start of each sentence, and a full stop at the end. Headings are left alone.
   */
  tidyLine(text: string, start: number, end: number, protectedRanges: [number, number][] = []): TextEdit[] {
    const line = text.slice(start, end);
    if (!line.trim() || line.length > MAX_TIDY_LINE) return [];
    const tidied = this.tidyLineText(line);
    if (tidied === line) return [];
    return lineDiff(line, tidied)
      .map(e => ({ start: start + e.start, end: start + e.end, replacement: e.replacement }))
      .filter(e => !rangesOverlap(e.start, Math.max(e.end, e.start + 1), protectedRanges));
  }

  tidyLineText(line: string): string {
    let prefix = '';
    for (const h of this.headings) {
      const m = line.match(h.re);
      if (m) { prefix = m[0]; break; }
    }
    const rest = line.slice(prefix.length);
    const lead = rest.match(/^\s*(?:(?:[-*\u2022]|\d+[.)])\s+)?/)?.[0] ?? '';   // indentation / list marker
    let core = rest.slice(lead.length);
    if (!core.trim()) return line;
    for (const { globalRe, rule } of this.punctuation) {
      globalRe.lastIndex = 0;
      core = core.replace(globalRe, m => m.replace(new RegExp(rule.pattern, rule.flags), rule.replacement));
    }
    core = core
      .replace(/\b(mmHg|bpm|\/min)(?:[ \t]+\1\b)+/gi, '$1')   // "mmHg mmHg" -> "mmHg"
      .replace(/(\S) {2,}(?=\S)/g, '$1 ')                    // single spaces
      .replace(/ +([,.;!?])/g, '$1')                          // no space before punctuation
      .replace(/([,;])(?=[A-Za-z])/g, '$1 ')                  // space after comma / semicolon
      .replace(/([A-Za-z]{2,})\.(?=[A-Za-z]{2,})/g, '$1. ')   // "no sob.vitals stable" (not "e.g." or 2.5)
      .replace(/([A-Za-z0-9])\((?=[A-Za-z])/g, '$1 (')        // "Infection(provisional)" -> "Infection (provisional)"
      .replace(VITALS_JOIN_RE, '$1,')                         // "mmHg Pulse" -> "mmHg, Pulse"
      .replace(/^([a-z])/, c => c.toUpperCase())              // capital at the start
      .replace(/([.!?] +)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
      .replace(/\s+$/, '');
    // Full stop at the end, except prescription lines ("Tab Paracetamol 650 mg SOS").
    if (/[A-Za-z0-9%)\]\u00b0]$/.test(core) && !RX_LINE_RE.test(core)) core += '.';
    return prefix + lead + core;
  }

  /** Expand every shorthand token in the note. */
  expandAllShorthand(text: string, protectedRanges: [number, number][]): TextEdit[] {
    const edits: TextEdit[] = [];
    const add = (start: number, end: number, replacement: string, entry?: ShorthandEntry) => {
      if (rangesOverlap(start, end, protectedRanges) || edits.some(e => start < e.end && e.start < end)) return;
      const original = text.slice(start, end);
      edits.push({
        start, end, replacement,
        coded: entry?.codes?.length ? {
          kind: 'coded', original, name: replacement, codes: entry.codes, category: entry.category,
          severity: 'routine', confidence: 1, alternatives: [], auto: false,
        } : undefined,
      });
    };
    const multi = [...this.shorthand.values()].sort((a, b) => b.abbr.length - a.abbr.length);
    for (const entry of multi) {
      const re = new RegExp(wordRe(entry.abbr), 'gi');
      for (const m of text.matchAll(re)) add(m.index ?? 0, (m.index ?? 0) + m[0].length, entry.expansion, entry);
    }
    for (const { globalRe, rule } of this.shorthandPatterns) {
      for (const m of text.matchAll(globalRe)) {
        add(m.index ?? 0, (m.index ?? 0) + m[0].length, m[0].replace(new RegExp(rule.pattern, rule.flags), rule.replacement));
      }
    }
    return edits.sort((a, b) => a.start - b.start);
  }

  // -------------------------------------------------------------------------
  // Offline nomenclature fallback: dictionary lookup, ranked by prior only, never auto-converted.
  // -------------------------------------------------------------------------
  localNomenclature(text: string, skipRanges: [number, number][]): NomenclatureMatch[] {
    const found: { start: number; end: number; entry: Lexicon['nomenclature'][number] }[] = [];
    for (const { re, entry } of this.nomenclature) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) found.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, entry });
    }
    found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const taken: [number, number][] = [...skipRanges];
    const out: NomenclatureMatch[] = [];
    for (const f of found) {
      if (rangesOverlap(f.start, f.end, taken)) continue;
      taken.push([f.start, f.end]);
      const cands = [...f.entry.candidates].sort((a, b) => b.prior - a.prior);
      out.push({
        start: f.start,
        end: f.end,
        original: text.slice(f.start, f.end),
        section: this.detectSection(text, f.start),
        confidence: Math.min(OFFLINE_CONFIDENCE_CAP, cands[0].prior),
        auto_convert: false,
        candidates: cands.map(c => ({ name: c.name, codes: c.codes, category: c.category, severity: c.severity, score: c.prior })),
      });
    }
    return out;
  }
}

const CODE_LABELS: Record<string, string> = { SNOMED_CT: 'SNOMED', ICD_10: 'ICD-10', ICD_11: 'ICD-11' };

export function formatCode(c: { system: string; code: string }): string {
  return `${CODE_LABELS[c.system] ?? c.system}: ${c.code}`;
}

/**
 * Keep annotation offsets in sync with a text edit.
 * Annotations before the edit stay; after it shift by the length delta; overlapping ones are dropped.
 * If a coded span was replaced by its original text (Ctrl+Z / revert), it becomes 'dismissed' so the
 * engine doesn't immediately convert it again.
 */
export function shiftAnnotations(anns: Annotation[], oldText: string, newText: string): Annotation[] {
  if (oldText === newText) return anns;
  const maxPrefix = Math.min(oldText.length, newText.length);
  let p = 0;
  while (p < maxPrefix && oldText[p] === newText[p]) p++;
  let s = 0;
  while (s < maxPrefix - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  const oldEditEnd = oldText.length - s;
  const delta = newText.length - oldText.length;

  const out: Annotation[] = [];
  for (const a of anns) {
    if (a.end <= p) {
      out.push(a);
    } else if (a.start >= oldEditEnd) {
      out.push({ ...a, start: a.start + delta, end: a.end + delta });
    } else if ((a.kind === 'coded' || a.kind === 'autocorrect') && newText.slice(a.start, a.start + a.original.length) === a.original) {
      out.push({ ...a, kind: 'dismissed', end: a.start + a.original.length });
    }
  }
  return out;
}

// Connection to the server IntelliSense worker.
// Preference order: WebSocket (live) -> REST /analyze -> offline (caller falls back to LocalEngine).

import { authFetch, getStoredToken } from '../apiClient';
import type { AnalysisResult, CompletionResult, EngineStatus, Lexicon, TermSearchResult, TerminologyInfo, Tier3Info } from './types';

const LEXICON_CACHE_KEY = 'cb_intellisense_lexicon';
const MAX_BACKOFF_MS = 15000;

/** Fetch the lexicon, caching it for offline use. The lexicon holds no patient data. */
export async function loadLexicon(): Promise<Lexicon | null> {
  try {
    const res = await authFetch('/api/v1/intellisense/lexicon');
    if (res.ok) {
      const lexicon = (await res.json()) as Lexicon;
      try { localStorage.setItem(LEXICON_CACHE_KEY, JSON.stringify(lexicon)); } catch { /* storage full/blocked */ }
      return lexicon;
    }
  } catch { /* offline */ }
  try {
    const cached = localStorage.getItem(LEXICON_CACHE_KEY);
    return cached ? (JSON.parse(cached) as Lexicon) : null;
  } catch {
    return null;
  }
}

export interface AnalyzeRequest {
  text: string;
  cursor: number;
  skip_ranges: [number, number][];
}

type ResultHandler = (seq: number, result: AnalysisResult | null, latencyMs: number) => void;
type CompletionHandler = (seq: number, result: CompletionResult | null) => void;

export interface ConnectionHandlers {
  onStatus: (s: EngineStatus) => void;
  onResult: ResultHandler;
  onCompletion: CompletionHandler;
  onTier3: (info: Tier3Info) => void;
  onTerms: (seq: number, result: TermSearchResult | null) => void;
  onTerminology: (info: TerminologyInfo) => void;
}

export class IntelliSenseConnection {
  private ws: WebSocket | null = null;
  private closed = false;
  private backoff = 1000;
  private reconnectTimer: number | undefined;
  private sentAt = new Map<number, number>();
  private restCompletion: AbortController | null = null;
  private readonly encounterId: string;
  private readonly h: ConnectionHandlers;

  constructor(encounterId: string, handlers: ConnectionHandlers) {
    this.encounterId = encounterId;
    this.h = handlers;
    this.connect();
  }

  private onStatus(s: EngineStatus) { this.h.onStatus(s); }
  private onResult(...args: Parameters<ResultHandler>) { this.h.onResult(...args); }

  private connect() {
    if (this.closed) return;
    const token = getStoredToken();
    if (!token) {
      this.onStatus('rest');
      return;
    }
    this.onStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/v1/encounters/${encodeURIComponent(this.encounterId)}/intellisense`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    // Authenticate in the first frame so the token never appears in URLs or server logs.
    ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token }));

    ws.onmessage = (event) => {
      let msg: { type?: string; seq?: number; tier3?: Tier3Info; terminology?: TerminologyInfo } & Partial<AnalysisResult>;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'SESSION_ACK') {
        this.backoff = 1000;
        this.onStatus('live');
        if (msg.tier3) this.h.onTier3(msg.tier3);
        if (msg.terminology) this.h.onTerminology(msg.terminology);
      } else if (msg.type === 'TERM_RESULTS' && typeof msg.seq === 'number') {
        this.h.onTerms(msg.seq, msg as unknown as TermSearchResult);
      } else if (msg.type === 'COMPLETION_PAYLOAD' && typeof msg.seq === 'number') {
        this.h.onCompletion(msg.seq, msg as unknown as CompletionResult);
      } else if (msg.type === 'SUGGESTION_PAYLOAD' && typeof msg.seq === 'number') {
        const sent = this.sentAt.get(msg.seq);
        this.sentAt.delete(msg.seq);
        this.onResult(msg.seq, msg as AnalysisResult, sent ? performance.now() - sent : 0);
      }
    };
    ws.onclose = (event) => {
      this.ws = null;
      if (this.closed) return;
      // 4401/4404: auth or encounter problem; retrying the socket won't help, use REST instead.
      if (event.code === 4401 || event.code === 4404) {
        this.onStatus('rest');
        return;
      }
      this.onStatus('rest');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
  }

  async analyze(seq: number, req: AnalyzeRequest): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sentAt.set(seq, performance.now());
      if (this.sentAt.size > 50) this.sentAt.delete(this.sentAt.keys().next().value as number);
      this.ws.send(JSON.stringify({ type: 'INPUT_DELTA', seq, ...req }));
      return;
    }
    const started = performance.now();
    try {
      const res = await authFetch('/api/v1/intellisense/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, encounter_id: this.encounterId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (!this.ws) this.onStatus('rest');
      this.onResult(seq, (await res.json()) as AnalysisResult, performance.now() - started);
    } catch {
      if (!this.ws) this.onStatus('offline');
      this.onResult(seq, null, 0);
    }
  }

  /** Tier 3: ask the language model to continue the current sentence. */
  async complete(seq: number, text: string, cursor: number): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'COMPLETION_REQUEST', seq, text, cursor }));
      return;
    }
    this.restCompletion?.abort();
    const ctrl = new AbortController();
    this.restCompletion = ctrl;
    try {
      const res = await authFetch('/api/v1/intellisense/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounter_id: this.encounterId, text, cursor }),
        signal: ctrl.signal,
      });
      this.h.onCompletion(seq, res.ok ? ((await res.json()) as CompletionResult) : null);
    } catch {
      if (!ctrl.signal.aborted) this.h.onCompletion(seq, null);
    }
  }

  /** Look up what the doctor is typing in the official terminologies (server's local store). */
  async searchTerms(seq: number, query: string, section: string | null): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'TERM_SEARCH', seq, query, section }));
      return;
    }
    try {
      const params = new URLSearchParams({ q: query });
      if (section) params.set('section', section);
      const res = await authFetch(`/api/v1/terminology/search?${params}`);
      this.h.onTerms(seq, res.ok ? ((await res.json()) as TermSearchResult) : null);
    } catch {
      this.h.onTerms(seq, null);
    }
  }

  /** The doctor typed again before the model answered: stop it generating. */
  cancelCompletion(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'COMPLETION_CANCEL' }));
    this.restCompletion?.abort();
    this.restCompletion = null;
  }

  /** Current Tier 3 status (ready / paused / offline ...). */
  async fetchTier3(): Promise<void> {
    try {
      const res = await authFetch('/api/v1/intellisense/tier3');
      if (res.ok) this.h.onTier3((await res.json()) as Tier3Info);
    } catch { /* offline: keep the last known status */ }
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

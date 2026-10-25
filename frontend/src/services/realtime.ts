// Real-time notifications for the signed-in user (consent requests/decisions, history updates).
// The server only sends each message to the people it concerns, so the connection must sign in first.

import { getStoredToken } from './apiClient';

// Server messages are loosely typed; each listener checks `type`.
export type RealtimeMessage = { type?: string; [key: string]: any };

/** Opens the connection (reconnecting if it drops); returns a function that closes it. */
export function openRealtime(onMessage: (msg: RealtimeMessage) => void): () => void {
  let ws: WebSocket | null = null;
  let timer: number | undefined;
  let retry = 1000;
  let closed = false;

  const connect = () => {
    const token = getStoredToken();
    if (closed || !token) return;                       // not signed in: nothing to listen for
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/telehealth`);
    ws.onopen = () => { retry = 1000; ws?.send(JSON.stringify({ type: 'AUTH', token })); };
    ws.onmessage = (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed */ }
    };
    ws.onclose = (event) => {
      ws = null;
      if (closed || event.code === 4401) return;        // closed by us, or the login was rejected
      timer = window.setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };
  };
  connect();

  return () => { closed = true; window.clearTimeout(timer); ws?.close(); };
}

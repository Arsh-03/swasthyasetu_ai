// Doctor portal: listens for patients calling on any of the doctor's consultations, on every page.

import { useEffect, useRef, useState } from 'react';
import { getStoredToken, wsUrl } from '../backend';
import { startTone } from './ringtone';

export interface LobbyCall {
  encounterId: string;
  patientId: string | null;
  callerName: string;
  video: boolean;
}

export interface DoctorLobby {
  /** A patient calling on a consultation the doctor doesn't have open. */
  ringing: LobbyCall | null;
  /** Forget the ringing call (it was answered by opening its consultation). */
  clear: () => void;
  /** Decline it; the patient is told straight away. */
  decline: () => void;
}

export function useDoctorLobby(enabled: boolean): DoctorLobby {
  const [ringing, setRinging] = useState<LobbyCall | null>(null);
  const retry = useRef(1000);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      const token = getStoredToken();
      if (!token || closed) return;
            ws = new WebSocket(wsUrl(`/ws/v1/doctor/lobby`));
      wsRef.current = ws;
      ws.onopen = () => { retry.current = 1000; ws?.send(JSON.stringify({ type: 'AUTH', token })); };
      ws.onmessage = (event) => {
        let msg: { type?: string; encounter_id?: string; patient_id?: string; caller_name?: string; video?: boolean };
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type === 'INCOMING_CALL' && msg.encounter_id) {
          setRinging({ encounterId: msg.encounter_id, patientId: msg.patient_id ?? null,
            callerName: msg.caller_name || 'Your patient', video: msg.video !== false });
        } else if (msg.type === 'CALL_CANCELLED') {
          setRinging(r => (r && r.encounterId === msg.encounter_id ? null : r));
        }
      };
      ws.onclose = (event) => {
        ws = null;
        if (closed || event.code === 4401) return;
        timer = window.setTimeout(connect, retry.current);
        retry.current = Math.min(retry.current * 2, 15000);
      };
    };
    connect();
    return () => { closed = true; window.clearTimeout(timer); ws?.close(); };
  }, [enabled]);

  // Ring while a lobby call is waiting.
  useEffect(() => (ringing ? startTone('incoming') : undefined), [ringing]);

  return {
    ringing,
    clear: () => setRinging(null),
    decline: () => {
      if (ringing && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CALL_DECLINE', encounter_id: ringing.encounterId }));
      }
      setRinging(null);
    },
  };
}

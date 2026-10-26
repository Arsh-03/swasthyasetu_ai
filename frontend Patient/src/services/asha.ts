// ASHA worker helpers: an offline outbox for visit readings, and the same danger-level check as the server
// (backend/app/routers/vitals.py assess()), so she sees "urgent" even with no network.
import { vault } from './secureVault';
import { patientApi, type AshaReadingItem, type ReadingKind } from './api';

export type Level = 'normal' | 'high' | 'low' | 'urgent';

export function assess(kind: ReadingKind, value: number, value2?: number | null, timing?: string): { level: Level; reason: string } {
  if (kind === 'blood_pressure') {
    const dia = value2 ?? 0;
    if (value >= 180 || dia >= 120) return { level: 'urgent', reason: 'bpUrgent' };
    if (value < 90 || (dia && dia < 60)) return { level: 'low', reason: 'bpLow' };
    if (value >= 140 || dia >= 90) return { level: 'high', reason: 'bpHigh' };
    return { level: 'normal', reason: '' };
  }
  if (kind === 'blood_sugar') {
    if (value < 70) return { level: 'urgent', reason: 'sugarLow' };
    if (value >= 300) return { level: 'urgent', reason: 'sugarVeryHigh' };
    if ((timing === 'fasting' && value >= 126) || (timing !== 'fasting' && value >= 200)) return { level: 'high', reason: 'sugarHigh' };
    return { level: 'normal', reason: '' };
  }
  if (kind === 'temperature') {
    if (value >= 104 || value < 95) return { level: 'urgent', reason: value >= 104 ? 'tempVeryHigh' : 'tempLow' };
    if (value >= 100.4) return { level: 'high', reason: 'tempFever' };
    return { level: 'normal', reason: '' };
  }
  return { level: 'normal', reason: '' };
}

// ---------------------------------------------------------------------------------------------- Outbox
export interface OutboxEntry {
  client_id: string;
  patient_id: string;
  patient_name: string;
  task_id?: string | null;
  items: AshaReadingItem[];
  measured_at: string;
}

const KEY = 'asha_outbox_v1';

async function readAll(): Promise<OutboxEntry[]> {
  try {
    // Encrypted on the phone (patient names + readings): see secureVault.ts
    return JSON.parse((await vault.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}

async function writeAll(entries: OutboxEntry[]): Promise<void> {
  await vault.setItem(KEY, JSON.stringify(entries));
}

export const outbox = {
  list: readAll,
  /** Keep the visit on the phone first: nothing is lost if the network drops. */
  async add(entry: OutboxEntry): Promise<void> {
    await writeAll([...(await readAll()), entry]);
  },
  /** Send what is waiting. A re-send of the same visit is stored once by the server (client_id). */
  async flush(): Promise<{ sent: number; waiting: number; error: boolean }> {
    const entries = await readAll();
    const left: OutboxEntry[] = [];
    let sent = 0;
    let error = false;
    for (const e of entries) {
      try {
        await patientApi.ashaSaveReadings({
          patient_id: e.patient_id, task_id: e.task_id ?? undefined, items: e.items, measured_at: e.measured_at, client_id: e.client_id,
        });
        sent++;
      } catch (err) {
        // A refused visit (e.g. bad value) would never succeed: drop it; a network error: keep it for later.
        const status = (err as { status?: number }).status;
        if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) continue;
        error = true;
        left.push(e);
      }
    }
    await writeAll(left);
    return { sent, waiting: left.length, error };
  },
};

export function newClientId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

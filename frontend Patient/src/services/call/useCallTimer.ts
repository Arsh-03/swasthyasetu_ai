// GENERATED COPY of shared/call/useCallTimer.ts. Do not edit here: edit shared/call/useCallTimer.ts,
// then run `node scripts/sync-call-engine.mjs`.

import { useEffect, useState } from 'react';

/** "m:ss" since the call connected; updates every second. */
export function useCallTimer(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return '';
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

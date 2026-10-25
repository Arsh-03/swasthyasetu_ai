// Backend address and login for the AI features (notepad, consultation calls, AI minutes).
// Uses the same backend and token as the rest of the Doctor portal (services/api.ts).

import { api, API_BASE_URL } from './api';

const ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/** "/api/v1/..." -> full URL on the backend. */
export const apiUrl = (path: string): string => (/^https?:/.test(path) ? path : `${ORIGIN}${path}`);

/** "/ws/v1/..." -> WebSocket URL on the backend. */
export const wsUrl = (path: string): string => `${ORIGIN.replace(/^http/, 'ws')}${path}`;

export const getStoredToken = (): string | null => api.getToken();

/** fetch() with the doctor's login token. */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetch(apiUrl(path), { ...options, headers });
}

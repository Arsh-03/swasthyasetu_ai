// Backend address and login for the consultation call (web build). Same backend and token as
// the rest of the patient app (services/api.ts).

import { patientApi, API_BASE_URL } from './api';

const ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/** "/api/v1/..." -> full URL on the backend. */
export const apiUrl = (path: string): string => (/^https?:/.test(path) ? path : `${ORIGIN}${path}`);

/** "/ws/v1/..." -> WebSocket URL on the backend. */
export const wsUrl = (path: string): string => `${ORIGIN.replace(/^http/, 'ws')}${path}`;

export const getStoredToken = (): string | null => patientApi.getToken();

/** fetch() with the patient's login token. */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetch(apiUrl(path), { ...options, headers });
}

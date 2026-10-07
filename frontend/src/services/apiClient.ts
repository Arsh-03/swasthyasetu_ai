// CareBridge India - Authenticated API Client
// Handles cryptographic Bearer token injection, session validation & RBAC security

export interface CurrentUserProfile {
  user_id: string;
  role: 'patient' | 'doctor';
  full_name?: string;
  display_name?: string;
  abha_address?: string;
  registration_number?: string;
  phone_number?: string;
  specialty?: string;
  preferred_language?: string;
}

export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('carebridge_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token || null;
  } catch {
    return null;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  // Handle unauthorized session
  if (res.status === 401) {
    console.warn("Unauthorized request (401). Token may be expired or invalid.");
  }

  return res;
}

export async function verifyCurrentSession(): Promise<CurrentUserProfile | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await authFetch('/api/v1/auth/me');
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

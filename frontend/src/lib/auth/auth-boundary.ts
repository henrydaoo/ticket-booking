export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    roles: string[];
    branchIds: string[];
    mfaCompleted: boolean;
  };
};

export type AuthProvider = {
  getSession(): Promise<AuthSession | null>;
  clearSession(): Promise<void>;
};

const SESSION_KEY = 'cinema-ticket-booking.session';
const SESSION_EVENT = 'cinema-ticket-booking.session-change';

export function subscribeToSession(onChange: () => void): () => void {
  window.addEventListener(SESSION_EVENT, onChange);
  return () => window.removeEventListener(SESSION_EVENT, onChange);
}

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearStoredSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

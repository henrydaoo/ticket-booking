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

let cachedSession: AuthSession | null | undefined;

function readStoredSession(): AuthSession | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function subscribeToSession(onChange: () => void): () => void {
  const handleSessionChange = () => {
    cachedSession = readStoredSession();
    onChange();
  };
  window.addEventListener(SESSION_EVENT, handleSessionChange);
  return () => window.removeEventListener(SESSION_EVENT, handleSessionChange);
}

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  if (cachedSession === undefined) cachedSession = readStoredSession();
  return cachedSession;
}

export function writeSession(session: AuthSession): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  cachedSession = session;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearStoredSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
  cachedSession = null;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

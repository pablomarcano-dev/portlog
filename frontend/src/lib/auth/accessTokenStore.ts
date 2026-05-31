const STORAGE_KEY = 'portlog_at';
const STORAGE_TS_KEY = 'portlog_at_ts';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function readStorage(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ts = localStorage.getItem(STORAGE_TS_KEY);
    if (!stored || !ts) return null;
    if (Date.now() - Number(ts) > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function writeStorage(t: string | null): void {
  try {
    if (t === null) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, t);
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    }
  } catch {
    // Private browsing or storage quota — silently ignore
  }
}

// Hydrate from storage on module load so the token survives page refreshes
// within the 5-minute window without a round-trip to /auth/refresh.
let token: string | null = readStorage();

const subs = new Set<(t: string | null) => void>();

export const accessTokenStore = {
  get: () => token,
  set: (t: string | null) => {
    token = t;
    writeStorage(t);
    subs.forEach((f) => f(t));
  },
  subscribe: (f: (t: string | null) => void) => {
    subs.add(f);
    return () => subs.delete(f);
  },
};

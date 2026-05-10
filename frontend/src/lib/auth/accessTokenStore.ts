let token: string | null = null;
const subs = new Set<(t: string | null) => void>();

export const accessTokenStore = {
  get: () => token,
  set: (t: string | null) => {
    token = t;
    subs.forEach((f) => f(t));
  },
  subscribe: (f: (t: string | null) => void) => {
    subs.add(f);
    return () => subs.delete(f);
  },
};

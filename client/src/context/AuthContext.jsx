import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

/**
 * Session state. The JWT lives in an httpOnly cookie (invisible to JS), so
 * the client learns who is signed in by asking GET /api/auth/me.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'guest'

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ user: u }) => !cancelled && (setUser(u), setStatus('authenticated')))
      .catch(() => !cancelled && setStatus('guest'));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((u) => {
    setUser(u);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

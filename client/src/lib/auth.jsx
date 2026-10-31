import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.get('/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // If the API says we're not allowed (for example the owner just changed our role), reload who we are
  useEffect(() => {
    window.addEventListener('auth:changed', refresh);
    return () => window.removeEventListener('auth:changed', refresh);
  }, [refresh]);

  const value = useMemo(() => ({
    user,
    loading,
    setUser,
    refresh,
    // can('players.manage') etc. Permissions come from the server (server/src/permissions.js)
    can: (permission) => Boolean(user?.household?.permissions?.includes(permission)),
    signIn: async (email, password) => setUser(await api.post('/auth/signin', { email, password })),
    signUp: async (displayName, email, password) =>
      setUser(await api.post('/auth/signup', { displayName, email, password })),
    signOut: async () => {
      await api.post('/auth/signout');
      setUser(null);
    },
  }), [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

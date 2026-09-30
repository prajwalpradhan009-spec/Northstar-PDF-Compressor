import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth as authApi, ApiError } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Session state.
 *
 * The token never exists in JavaScript — it lives in an HttpOnly cookie set by
 * the server. This context only mirrors who the server says you are.
 *
 * Sessions are deliberately tied to the page load that created them. Reloading
 * the browser must require a fresh sign-in, so the session is never restored
 * from the cookie on boot: a full page load re-mounts this provider, and that
 * mount clears the cookie. Client-side navigation keeps the provider alive, so
 * a user stays signed in while moving around the site.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `loading` covers the initial boot handshake only, so pages do not flash the
  // signed-out navbar before it finishes.
  const [loading, setLoading] = useState(true);
  // Guards against a slow boot handshake clobbering a sign-in that landed first.
  const signedIn = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    // Seal the load: discard whatever cookie this document inherited. This only
    // ever runs on a real page load, which is exactly the behaviour we want.
    // A failure still clears local state — an unreachable server must not leave
    // the UI believing the old session is good.
    authApi
      .logout()
      .catch((error) => {
        if (error?.name !== 'AbortError' && !(error instanceof ApiError)) {
          console.warn('[auth] could not clear the previous session:', error?.message);
        }
      })
      .finally(() => {
        if (controller.signal.aborted || signedIn.current) return;
        setUser(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const signin = useCallback(async (credentials) => {
    signedIn.current = true;
    const data = await authApi.signin(credentials);
    setUser(data.user);
    setLoading(false);
    return data;
  }, []);

  const signup = useCallback(async (payload) => authApi.signup(payload), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear local state even if the network call failed, so the UI never
      // leaves a user believing they are still signed in.
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await authApi.updateProfile(payload);
    setUser(data.user);
    return data;
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), signin, signup, logout, updateProfile, setUser }),
    [user, loading, signin, signup, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

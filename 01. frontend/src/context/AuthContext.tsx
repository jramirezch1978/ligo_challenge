import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/client';
import type { LoginResponse, UserRole } from '../api/types';
import { parseJwtClaims } from '../utils/jwt';

interface AuthContextValue {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'ligo-wallet-token';
const STORAGE_USER_KEY = 'ligo-wallet-username';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem(STORAGE_USER_KEY));

  const login = useCallback(async (usernameInput: string, password: string) => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username: usernameInput, password },
    });
    sessionStorage.setItem(STORAGE_KEY, response.token);
    sessionStorage.setItem(STORAGE_USER_KEY, usernameInput);
    setToken(response.token);
    setUsername(usernameInput);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_USER_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  const claims = useMemo(() => (token ? parseJwtClaims(token) : null), [token]);
  const role = claims?.role ?? null;
  const isAdmin = role === 'ADMIN';

  const value = useMemo<AuthContextValue>(
    () => ({ token, username, role, isAdmin, isAuthenticated: Boolean(token), login, logout }),
    [token, username, role, isAdmin, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

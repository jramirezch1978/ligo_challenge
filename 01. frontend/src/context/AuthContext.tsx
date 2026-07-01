import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/client';
import type { LoginResponse } from '../api/types';

interface AuthContextValue {
  token: string | null;
  username: string | null;
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

  const value = useMemo<AuthContextValue>(
    () => ({ token, username, isAuthenticated: Boolean(token), login, logout }),
    [token, username, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

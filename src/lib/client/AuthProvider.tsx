'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/client/apiClient';

interface CurrentUser {
  id: string;
  email: string;
  role: 'buyer' | 'supplier' | 'admin';
  status: string;
  email_verified_at: string | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchDevRole: (role: 'buyer' | 'supplier' | 'admin') => Promise<CurrentUser>;
}

/** Dev-only convenience: when set, Shell renders buttons to instantly switch between the
 * three seeded demo accounts (see prisma/seed.ts) instead of logging out/in by hand. This is
 * NOT an auth bypass — switching still calls the real /auth/login endpoint with the seeded
 * demo credentials, so the API's normal auth/RBAC checks still apply. Gate it behind an env
 * flag so it never renders unless explicitly enabled for local development. */
export const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

const DEMO_PASSWORD = 'Password123';
const DEMO_CREDENTIALS: Record<'buyer' | 'supplier' | 'admin', { email: string; password: string }> = {
  buyer: { email: 'buyer@wardly.test', password: DEMO_PASSWORD },
  supplier: { email: 'supplier@wardly.test', password: DEMO_PASSWORD },
  admin: { email: 'admin@wardly.test', password: DEMO_PASSWORD },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: CurrentUser }>('/api/users/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ access_token: string; refresh_token: string; user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearTokens();
    setUser(null);
  }, []);

  const switchDevRole = useCallback(
    async (role: 'buyer' | 'supplier' | 'admin') => {
      if (!SKIP_AUTH) throw new Error('switchDevRole is only available when NEXT_PUBLIC_SKIP_AUTH=true.');
      const { email, password } = DEMO_CREDENTIALS[role];
      return login(email, password);
    },
    [login],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, switchDevRole }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

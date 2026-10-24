import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { setUnauthorizedHandler } from "../api/client";
import { getStoredToken, setStoredToken } from "../api/token";
import type { User } from "../api/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<void>;
  logout: (notice?: "password_changed") => void;
  sessionNotice: "password_changed" | null;
  refreshUser: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<"password_changed" | null>(
    null,
  );
  const logout = useCallback(
    (notice?: "password_changed") => {
      setSessionNotice(notice ?? null);
      setStoredToken(null);
      setUser(null);
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    [queryClient],
  );

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await authApi.fetchMe();
    if (getStoredToken() === token) setUser(me);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    void refreshUser()
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await authApi.login(email, password);
      logout();
      setStoredToken(token.access_token);
      await refreshUser();
    },
    [logout, refreshUser],
  );

  const register = useCallback(
    async (email: string, password: string, fullName?: string) => {
      await authApi.register(email, password, fullName ?? null);
      await login(email, password);
    },
    [login],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      sessionNotice,
    }),
    [user, loading, login, register, logout, refreshUser, sessionNotice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth outside AuthProvider");
  return state;
}

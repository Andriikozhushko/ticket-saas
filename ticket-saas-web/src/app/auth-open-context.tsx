"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = { email: string; isAdmin: boolean } | null;

type AuthOpenContextValue = {
  open: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  user: AuthUser;
  setUser: (u: AuthUser) => void;
};

const AuthOpenContext = createContext<AuthOpenContextValue | null>(null);

export function AuthOpenProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: AuthUser;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser>(initialUser ?? null);
  const openAuth = useCallback(() => setOpen(true), []);
  const closeAuth = useCallback(() => setOpen(false), []);

  return (
    <AuthOpenContext.Provider value={{ open, openAuth, closeAuth, user, setUser }}>
      {children}
    </AuthOpenContext.Provider>
  );
}

export function useAuthOpen(): AuthOpenContextValue {
  const ctx = useContext(AuthOpenContext);
  if (!ctx) {
    throw new Error("useAuthOpen must be used within AuthOpenProvider");
  }
  return ctx;
}

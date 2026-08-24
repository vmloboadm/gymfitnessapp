"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Session = {
  id: string;
  equipment_id: string;
  variation_id: string | null;
  name: string;
  variation_name: string | null;
  student_id: string;
  status: "active" | "completed";
  type: "regular" | "super" | "bi" | "tri";
  started_at: string;
  ended_at: string | null;
  meta: Record<string, unknown> | null;
  sets?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  active?: boolean;
};

const SessionContext = createContext<{
  session: Session | null;
  readSession: () => Session | null;
  setSession: (s: Session | null) => void;
  startSession: (s: Session) => void;
  endSession: () => void;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const readSession = useCallback(() => session, [session]);

  const startSession = useCallback((s: Session) => {
    setSession({ ...s, status: "active", active: true });
  }, []);

  const endSession = useCallback(() => setSession(null), []);

  return (
    <SessionContext.Provider
      value={{ session, readSession, setSession, startSession, endSession }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}
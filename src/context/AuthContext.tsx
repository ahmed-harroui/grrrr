import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { GoogleSignInResult, signInWithGoogle, signOutGoogle } from "@/lib/googleAuth";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  /** "Continue with Google": a new account is created on the first time */
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      demoMode: !isSupabaseConfigured,
      signIn: async (email, password) => {
        if (!supabase) return null;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signUp: async (email, password) => {
        if (!supabase) return null;
        const { error } = await supabase.auth.signUp({ email, password });
        return error?.message ?? null;
      },
      signInWithGoogle,
      signOut: async () => {
        await signOutGoogle();
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
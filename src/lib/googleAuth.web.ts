import { supabase } from "@/lib/supabase";

// Web: "Continue with Google" goes through Google's page and back to the site (Supabase OAuth).
// The site's address must be in Supabase > Authentication > URL Configuration > Redirect URLs.

export const googleSignInAvailable = true;

export type GoogleSignInResult = { error: string | null; cancelled?: boolean };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!supabase) return { error: "Supabase is not configured." };
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  return { error: error?.message ?? null };
}

export async function signOutGoogle() {}

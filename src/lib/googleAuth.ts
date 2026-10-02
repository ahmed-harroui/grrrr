import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

// "Continue with Google" on the phones: Android's own account picker (no browser), then the
// Google ID token signs in to Supabase (provider "google", enabled in the Supabase dashboard).
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the OAuth client of type "Web application" of the Google
// Cloud project (the one Supabase uses); the Android OAuth client (package + SHA-1) must exist too.
// The web version is googleAuth.web.ts. Expo Go has no Google Sign-In module.

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const isExpoGo = Constants.executionEnvironment === "storeClient";

export const googleSignInAvailable = Boolean(WEB_CLIENT_ID) && !isExpoGo;

export type GoogleSignInResult = { error: string | null; cancelled?: boolean };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!supabase || !googleSignInAvailable) return { error: "Google Sign-In is not available here." };
  // Loaded here so that Expo Go (without the native module) never imports it.
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = require("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { error: null, cancelled: true };
    const idToken: string | null = response.data.idToken;
    if (!idToken) return { error: "Google did not return an identity token." };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) return { error: error.message };
    await fillProfileFromGoogle(response.data.user.name, response.data.user.photo);
    return { error: null };
  } catch (error: any) {
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) return { error: null, cancelled: true };
    if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { error: "Google Play services are needed to sign in with Google." };
    return { error: error?.message ?? String(error) };
  }
}

/** A new account takes its name and photo from Google (an existing one keeps its own). */
async function fillProfileFromGoogle(name: string | null, photo: string | null) {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", userId).maybeSingle();
  const changes: Record<string, string> = {};
  if (!profile?.display_name && name) changes.display_name = name;
  if (!profile?.avatar_url && photo) changes.avatar_url = photo;
  if (Object.keys(changes).length) await supabase.from("profiles").upsert({ user_id: userId, ...changes }, { onConflict: "user_id" });
}

/** At sign-out: the next "Continue with Google" lets the user pick an account again. */
export async function signOutGoogle() {
  if (!googleSignInAvailable) return;
  try {
    await require("@react-native-google-signin/google-signin").GoogleSignin.signOut();
  } catch {
    // Not signed in with Google.
  }
}

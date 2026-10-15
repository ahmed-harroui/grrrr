import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAuth } from "@/context/AuthContext";
import { googleSignInAvailable } from "@/lib/googleAuth";

import { useTranslation } from "@/i18n/useTranslation";

export default function AuthScreen({ onDemo, onAuthenticated }: { onDemo: () => void; onAuthenticated: () => void }) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // What went wrong, said under the form (an alert is not shown on every device)
  const [message, setMessage] = useState<string | null>(null);

  const explain = (error: string) =>
    /invalid login|invalid credentials/i.test(error)
      ? tx("Email ou mot de passe incorrect.", "Wrong email or password.")
      : /email not confirmed/i.test(error)
        ? tx("Confirme d'abord ton email : ouvre le lien qu'on t'a envoyé.", "Confirm your email first: open the link we sent you.")
        : /password/i.test(error) && /weak|short|least/i.test(error)
          ? tx("Mot de passe trop faible : 6 caractères minimum.", "Password too weak: at least 6 characters.")
          : /rate limit|too many/i.test(error)
            ? tx("Trop d'essais d'affilée. Réessaie dans quelques minutes.", "Too many tries in a row. Try again in a few minutes.")
            : error;

  const submit = async () => {
    setMessage(null);
    if (!email.trim() || password.length < 6) {
      setMessage(tx("Entre un email et un mot de passe de 6 caractères minimum.", "Enter an email and a password of at least 6 characters."));
      return;
    }
    setBusy(true);
    if (!isSignUp) {
      const error = await signIn(email.trim(), password);
      setBusy(false);
      if (error) setMessage(explain(error));
      else onAuthenticated();
      return;
    }
    const error = await signUp(email.trim(), password);
    if (error && /already registered|already exists/i.test(error)) {
      // The email already has an account (made in GRRRR or Care: it is the same one). With the
      // right password that is simply a sign-in; otherwise the sign-in asks for that account's password.
      const signInError = await signIn(email.trim(), password);
      setBusy(false);
      if (!signInError) {
        onAuthenticated();
        return;
      }
      setIsSignUp(false);
      setPassword("");
      setMessage(tx("Cet email a déjà un compte (le même pour GRRRR et GRRR Care). Tape son mot de passe pour te connecter.", "This email already has an account (the same for GRRRR and GRRR Care). Type its password to sign in."));
      return;
    }
    setBusy(false);
    if (error === "CONFIRM_EMAIL") {
      setIsSignUp(false);
      setMessage(tx("Compte créé ! Ouvre le lien reçu par email, puis connecte-toi ici.", "Account created! Open the link we emailed you, then sign in here."));
    } else if (error) setMessage(explain(error));
    else onAuthenticated();
  };

  // A new Google account is created on the first time, then goes to the pet setup like any other.
  const continueWithGoogle = async () => {
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.error) setMessage(tx(`Connexion Google impossible : ${result.error}`, `Google sign-in failed: ${result.error}`));
    else if (!result.cancelled) onAuthenticated();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <Text style={styles.logo}>GR<Text style={styles.logoAccent}>RRR</Text> 🐾</Text>
        <Text style={styles.title}>{isSignUp ? tx("Crée ton univers", "Create your world") : tx("Bienvenue à nouveau", "Welcome back")}</Text>
        <Text style={styles.subtitle}>{tx("Le profil de ton compagnon, ses rencontres, son histoire.", "Your companion's profile, their meetups, their story.")}</Text>
      </View>

      <View style={styles.form}>
        {googleSignInAvailable && (
          <>
            <Pressable style={({ pressed }) => [styles.google, pressed && styles.pressed]} onPress={continueWithGoogle} disabled={busy}>
              <Text style={styles.googleG}>
                <Text style={{ color: "#4285F4" }}>G</Text>
              </Text>
              <Text style={styles.googleText}>{tx("Continuer avec Google", "Continue with Google")}</Text>
            </Pressable>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{tx("ou avec ton email", "or with your email")}</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}
        <Text style={styles.label}>EMAIL</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder={tx("toi@exemple.com", "you@example.com")} placeholderTextColor={colors.grey} style={styles.input} />
        <Text style={styles.label}>{tx("MOT DE PASSE", "PASSWORD")}</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={tx("6 caractères minimum", "At least 6 characters")} placeholderTextColor={colors.grey} style={styles.input} />
        {message && <Text style={styles.message}>{message}</Text>}
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? tx("Un instant...", "One moment...") : isSignUp ? tx("Créer mon compte", "Create my account") : tx("Se connecter", "Sign in")}</Text>
        </Pressable>
        <Pressable onPress={() => { setMessage(null); setIsSignUp((value) => !value); }} style={styles.switchButton}>
          <Text style={styles.switchText}>{isSignUp ? tx("J'ai déjà un compte", "I already have an account") : tx("Créer un compte", "Create an account")}</Text>
        </Pressable>
        <Pressable onPress={onDemo} style={styles.demoButton}>
          <Text style={styles.demoText}>{tx("Découvrir sans compte", "Explore without an account")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream, justifyContent: "center", padding: 24 },
    hero: { marginBottom: 34 },
    logo: { fontFamily: fonts.displayExtra, fontSize: 29, color: colors.dark, marginBottom: 34 },
    logoAccent: { color: colors.coral },
    title: { fontFamily: fonts.displayExtra, fontSize: 31, color: colors.dark },
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.grey, marginTop: 8, maxWidth: 300 },
    form: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 20, borderWidth: 1, borderColor: colors.line },
    label: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.grey, letterSpacing: 0.8, marginBottom: 7, marginTop: 4 },
    input: { height: 48, borderRadius: radii.sm, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.dark, fontFamily: fonts.body, marginBottom: 14 },
    message: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 19, color: colors.coralDark, textAlign: "center", marginTop: 4, marginBottom: 2 },
    primary: { backgroundColor: colors.coral, borderRadius: radii.sm, alignItems: "center", paddingVertical: 15, marginTop: 4 },
    primaryText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 14 },
    pressed: { opacity: 0.82 },
    google: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 50, borderRadius: radii.sm, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADCE0", marginBottom: 4 },
    googleG: { fontFamily: fonts.displayExtra, fontSize: 20 },
    googleText: { fontFamily: fonts.bodySemi, fontSize: 14, color: "#3C4043" },
    divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dividerText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    switchButton: { alignItems: "center", paddingTop: 18 },
    switchText: { color: colors.coralDark, fontFamily: fonts.bodySemi, fontSize: 13 },
    demoButton: { alignItems: "center", paddingTop: 24 },
    demoText: { color: colors.grey, fontFamily: fonts.bodyMedium, fontSize: 12 },
  });
}
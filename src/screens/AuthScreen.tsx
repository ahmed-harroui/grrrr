import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAuth } from "@/context/AuthContext";

import { useTranslation } from "@/i18n/useTranslation";

export default function AuthScreen({ onDemo, onAuthenticated }: { onDemo: () => void; onAuthenticated: () => void }) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert(tx("Informations manquantes", "Missing information"), tx("Entre un email et un mot de passe de 6 caractères minimum.", "Enter an email and a password of at least 6 characters."));
      return;
    }
    setBusy(true);
    const error = isSignUp ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert(tx("Connexion impossible", "Sign-in failed"), error);
    else if (isSignUp) Alert.alert(tx("Compte créé", "Account created"), tx("Vérifie ton email si la confirmation est activée.", "Check your email if confirmation is enabled."));
    else onAuthenticated();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <Text style={styles.logo}>GR<Text style={styles.logoAccent}>RRR</Text> 🐾</Text>
        <Text style={styles.title}>{isSignUp ? tx("Crée ton univers", "Create your world") : tx("Bienvenue à nouveau", "Welcome back")}</Text>
        <Text style={styles.subtitle}>{tx("Le profil de ton compagnon, ses rencontres, son histoire.", "Your companion's profile, their meetups, their story.")}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder={tx("toi@exemple.com", "you@example.com")} placeholderTextColor={colors.grey} style={styles.input} />
        <Text style={styles.label}>{tx("MOT DE PASSE", "PASSWORD")}</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={tx("6 caractères minimum", "At least 6 characters")} placeholderTextColor={colors.grey} style={styles.input} />
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? tx("Un instant...", "One moment...") : isSignUp ? tx("Créer mon compte", "Create my account") : tx("Se connecter", "Sign in")}</Text>
        </Pressable>
        <Pressable onPress={() => setIsSignUp((value) => !value)} style={styles.switchButton}>
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
    primary: { backgroundColor: colors.coral, borderRadius: radii.sm, alignItems: "center", paddingVertical: 15, marginTop: 4 },
    primaryText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 14 },
    pressed: { opacity: 0.82 },
    switchButton: { alignItems: "center", paddingTop: 18 },
    switchText: { color: colors.coralDark, fontFamily: fonts.bodySemi, fontSize: 13 },
    demoButton: { alignItems: "center", paddingTop: 24 },
    demoText: { color: colors.grey, fontFamily: fonts.bodyMedium, fontSize: 12 },
  });
}
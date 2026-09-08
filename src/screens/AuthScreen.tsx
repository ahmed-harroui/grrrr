import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";

export default function AuthScreen({ onDemo, onAuthenticated }: { onDemo: () => void; onAuthenticated: () => void }) {
  const { demoMode, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("Informations manquantes", "Entre un email et un mot de passe de 6 caractères minimum.");
      return;
    }
    setBusy(true);
    const error = isSignUp ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert("Connexion impossible", error);
    else if (isSignUp) Alert.alert("Compte créé", "Vérifie ton email si la confirmation est activée.");
    else onAuthenticated();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <Text style={styles.logo}>GR<Text style={styles.logoAccent}>RRR</Text> 🐾</Text>
        <Text style={styles.title}>{isSignUp ? "Crée ton univers" : "Bienvenue à nouveau"}</Text>
        <Text style={styles.subtitle}>Le profil de ton compagnon, ses rencontres, son histoire.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="toi@exemple.com" placeholderTextColor={colors.grey} style={styles.input} />
        <Text style={styles.label}>MOT DE PASSE</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="6 caractères minimum" placeholderTextColor={colors.grey} style={styles.input} />
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? "Un instant..." : isSignUp ? "Créer mon compte" : "Se connecter"}</Text>
        </Pressable>
        <Pressable onPress={() => setIsSignUp((value) => !value)} style={styles.switchButton}>
          <Text style={styles.switchText}>{isSignUp ? "J'ai déjà un compte" : "Créer un compte"}</Text>
        </Pressable>
        {demoMode && (
          <Pressable onPress={onDemo} style={styles.demoButton}>
            <Text style={styles.demoText}>Continuer en mode démo</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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